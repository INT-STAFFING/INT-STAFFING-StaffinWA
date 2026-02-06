
import React, { useState, useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { LeaveRequest, LeaveStatus, LeaveType } from '../types';
import { isHoliday, getWorkingDaysBetween, formatDateFull, formatDate } from '../utils/dateUtils';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { SpinnerIcon } from '../components/icons';
import ConfirmationModal from '../components/ConfirmationModal';
import { DataTable, ColumnDef } from '../components/DataTable';
import { ExportButton } from '@/components/shared/ExportButton';

/**
 * @file LeavePage.tsx
 * @description Pagina per la gestione delle richieste di assenza (ferie, permessi, malattie).
 */

const buildLeaveRequestPayload = (request: LeaveRequest | Omit<LeaveRequest, 'id'>): LeaveRequest | Omit<LeaveRequest, 'id'> => {
    const basePayload: any = {
        resourceId: request.resourceId,
        typeId: request.typeId,
        startDate: request.startDate,
        endDate: request.endDate,
        status: request.status,
        managerId: request.managerId ?? null,
        approverIds: request.approverIds ?? [],
        notes: request.notes ?? '',
        isHalfDay: request.isHalfDay ?? false,
    };

    // Preserve version for optimistic locking
    if (request.version !== undefined) {
        basePayload.version = request.version;
    }

    if ('id' in request) {
        return { id: request.id, ...basePayload };
    }

    return basePayload;
};

const LeavePage: React.FC = () => {
    const { 
        leaveRequests, resources, leaveTypes, companyCalendar, 
        addLeaveRequest, updateLeaveRequest, deleteLeaveRequest, 
        isActionLoading, managerResourceIds, loading 
    } = useEntitiesContext();
    const { user, isAdmin } = useAuth();

    // View State
    const [view, setView] = useState<'table' | 'card' | 'calendar'>('table');
    const [calendarDate, setCalendarDate] = useState(new Date());
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRequest, setEditingRequest] = useState<LeaveRequest | Omit<LeaveRequest, 'id'> | null>(null);
    const [requestToDelete, setRequestToDelete] = useState<LeaveRequest | null>(null);

    // Filters
    const [filters, setFilters] = useState({ resourceId: '', typeId: '', status: '' });

    const currentUserResource = useMemo(() => resources.find(r => r.id === user?.resourceId), [resources, user]);

    // --- Data Preparation ---

    // Base set of requests visible to the user (Security Layer)
    const accessibleRequests = useMemo(() => {
        return leaveRequests.filter(req => {
            if (isAdmin) return true;
            // User can see own requests
            if (req.resourceId === user?.resourceId) return true;
            
            // Approvers can see requests assigned to them
            if (req.approverIds?.includes(user?.resourceId || '')) return true;
            
            // Public Calendar Logic: 
            // Managers/Directors can see APPROVED requests of everyone (Team Calendar).
            // SIMPLE users can ONLY see their own requests (already filtered above).
            if (user?.role !== 'SIMPLE' && req.status === 'APPROVED') return true;
            
            return false;
        });
    }, [leaveRequests, isAdmin, user]);

    // Calculate KPIs based on accessible requests
    const kpis = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return {
            pending: accessibleRequests.filter(r => r.status === 'PENDING').length,
            approved: accessibleRequests.filter(r => r.status === 'APPROVED').length,
            rejected: accessibleRequests.filter(r => r.status === 'REJECTED').length,
            onLeaveToday: accessibleRequests.filter(r => r.status === 'APPROVED' && today >= r.startDate && today <= r.endDate).length
        };
    }, [accessibleRequests]);

    // Apply UI Filters on top of accessible requests
    const filteredRequests = useMemo(() => {
        return accessibleRequests.filter(req => {
            if (filters.resourceId && req.resourceId !== filters.resourceId) return false;
            if (filters.typeId && req.typeId !== filters.typeId) return false;
            if (filters.status && req.status !== filters.status) return false;
            return true;
        });
    }, [accessibleRequests, filters]);

    const enrichedRequests = useMemo(() => {
        return filteredRequests.map(req => {
            const resource = resources.find(r => r.id === req.resourceId);
            const type = leaveTypes.find(t => t.id === req.typeId);
            const duration = getWorkingDaysBetween(new Date(req.startDate), new Date(req.endDate), companyCalendar, resource?.location || null);
            
            return {
                ...req,
                resourceName: resource?.name || 'Sconosciuto',
                typeName: type?.name || 'Sconosciuto',
                typeColor: type?.color || '#ccc',
                duration: req.isHalfDay ? 0.5 : duration
            };
        });
    }, [filteredRequests, resources, leaveTypes, companyCalendar]);

    const exportData = useMemo(() => {
        const statusMap: Record<string, string> = { 'APPROVED': 'Approvata', 'PENDING': 'In Attesa', 'REJECTED': 'Rifiutata' };
        return enrichedRequests.map(r => ({
            'Risorsa': r.resourceName,
            'Tipologia': r.typeName,
            'Data Inizio': formatDateFull(r.startDate),
            'Data Fine': formatDateFull(r.endDate),
            'Durata (gg)': r.duration,
            'Stato': statusMap[r.status] || r.status,
            'Note': r.notes || ''
        }));
    }, [enrichedRequests]);

    // --- Calendar Logic ---
    
    const calendarGrid = useMemo(() => {
        // Use UTC components to ensure month grid is stable across timezones
        const year = calendarDate.getUTCFullYear();
        const month = calendarDate.getUTCMonth();
        
        const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
        
        // Calculate start date (Monday)
        const startDate = new Date(firstDayOfMonth);
        const dayOfWeek = startDate.getUTCDay(); 
        const diff = startDate.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        startDate.setUTCDate(diff);

        const days = [];
        const currentDay = new Date(startDate);
        
        // 6 weeks grid
        for (let i = 0; i < 42; i++) {
            const y = currentDay.getUTCFullYear();
            const m = String(currentDay.getUTCMonth() + 1).padStart(2, '0');
            const d = String(currentDay.getUTCDate()).padStart(2, '0');
            const dateIso = `${y}-${m}-${d}`;

            const isCurrentMonth = currentDay.getUTCMonth() === month;
            
            // Find leaves for this day
            const dayLeaves = filteredRequests.filter(req => 
                dateIso >= req.startDate && dateIso <= req.endDate && req.status !== 'REJECTED'
            );

            // isHoliday helper already uses UTC internally
            const holiday = isHoliday(currentDay, null, companyCalendar);
            
            days.push({
                date: new Date(currentDay),
                dateIso,
                isCurrentMonth,
                leaves: dayLeaves,
                isHoliday: holiday,
                isWeekend: currentDay.getUTCDay() === 0 || currentDay.getUTCDay() === 6
            });
            // Increment by exactly 24 hours in UTC terms
            currentDay.setUTCDate(currentDay.getUTCDate() + 1);
        }
        return days;
    }, [calendarDate, filteredRequests, companyCalendar]);

    // --- Handlers ---

    // Navigation uses pure UTC arithmetic
    const handlePrevMonth = () => setCalendarDate(new Date(Date.UTC(calendarDate.getUTCFullYear(), calendarDate.getUTCMonth() - 1, 1)));
    const handleNextMonth = () => setCalendarDate(new Date(Date.UTC(calendarDate.getUTCFullYear(), calendarDate.getUTCMonth() + 1, 1)));
    
    // Reset to "Today" - Extract current UTC components to set state
    const handleToday = () => {
        const now = new Date();
        setCalendarDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
    };

    const openNewRequestModal = () => {
        setEditingRequest({
            resourceId: currentUserResource?.id || '',
            typeId: leaveTypes[0]?.id || '',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            status: 'PENDING',
            notes: '',
            isHalfDay: false,
            approverIds: []
        });
        setIsModalOpen(true);
    };

    const openEditRequestModal = (req: LeaveRequest) => {
        const sanitizedRequest = buildLeaveRequestPayload(req);
        setEditingRequest({ ...sanitizedRequest });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRequest) return;
        
        try {
            const requestPayload = buildLeaveRequestPayload(editingRequest);
            if ('id' in requestPayload) {
                await updateLeaveRequest(requestPayload as LeaveRequest);
            } else {
                await addLeaveRequest(requestPayload as Omit<LeaveRequest, 'id'>);
            }
            setIsModalOpen(false);
            setEditingRequest(null);
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async () => {
        if (requestToDelete) {
            await deleteLeaveRequest(requestToDelete.id!);
            setRequestToDelete(null);
        }
    };

    const handleQuickAction = async (req: any, newStatus: LeaveStatus) => {
        try {
            const payload: LeaveRequest = {
                id: req.id,
                resourceId: req.resourceId,
                typeId: req.typeId,
                startDate: req.startDate,
                endDate: req.endDate,
                status: newStatus,
                managerId: user?.resourceId || null,
                approverIds: req.approverIds,
                notes: req.notes,
                isHalfDay: req.isHalfDay,
                version: req.version
            };
            await updateLeaveRequest(payload);
        } catch (e) {
            console.error("Failed quick action", e);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        if (!editingRequest) return;
        const { name, value, type } = e.target;
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        setEditingRequest({ ...editingRequest, [name]: val });
    };

    const handleSelectChange = (name: string, value: string) => {
        if(editingRequest) setEditingRequest({ ...editingRequest, [name]: value });
    };

    const handleApproversChange = (name: string, values: string[]) => {
        if(editingRequest) setEditingRequest({ ...editingRequest, [name]: values });
    };

    const handleFilterClick = (status: string) => {
        setFilters(prev => ({ ...prev, status: prev.status === status ? '' : status }));
    };

    // --- Render Components ---

    const resourceOptions = useMemo(() => resources.filter(r => !r.resigned).map(r => ({ value: r.id!, label: r.name })), [resources]);
    const typeOptions = useMemo(() => leaveTypes.map(t => ({ value: t.id!, label: t.name })), [leaveTypes]);
    const managerOptions = useMemo(() => resources.filter(r => managerResourceIds.includes(r.id!) && !r.resigned).map(r => ({ value: r.id!, label: r.name })), [resources, managerResourceIds]);
    const statusOptions: {value: LeaveStatus, label: string}[] = [
        { value: 'PENDING', label: 'In Attesa' },
        { value: 'APPROVED', label: 'Approvata' },
        { value: 'REJECTED', label: 'Rifiutata' }
    ];

    const columns: ColumnDef<any>[] = [
        { header: 'Risorsa', sortKey: 'resourceName', cell: r => <span className="font-medium text-on-surface sticky left-0 bg-inherit pl-6">{r.resourceName}</span> },
        { header: 'Tipologia', sortKey: 'typeName', cell: r => (
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: `${r.typeColor}30`, color: '#191c1e' }}>
                {r.typeName}
            </span>
        )},
        { header: 'Inizio', sortKey: 'startDate', cell: r => formatDateFull(r.startDate) },
        { header: 'Fine', sortKey: 'endDate', cell: r => formatDateFull(r.endDate) },
        { header: 'GG', sortKey: 'duration', cell: r => <span className="font-bold">{r.duration}</span> },
        { header: 'Stato', sortKey: 'status', cell: r => (
            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter ${r.status === 'APPROVED' ? 'bg-tertiary-container text-on-tertiary-container' : r.status === 'REJECTED' ? 'bg-error-container text-on-error-container' : 'bg-yellow-container text-on-yellow-container'}`}>
                {r.status}
            </span>
        )},
    ];

    const renderRow = (req: any) => {
        const canApprove = !isAdmin && req.status === 'PENDING' && req.approverIds?.includes(user?.resourceId || '');
        const canEdit = isAdmin || (req.resourceId === user?.resourceId && req.status === 'PENDING');
        const isSaving = isActionLoading(`updateLeaveRequest-${req.id}`);

        return (
            <tr key={req.id} className="hover:bg-surface-container-low transition-colors">
                {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant bg-inherit">{col.cell(req)}</td>)}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium bg-inherit">
                    <div className="flex items-center justify-end gap-2">
                        {canApprove && (
                            <>
                                <button onClick={() => handleQuickAction(req, 'APPROVED')} disabled={isSaving} className="p-2 rounded-full text-tertiary hover:bg-tertiary-container transition-colors" title="Approva"><span className="material-symbols-outlined">check_circle</span></button>
                                <button onClick={() => handleQuickAction(req, 'REJECTED')} disabled={isSaving} className="p-2 rounded-full text-error hover:bg-error-container transition-colors" title="Rifiuta"><span className="material-symbols-outlined">cancel</span></button>
                            </>
                        )}
                        {canEdit && (
                            <>
                                <button onClick={() => openEditRequestModal(req)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors" title="Modifica"><span className="material-symbols-outlined">edit</span></button>
                                <button onClick={() => setRequestToDelete(req)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-error transition-colors" title="Elimina"><span className="material-symbols-outlined">delete</span></button>
                            </>
                        )}
                    </div>
                </td>
            </tr>
        );
    };

    const renderMobileCard = (req: any) => {
        const canApprove = !isAdmin && req.status === 'PENDING' && req.approverIds?.includes(user?.resourceId || '');
        const canEdit = isAdmin || (req.resourceId === user?.resourceId && req.status === 'PENDING');

        return (
            <div key={req.id} className="bg-surface rounded-2xl shadow p-4 border border-outline-variant flex flex-col gap-3">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-on-surface">{req.resourceName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="w-2 h-2 rounded-full" style={{backgroundColor: req.typeColor}}></span>
                            <span className="text-xs text-on-surface-variant font-medium">{req.typeName}</span>
                        </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${req.status === 'APPROVED' ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-yellow-container text-on-yellow-container'}`}>{req.status}</span>
                </div>
                <div className="text-xs font-mono text-on-surface-variant bg-surface-container-low p-2 rounded-lg">
                    {formatDateFull(req.startDate)} → {formatDateFull(req.endDate)} ({req.duration}gg)
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant">
                    {canApprove && (
                        <div className="flex gap-2 mr-auto">
                            <button onClick={() => handleQuickAction(req, 'APPROVED')} className="text-tertiary font-bold text-xs uppercase">Approva</button>
                            <button onClick={() => handleQuickAction(req, 'REJECTED')} className="text-error font-bold text-xs uppercase">Rifiuta</button>
                        </div>
                    )}
                    {canEdit && (
                        <>
                            <button onClick={() => openEditRequestModal(req)} className="text-primary font-bold text-xs uppercase">Modifica</button>
                            <button onClick={() => setRequestToDelete(req)} className="text-error font-bold text-xs uppercase">Elimina</button>
                        </>
                    )}
                </div>
            </div>
        );
    };

    const filtersNode = (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <SearchableSelect name="resourceId" value={filters.resourceId} onChange={(_, v) => setFilters(f => ({...f, resourceId: v}))} options={resourceOptions} placeholder="Tutte le Risorse"/>
            <SearchableSelect name="typeId" value={filters.typeId} onChange={(_, v) => setFilters(f => ({...f, typeId: v}))} options={typeOptions} placeholder="Tutte le Tipologie"/>
            <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                <ExportButton data={exportData} title="Richieste Assenza" />
                <button onClick={() => setFilters({ resourceId: '', typeId: '', status: '' })} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full text-sm font-bold hover:opacity-90">Reset Filtri</button>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 pb-20 md:pb-0">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-on-surface">Gestione Assenze</h1>
                <div className="flex items-center gap-2">
                    <div className="flex bg-surface-container p-1 rounded-full">
                        <button onClick={() => setView('table')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${view === 'table' ? 'bg-surface shadow text-primary' : 'text-on-surface-variant'}`}>Tabella</button>
                        <button onClick={() => setView('calendar')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${view === 'calendar' ? 'bg-surface shadow text-primary' : 'text-on-surface-variant'}`}>Calendario</button>
                    </div>
                    <button onClick={openNewRequestModal} className="px-6 py-2 bg-primary text-on-primary rounded-full font-bold shadow-lg hover:opacity-90 flex items-center gap-2">
                        <span className="material-symbols-outlined">add</span> Nuova Richiesta
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div onClick={() => handleFilterClick('PENDING')} className={`p-4 rounded-3xl border transition-all cursor-pointer ${filters.status === 'PENDING' ? 'bg-yellow-container border-yellow-500 scale-105' : 'bg-surface border-outline-variant hover:bg-surface-container'}`}>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">In Attesa</p>
                    <p className="text-3xl font-black text-on-surface">{kpis.pending}</p>
                </div>
                <div onClick={() => handleFilterClick('APPROVED')} className={`p-4 rounded-3xl border transition-all cursor-pointer ${filters.status === 'APPROVED' ? 'bg-tertiary-container border-tertiary scale-105' : 'bg-surface border-outline-variant hover:bg-surface-container'}`}>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Approvate</p>
                    <p className="text-3xl font-black text-on-surface">{kpis.approved}</p>
                </div>
                <div className="p-4 bg-primary-container/20 rounded-3xl border border-primary/20">
                    <p className="text-xs font-bold text-primary uppercase tracking-widest">Assenti Oggi</p>
                    <p className="text-3xl font-black text-primary">{kpis.onLeaveToday}</p>
                </div>
                <div onClick={() => handleFilterClick('REJECTED')} className={`p-4 rounded-3xl border transition-all cursor-pointer ${filters.status === 'REJECTED' ? 'bg-error-container border-error scale-105' : 'bg-surface border-outline-variant hover:bg-surface-container'}`}>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Rifiutate</p>
                    <p className="text-3xl font-black text-on-surface">{kpis.rejected}</p>
                </div>
            </div>

            {view === 'calendar' ? (
                <div className="bg-surface rounded-[2.5rem] shadow-xl border border-outline-variant overflow-hidden flex flex-col">
                    <div className="p-6 bg-surface-container-low border-b border-outline-variant flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-bold capitalize">{calendarDate.toLocaleString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2>
                            <div className="flex gap-1">
                                <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-surface-container"><span className="material-symbols-outlined">chevron_left</span></button>
                                <button onClick={handleToday} className="px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-full border border-outline hover:bg-surface-container">Oggi</button>
                                <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-surface-container"><span className="material-symbols-outlined">chevron_right</span></button>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-7 gap-px bg-outline-variant border-b border-outline-variant">
                        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(d => <div key={d} className="bg-surface-container-high py-2 text-center text-[10px] font-black uppercase text-on-surface-variant tracking-widest">{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 auto-rows-fr flex-grow bg-outline-variant">
                        {calendarGrid.map((day, idx) => (
                            <div key={idx} className={`min-h-[120px] p-2 bg-surface flex flex-col gap-1 ${!day.isCurrentMonth ? 'opacity-30' : ''} ${day.isHoliday ? 'bg-error-container/5' : ''}`}>
                                <span className={`text-xs font-bold ${day.isWeekend || day.isHoliday ? 'text-error' : 'text-on-surface-variant'}`}>{day.date.getUTCDate()}</span>
                                <div className="space-y-1 overflow-y-auto max-h-[100px] scrollbar-none">
                                    {day.leaves.map(l => (
                                        <div key={l.id} className="px-1.5 py-0.5 rounded text-[10px] font-bold truncate text-white" style={{backgroundColor: leaveTypes.find(t => t.id === l.typeId)?.color || '#ccc'}} title={`${l.resourceName}: ${l.typeName}`}>
                                            {l.resourceName.split(' ')[0]}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <DataTable<any>
                    title="Richieste di Assenza"
                    addNewButtonLabel=""
                    data={enrichedRequests}
                    columns={columns}
                    filtersNode={filtersNode}
                    onAddNew={() => {}}
                    renderRow={renderRow}
                    renderMobileCard={renderMobileCard}
                    isLoading={loading}
                    initialSortKey="startDate"
                    // FIX: Type error boolean vs string. Using condition to match expected number type.
                    numActions={isAdmin ? 3 : 2}
                />
            )}

            {/* Request Modal */}
            {isModalOpen && editingRequest && (
                // FIX: Check for 'id' property existence using 'in' operator to handle union type correctly
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={'id' in editingRequest ? "Modifica Richiesta" : "Nuova Richiesta Assenza"}>
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant space-y-4">
                            <div>
                                <label className="block text-xs font-black text-primary uppercase tracking-widest mb-2">Risorsa Richiedente</label>
                                <SearchableSelect 
                                    name="resourceId" 
                                    value={editingRequest.resourceId} 
                                    onChange={handleSelectChange} 
                                    options={resourceOptions} 
                                    required 
                                    placeholder="Seleziona risorsa..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-primary uppercase tracking-widest mb-2">Tipologia Assenza</label>
                                <SearchableSelect 
                                    name="typeId" 
                                    value={editingRequest.typeId} 
                                    onChange={handleSelectChange} 
                                    options={typeOptions} 
                                    required 
                                    placeholder="Seleziona tipo..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-primary uppercase tracking-widest mb-2">Data Inizio</label>
                                    <input type="date" name="startDate" value={editingRequest.startDate} onChange={handleChange} required className="form-input" />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-primary uppercase tracking-widest mb-2">Data Fine</label>
                                    <input type="date" name="endDate" value={editingRequest.endDate} onChange={handleChange} required className="form-input" />
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-surface rounded-2xl border border-outline-variant">
                                <input type="checkbox" id="halfday" name="isHalfDay" checked={editingRequest.isHalfDay} onChange={handleChange} className="form-checkbox h-5 w-5" />
                                <label htmlFor="halfday" className="text-sm font-bold text-on-surface">Mezza Giornata</label>
                            </div>
                        </div>

                        <div className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant space-y-4">
                            <div>
                                <label className="block text-xs font-black text-primary uppercase tracking-widest mb-2">Richiedi Approvazione a</label>
                                <MultiSelectDropdown 
                                    name="approverIds" 
                                    selectedValues={editingRequest.approverIds || []} 
                                    onChange={handleApproversChange} 
                                    options={managerOptions} 
                                    placeholder="Seleziona manager..."
                                />
                                <p className="mt-2 text-[10px] text-on-surface-variant leading-tight">Verrà inviata una notifica a tutti gli approvatori selezionati. È necessaria una sola approvazione.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-primary uppercase tracking-widest mb-2">Note / Motivazione</label>
                                <textarea name="notes" value={editingRequest.notes || ''} onChange={handleChange} className="form-textarea h-24" placeholder="Opzionale..." />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-full font-bold text-on-surface-variant hover:bg-surface-container">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addLeaveRequest') || isActionLoading('updateLeaveRequest')} className="px-8 py-2 bg-primary text-on-primary rounded-full font-bold shadow-lg flex items-center gap-2">
                                {isActionLoading('addLeaveRequest') || isActionLoading('updateLeaveRequest') ? <SpinnerIcon className="w-4 h-4"/> : 'Invia Richiesta'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Delete Modal */}
            {requestToDelete && (
                <ConfirmationModal 
                    isOpen={!!requestToDelete}
                    onClose={() => setRequestToDelete(null)}
                    onConfirm={handleDelete}
                    title="Annulla Richiesta"
                    message="Sei sicuro di voler eliminare questa richiesta di assenza? Se già approvata, i giorni verranno ripristinati nel calcolo della capacità."
                    isConfirming={isActionLoading(`deleteLeaveRequest-${requestToDelete.id}`)}
                />
            )}
        </div>
    );
};

export default LeavePage;
