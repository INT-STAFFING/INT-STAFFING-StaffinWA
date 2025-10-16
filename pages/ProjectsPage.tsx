/**
 * @file ProjectsPage.tsx
 * @description Pagina per la gestione dei progetti (CRUD e visualizzazione).
 */

import React, { useState, useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Project } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { PencilIcon, TrashIcon, CheckIcon, XMarkIcon, SpinnerIcon } from '../components/icons';
import { DataTable, ColumnDef } from '../components/DataTable';

type EnrichedProject = Project & { clientName: string };

const formatDateForDisplay = (dateStr: string | null): string => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('it-IT', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const ProjectsPage: React.FC = () => {
    const { projects, clients, resources, projectStatuses, addProject, updateProject, deleteProject, isActionLoading } = useEntitiesContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | Omit<Project, 'id'> | null>(null);
    const [filters, setFilters] = useState({ name: '', clientId: '', status: '' });

    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
    const [inlineEditingData, setInlineEditingData] = useState<Project | null>(null);

    const emptyProject: Omit<Project, 'id'> = {
        name: '', clientId: '', startDate: '', endDate: '', budget: 0,
        realizationPercentage: 100, projectManager: '', status: projectStatuses[0]?.value || '', notes: '',
    };
    
    const dataForTable = useMemo<EnrichedProject[]>(() => {
        return projects
            .filter(project => {
                const nameMatch = project.name.toLowerCase().includes(filters.name.toLowerCase());
                const clientMatch = filters.clientId ? project.clientId === filters.clientId : true;
                const statusMatch = filters.status ? project.status === filters.status : true;
                return nameMatch && clientMatch && statusMatch;
            })
            .map(project => ({
                ...project,
                clientName: clients.find(c => c.id === project.clientId)?.name || 'N/A',
            }));
    }, [projects, filters, clients]);
    
    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleFilterSelectChange = (name: string, value: string) => setFilters(prev => ({ ...prev, [name]: value }));
    const resetFilters = () => setFilters({ name: '', clientId: '', status: '' });

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
            case 'Completato': return 'bg-accent-teal/20 text-accent-teal';
            case 'In pausa': return 'bg-accent-orange/20 text-accent-orange';
            case 'In corso': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'; // Kept blue for variety
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    };
    
    const clientOptions = useMemo(() => clients.sort((a,b)=>a.name.localeCompare(b.name)).map(c => ({ value: c.id!, label: c.name })), [clients]);
    const statusOptions = useMemo(() => projectStatuses.sort((a,b)=>a.value.localeCompare(b.value)).map(s => ({ value: s.value, label: s.value })), [projectStatuses]);
    const projectManagerOptions = useMemo(() => resources.map(r => ({ value: r.name, label: r.name })).sort((a,b) => a.label.localeCompare(b.label)), [resources]);

    const columns: ColumnDef<EnrichedProject>[] = [
        { header: 'Nome Progetto', sortKey: 'name', cell: p => <span className="font-medium text-primary-dark dark:text-primary-light">{p.name}</span> },
        { header: 'Cliente', sortKey: 'clientName', cell: p => <span className="text-sm text-gray-600 dark:text-gray-300">{p.clientName}</span> },
        { header: 'Stato', sortKey: 'status', cell: p => <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(p.status)}`}>{p.status || 'Non definito'}</span> },
        { header: 'Data Inizio', sortKey: 'startDate', cell: p => <span className="text-sm text-gray-600 dark:text-gray-300">{formatDateForDisplay(p.startDate)}</span> },
        { header: 'Data Fine', sortKey: 'endDate', cell: p => <span className="text-sm text-gray-600 dark:text-gray-300">{formatDateForDisplay(p.endDate)}</span> },
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
                    <td className="px-6 py-4"><SearchableSelect name="status" value={inlineEditingData!.status || ''} onChange={handleInlineSelectChange} options={statusOptions} placeholder="Nessuno stato" /></td>
                    <td className="px-6 py-4"><input type="date" name="startDate" value={inlineEditingData!.startDate || ''} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                    <td className="px-6 py-4"><input type="date" name="endDate" value={inlineEditingData!.endDate || ''} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                    <td className="px-6 py-4"><input type="number" name="budget" value={inlineEditingData!.budget} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                    <td className="px-6 py-4 text-right"><div className="flex items-center justify-end space-x-2">
                        <button onClick={handleSaveInlineEdit} disabled={isSaving} className="p-1 text-accent-teal hover:opacity-80 disabled:opacity-50">
                           {isSaving ? <SpinnerIcon className="w-5 h-5"/> : <CheckIcon className="w-5 h-5"/>}
                        </button>
                        <button onClick={handleCancelInlineEdit} className="p-1 text-gray-500 hover:text-gray-400"><XMarkIcon className="w-5 h-5"/></button>
                    </div></td>
                </tr>
            );
        }
        return (
            <tr key={project.id} className="hover:bg-accent-teal/5 dark:hover:bg-accent-teal/10">
                {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap">{col.cell(project)}</td>)}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-3">
                        <button onClick={() => openModalForEdit(project)} className="text-gray-500 hover:text-accent-teal" title="Modifica Dettagli"><PencilIcon className="w-5 h-5"/></button>
                        <button onClick={() => handleStartInlineEdit(project)} className="text-gray-500 hover:text-accent-teal" title="Modifica Rapida"><PencilIcon className="w-5 h-5"/></button>
                        <button onClick={() => deleteProject(project.id!)} className="text-gray-500 hover:text-accent-red" title="Elimina">
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
               <div key={project.id} className="p-4 rounded-lg shadow-md bg-primary-light dark:bg-primary-dark border border-accent-teal">
                   <div className="space-y-3">
                       <div><label className="text-xs font-medium text-gray-500">Nome Progetto</label><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full form-input p-1" /></div>
                       <div><label className="text-xs font-medium text-gray-500">Cliente</label><SearchableSelect name="clientId" value={inlineEditingData!.clientId || ''} onChange={handleInlineSelectChange} options={clientOptions} placeholder="Nessun cliente" /></div>
                       <div><label className="text-xs font-medium text-gray-500">Stato</label><SearchableSelect name="status" value={inlineEditingData!.status || ''} onChange={handleInlineSelectChange} options={statusOptions} placeholder="Nessuno stato" /></div>
                       <div><label className="text-xs font-medium text-gray-500">Data Inizio</label><input type="date" name="startDate" value={inlineEditingData!.startDate || ''} onChange={handleInlineFormChange} className="w-full form-input p-1" /></div>
                       <div><label className="text-xs font-medium text-gray-500">Data Fine</label><input type="date" name="endDate" value={inlineEditingData!.endDate || ''} onChange={handleInlineFormChange} className="w-full form-input p-1" /></div>
                       <div><label className="text-xs font-medium text-gray-500">Budget</label><input type="number" name="budget" value={inlineEditingData!.budget} onChange={handleInlineFormChange} className="w-full form-input p-1" /></div>
                       <div className="flex justify-end space-x-2 pt-2">
                           <button onClick={handleSaveInlineEdit} disabled={isSaving} className="p-2 bg-accent-teal/20 text-accent-teal rounded-full disabled:opacity-50">
                                {isSaving ? <SpinnerIcon className="w-5 h-5"/> : <CheckIcon className="w-5 h-5"/>}
                           </button>
                           <button onClick={handleCancelInlineEdit} className="p-2 bg-gray-100 text-gray-700 rounded-full"><XMarkIcon className="w-5 h-5"/></button>
                       </div>
                   </div>
               </div>
           );
        }
        return (
            <div key={project.id} className="p-4 rounded-lg shadow-md bg-gray-50 dark:bg-white/5">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-bold text-lg text-primary-dark dark:text-primary-light">{project.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{project.clientName}</p>
                    </div>
                     <div className="flex items-center space-x-1 flex-shrink-0 ml-4">
                        <button onClick={() => openModalForEdit(project)} className="p-1 text-gray-500 hover:text-accent-teal"><PencilIcon className="w-5 h-5"/></button>
                        <button onClick={() => handleStartInlineEdit(project)} className="p-1 text-gray-500 hover:text-accent-teal"><PencilIcon className="w-5 h-5"/></button>
                        <button onClick={() => deleteProject(project.id!)} className="p-1 text-gray-500 hover:text-accent-red">
                             {isActionLoading(`deleteProject-${project.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <TrashIcon className="w-5 h-5"/>}
                        </button>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/20 grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-gray-500 dark:text-gray-400">Stato</p><p><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(project.status)}`}>{project.status || 'Non definito'}</span></p></div>
                    <div><p className="text-gray-500 dark:text-gray-400">Budget</p><p className="font-medium text-primary-dark dark:text-primary-light">{project.budget.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</p></div>
                    <div><p className="text-gray-500 dark:text-gray-400">Data Inizio</p><p className="font-medium text-primary-dark dark:text-primary-light">{formatDateForDisplay(project.startDate)}</p></div>
                    <div><p className="text-gray-500 dark:text-gray-400">Data Fine</p><p className="font-medium text-primary-dark dark:text-primary-light">{formatDateForDisplay(project.endDate)}</p></div>
                </div>
            </div>
        );
    };
    
    const filtersNode = (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per nome..."/>
            <SearchableSelect name="clientId" value={filters.clientId} onChange={handleFilterSelectChange} options={clientOptions} placeholder="Tutti i clienti"/>
            <SearchableSelect name="status" value={filters.status} onChange={handleFilterSelectChange} options={statusOptions} placeholder="Tutti gli stati"/>
            <button onClick={resetFilters} className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 w-full md:w-auto">Reset</button>
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
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cliente</label>
                            <SearchableSelect name="clientId" value={editingProject.clientId || ''} onChange={handleSelectChange} options={clientOptions} placeholder="Seleziona un cliente" />
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
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addProject') || isActionLoading(`updateProject-${'id' in editingProject ? editingProject.id : ''}`)} className="flex justify-center items-center px-4 py-2 bg-accent-teal text-primary-dark font-semibold rounded-md hover:opacity-90 disabled:opacity-50">
                               {(isActionLoading('addProject') || isActionLoading(`updateProject-${'id' in editingProject ? editingProject.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
            <style>{`
                .form-input, .form-select, .form-textarea {
                    border-color: #D1D5DB; 
                    background-color: #FDFFFC;
                }
                .dark .form-input, .dark .form-select, .dark .form-textarea {
                    border-color: #4B5563;
                    background-color: #011627;
                    color: #FDFFFC;
                }
                .form-input:focus, .form-select:focus, .form-textarea:focus {
                    --tw-ring-color: #2EC4B6;
                    border-color: #2EC4B6;
                }
            `}</style>
        </div>
    );
};

export default ProjectsPage;