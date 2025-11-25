
/**
 * @file LeavePage.tsx
 * @description Pagina per la gestione delle richieste di assenza (ferie, permessi).
 * Supporta viste: Tabella, Card, Calendario.
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

    const filteredRequests = useMemo(() => {
        return leaveRequests.filter(req => {
            // Permission Filter
            let isVisible = false;
            if (isAdmin) isVisible = true;
            else if (req.resourceId === user?.resourceId) isVisible = true;
            else if (req.approverIds?.includes(user?.resourceId || '')) isVisible = true;
            else if (req.status === 'APPROVED') isVisible = true;
            
            if (!isVisible) return false;

            // UI Filters
            if (filters.resourceId && req.resourceId !== filters.resourceId) return false;
            if (filters.typeId && req.typeId !== filters.typeId) return false;
            if (filters.status && req.status !== filters.status) return false;

            return true;
        });
    }, [leaveRequests, isAdmin, user, filters]);

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
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        
        const firstDayOfMonth = new Date(year, month, 1);
        
        // Calculate start date (Monday)
        const startDate = new Date(firstDayOfMonth);
        const dayOfWeek = startDate.getDay(); 
        const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        startDate.setDate(diff);

        const days = [];
        const currentDay = new Date(startDate);
        
        // 6 weeks grid
        for (let i = 0; i < 42; i++) {
            // LOCAL DATE FIX: Costruiamo la stringa manualmente per evitare shift UTC
            const y = currentDay.getFullYear();
            const m = String(currentDay.getMonth() + 1).padStart(2, '0');
            const d = String(currentDay.getDate()).padStart(2, '0');
            const dateIso = `${y}-${m}-${d}`;

            const isCurrentMonth = currentDay.getMonth() === month;
            
            // Find leaves for this day
            const dayLeaves = filteredRequests.filter(req => 
                dateIso >= req.startDate && dateIso <= req.endDate && req.status !== 'REJECTED'
            );

            const holiday = isHoliday(currentDay, null, companyCalendar);
            
            days.push({
                date: new Date(currentDay),
                dateIso,
                isCurrentMonth,
                leaves: dayLeaves,
                isHoliday: holiday,
                isWeekend: currentDay.getDay() === 0 || currentDay.getDay() === 6
            });
            currentDay.setDate(currentDay.getDate() + 1);
        }
        return days;
    }, [calendarDate, filteredRequests, companyCalendar]);

    // --- Handlers ---

    const handlePrevMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
    const handleNextMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
    const handleToday = () => setCalendarDate(new Date());

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
        setEditingRequest({ ...req });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRequest) return;
        
        try {
            if ('id' in editingRequest) {
                await updateLeaveRequest(editingRequest as LeaveRequest);
            } else {
                await addLeaveRequest(editingRequest as Omit<LeaveRequest, 'id'>);
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
        { header: 'Risorsa', sortKey: 'resourceName', cell: r => <span className="font-medium text-on-surface">{r.resourceName}</span> },
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

    const renderRow = (req: typeof enrichedRequests[0]) => (
        <tr key={req.id} className="hover:bg-surface-container-low group">
            {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap bg-inherit">{col.cell(req)}</td>)}
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium bg-inherit">
                <div className="flex items-center justify-center space-x-3">
                    <button onClick={() => openEditRequestModal(req)} className="text-on-surface-variant hover:text-primary" title="Modifica"><span className="material-symbols-outlined">edit</span></button>
                    <button onClick={() => setRequestToDelete(req)} className="text-on-surface-variant hover:text-error" title="Elimina"><span className="material-symbols-outlined">delete</span></button>
                </div>
            </td>
        </tr>
    );

    const renderCard = (req: typeof enrichedRequests[0]) => (
        <div key={req.id} className="bg-surface p-4 rounded-2xl shadow border-l-4 flex flex-col gap-3" style={{ borderLeftColor: req.typeColor }}>
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-on-surface">{req.resourceName}</h3>
                    <span className="text-xs text-on-surface-variant">{req.typeName}</span>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                    req.status === 'APPROVED' ? 'bg-tertiary-container text-on-tertiary-container' :
                    req.status === 'REJECTED' ? 'bg-error-container text-on-error-container' :
                    'bg-yellow-container text-on-yellow-container'
                }`}>
                    {req.status}
                </span>
            </div>
            <div className="text-sm text-on-surface-variant">
                <p>Dal: {formatDateFull(req.startDate)}</p>
                <p>Al: {formatDateFull(req.endDate)}</p>
                <p className="font-semibold mt-1">Durata: {req.duration} gg {req.isHalfDay ? '(Mezza)' : ''}</p>
            </div>
            <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-outline-variant">
                <button onClick={() => openEditRequestModal(req)} className="text-primary text-sm font-medium">Modifica</button>
                <button onClick={() => setRequestToDelete(req)} className="text-error text-sm font-medium">Elimina</button>
            </div>
        </div>
    );

    const filtersNode = (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <SearchableSelect name="resourceId" value={filters.resourceId} onChange={(_,v) => setFilters(p => ({...p, resourceId: v}))} options={resourceOptions} placeholder="Tutte le Risorse" />
            <SearchableSelect name="typeId" value={filters.typeId} onChange={(_,v) => setFilters(p => ({...p, typeId: v}))} options={typeOptions} placeholder="Tutti i Tipi" />
            <SearchableSelect name="status" value={filters.status} onChange={(_,v) => setFilters(p => ({...p, status: v}))} options={statusOptions} placeholder="Tutti gli Stati" />
            <button onClick={() => setFilters({resourceId: '', typeId: '', status: ''})} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full">Reset</button>
        </div>
    );

    return (
        <div className="h-full flex flex-col space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-on-surface">Gestione Assenze</h1>
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-surface-container p-1 rounded-full">
                        <button onClick={() => setView('table')} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${view === 'table' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}>Tabella</button>
                        <button onClick={() => setView('card')} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${view === 'card' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}>Card</button>
                        <button onClick={() => setView('calendar')} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${view === 'calendar' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}>Calendario</button>
                    </div>
                    <button onClick={openNewRequestModal} className="px-4 py-2 bg-primary text-on-primary rounded-full font-bold flex items-center gap-2 shadow-sm hover:opacity-90">
                        <span className="material-symbols-outlined">add</span> Nuova
                    </button>
                </div>
            </div>

            {/* Content Views */}
            {view === 'table' && (
                <DataTable<typeof enrichedRequests[0]>
                    title=""
                    addNewButtonLabel=""
                    data={enrichedRequests}
                    columns={columns}
                    filtersNode={filtersNode}
                    onAddNew={() => {}}
                    renderRow={renderRow}
                    renderMobileCard={renderCard}
                    initialSortKey="startDate"
                    isLoading={loading}
                    tableLayout={{ dense: true, striped: true, headerSticky: true }}
                    numActions={4} // Edit, Delete + potentially Approve/Reject via modal
                />
            )}

            {view === 'card' && (
                <div className="space-y-4">
                    <div className="bg-surface rounded-2xl shadow p-4">
                        {filtersNode}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {enrichedRequests.map(renderCard)}
                        {enrichedRequests.length === 0 && <p className="col-span-full text-center py-10 text-on-surface-variant">Nessuna richiesta trovata.</p>}
                    </div>
                </div>
            )}

            {view === 'calendar' && (
                <div className="flex-grow bg-surface rounded-2xl shadow overflow-hidden flex flex-col">
                    {/* Calendar Header */}
                    <div className="flex justify-between items-center p-4 border-b border-outline-variant">
                        <div className="flex items-center gap-4">
                            <button onClick={handlePrevMonth} className="p-2 hover:bg-surface-container rounded-full"><span className="material-symbols-outlined">chevron_left</span></button>
                            <h2 className="text-xl font-bold text-on-surface min-w-[150px] text-center">
                                {calendarDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}
                            </h2>
                            <button onClick={handleNextMonth} className="p-2 hover:bg-surface-container rounded-full"><span className="material-symbols-outlined">chevron_right</span></button>
                            <button onClick={handleToday} className="text-sm font-medium text-primary hover:underline ml-2">Oggi</button>
                        </div>
                        
                        {/* Legend */}
                        <div className="flex flex-wrap gap-3">
                            {leaveTypes.map(t => (
                                <div key={t.id} className="flex items-center gap-1.5 text-xs">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }}></span>
                                    <span className="text-on-surface-variant">{t.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Weekday Headers */}
                    <div className="grid grid-cols-7 bg-surface-container-low border-b border-outline-variant">
                        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(d => (
                            <div key={d} className="p-2 text-center text-xs font-bold text-on-surface-variant uppercase">{d}</div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 flex-grow auto-rows-fr bg-surface-variant/20 gap-px border-b border-outline-variant">
                        {calendarGrid.map((day) => (
                            <div 
                                key={day.dateIso} 
                                className={`
                                    min-h-[100px] p-1 bg-surface relative flex flex-col gap-1
                                    ${!day.isCurrentMonth ? 'bg-surface-container-lowest opacity-50' : ''}
                                    ${(day.isWeekend || day.isHoliday) ? 'bg-surface-container/30' : ''}
                                `}
                            >
                                <div className="flex justify-between items-start px-1">
                                    <span className={`text-xs font-medium ${day.dateIso === new Date().toISOString().split('T')[0] ? 'bg-primary text-on-primary w-5 h-5 rounded-full flex items-center justify-center' : 'text-on-surface-variant'}`}>
                                        {day.date.getDate()}
                                    </span>
                                    {day.isHoliday && <span className="text-[9px] text-error font-bold uppercase">Festivo</span>}
                                </div>
                                
                                <div className="flex-grow overflow-y-auto space-y-0.5 custom-scrollbar">
                                    {day.leaves.map(req => {
                                        const type = leaveTypes.find(t => t.id === req.typeId);
                                        const resource = resources.find(r => r.id === req.resourceId);
                                        const isPending = req.status === 'PENDING';
                                        
                                        return (
                                            <button 
                                                key={req.id} 
                                                onClick={() => openEditRequestModal(req)}
                                                className={`
                                                    w-full text-left text-[10px] px-1 py-0.5 rounded truncate block border-l-2
                                                    ${isPending ? 'opacity-70 border-dashed' : ''}
                                                    hover:brightness-95 transition-all
                                                `}
                                                style={{ 
                                                    backgroundColor: `${type?.color}20` || '#eee', 
                                                    borderLeftColor: type?.color || '#ccc',
                                                    color: '#191c1e'
                                                }}
                                                title={`${resource?.name} - ${type?.name} (${req.status})`}
                                            >
                                                <span className="font-bold">{resource?.name.split(' ')[0]}</span> {req.isHalfDay ? '½' : ''}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Edit/Add Modal */}
            {isModalOpen && editingRequest && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={'id' in editingRequest ? 'Modifica Richiesta' : 'Nuova Richiesta'}>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-on-surface-variant">Risorsa</label>
                            <SearchableSelect name="resourceId" value={editingRequest.resourceId} onChange={handleSelectChange} options={resourceOptions} placeholder="Seleziona risorsa..." required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-on-surface-variant">Tipologia</label>
                            <SearchableSelect name="typeId" value={editingRequest.typeId} onChange={handleSelectChange} options={typeOptions} placeholder="Seleziona tipo..." required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-on-surface-variant">Dal</label>
                                <input type="date" name="startDate" value={editingRequest.startDate} onChange={handleChange} className="form-input" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-on-surface-variant">Al</label>
                                <input type="date" name="endDate" value={editingRequest.endDate} onChange={handleChange} className="form-input" required />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" name="isHalfDay" checked={editingRequest.isHalfDay} onChange={handleChange} className="form-checkbox" />
                            <label className="text-sm text-on-surface">Mezza Giornata (0.5 G/U)</label>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium mb-1 text-on-surface-variant">Richiedi Approvazione a (min. 3)</label>
                            <MultiSelectDropdown name="approverIds" selectedValues={editingRequest.approverIds || []} onChange={handleApproversChange} options={managerOptions} placeholder="Seleziona manager..." />
                            <p className="text-xs text-on-surface-variant mt-1">Seleziona almeno 3 manager se richiesto dalle policy.</p>
                        </div>

                        {(isAdmin || editingRequest.approverIds?.includes(user?.resourceId || '')) && (
                            <div>
                                <label className="block text-sm font-medium mb-1 text-on-surface-variant">Stato (Admin/Approver)</label>
                                <select name="status" value={editingRequest.status} onChange={handleChange} className="form-select">
                                    {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium mb-1 text-on-surface-variant">Note</label>
                            <textarea name="notes" value={editingRequest.notes || ''} onChange={handleChange} className="form-textarea" rows={2}></textarea>
                        </div>

                        <div className="flex justify-between items-center pt-4 mt-4 border-t border-outline-variant">
                            {'id' in editingRequest && (
                                <button type="button" onClick={() => setRequestToDelete(editingRequest as LeaveRequest)} className="text-error hover:text-error-container flex items-center gap-1 text-sm font-medium">
                                    <span className="material-symbols-outlined text-lg">delete</span> Elimina
                                </button>
                            )}
                            <div className="flex gap-2 ml-auto">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-outline rounded-full text-primary font-medium hover:bg-surface-container">Annulla</button>
                                <button type="submit" disabled={isActionLoading('addLeaveRequest') || isActionLoading('updateLeaveRequest')} className="px-4 py-2 bg-primary text-on-primary rounded-full font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                                    {(isActionLoading('addLeaveRequest') || isActionLoading('updateLeaveRequest')) ? <SpinnerIcon className="w-4 h-4" /> : 'Salva'}
                                </button>
                            </div>
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
                    message="Sei sicuro di voler eliminare questa richiesta di assenza?"
                    isConfirming={isActionLoading(`deleteLeaveRequest-${requestToDelete.id}`)}
                />
            )}
        </div>
    );
};

export default LeavePage;
