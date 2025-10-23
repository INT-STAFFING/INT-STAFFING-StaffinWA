/**
 * @file ProjectsPage.tsx
 * @description Pagina per la gestione dei progetti (CRUD e visualizzazione).
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Project } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { PencilIcon, TrashIcon, CheckIcon, XMarkIcon, SpinnerIcon } from '../components/icons';
import { DataTable, ColumnDef } from '../components/DataTable';
import { useSearchParams } from 'react-router-dom';


type EnrichedProject = Project & { 
    clientName: string; 
    isStaffed: boolean;
    assignedResources: number;
};

const formatDateForDisplay = (dateStr: string | null): string => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('it-IT', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const ProjectsPage: React.FC = () => {
    const { projects, clients, resources, projectStatuses, contracts, addProject, updateProject, deleteProject, isActionLoading, assignments } = useEntitiesContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | Omit<Project, 'id'> | null>(null);
    const [filters, setFilters] = useState({ name: '', clientId: '', status: '' });
    const [showOnlyUnstaffed, setShowOnlyUnstaffed] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();

     useEffect(() => {
        const projectId = searchParams.get('projectId');
        const clientId = searchParams.get('clientId');
        const filter = searchParams.get('filter');

        if (projectId) {
            setFilters(prev => ({ ...prev, name: projects.find(p => p.id === projectId)?.name || '', clientId: '', status: '' }));
            setShowOnlyUnstaffed(false);
            setSearchParams({}, { replace: true });
        } else if (clientId) {
            setFilters(prev => ({ ...prev, clientId, name: '', status: '' }));
            setShowOnlyUnstaffed(false);
            setSearchParams({}, { replace: true });
        } else if (filter === 'unstaffed') {
            setShowOnlyUnstaffed(true);
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, setSearchParams, projects]);

    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
    const [inlineEditingData, setInlineEditingData] = useState<Project | null>(null);

    const emptyProject: Omit<Project, 'id'> = {
        name: '', clientId: '', startDate: '', endDate: '', budget: 0,
        realizationPercentage: 100, projectManager: '', status: projectStatuses[0]?.value || '', notes: '', contractId: null
    };
    
    const dataForTable = useMemo<EnrichedProject[]>(() => {
        const staffedProjectIds = new Set(assignments.map(a => a.projectId));
        return projects
            .filter(project => {
                const isStaffed = staffedProjectIds.has(project.id!);
                if(showOnlyUnstaffed && isStaffed) {
                    return false;
                }
                const nameMatch = project.name.toLowerCase().includes(filters.name.toLowerCase());
                const clientMatch = filters.clientId ? project.clientId === filters.clientId : true;
                const statusMatch = filters.status ? project.status === filters.status : true;
                return nameMatch && clientMatch && statusMatch;
            })
            .map(project => {
                const assignedResources = new Set(assignments.filter(a => a.projectId === project.id).map(a => a.resourceId)).size;
                return {
                    ...project,
                    clientName: clients.find(c => c.id === project.clientId)?.name || 'N/A',
                    isStaffed: staffedProjectIds.has(project.id!),
                    assignedResources,
                };
            });
    }, [projects, filters, clients, assignments, showOnlyUnstaffed]);
    
    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleFilterSelectChange = (name: string, value: string) => setFilters(prev => ({ ...prev, [name]: value }));
    const resetFilters = () => {
        setFilters({ name: '', clientId: '', status: '' });
        setShowOnlyUnstaffed(false);
    };

    const openModalForNew = () => { setEditingProject(emptyProject); setIsModalOpen(true); };
    const openModalForEdit = (project: Project) => { setEditingProject(project); setIsModalOpen(true); handleCancelInlineEdit(); };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingProject(null); };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingProject) {
            try {
                if ('id' in editingProject) await updateProject(editingProject as Project);
                else await addProject(editingProject as Omit<Project, 'id'>);
                handleCloseModal();
            } catch (e) {}
        }
    };
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (editingProject) {
            const { name, value } = e.target;
            const numericFields = ['budget', 'realizationPercentage'];
            setEditingProject({ ...editingProject, [name]: numericFields.includes(name) ? parseFloat(value) || 0 : value });
        }
    };

    const handleSelectChange = (name: string, value: string) => {
        if (editingProject) setEditingProject({ ...editingProject, [name]: value });
    };

    const handleStartInlineEdit = (project: Project) => { setInlineEditingId(project.id!); setInlineEditingData({ ...project }); };
    const handleCancelInlineEdit = () => { setInlineEditingId(null); setInlineEditingData(null); };

    const handleInlineFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (inlineEditingData) {
            const { name, value } = e.target;
            const numericFields = ['budget', 'realizationPercentage'];
            setInlineEditingData({ ...inlineEditingData, [name]: numericFields.includes(name) ? parseFloat(value) || 0 : value });
        }
    };
    
    const handleInlineSelectChange = (name: string, value: string) => {
        if (inlineEditingData) setInlineEditingData({ ...inlineEditingData, [name]: value });
    };

    const handleSaveInlineEdit = async () => { if (inlineEditingData) { await updateProject(inlineEditingData); handleCancelInlineEdit(); } };

    const getStatusBadgeClass = (status: string | null): string => {
        switch (status) {
            case 'Completato': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            case 'In pausa': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
            case 'In corso': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    };
    
    const clientOptions = useMemo(() => clients.sort((a,b)=>a.name.localeCompare(b.name)).map(c => ({ value: c.id!, label: c.name })), [clients]);
    const statusOptions = useMemo(() => projectStatuses.sort((a,b)=>a.value.localeCompare(b.value)).map(s => ({ value: s.value, label: s.value })), [projectStatuses]);
    const projectManagerOptions = useMemo(() => resources.map(r => ({ value: r.name, label: r.name })).sort((a,b) => a.label.localeCompare(b.label)), [resources]);
    const contractOptions = useMemo(() => contracts.map(c => ({ value: c.id!, label: c.name })), [contracts]);


    const columns: ColumnDef<EnrichedProject>[] = [
        { header: 'Nome Progetto', sortKey: 'name', cell: p => (
            <div className="flex items-center">
                <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                {!p.isStaffed && p.status === 'In corso' && <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-amber-800 bg-amber-100 dark:text-amber-100 dark:bg-amber-800 rounded-full">Senza Staff</span>}
            </div>
        )},
        { header: 'Cliente', sortKey: 'clientName', cell: p => <span className="text-sm text-gray-600 dark:text-gray-300">{p.clientName}</span> },
        { header: 'Risorse Assegnate', sortKey: 'assignedResources', cell: p => <span className="text-sm text-center font-semibold text-gray-600 dark:text-gray-300">{p.assignedResources}</span> },
        { header: 'Stato', sortKey: 'status', cell: p => <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(p.status)}`}>{p.status || 'Non definito'}</span> },
        { header: 'Data Inizio', sortKey: 'startDate', cell: p => <span className="text-sm text-gray-600 dark:text-gray-300">{formatDateForDisplay(p.startDate)}</span> },
        { header: 'Budget', sortKey: 'budget', cell: p => <span className="text-sm text-gray-600 dark:text-gray-300">{p.budget.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span> },
    ];
    
     const renderRow = (project: EnrichedProject) => {
        const isEditing = inlineEditingId === project.id;
        const isSaving = isActionLoading(`updateProject-${project.id}`);
        if(isEditing){
            return (
                <tr key={project.id}>
                    <td className="px-6 py-4"><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                    <td className="px-6 py-4"><SearchableSelect name="clientId" value={inlineEditingData!.clientId || ''} onChange={handleInlineSelectChange} options={clientOptions} placeholder="Nessun cliente" /></td>
                    <td className="px-6 py-4 text-center">{project.assignedResources}</td>
                    <td className="px-6 py-4"><SearchableSelect name="status" value={inlineEditingData!.status || ''} onChange={handleInlineSelectChange} options={statusOptions} placeholder="Nessuno stato" /></td>
                    <td className="px-6 py-4"><input type="date" name="startDate" value={inlineEditingData!.startDate || ''} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                    <td className="px-6 py-4"><input type="number" name="budget" value={inlineEditingData!.budget} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                    <td className="px-6 py-4 text-right"><div className="flex items-center justify-end space-x-2">
                        <button onClick={handleSaveInlineEdit} disabled={isSaving} className="p-1 text-green-600 hover:text-green-500 disabled:opacity-50">
                           {isSaving ? <SpinnerIcon className="w-5 h-5"/> : <CheckIcon className="w-5 h-5"/>}
                        </button>
                        <button onClick={handleCancelInlineEdit} className="p-1 text-gray-500 hover:text-gray-400"><XMarkIcon className="w-5 h-5"/></button>
                    </div></td>
                </tr>
            );
        }
        return (
            <tr key={project.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap">{col.cell(project)}</td>)}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-3">
                        <button onClick={() => openModalForEdit(project)} className="text-gray-500 hover:text-blue-600" title="Modifica Dettagli"><PencilIcon className="w-5 h-5"/></button>
                        <button onClick={() => handleStartInlineEdit(project)} className="text-gray-500 hover:text-green-600" title="Modifica Rapida"><PencilIcon className="w-5 h-5"/></button>
                        <button onClick={() => deleteProject(project.id!)} className="text-gray-500 hover:text-red-600" title="Elimina">
                             {isActionLoading(`deleteProject-${project.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <TrashIcon className="w-5 h-5"/>}
                        </button>
                    </div>
                </td>
            </tr>
        );
    };
    
    const renderMobileCard = (project: EnrichedProject) => {
        const isEditing = inlineEditingId === project.id;
        const isSaving = isActionLoading(`updateProject-${project.id}`);
        if (isEditing) {
            return (
               <div key={project.id} className="p-4 rounded-lg shadow-md bg-white dark:bg-gray-800 border border-blue-500">
                   <div className="space-y-3">
                       <div><label className="text-xs font-medium text-gray-500">Nome Progetto</label><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full form-input p-1" /></div>
                       <div><label className="text-xs font-medium text-gray-500">Cliente</label><SearchableSelect name="clientId" value={inlineEditingData!.clientId || ''} onChange={handleInlineSelectChange} options={clientOptions} placeholder="Nessun cliente" /></div>
                       <div><label className="text-xs font-medium text-gray-500">Stato</label><SearchableSelect name="status" value={inlineEditingData!.status || ''} onChange={handleInlineSelectChange} options={statusOptions} placeholder="Nessuno stato" /></div>
                       <div><label className="text-xs font-medium text-gray-500">Data Inizio</label><input type="date" name="startDate" value={inlineEditingData!.startDate || ''} onChange={handleInlineFormChange} className="w-full form-input p-1" /></div>
                       <div><label className="text-xs font-medium text-gray-500">Budget</label><input type="number" name="budget" value={inlineEditingData!.budget} onChange={handleInlineFormChange} className="w-full form-input p-1" /></div>
                       <div className="flex justify-end space-x-2 pt-2">
                           <button onClick={handleSaveInlineEdit} disabled={isSaving} className="p-2 bg-green-100 text-green-700 rounded-full disabled:opacity-50">
                                {isSaving ? <SpinnerIcon className="w-5 h-5"/> : <CheckIcon className="w-5 h-5"/>}
                           </button>
                           <button onClick={handleCancelInlineEdit} className="p-2 bg-gray-100 text-gray-700 rounded-full"><XMarkIcon className="w-5 h-5"/></button>
                       </div>
                   </div>
               </div>
           );
        }
        return (
            <div key={project.id} className="p-4 rounded-lg shadow-md bg-gray-50 dark:bg-gray-900/50">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="font-bold text-lg text-gray-900 dark:text-white">{project.name}</p>
                             {!project.isStaffed && project.status === 'In corso' && <span className="px-2 py-0.5 text-xs font-semibold text-amber-800 bg-amber-100 dark:text-amber-100 dark:bg-amber-800 rounded-full">Senza Staff</span>}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{project.clientName}</p>
                    </div>
                     <div className="flex items-center space-x-1 flex-shrink-0 ml-4">
                        <button onClick={() => openModalForEdit(project)} className="p-1 text-gray-500 hover:text-blue-600"><PencilIcon className="w-5 h-5"/></button>
                        <button onClick={() => handleStartInlineEdit(project)} className="p-1 text-gray-500 hover:text-green-600"><PencilIcon className="w-5 h-5"/></button>
                        <button onClick={() => deleteProject(project.id!)} className="p-1 text-gray-500 hover:text-red-600">
                             {isActionLoading(`deleteProject-${project.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <TrashIcon className="w-5 h-5"/>}
                        </button>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-gray-500 dark:text-gray-400">Stato</p><p><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(project.status)}`}>{project.status || 'Non definito'}</span></p></div>
                    <div><p className="text-gray-500 dark:text-gray-400">Risorse Assegnate</p><p className="font-medium text-gray-900 dark:text-white">{project.assignedResources}</p></div>
                    <div><p className="text-gray-500 dark:text-gray-400">Data Inizio</p><p className="font-medium text-gray-900 dark:text-white">{formatDateForDisplay(project.startDate)}</p></div>
                    <div><p className="text-gray-500 dark:text-gray-400">Budget</p><p className="font-medium text-gray-900 dark:text-white">{project.budget.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</p></div>
                </div>
            </div>
        );
    };
    
    const filtersNode = (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per nome..."/>
            <SearchableSelect name="clientId" value={filters.clientId} onChange={handleFilterSelectChange} options={clientOptions} placeholder="Tutti i clienti"/>
            <SearchableSelect name="status" value={filters.status} onChange={handleFilterSelectChange} options={statusOptions} placeholder="Tutti gli stati"/>
            <div className="flex items-center space-x-4">
                <div className="flex items-center">
                    <input id="unstaffed-filter" type="checkbox" checked={showOnlyUnstaffed} onChange={(e) => setShowOnlyUnstaffed(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <label htmlFor="unstaffed-filter" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">Solo senza staff</label>
                </div>
                <button onClick={resetFilters} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full md:w-auto">Reset</button>
            </div>
        </div>
    );
    
    return (
        <div>
            <DataTable<EnrichedProject>
                title="Gestione Progetti"
                addNewButtonLabel="Aggiungi Progetto"
                data={dataForTable}
                columns={columns}
                filtersNode={filtersNode}
                onAddNew={openModalForNew}
                renderRow={renderRow}
                renderMobileCard={renderMobileCard}
                initialSortKey="startDate"
            />
            
            {editingProject && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingProject ? 'Modifica Progetto' : 'Aggiungi Progetto'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome Progetto *</label>
                            <input type="text" name="name" value={editingProject.name} onChange={handleChange} required className="w-full form-input"/>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cliente</label>
                                <SearchableSelect name="clientId" value={editingProject.clientId || ''} onChange={handleSelectChange} options={clientOptions} placeholder="Seleziona un cliente" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contratto Associato</label>
                                <SearchableSelect name="contractId" value={editingProject.contractId || ''} onChange={handleSelectChange} options={contractOptions} placeholder="Nessun contratto" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Inizio</label>
                                <input type="date" name="startDate" value={editingProject.startDate || ''} onChange={handleChange} className="w-full form-input"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Fine</label>
                                <input type="date" name="endDate" value={editingProject.endDate || ''} onChange={handleChange} className="w-full form-input"/>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 items-end">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Budget (€)</label>
                                <input type="number" step="0.01" name="budget" value={editingProject.budget} onChange={handleChange} className="w-full form-input"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">% Realizzazione</label>
                                <input type="range" min="30" max="100" name="realizationPercentage" value={editingProject.realizationPercentage} onChange={handleChange} className="w-full"/>
                                <div className="text-center text-sm text-gray-500">{editingProject.realizationPercentage}%</div>
                            </div>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Manager</label>
                            <SearchableSelect name="projectManager" value={editingProject.projectManager || ''} onChange={handleSelectChange} options={projectManagerOptions} placeholder="Seleziona un PM" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stato</label>
                            <SearchableSelect name="status" value={editingProject.status || ''} onChange={handleSelectChange} options={statusOptions} placeholder="Seleziona uno stato" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Note</label>
                            <textarea name="notes" value={editingProject.notes || ''} onChange={handleChange} rows={3} className="w-full form-textarea"></textarea>
                        </div>
                        <div className="flex justify-end space-x-3 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 rounded-md">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addProject') || isActionLoading(`updateProject-${'id' in editingProject ? editingProject.id : ''}`)} className="flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400">
                               {(isActionLoading('addProject') || isActionLoading(`updateProject-${'id' in editingProject ? editingProject.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
            <style>{`.form-input, .form-select, .form-textarea { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-input, .dark .form-select, .dark .form-textarea { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }`}</style>
        </div>
    );
};

export default ProjectsPage;