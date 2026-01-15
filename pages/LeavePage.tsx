
/**
 * @file LeavePage.tsx
 * @description Pagina per la gestione delle richieste di ferie e assenze.
 */

import React, { useState, useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { LeaveRequest, LeaveStatus } from '../types';
import { isHoliday, getWorkingDaysBetween, formatDateFull } from '../utils/dateUtils';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { SpinnerIcon } from '../components/icons';
import ConfirmationModal from '../components/ConfirmationModal';
import { DataTable, ColumnDef } from '../components/DataTable';
import { ExportButton } from '@/components/shared/ExportButton';


const buildLeaveRequestPayload = (request: LeaveRequest | Omit<LeaveRequest, 'id'>): LeaveRequest | Omit<LeaveRequest, 'id'> => {
    const basePayload: Omit<LeaveRequest, 'id'> = {
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

    const handleQuickAction = async (req: typeof enrichedRequests[0], newStatus: LeaveStatus) => {
        try {
            const payload: LeaveRequest = {
                id: req.id,
                resourceId: req.resourceId,
                typeId: req.typeId,
                startDate: req.startDate,
                endDate: req.endDate,
                status: newStatus,
                managerId: user?.resourceId, // L'utente corrente agisce come manager
                approverIds: req.approverIds,
                notes: req.notes,
                isHalfDay: req.isHalfDay
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

    const columns: ColumnDef<typeof enrichedRequests[0]>[] = [
        { header: 'Risorsa', sortKey: 'resourceName', cell: r => <span className="font-medium text-on-surface sticky left-0 bg-inherit pl-6">{r.resourceName}</span> },
        { header: 'Tipologia', sortKey: 'typeName', cell: r => (
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: `${r.typeColor}30`, color: '#191c1e' }}>
                <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: r.typeColor }}></span>
                {r.typeName}
            </span>
        )},
        { header: 'Periodo', sortKey: 'startDate', cell: r => <span className="text-sm">{formatDateFull(r.startDate)} - {formatDateFull(r.endDate)}</span> },
        { header: 'Giorni', sortKey: 'duration', cell: r => <span className="text-sm font-semibold">{r.duration} gg</span> },
        { header: 'Stato', sortKey: 'status', cell: r => (
            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                r.status === 'APPROVED' ? 'bg-tertiary-container text-on-tertiary-container' :
                r.status === 'REJECTED' ? 'bg-error-container text-on-error-container' :
                'bg-yellow-container text-on-yellow-container'
            }`}>
                {r.status === 'PENDING' ? 'In Attesa' : r.status === 'APPROVED' ? 'Approvata' : 'Rifiutata'}
            </span>
        )},
    ];

    const renderRow = (req: typeof enrichedRequests[0]) => {
        const canApprove = req.status === 'PENDING' && (isAdmin || (user?.resourceId && req.approverIds?.includes(user.resourceId)));
        const isUpdating = isActionLoading('updateLeaveRequest');

        return (
            <tr key={req.id} className="group hover:bg-surface-container">
                {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap bg-inherit text-sm text-on-surface-variant">{col.cell(req)}</td>)}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium bg-inherit">
                    <div className="flex items-center justify-end space-x-2">
                        {canApprove && (
                            <>
                                <button onClick={() => handleQuickAction(req, 'APPROVED')} disabled={isUpdating} className="p-2 rounded-full hover:bg-tertiary-container text-tertiary" title="Approva Rapido">
                                    <span className="material-symbols-outlined">check</span>
                                </button>
                                <button onClick={() => handleQuickAction(req, 'REJECTED')} disabled={isUpdating} className="p-2 rounded-full hover:bg-error-container text-error" title="Rifiuta Rapido">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </>
                        )}
                        {(isAdmin || req.resourceId === user?.resourceId) && req.status === 'PENDING' && (
                            <>
                                <button onClick={() => openEditRequestModal(req)} className="p-2 rounded-full hover:bg-surface-container text-primary" title="Modifica">
                                    <span className="material-symbols-outlined">edit</span>
                                </button>
                                <button onClick={() => setRequestToDelete(req)} className="p-2 rounded-full hover:bg-surface-container text-error" title="Elimina">
                                    <span className="material-symbols-outlined">delete</span>
                                </button>
                            </>
                        )}
                    </div>
                </td>
            </tr>
        );
    };

    const renderMobileCard = (req: typeof enrichedRequests[0]) => (
        <div key={req.id} className={`p-4 rounded-lg shadow-md bg-surface-container border-l-4 mb-4 ${req.status === 'APPROVED' ? 'border-tertiary' : req.status === 'REJECTED' ? 'border-error' : 'border-yellow-500'}`}>
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-lg text-on-surface">{req.resourceName}</h3>
                    <span className="text-xs font-medium bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded">{req.typeName}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    req.status === 'APPROVED' ? 'bg-tertiary-container text-on-tertiary-container' :
                    req.status === 'REJECTED' ? 'bg-error-container text-on-error-container' :
                    'bg-yellow-container text-on-yellow-container'
                }`}>{req.status}</span>
            </div>
            <div className="mt-2 text-sm text-on-surface-variant">
                <p>{formatDateFull(req.startDate)} - {formatDateFull(req.endDate)}</p>
                <p className="font-semibold">{req.duration} gg</p>
            </div>
            <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-outline-variant">
                <button onClick={() => openEditRequestModal(req)} className="text-primary font-medium text-sm">Modifica</button>
                <button onClick={() => setRequestToDelete(req)} className="text-error font-medium text-sm">Elimina</button>
            </div>
        </div>
    );

    const filtersNode = (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <SearchableSelect name="resourceId" value={filters.resourceId} onChange={(_, v) => setFilters(f => ({ ...f, resourceId: v }))} options={resourceOptions} placeholder="Tutte le Risorse" />
            <SearchableSelect name="typeId" value={filters.typeId} onChange={(_, v) => setFilters(f => ({ ...f, typeId: v }))} options={typeOptions} placeholder="Tutti i Tipi" />
            <div className="flex items-center space-x-1 bg-surface-container p-1 rounded-full w-fit">
                <button onClick={() => setView('table')} className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${view === 'table' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}>Tabella</button>
                <button onClick={() => setView('calendar')} className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${view === 'calendar' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}>Calendario</button>
            </div>
            <button onClick={() => setFilters({ resourceId: '', typeId: '', status: '' })} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full hover:opacity-90 w-full">Reset</button>
        </div>
    );

    return (
        <div className="h-full flex flex-col">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div 
                    onClick={() => handleFilterClick('PENDING')} 
                    className={`cursor-pointer bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-yellow-500 transition-all ${filters.status === 'PENDING' ? 'ring-2 ring-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' : 'hover:shadow-md'}`}
                >
                    <p className="text-sm text-on-surface-variant">In Attesa</p>
                    <p className="text-2xl font-bold text-on-surface">{kpis.pending}</p>
                </div>
                <div 
                    onClick={() => handleFilterClick('APPROVED')} 
                    className={`cursor-pointer bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-tertiary transition-all ${filters.status === 'APPROVED' ? 'ring-2 ring-tertiary bg-tertiary-container/20' : 'hover:shadow-md'}`}
                >
                    <p className="text-sm text-on-surface-variant">Approvate</p>
                    <p className="text-2xl font-bold text-on-surface">{kpis.approved}</p>
                </div>
                <div 
                    onClick={() => handleFilterClick('REJECTED')} 
                    className={`cursor-pointer bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-error transition-all ${filters.status === 'REJECTED' ? 'ring-2 ring-error bg-error-container/20' : 'hover:shadow-md'}`}
                >
                    <p className="text-sm text-on-surface-variant">Rifiutate</p>
                    <p className="text-2xl font-bold text-on-surface">{kpis.rejected}</p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-primary">
                    <p className="text-sm text-on-surface-variant">Assenti Oggi</p>
                    <p className="text-2xl font-bold text-on-surface">{kpis.onLeaveToday}</p>
                </div>
            </div>

            {view === 'table' && (
                <DataTable<typeof enrichedRequests[0]>
                    title="Gestione Assenze"
                    addNewButtonLabel="Nuova Richiesta"
                    data={enrichedRequests}
                    columns={columns}
                    filtersNode={filtersNode}
                    onAddNew={openNewRequestModal}
                    renderRow={renderRow}
                    renderMobileCard={renderMobileCard}
                    headerActions={<ExportButton data={enrichedRequests} title="Gestione Assenze" />}
                    initialSortKey="startDate"
                    isLoading={loading}
                    tableLayout={{ dense: true, striped: true, headerSticky: true }}
                    numActions={isAdmin ? 4 : 2}
                />
            )}

            {view === 'calendar' && (
                <>
                    {/* Header Manuale per Vista Calendario */}
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold text-on-surface">Gestione Assenze</h1>
                        <div className="flex flex-wrap items-center gap-2">
                            <button onClick={openNewRequestModal} className="px-6 py-2 bg-primary text-on-primary font-semibold rounded-full shadow-sm hover:opacity-90 flex items-center gap-2">
                                <span className="material-symbols-outlined">add</span> Nuova Richiesta
                            </button>
                            <ExportButton data={enrichedRequests} title="Gestione Assenze" />
                        </div>
                    </div>

                    {/* Filtri Manuali per Vista Calendario */}
                    <div className="bg-surface rounded-2xl shadow p-4 mb-6">
                        {filtersNode}
                    </div>

                    <div className="bg-surface rounded-2xl shadow p-4 overflow-hidden">
                        <div className="flex justify-between items-center mb-4">
                            <button onClick={handlePrevMonth} className="p-2 hover:bg-surface-container rounded-full"><span className="material-symbols-outlined">chevron_left</span></button>
                            <h2 className="text-xl font-bold text-on-surface capitalize">{calendarDate.toLocaleString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2>
                            <div className="flex items-center">
                                <button onClick={handleNextMonth} className="p-2 hover:bg-surface-container rounded-full"><span className="material-symbols-outlined">chevron_right</span></button>
                                <button onClick={handleToday} className="ml-2 px-3 py-1 text-sm bg-secondary-container text-on-secondary-container rounded-full">Oggi</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-7 gap-px bg-outline-variant border border-outline-variant rounded-lg overflow-hidden text-sm">
                            {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
                                <div key={day} className="bg-surface-container text-center py-2 font-bold text-on-surface-variant">{day}</div>
                            ))}
                            {calendarGrid.map((day, i) => (
                                <div 
                                    key={i} 
                                    className={`min-h-[100px] bg-surface p-2 flex flex-col gap-1 
                                        ${!day.isCurrentMonth ? 'bg-surface-container-low/50 text-on-surface-variant/50' : ''}
                                        ${(day.isWeekend || day.isHoliday) ? 'bg-surface-container' : ''} 
                                    `}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className={`text-xs font-semibold ${day.dateIso === new Date().toISOString().split('T')[0] ? 'bg-primary text-on-primary rounded-full w-6 h-6 flex items-center justify-center' : ''}`}>{day.date.getUTCDate()}</span>
                                        {day.isHoliday && <span className="material-symbols-outlined text-xs text-tertiary" title="Festivo">star</span>}
                                    </div>
                                    <div className="flex-grow overflow-y-auto space-y-1 max-h-[80px]">
                                        {day.leaves.map(leave => (
                                            <div 
                                                key={leave.id} 
                                                onClick={() => openEditRequestModal(leave)}
                                                className="text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 border-l-2"
                                                style={{ backgroundColor: `${leave.typeColor}30`, borderLeftColor: leave.typeColor, color: '#191c1e' }}
                                                title={`${leave.resourceName} - ${leave.typeName}`}
                                            >
                                                {leave.resourceName}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* Edit Modal */}
            {isModalOpen && editingRequest && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={'id' in editingRequest ? 'Modifica Richiesta' : 'Nuova Richiesta'}>
                    <form onSubmit={handleSave} className="space-y-4">
                        {!('id' in editingRequest) && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Risorsa Richiedente</label>
                                <SearchableSelect name="resourceId" value={editingRequest.resourceId} onChange={handleSelectChange} options={resourceOptions} placeholder="Seleziona risorsa..." required/>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium mb-1">Tipologia Assenza</label>
                            <SearchableSelect name="typeId" value={editingRequest.typeId} onChange={handleSelectChange} options={typeOptions} placeholder="Seleziona tipo..." required/>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium mb-1">Data Inizio</label><input type="date" name="startDate" value={editingRequest.startDate} onChange={handleChange} required className="form-input"/></div>
                            <div><label className="block text-sm font-medium mb-1">Data Fine</label><input type="date" name="endDate" value={editingRequest.endDate} onChange={handleChange} required className="form-input"/></div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" name="isHalfDay" checked={editingRequest.isHalfDay} onChange={handleChange} className="form-checkbox"/>
                            <label className="text-sm">Mezza Giornata (0.5 gg)</label>
                        </div>
                        {isAdmin && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Stato</label>
                                <select name="status" value={editingRequest.status} onChange={handleChange} className="form-select">
                                    {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium mb-1">Richiedi Approvazione a (Opzionale)</label>
                            <MultiSelectDropdown name="approverIds" selectedValues={editingRequest.approverIds || []} onChange={handleApproversChange} options={managerOptions} placeholder="Seleziona Manager..."/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Note</label>
                            <textarea name="notes" value={editingRequest.notes || ''} onChange={handleChange} className="form-textarea" rows={3}></textarea>
                        </div>
                        <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-outline rounded-full text-primary font-semibold">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addLeaveRequest') || isActionLoading('updateLeaveRequest')} className="px-4 py-2 bg-primary text-on-primary rounded-full font-semibold disabled:opacity-50">
                                {isActionLoading('addLeaveRequest') || isActionLoading('updateLeaveRequest') ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {requestToDelete && (
                <ConfirmationModal
                    isOpen={!!requestToDelete}
                    onClose={() => setRequestToDelete(null)}
                    onConfirm={handleDelete}
                    title="Elimina Richiesta"
                    message="Sei sicuro di voler eliminare questa richiesta? L'azione è irreversibile."
                    isConfirming={isActionLoading(`deleteLeaveRequest-${requestToDelete.id}`)}
                />
            )}
        </div>
    );
};

export default LeavePage;