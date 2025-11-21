/**
 * @file LeavePage.tsx
 * @description Pagina per la gestione delle assenze (Ferie, Permessi, Malattia).
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { LeaveRequest, LeaveStatus, Resource } from '../types';
import { DataTable, ColumnDef } from '../components/DataTable';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { SpinnerIcon } from '../components/icons';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/dateUtils';

// --- Helper Types ---
type EnrichedLeaveRequest = LeaveRequest & {
    resourceName: string;
    typeName: string;
    typeColor: string;
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
        leaveRequests, resources, leaveTypes, 
        addLeaveRequest, updateLeaveRequest, deleteLeaveRequest, 
        isActionLoading, loading 
    } = useEntitiesContext();
    
    const { allocations } = useAllocationsContext();
    const { isAdmin } = useAuth();

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
        notes: ''
    };

    // --- Data Preparation ---
    const enrichedRequests = useMemo<EnrichedLeaveRequest[]>(() => {
        return leaveRequests.map(req => {
            const resource = resources.find(r => r.id === req.resourceId);
            const type = leaveTypes.find(t => t.id === req.typeId);
            return {
                ...req,
                resourceName: resource?.name || 'Sconosciuto',
                typeName: type?.name || 'N/A',
                typeColor: type?.color || '#ccc'
            };
        });
    }, [leaveRequests, resources, leaveTypes]);

    const filteredRequests = useMemo(() => {
        return enrichedRequests.filter(req => 
            (!filters.resourceId || req.resourceId === filters.resourceId) &&
            (!filters.typeId || req.typeId === filters.typeId) &&
            (!filters.status || req.status === filters.status)
        ).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    }, [enrichedRequests, filters]);

    // --- Options ---
    const resourceOptions = useMemo(() => resources.filter(r => !r.resigned).map(r => ({ value: r.id!, label: r.name })), [resources]);
    const typeOptions = useMemo(() => leaveTypes.map(t => ({ value: t.id!, label: t.name })), [leaveTypes]);
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
            endDate: req.endDate.split('T')[0]
        });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingRequest(null);
    };

    // --- Helper for Assignments Access ---
    const { assignments, projects } = useEntitiesContext(); // Get these for conflict check

    const performConflictCheck = (resourceId: string, start: string, end: string): string[] => {
        const conflicts: string[] = [];
        const startDate = new Date(start);
        const endDate = new Date(end);

        const userAssignments = assignments.filter(a => a.resourceId === resourceId);
        
        userAssignments.forEach(assignment => {
            const assignmentAllocations = allocations[assignment.id!];
            if (assignmentAllocations) {
                let hasAllocation = false;
                for (const dateStr in assignmentAllocations) {
                    const date = new Date(dateStr);
                    if (date >= startDate && date <= endDate && assignmentAllocations[dateStr] > 0) {
                        hasAllocation = true;
                        break;
                    }
                }
                if (hasAllocation) {
                    const project = projects.find(p => p.id === assignment.projectId);
                    conflicts.push(`Progetto: ${project?.name || 'Sconosciuto'}`);
                }
            }
        });
        
        return [...new Set(conflicts)]; // Unique projects
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

        // Check conflicts if status is APPROVED or if it's a new request that implies booking
        const conflicts = performConflictCheck(editingRequest.resourceId, editingRequest.startDate, editingRequest.endDate);
        
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
        const conflicts = performConflictCheck(req.resourceId, req.startDate, req.endDate);
        const action = async () => {
            await updateLeaveRequest({ ...req, status: 'APPROVED' });
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
        await updateLeaveRequest({ ...req, status: 'REJECTED' });
    };

    const handleConflictConfirm = async () => {
        if (pendingAction) {
            await pendingAction();
        }
        setConflictModalOpen(false);
        setPendingAction(null);
        setConflictData(null);
    };

    // --- Columns ---
    const columns: ColumnDef<EnrichedLeaveRequest>[] = [
        { header: 'Risorsa', sortKey: 'resourceName', cell: r => <span className="font-medium text-on-surface sticky left-0 bg-inherit pl-6">{r.resourceName}</span> },
        { header: 'Tipo', sortKey: 'typeName', cell: r => (
            <span className="inline-flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: r.typeColor }}></span>
                {r.typeName}
            </span>
        )},
        { header: 'Periodo', sortKey: 'startDate', cell: r => <span className="text-sm text-on-surface-variant">{formatDate(new Date(r.startDate), 'short')} - {formatDate(new Date(r.endDate), 'short')}</span> },
        { header: 'Giorni', cell: r => {
            const diff = Math.ceil((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
            return <span className="text-sm">{diff} gg</span>;
        }},
        { header: 'Stato', sortKey: 'status', cell: r => <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusBadgeClass(r.status)}`}>{r.status}</span> },
        { header: 'Note', cell: r => <span className="text-xs text-on-surface-variant truncate max-w-xs block" title={r.notes}>{r.notes}</span> }
    ];

    const renderRow = (req: EnrichedLeaveRequest) => (
        <tr key={req.id} className="hover:bg-surface-container group">
            {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap bg-inherit">{col.cell(req)}</td>)}
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium bg-inherit">
                <div className="flex items-center justify-end space-x-2">
                    {isAdmin && req.status === 'PENDING' && (
                        <>
                            <button onClick={() => handleApprove(req)} className="text-tertiary hover:bg-tertiary-container p-1 rounded" title="Approva">
                                <span className="material-symbols-outlined">check_circle</span>
                            </button>
                            <button onClick={() => handleReject(req)} className="text-error hover:bg-error-container p-1 rounded" title="Rifiuta">
                                <span className="material-symbols-outlined">cancel</span>
                            </button>
                        </>
                    )}
                    <button onClick={() => openModalForEdit(req)} className="text-on-surface-variant hover:text-primary p-1 rounded" title="Modifica">
                        <span className="material-symbols-outlined">edit</span>
                    </button>
                    <button onClick={() => setDeleteRequest(req)} className="text-on-surface-variant hover:text-error p-1 rounded" title="Elimina">
                        <span className="material-symbols-outlined">delete</span>
                    </button>
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
                <span className="font-medium">{req.typeName}</span>
                <span className="text-on-surface-variant">{formatDate(new Date(req.startDate), 'short')} - {formatDate(new Date(req.endDate), 'short')}</span>
            </div>
            {req.notes && <p className="text-xs text-on-surface-variant italic">{req.notes}</p>}
            <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-outline-variant">
                 {isAdmin && req.status === 'PENDING' && (
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
            />

            {/* Edit/Create Modal */}
            {editingRequest && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingRequest ? 'Modifica Richiesta' : 'Nuova Richiesta'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Risorsa *</label>
                            <SearchableSelect name="resourceId" value={editingRequest.resourceId} onChange={(name, val) => setEditingRequest(prev => prev ? ({...prev, [name]: val}) : null)} options={resourceOptions} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Tipologia *</label>
                            <SearchableSelect name="typeId" value={editingRequest.typeId} onChange={(name, val) => setEditingRequest(prev => prev ? ({...prev, [name]: val}) : null)} options={typeOptions} required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-1">Data Inizio *</label>
                                <input type="date" value={editingRequest.startDate} onChange={e => setEditingRequest(prev => prev ? ({...prev, startDate: e.target.value}) : null)} className="form-input" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-1">Data Fine *</label>
                                <input type="date" value={editingRequest.endDate} onChange={e => setEditingRequest(prev => prev ? ({...prev, endDate: e.target.value}) : null)} className="form-input" required />
                            </div>
                        </div>
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
                        <div className="flex justify-end space-x-2 pt-4">
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
                        <p className="mb-2">Attenzione: <strong>{conflictData?.resourceName}</strong> risulta avere allocazioni attive sui seguenti progetti nel periodo selezionato:</p>
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