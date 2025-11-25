
/**
 * @file LeavePage.tsx
 * @description Pagina per la gestione delle assenze con workflow di approvazione multipla.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { LeaveRequest, LeaveStatus } from '../types';
import { DataTable, ColumnDef } from '../components/DataTable';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { SpinnerIcon } from '../components/icons';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth } from '../context/AuthContext';
import { formatDateFull, getWorkingDaysBetween } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';

// --- Helper Types ---
type EnrichedLeaveRequest = LeaveRequest & {
    resourceName: string;
    typeName: string;
    typeColor: string;
    approverNames: string;
};

// --- Helper Functions ---
const getStatusBadgeClass = (status: LeaveStatus) => {
    switch (status) {
        case 'APPROVED': return 'bg-tertiary-container text-on-tertiary-container';
        case 'PENDING': return 'bg-yellow-container text-on-yellow-container';
        case 'REJECTED': return 'bg-error-container text-on-error-container';
        default: return 'bg-surface-variant text-on-surface-variant';
    }
};

const LeavePage: React.FC = () => {
    const { 
        leaveRequests, resources, leaveTypes, managerResourceIds, companyCalendar,
        addLeaveRequest, updateLeaveRequest, deleteLeaveRequest, 
        isActionLoading, loading 
    } = useEntitiesContext();
    
    const { allocations } = useAllocationsContext();
    const { user, isAdmin } = useAuth();
    const { addToast } = useToast();

    // State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRequest, setEditingRequest] = useState<LeaveRequest | Omit<LeaveRequest, 'id'> | null>(null);
    const [deleteRequest, setDeleteRequest] = useState<LeaveRequest | null>(null);
    const [filters, setFilters] = useState({ resourceId: '', typeId: '', status: '' });
    
    // Conflict Detection State
    const [conflictModalOpen, setConflictModalOpen] = useState(false);
    const [conflictData, setConflictData] = useState<{ resourceName: string, conflicts: string[] } | null>(null);
    const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

    const emptyRequest: Omit<LeaveRequest, 'id'> = {
        resourceId: '',
        typeId: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        status: 'PENDING',
        notes: '',
        approverIds: [],
        isHalfDay: false
    };

    // Auto-populate resource if user is linked
    useEffect(() => {
        if (isModalOpen && editingRequest && !('id' in editingRequest) && user?.resourceId && !editingRequest.resourceId) {
            setEditingRequest(prev => prev ? ({ ...prev, resourceId: user.resourceId! }) : null);
        }
    }, [isModalOpen, editingRequest, user]);

    // --- KPI Data ---
    const kpis = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        
        // My Pending Requests
        const myPending = user?.resourceId ? leaveRequests.filter(l => l.resourceId === user.resourceId && l.status === 'PENDING').length : 0;
        
        // Waiting for Approval (If user is manager/admin)
        const toApprove = leaveRequests.filter(l => 
            l.status === 'PENDING' && 
            (isAdmin || (user?.resourceId && l.approverIds?.includes(user.resourceId)))
        ).length;

        // Absent Today
        const absentToday = leaveRequests.filter(l => 
            l.status === 'APPROVED' && 
            today >= l.startDate && 
            today <= l.endDate
        ).length;

        return { myPending, toApprove, absentToday };
    }, [leaveRequests, user, isAdmin]);

    // --- Data Preparation ---
    const enrichedRequests = useMemo<EnrichedLeaveRequest[]>(() => {
        return leaveRequests.map(req => {
            const resource = resources.find(r => r.id === req.resourceId);
            const type = leaveTypes.find(t => t.id === req.typeId);
            
            const approverNames = req.approverIds
                ? req.approverIds.map(id => resources.find(r => r.id === id)?.name).filter(Boolean).join(', ')
                : 'Nessuno';

            return {
                ...req,
                resourceName: resource?.name || 'Sconosciuto',
                typeName: type?.name || 'N/A',
                typeColor: type?.color || '#ccc',
                approverNames
            };
        });
    }, [leaveRequests, resources, leaveTypes]);

    const filteredRequests = useMemo(() => {
        return enrichedRequests.filter(req => {
            // RESTRIZIONE VISIBILITÀ SIMPLE USER
            // Se l'utente è SIMPLE, può vedere solo le proprie richieste.
            if (user?.role === 'SIMPLE' && req.resourceId !== user.resourceId) {
                return false;
            }

            return (!filters.resourceId || req.resourceId === filters.resourceId) &&
                   (!filters.typeId || req.typeId === filters.typeId) &&
                   (!filters.status || req.status === filters.status);
        }).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    }, [enrichedRequests, filters, user]);

    // --- Options ---
    const resourceOptions = useMemo(() => {
        let list = resources.filter(r => !r.resigned);
        // Se l'utente è SIMPLE, restringiamo le opzioni di filtro alla sola sua risorsa
        if (user?.role === 'SIMPLE' && user.resourceId) {
            list = list.filter(r => r.id === user.resourceId);
        }
        return list.map(r => ({ value: r.id!, label: r.name }));
    }, [resources, user]);

    const typeOptions = useMemo(() => leaveTypes.map(t => ({ value: t.id!, label: t.name })), [leaveTypes]);
    
    const approverOptions = useMemo(() => {
        // Only resources linked to Manager/Admin users
        return resources
            .filter(r => managerResourceIds.includes(r.id!))
            .map(r => ({ value: r.id!, label: r.name }));
    }, [resources, managerResourceIds]);

    const statusOptions = [
        { value: 'PENDING', label: 'In Attesa' },
        { value: 'APPROVED', label: 'Approvata' },
        { value: 'REJECTED', label: 'Rifiutata' }
    ];

    // --- Handlers ---
    const handleFilterChange = (name: string, value: string) => setFilters(prev => ({ ...prev, [name]: value }));
    const resetFilters = () => setFilters({ resourceId: '', typeId: '', status: '' });

    const openModalForNew = () => {
        setEditingRequest(emptyRequest);
        setIsModalOpen(true);
    };

    const openModalForEdit = (req: LeaveRequest) => {
        setEditingRequest({
            ...req,
            startDate: req.startDate.split('T')[0],
            endDate: req.endDate.split('T')[0],
            approverIds: req.approverIds || [],
            isHalfDay: req.isHalfDay || false
        });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingRequest(null);
    };

    // --- Helper for Assignments Access ---
    const { projects, assignments } = useEntitiesContext();

    const performConflictCheck = (resourceId: string, start: string, end: string, isHalfDay: boolean = false): string[] => {
        const conflicts: string[] = [];
        const startDate = new Date(start);
        const endDate = new Date(end);

        const userAssignments = assignments.filter(a => a.resourceId === resourceId);
        
        userAssignments.forEach(assignment => {
            const assignmentAllocations = allocations[assignment.id!];
            if (assignmentAllocations) {
                let hasConflict = false;
                for (const dateStr in assignmentAllocations) {
                    const date = new Date(dateStr);
                    if (date >= startDate && date <= endDate) {
                        const allocation = assignmentAllocations[dateStr] || 0;
                        const leaveImpact = isHalfDay ? 50 : 100;
                        
                        // Conflitto se la somma supera il 100%
                        if ((allocation + leaveImpact) > 100) {
                            hasConflict = true;
                            break;
                        }
                    }
                }
                if (hasConflict) {
                    const project = projects.find(p => p.id === assignment.projectId);
                    conflicts.push(`Progetto: ${project?.name || 'Sconosciuto'} (Sovraccarico)`);
                }
            }
        });
        
        return [...new Set(conflicts)];
    };

    const saveRequest = async () => {
        if (!editingRequest) return;
        try {
            if ('id' in editingRequest) {
                await updateLeaveRequest(editingRequest as LeaveRequest);
            } else {
                await addLeaveRequest(editingRequest as Omit<LeaveRequest, 'id'>);
            }
            handleCloseModal();
        } catch (e) {}
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRequest) return;

        // Validation: 3 Approvers
        if (!editingRequest.approverIds || editingRequest.approverIds.length < 3) {
            addToast('Devi selezionare almeno 3 Manager per l\'approvazione.', 'error');
            return;
        }

        // Check conflicts
        const conflicts = performConflictCheck(
            editingRequest.resourceId, 
            editingRequest.startDate, 
            editingRequest.endDate,
            editingRequest.isHalfDay
        );
        
        if (conflicts.length > 0) {
            const resourceName = resources.find(r => r.id === editingRequest.resourceId)?.name || 'Risorsa';
            setConflictData({ resourceName, conflicts });
            setPendingAction(() => saveRequest);
            setConflictModalOpen(true);
        } else {
            await saveRequest();
        }
    };

    const handleApprove = async (req: LeaveRequest) => {
        const conflicts = performConflictCheck(req.resourceId, req.startDate, req.endDate, req.isHalfDay);
        const action = async () => {
            // Track WHO approved it (managerId) but keep approverIds list intact
            await updateLeaveRequest({ ...req, status: 'APPROVED', managerId: user?.resourceId || null });
        };

        if (conflicts.length > 0) {
            const resourceName = resources.find(r => r.id === req.resourceId)?.name || 'Risorsa';
            setConflictData({ resourceName, conflicts });
            setPendingAction(() => action);
            setConflictModalOpen(true);
        } else {
            await action();
        }
    };

    const handleReject = async (req: LeaveRequest) => {
        await updateLeaveRequest({ ...req, status: 'REJECTED', managerId: user?.resourceId || null });
    };

    const handleConflictConfirm = async () => {
        if (pendingAction) {
            await pendingAction();
        }
        setConflictModalOpen(false);
        setPendingAction(null);
        setConflictData(null);
    };

    const canApprove = (req: LeaveRequest) => {
        if (req.status !== 'PENDING') return false;
        if (isAdmin) return true;
        // Can approve if I am in the list of approvers
        return user?.resourceId && req.approverIds?.includes(user.resourceId);
    };

    // --- Columns ---
    const columns: ColumnDef<EnrichedLeaveRequest>[] = [
        { header: 'Risorsa', sortKey: 'resourceName', cell: r => <span className="font-medium text-on-surface sticky left-0 bg-inherit pl-6">{r.resourceName}</span> },
        { header: 'Tipo', sortKey: 'typeName', cell: r => (
            <span className="inline-flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: r.typeColor }}></span>
                {r.typeName}
                {r.isHalfDay && <span className="text-xs bg-secondary-container text-on-secondary-container px-1 rounded">1/2</span>}
            </span>
        )},
        // Utilizzo formatDateFull per visualizzare GG/MM/AAAA
        { header: 'Periodo', sortKey: 'startDate', cell: r => <span className="text-sm text-on-surface-variant">{formatDateFull(r.startDate)} - {formatDateFull(r.endDate)}</span> },
        { header: 'Giorni (Lav.)', cell: r => {
            const resource = resources.find(res => res.id === r.resourceId);
            const workingDays = getWorkingDaysBetween(
                new Date(r.startDate), 
                new Date(r.endDate), 
                companyCalendar, 
                resource?.location || null
            );
            const effectiveDays = r.isHalfDay ? workingDays * 0.5 : workingDays;
            
            return <span className="text-sm font-semibold">{effectiveDays} gg</span>;
        }},
        { header: 'Richiesto A', cell: r => <span className="text-xs text-on-surface-variant truncate max-w-xs block" title={r.approverNames}>{r.approverNames}</span> },
        { header: 'Stato', sortKey: 'status', cell: r => <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusBadgeClass(r.status)}`}>{r.status}</span> },
        { header: 'Note', cell: r => <span className="text-xs text-on-surface-variant truncate max-w-xs block" title={r.notes}>{r.notes}</span> }
    ];

    const renderRow = (req: EnrichedLeaveRequest) => (
        <tr key={req.id} className="hover:bg-surface-container group">
            {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap bg-inherit">{col.cell(req)}</td>)}
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium bg-inherit">
                {/* Changed justify-end to justify-center to keep buttons visible in sticky column */}
                <div className="flex items-center justify-center space-x-2 w-full">
                    {/* Quick Action: Approve directly in table with visible styling */}
                    {canApprove(req) && (
                        <>
                            <button onClick={() => handleApprove(req)} className="text-green-600 hover:bg-green-100 p-1 rounded transition-colors" title="Approva">
                                <span className="material-symbols-outlined">check_circle</span>
                            </button>
                            <button onClick={() => handleReject(req)} className="text-red-600 hover:bg-red-100 p-1 rounded transition-colors" title="Rifiuta">
                                <span className="material-symbols-outlined">cancel</span>
                            </button>
                        </>
                    )}
                    {(isAdmin || req.resourceId === user?.resourceId) && (
                        <>
                            <button onClick={() => openModalForEdit(req)} className="text-on-surface-variant hover:text-primary p-1 rounded" title="Modifica">
                                <span className="material-symbols-outlined">edit</span>
                            </button>
                            <button onClick={() => setDeleteRequest(req)} className="text-on-surface-variant hover:text-error p-1 rounded" title="Elimina">
                                <span className="material-symbols-outlined">delete</span>
                            </button>
                        </>
                    )}
                </div>
            </td>
        </tr>
    );

    const renderMobileCard = (req: EnrichedLeaveRequest) => (
        <div className={`p-4 rounded-lg shadow-md bg-surface-container border-l-4 mb-4 flex flex-col gap-2`} style={{ borderLeftColor: req.typeColor }}>
            <div className="flex justify-between items-start">
                <h3 className="font-bold text-lg text-on-surface">{req.resourceName}</h3>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusBadgeClass(req.status)}`}>{req.status}</span>
            </div>
            <div className="flex justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                    {req.typeName}
                    {req.isHalfDay && <span className="text-[10px] bg-secondary-container text-on-secondary-container px-1 rounded">1/2</span>}
                </span>
                <span className="text-on-surface-variant">{formatDateFull(req.startDate)} - {formatDateFull(req.endDate)}</span>
            </div>
            <p className="text-xs text-on-surface-variant">Approvatori: {req.approverNames}</p>
            {req.notes && <p className="text-xs text-on-surface-variant italic">{req.notes}</p>}
            <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-outline-variant">
                 {canApprove(req) && (
                    <>
                        <button onClick={() => handleApprove(req)} className="text-tertiary font-medium text-sm">Approva</button>
                        <button onClick={() => handleReject(req)} className="text-error font-medium text-sm">Rifiuta</button>
                    </>
                )}
                <button onClick={() => openModalForEdit(req)} className="text-primary font-medium text-sm">Modifica</button>
            </div>
        </div>
    );

    const filtersNode = (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <SearchableSelect name="resourceId" value={filters.resourceId} onChange={handleFilterChange} options={resourceOptions} placeholder="Tutte le Risorse"/>
            <SearchableSelect name="typeId" value={filters.typeId} onChange={handleFilterChange} options={typeOptions} placeholder="Tutti i Tipi"/>
            <SearchableSelect name="status" value={filters.status} onChange={handleFilterChange} options={statusOptions} placeholder="Tutti gli Stati"/>
            <button onClick={resetFilters} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full hover:opacity-90 w-full">Reset</button>
        </div>
    );

    return (
        <div>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div 
                    className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-primary cursor-pointer hover:shadow-md"
                    onClick={() => user?.resourceId && setFilters(f => ({...f, resourceId: user.resourceId!, status: 'PENDING'}))}
                >
                    <p className="text-sm text-on-surface-variant">Le Mie Richieste Pendenti</p>
                    <p className="text-2xl font-bold text-on-surface">{kpis.myPending}</p>
                </div>
                <div 
                    className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-yellow-500 cursor-pointer hover:shadow-md"
                    onClick={() => setFilters(f => ({...f, status: 'PENDING', resourceId: ''}))}
                >
                    <p className="text-sm text-on-surface-variant">Da Approvare (Team)</p>
                    <p className="text-2xl font-bold text-on-surface">{kpis.toApprove}</p>
                </div>
                <div 
                    className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-tertiary cursor-pointer hover:shadow-md"
                    onClick={() => setFilters(f => ({...f, status: 'APPROVED', resourceId: ''}))}
                >
                    <p className="text-sm text-on-surface-variant">Assenti Oggi</p>
                    <p className="text-2xl font-bold text-on-surface">{kpis.absentToday}</p>
                </div>
            </div>

            <DataTable<EnrichedLeaveRequest>
                title="Gestione Assenze"
                addNewButtonLabel="Nuova Richiesta"
                data={filteredRequests}
                columns={columns}
                filtersNode={filtersNode}
                onAddNew={openModalForNew}
                renderRow={renderRow}
                renderMobileCard={renderMobileCard}
                initialSortKey="startDate"
                isLoading={loading}
                tableLayout={{ dense: true, striped: true, headerSticky: true }}
                numActions={4} // APPROVA, RIFIUTA, MODIFICA, ELIMINA
            />

            {/* Edit/Create Modal */}
            {editingRequest && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingRequest ? 'Modifica Richiesta' : 'Nuova Richiesta'}>
                    <form onSubmit={handleSubmit} className="space-y-4 flex flex-col max-h-[80vh]">
                        <div className="flex-grow overflow-y-auto space-y-4 px-1">
                            <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-1">Risorsa Richiedente *</label>
                                <SearchableSelect name="resourceId" value={editingRequest.resourceId} onChange={(name, val) => setEditingRequest(prev => prev ? ({...prev, [name]: val}) : null)} options={resourceOptions} required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-1">Tipologia Assenza *</label>
                                <SearchableSelect name="typeId" value={editingRequest.typeId} onChange={(name, val) => setEditingRequest(prev => prev ? ({...prev, [name]: val}) : null)} options={typeOptions} required />
                            </div>
                            
                            <div className="bg-surface-container-low p-3 rounded border border-outline-variant">
                                <label className="block text-sm font-bold text-primary mb-1">Richiedi Approvazione a (Min. 3) *</label>
                                <p className="text-xs text-on-surface-variant mb-2">Seleziona almeno 3 Manager. Basta l'approvazione di uno solo.</p>
                                <MultiSelectDropdown 
                                    name="approverIds" 
                                    selectedValues={editingRequest.approverIds || []} 
                                    onChange={(_, val) => setEditingRequest(prev => prev ? ({...prev, approverIds: val}) : null)}
                                    options={approverOptions}
                                    placeholder="Seleziona Manager..."
                                />
                                {editingRequest.approverIds && editingRequest.approverIds.length < 3 && (
                                    <p className="text-xs text-error mt-1">Selezionati: {editingRequest.approverIds.length}/3</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Data Inizio *</label>
                                    <input 
                                        type="date" 
                                        value={editingRequest.startDate} 
                                        onChange={e => {
                                            const newVal = e.target.value;
                                            setEditingRequest(prev => prev ? ({
                                                ...prev, 
                                                startDate: newVal,
                                                // Auto disable half day if dates differ
                                                isHalfDay: newVal !== prev.endDate ? false : prev.isHalfDay
                                            }) : null);
                                        }} 
                                        className="form-input" 
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Data Fine *</label>
                                    <input 
                                        type="date" 
                                        value={editingRequest.endDate} 
                                        onChange={e => {
                                            const newVal = e.target.value;
                                            setEditingRequest(prev => prev ? ({
                                                ...prev, 
                                                endDate: newVal,
                                                // Auto disable half day if dates differ
                                                isHalfDay: prev.startDate !== newVal ? false : prev.isHalfDay
                                            }) : null);
                                        }} 
                                        className="form-input" 
                                        required 
                                    />
                                </div>
                            </div>

                            {editingRequest.startDate && editingRequest.endDate && editingRequest.startDate === editingRequest.endDate && (
                                <div className="flex items-center gap-2 p-2 bg-secondary-container/30 rounded border border-secondary-container">
                                    <input 
                                        type="checkbox" 
                                        id="isHalfDay"
                                        checked={editingRequest.isHalfDay} 
                                        onChange={e => setEditingRequest(prev => prev ? ({...prev, isHalfDay: e.target.checked}) : null)}
                                        className="form-checkbox text-primary rounded"
                                    />
                                    <label htmlFor="isHalfDay" className="text-sm font-medium text-on-surface cursor-pointer">
                                        Richiedi solo mezza giornata
                                    </label>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-1">Stato</label>
                                <select value={editingRequest.status} onChange={e => setEditingRequest(prev => prev ? ({...prev, status: e.target.value as LeaveStatus}) : null)} className="form-select">
                                    {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-1">Note</label>
                                <textarea value={editingRequest.notes || ''} onChange={e => setEditingRequest(prev => prev ? ({...prev, notes: e.target.value}) : null)} className="form-textarea" rows={3}></textarea>
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2 pt-4 border-t border-outline-variant">
                            <button type="button" onClick={handleCloseModal} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addLeaveRequest') || isActionLoading('updateLeaveRequest')} className="flex justify-center items-center px-6 py-2 bg-primary text-on-primary rounded-full disabled:opacity-50">
                                {isActionLoading('addLeaveRequest') || isActionLoading('updateLeaveRequest') ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Conflict Modal */}
            <ConfirmationModal 
                isOpen={conflictModalOpen}
                onClose={() => { setConflictModalOpen(false); setPendingAction(null); }}
                onConfirm={handleConflictConfirm}
                title="Rilevato Conflitto di Allocazione"
                message={
                    <div>
                        <p className="mb-2">Attenzione: <strong>{conflictData?.resourceName}</strong> risulta avere allocazioni attive che superano il 100% di capacità considerando l'assenza richiesta:</p>
                        <ul className="list-disc list-inside mb-4 text-sm text-on-surface">
                            {conflictData?.conflicts.map(c => <li key={c}>{c}</li>)}
                        </ul>
                        <p>Procedendo, le ferie verranno registrate ma le allocazioni esistenti <strong>NON verranno rimosse automaticamente</strong>. Si consiglia di verificare lo staffing.</p>
                        <p className="mt-2 font-semibold">Vuoi procedere comunque?</p>
                    </div>
                }
                confirmButtonText="Procedi Comunque"
                cancelButtonText="Annulla"
            />

            {/* Delete Confirmation */}
            {deleteRequest && (
                <ConfirmationModal 
                    isOpen={!!deleteRequest}
                    onClose={() => setDeleteRequest(null)}
                    onConfirm={async () => {
                        await deleteLeaveRequest(deleteRequest.id!);
                        setDeleteRequest(null);
                    }}
                    title="Elimina Richiesta"
                    message="Sei sicuro di voler eliminare questa richiesta di assenza?"
                    isConfirming={isActionLoading(`deleteLeaveRequest-${deleteRequest.id}`)}
                />
            )}
        </div>
    );
};

export default LeavePage;
