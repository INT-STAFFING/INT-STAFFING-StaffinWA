
import React, { useState, useMemo, useEffect } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { ProjectActivity, ActivityStatus, Project } from '../types';
import SearchableSelect from '../components/SearchableSelect';
import { DataTable, ColumnDef } from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import { SpinnerIcon } from '../components/icons';
import { formatDateFull } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';
import { useSearchParams } from 'react-router-dom';

type EnrichedActivity = ProjectActivity & {
    ownerName: string;
};

const getStatusColor = (status: ActivityStatus) => {
    switch (status) {
        case 'In linea': return 'bg-tertiary-container text-on-tertiary-container';
        case 'In ritardo': return 'bg-error-container text-on-error-container';
        case 'Conclusa': return 'bg-primary-container text-on-primary-container';
        case 'Non Iniziata': return 'bg-surface-variant text-on-surface-variant';
        default: return 'bg-surface-container text-on-surface';
    }
};

const ProjectActivitiesPage: React.FC = () => {
    const { 
        projects, projectActivities, resources, assignments,
        addProjectActivity, updateProjectActivity, deleteProjectActivity,
        isActionLoading, loading 
    } = useEntitiesContext();
    const { user, isAdmin } = useAuth();
    const { addToast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();

    // Selection State
    const [selectedProjectId, setSelectedProjectId] = useState<string>(searchParams.get('projectId') || '');

    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState<ProjectActivity | Omit<ProjectActivity, 'id' | 'updatedAt'> | null>(null);
    const [activityToDelete, setActivityToDelete] = useState<ProjectActivity | null>(null);
    
    // Filters
    const [filters, setFilters] = useState({ status: '', ownerId: '' });

    // Computed Data
    const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
    
    // Auth Check: Is User the PM?
    const isProjectManager = useMemo(() => {
        if (!selectedProject || !user) return false;
        if (isAdmin) return true;
        // User resource name vs Project Manager String
        // NOTE: Ideally we check IDs, but project.projectManager is a string currently. 
        // We look up the logged-in user's resource.
        const userResource = resources.find(r => r.id === user.resourceId);
        return userResource?.name === selectedProject.projectManager;
    }, [selectedProject, user, isAdmin, resources]);

    // Data for Table
    const tableData = useMemo<EnrichedActivity[]>(() => {
        if (!selectedProjectId) return [];
        return projectActivities
            .filter(a => a.projectId === selectedProjectId)
            .filter(a => !filters.status || a.status === filters.status)
            .filter(a => !filters.ownerId || a.ownerId === filters.ownerId)
            .map(a => ({
                ...a,
                ownerName: resources.find(r => r.id === a.ownerId)?.name || 'N/A'
            }));
    }, [projectActivities, selectedProjectId, filters, resources]);

    // Derived: Project Team (for Owner dropdown)
    const projectTeamOptions = useMemo(() => {
        if (!selectedProjectId) return [];
        const teamIds = assignments
            .filter(a => a.projectId === selectedProjectId)
            .map(a => a.resourceId);
        return resources
            .filter(r => teamIds.includes(r.id!) && !r.resigned)
            .map(r => ({ value: r.id!, label: r.name }));
    }, [selectedProjectId, assignments, resources]);

    const statusOptions = [
        { value: 'Non Iniziata', label: 'Non Iniziata' },
        { value: 'In linea', label: 'In linea' },
        { value: 'In ritardo', label: 'In ritardo' },
        { value: 'Conclusa', label: 'Conclusa' },
    ];

    // Handlers
    const handleProjectChange = (name: string, value: string) => {
        setSelectedProjectId(value);
        setSearchParams(value ? { projectId: value } : {});
        setFilters({ status: '', ownerId: '' });
    };

    const openNewModal = () => {
        setEditingActivity({
            projectId: selectedProjectId,
            description: '',
            ownerId: '',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            status: 'Non Iniziata',
            notes: ''
        });
        setIsModalOpen(true);
    };

    const openEditModal = (act: ProjectActivity) => {
        setEditingActivity({
            ...act,
            startDate: act.startDate ? act.startDate.split('T')[0] : '',
            endDate: act.endDate ? act.endDate.split('T')[0] : '',
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingActivity) return;
        try {
            if ('id' in editingActivity) {
                await updateProjectActivity(editingActivity as ProjectActivity);
            } else {
                await addProjectActivity(editingActivity as Omit<ProjectActivity, 'id' | 'updatedAt'>);
            }
            setIsModalOpen(false);
            setEditingActivity(null);
        } catch (e) {
            // Error handled by context
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        if (editingActivity) {
            setEditingActivity({ ...editingActivity, [e.target.name]: e.target.value });
        }
    };

    // Columns
    const columns: ColumnDef<EnrichedActivity>[] = [
        { header: 'Attività', sortKey: 'description', cell: a => <span className="font-medium text-on-surface">{a.description}</span> },
        { header: 'Owner', sortKey: 'ownerName', cell: a => <span className="text-sm text-on-surface-variant">{a.ownerName}</span> },
        { header: 'Periodo', sortKey: 'startDate', cell: a => <span className="text-xs">{formatDateFull(a.startDate)} - {formatDateFull(a.endDate)}</span> },
        { header: 'Stato', sortKey: 'status', cell: a => <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusColor(a.status)}`}>{a.status}</span> },
        { header: 'Note', cell: a => <span className="text-xs text-on-surface-variant truncate max-w-[200px] block" title={a.notes}>{a.notes}</span> },
        { header: 'Ultimo Aggiornamento', sortKey: 'updatedAt', cell: a => <span className="text-xs text-on-surface-variant">{new Date(a.updatedAt).toLocaleDateString()}</span> },
    ];

    const renderRow = (act: EnrichedActivity) => (
        <tr key={act.id} className="hover:bg-surface-container">
            {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap bg-inherit">{col.cell(act)}</td>)}
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium bg-inherit">
                <div className="flex items-center justify-end space-x-2">
                    <button onClick={() => openEditModal(act)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary"><span className="material-symbols-outlined">edit</span></button>
                    <button onClick={() => setActivityToDelete(act)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-error"><span className="material-symbols-outlined">delete</span></button>
                </div>
            </td>
        </tr>
    );

    const renderCard = (act: EnrichedActivity) => (
        <div key={act.id} className="p-4 rounded-lg shadow-md bg-surface-container border-l-4 mb-4 border-primary">
            <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-on-surface">{act.description}</h3>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusColor(act.status)}`}>{act.status}</span>
            </div>
            <div className="text-sm text-on-surface-variant space-y-1">
                <p>Owner: <strong>{act.ownerName}</strong></p>
                <p>Periodo: {formatDateFull(act.startDate)} - {formatDateFull(act.endDate)}</p>
                {act.notes && <p className="italic bg-surface p-1 rounded text-xs mt-2">{act.notes}</p>}
            </div>
            <div className="flex justify-end gap-2 mt-3 border-t border-outline-variant pt-2">
                <button onClick={() => openEditModal(act)} className="text-primary text-sm font-medium">Modifica</button>
                <button onClick={() => setActivityToDelete(act)} className="text-error text-sm font-medium">Elimina</button>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-on-surface">Attività di Progetto</h1>
            </div>

            {/* Project Selector */}
            <div className="bg-surface rounded-2xl shadow p-4">
                <label className="block text-sm font-medium text-on-surface-variant mb-2">Seleziona Progetto</label>
                <SearchableSelect 
                    name="projectSelector" 
                    value={selectedProjectId} 
                    onChange={handleProjectChange} 
                    options={projects.map(p => ({ value: p.id!, label: p.name }))} 
                    placeholder="Cerca progetto..."
                />
            </div>

            {!selectedProjectId ? (
                <div className="text-center py-12 bg-surface rounded-2xl shadow border-dashed border-2 border-outline-variant">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">task</span>
                    <p className="text-on-surface-variant">Seleziona un progetto per visualizzare le attività.</p>
                </div>
            ) : !isProjectManager ? (
                <div className="text-center py-12 bg-surface rounded-2xl shadow border-l-4 border-error">
                    <span className="material-symbols-outlined text-4xl text-error mb-2">lock</span>
                    <p className="text-on-surface font-bold">Accesso Negato</p>
                    <p className="text-on-surface-variant">Solo il Project Manager ({selectedProject?.projectManager}) può vedere e gestire le attività di questo progetto.</p>
                </div>
            ) : (
                <div className="animate-fade-in space-y-6">
                    {/* Info Card */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-surface-container-low p-4 rounded-xl border-l-4 border-primary shadow-sm">
                            <p className="text-xs text-on-surface-variant uppercase">Stato Progetto</p>
                            <p className="text-lg font-bold text-on-surface">{selectedProject?.status}</p>
                        </div>
                        <div className="bg-surface-container-low p-4 rounded-xl border-l-4 border-secondary shadow-sm">
                             <p className="text-xs text-on-surface-variant uppercase">Project Manager</p>
                             <p className="text-lg font-bold text-on-surface">{selectedProject?.projectManager}</p>
                        </div>
                        <div className="bg-surface-container-low p-4 rounded-xl border-l-4 border-tertiary shadow-sm">
                             <p className="text-xs text-on-surface-variant uppercase">Scadenza Progetto</p>
                             <p className="text-lg font-bold text-on-surface">{formatDateFull(selectedProject?.endDate)}</p>
                        </div>
                    </div>

                    {/* Filters & Actions */}
                    <div className="flex flex-col md:flex-row justify-between items-end gap-4 bg-surface rounded-2xl shadow p-4">
                        <div className="flex gap-4 w-full md:w-auto">
                            <div className="w-48">
                                <label className="text-xs font-medium text-on-surface-variant mb-1 block">Filtra per Stato</label>
                                <select 
                                    className="form-select text-sm py-1"
                                    value={filters.status} 
                                    onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
                                >
                                    <option value="">Tutti</option>
                                    {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            <div className="w-48">
                                <label className="text-xs font-medium text-on-surface-variant mb-1 block">Filtra per Owner</label>
                                <SearchableSelect 
                                    name="ownerFilter"
                                    value={filters.ownerId}
                                    onChange={(_, v) => setFilters(prev => ({ ...prev, ownerId: v }))}
                                    options={projectTeamOptions}
                                    placeholder="Tutti"
                                />
                            </div>
                        </div>
                        <button 
                            onClick={openNewModal}
                            disabled={selectedProject?.status !== 'In corso'}
                            className="px-4 py-2 bg-primary text-on-primary rounded-full font-medium shadow hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            title={selectedProject?.status !== 'In corso' ? 'Il progetto deve essere In corso per aggiungere attività' : ''}
                        >
                            <span className="material-symbols-outlined text-sm">add_task</span> Nuova Attività
                        </button>
                    </div>

                    <DataTable<EnrichedActivity>
                        title=""
                        addNewButtonLabel=""
                        data={tableData}
                        columns={columns}
                        filtersNode={null} 
                        onAddNew={() => {}}
                        renderRow={renderRow}
                        renderMobileCard={renderCard}
                        initialSortKey="startDate"
                        isLoading={loading}
                        tableLayout={{ dense: true, striped: true, headerSticky: true }}
                        numActions={2}
                    />
                </div>
            )}

            {/* Modal */}
            {isModalOpen && editingActivity && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={'id' in editingActivity ? 'Modifica Attività' : 'Nuova Attività'}>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Descrizione Attività *</label>
                            <input type="text" name="description" value={editingActivity.description} onChange={handleChange} required className="form-input"/>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium mb-1">Owner (Responsabile) *</label>
                            <SearchableSelect 
                                name="ownerId" 
                                value={editingActivity.ownerId} 
                                onChange={(_, v) => setEditingActivity(prev => prev ? ({ ...prev, ownerId: v }) : null)}
                                options={projectTeamOptions}
                                placeholder="Seleziona dal team..."
                                required
                            />
                            {projectTeamOptions.length === 0 && <p className="text-xs text-error mt-1">Nessuna risorsa assegnata a questo progetto.</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium mb-1">Data Inizio *</label><input type="date" name="startDate" value={editingActivity.startDate} onChange={handleChange} required className="form-input"/></div>
                            <div><label className="block text-sm font-medium mb-1">Data Fine *</label><input type="date" name="endDate" value={editingActivity.endDate} onChange={handleChange} required className="form-input"/></div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Stato *</label>
                            <select name="status" value={editingActivity.status} onChange={handleChange} className="form-select">
                                {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Note</label>
                            <textarea name="notes" value={editingActivity.notes || ''} onChange={handleChange} className="form-textarea" rows={3}></textarea>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-outline rounded-full text-primary font-semibold">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addProjectActivity')} className="px-4 py-2 bg-primary text-on-primary rounded-full font-semibold disabled:opacity-50 flex items-center gap-2">
                                {isActionLoading('addProjectActivity') ? <SpinnerIcon className="w-4 h-4"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Delete Confirmation */}
             <ConfirmationModal
                isOpen={!!activityToDelete}
                onClose={() => setActivityToDelete(null)}
                onConfirm={async () => {
                    if(activityToDelete) {
                        await deleteProjectActivity(activityToDelete.id!);
                        setActivityToDelete(null);
                    }
                }}
                title="Elimina Attività"
                message="Sei sicuro di voler eliminare questa attività?"
                isConfirming={isActionLoading(`deleteProjectActivity-${activityToDelete?.id}`)}
            />
        </div>
    );
};

export default ProjectActivitiesPage;
