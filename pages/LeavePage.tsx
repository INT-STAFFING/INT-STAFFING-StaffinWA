/**
 * @file LeavePage.tsx
 * @description Pagina per la gestione delle richieste di assenza (ferie, permessi).
 */

import React, { useState, useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { LeaveRequest, LeaveStatus } from '../types';
import { isHoliday } from '../utils/dateUtils';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { SpinnerIcon } from '../components/icons';
import ConfirmationModal from '../components/ConfirmationModal';

const LeavePage: React.FC = () => {
    const { 
        leaveRequests, resources, leaveTypes, companyCalendar, 
        addLeaveRequest, updateLeaveRequest, deleteLeaveRequest, 
        isActionLoading, managerResourceIds 
    } = useEntitiesContext();
    const { user, isAdmin } = useAuth();

    const [calendarDate, setCalendarDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRequest, setEditingRequest] = useState<LeaveRequest | Omit<LeaveRequest, 'id'> | null>(null);
    const [requestToDelete, setRequestToDelete] = useState<LeaveRequest | null>(null);

    const currentUserResource = useMemo(() => resources.find(r => r.id === user?.resourceId), [resources, user]);

    // Filter logic: Admins see all, others see their own + pending requests where they are approver?
    // For simplicity in visualization, let's show all approved leaves (transparency) + own pending + pending to approve.
    const filteredRequests = useMemo(() => {
        return leaveRequests.filter(req => {
            if (isAdmin) return true;
            // See own requests
            if (req.resourceId === user?.resourceId) return true;
            // See requests where I am approver
            if (req.approverIds?.includes(user?.resourceId || '')) return true;
            // See approved requests of others (public calendar)
            if (req.status === 'APPROVED') return true;
            return false;
        });
    }, [leaveRequests, isAdmin, user]);

    // --- Calendar Data Generation ---
    const calendarGrid = useMemo(() => {
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        
        const firstDayOfMonth = new Date(year, month, 1);
        
        // Calculate start date of the grid (monday of the first week)
        const startDate = new Date(firstDayOfMonth);
        const dayOfWeek = startDate.getDay(); // 0 (Sun) to 6 (Sat)
        const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
        startDate.setDate(diff);

        const days = [];
        const currentDay = new Date(startDate);
        
        // 6 weeks * 7 days = 42 days
        for (let i = 0; i < 42; i++) {
            // FIX: Usa la data locale invece di toISOString() (che usa UTC) per evitare shift di fuso orario
            const y = currentDay.getFullYear();
            const m = String(currentDay.getMonth() + 1).padStart(2, '0');
            const d = String(currentDay.getDate()).padStart(2, '0');
            const dateIso = `${y}-${m}-${d}`;

            const isCurrentMonth = currentDay.getMonth() === month;
            
            // Find leaves for this day
            const dayLeaves = filteredRequests.filter(req => 
                dateIso >= req.startDate && dateIso <= req.endDate && req.status !== 'REJECTED'
            );

            // Check holiday
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
        
        // Basic validation
        if (!editingRequest.resourceId || !editingRequest.typeId || !editingRequest.startDate || !editingRequest.endDate) {
            return; // Form validation handled by HTML required
        }
        
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

    // Options
    const resourceOptions = useMemo(() => resources.filter(r => !r.resigned).map(r => ({ value: r.id!, label: r.name })), [resources]);
    const typeOptions = useMemo(() => leaveTypes.map(t => ({ value: t.id!, label: t.name })), [leaveTypes]);
    const managerOptions = useMemo(() => resources.filter(r => managerResourceIds.includes(r.id!) && !r.resigned).map(r => ({ value: r.id!, label: r.name })), [resources, managerResourceIds]);
    const statusOptions: {value: LeaveStatus, label: string}[] = [
        { value: 'PENDING', label: 'In Attesa' },
        { value: 'APPROVED', label: 'Approvata' },
        { value: 'REJECTED', label: 'Rifiutata' }
    ];

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-on-surface">Calendario Assenze</h1>
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-surface-container p-1 rounded-full">
                        <button onClick={handlePrevMonth} className="p-2 hover:bg-surface rounded-full text-on-surface-variant"><span className="material-symbols-outlined">chevron_left</span></button>
                        <span className="px-4 font-medium text-on-surface min-w-[150px] text-center">
                            {calendarDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}
                        </span>
                        <button onClick={handleNextMonth} className="p-2 hover:bg-surface rounded-full text-on-surface-variant"><span className="material-symbols-outlined">chevron_right</span></button>
                    </div>
                    <button onClick={handleToday} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full font-medium">Oggi</button>
                    <button onClick={openNewRequestModal} className="px-4 py-2 bg-primary text-on-primary rounded-full font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined">add</span> Nuova Richiesta
                    </button>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mb-4 px-2">
                {leaveTypes.map(t => (
                    <div key={t.id} className="flex items-center gap-2 text-xs">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }}></span>
                        <span className="text-on-surface-variant">{t.name}</span>
                    </div>
                ))}
                <div className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full bg-surface-container border border-outline"></span>
                    <span className="text-on-surface-variant">Festivo/Weekend</span>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-grow bg-surface rounded-2xl shadow overflow-hidden flex flex-col">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 border-b border-outline-variant bg-surface-container-low">
                    {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(d => (
                        <div key={d} className="p-3 text-center text-sm font-bold text-on-surface-variant uppercase tracking-wide">
                            {d}
                        </div>
                    ))}
                </div>
                {/* Days */}
                <div className="grid grid-cols-7 flex-grow auto-rows-fr">
                    {calendarGrid.map((day) => (
                        <div 
                            key={day.dateIso} 
                            className={`
                                min-h-[100px] p-2 border-b border-r border-outline-variant relative flex flex-col gap-1
                                ${!day.isCurrentMonth ? 'bg-surface-container-lowest text-on-surface-variant/50' : 'bg-surface'}
                                ${(day.isWeekend || day.isHoliday) ? 'bg-surface-container/30' : ''}
                            `}
                        >
                            <div className="flex justify-between items-start">
                                <span className={`text-sm font-medium ${day.dateIso === new Date().toISOString().split('T')[0] ? 'bg-primary text-on-primary w-6 h-6 rounded-full flex items-center justify-center' : ''}`}>
                                    {day.date.getDate()}
                                </span>
                                {day.isHoliday && <span className="text-[10px] text-error font-bold uppercase tracking-tighter">Festivo</span>}
                            </div>
                            
                            <div className="flex-grow overflow-y-auto space-y-1 custom-scrollbar">
                                {day.leaves.map(req => {
                                    const type = leaveTypes.find(t => t.id === req.typeId);
                                    const resource = resources.find(r => r.id === req.resourceId);
                                    const isPending = req.status === 'PENDING';
                                    
                                    return (
                                        <button 
                                            key={req.id} 
                                            onClick={() => openEditRequestModal(req)}
                                            className={`
                                                w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate block border-l-2
                                                ${isPending ? 'opacity-70 border-dashed' : ''}
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