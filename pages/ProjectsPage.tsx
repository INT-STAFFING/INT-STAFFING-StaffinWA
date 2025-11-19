/**
 * @file ProjectsPage.tsx
 * @description Pagina per la gestione dei progetti (CRUD e visualizzazione).
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Project } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { SpinnerIcon } from '../components/icons';
import { DataTable, ColumnDef } from '../components/DataTable';
// FIX: Using namespace import for react-router-dom to address potential module resolution errors.
import * as ReactRouterDOM from 'react-router-dom';
const { useSearchParams } = ReactRouterDOM;


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
    const { projects, clients, resources, projectStatuses, contracts, addProject, updateProject, deleteProject, isActionLoading, assignments, loading, skills, projectSkills, addProjectSkill, deleteProjectSkill } = useEntitiesContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | Omit<Project, 'id'> | null>(null);
    const [filters, setFilters] = useState({ name: '', clientId: '', status: '' });
    const [showOnlyUnstaffed, setShowOnlyUnstaffed] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

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

                // "Solo senza staff" filter: Must be unstaffed AND 'In corso'
                if (showOnlyUnstaffed) {
                    if (isStaffed || project.status !== 'In corso') {
                        return false;
                    }
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

    const openModalForNew = () => { 
        setEditingProject(emptyProject); 
        setSelectedSkills([]);
        setIsModalOpen(true); 
    };
    const openModalForEdit = (project: Project) => { 
        setEditingProject(project); 
        const currentSkills = projectSkills.filter(ps => ps.projectId === project.id).map(ps => ps.skillId);
        setSelectedSkills(currentSkills);
        setIsModalOpen(true); 
        handleCancelInlineEdit(); 
    };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingProject(null); setSelectedSkills([]); };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingProject) {
            try {
                if ('id' in editingProject) {
                    // Update Project
                    await updateProject(editingProject as Project);
                    
                    // Update Skills
                    const projectId = editingProject.id!;
                    const oldSkills = projectSkills.filter(ps => ps.projectId === projectId).map(ps => ps.skillId);
                    const toAdd = selectedSkills.filter(id => !oldSkills.includes(id));
                    const toRemove = oldSkills.filter(id => !selectedSkills.includes(id));
                    
                    await Promise.all([
                        ...toAdd.map(skillId => addProjectSkill({ projectId, skillId })),
                        ...toRemove.map(skillId => deleteProjectSkill(projectId, skillId))
                    ]);

                } else {
                    // Create Project
                    const newProject = await addProject(editingProject as Omit<Project, 'id'>);
                    // Add Skills
                    if (newProject && newProject.id) {
                        await Promise.all(selectedSkills.map(skillId => addProjectSkill({ projectId: newProject.id!, skillId })));
                    }
                }
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
            case 'Completato': return 'bg-tertiary-container text-on-tertiary-container';
            case 'In pausa': return 'bg-yellow-container text-on-yellow-container';
            case 'In corso': return 'bg-primary-container text-on-primary-container';
            default: return 'bg-surface-variant text-on-surface-variant';
        }
    };
    
    const clientOptions = useMemo(() => clients.sort((a,b)=>a.name.localeCompare(b.name)).map(c => ({ value: c.id!, label: c.name })), [clients]);
    const statusOptions = useMemo(() => projectStatuses.sort((a,b)=>a.value.localeCompare(b.value)).map(s => ({ value: s.value, label: s.value })), [projectStatuses]);
    const projectManagerOptions = useMemo(() => resources.map(r => ({ value: r.name, label: r.name })).sort((a,b) => a.label.localeCompare(b.label)), [resources]);
    const contractOptions = useMemo(() => contracts.map(c => ({ value: c.id!, label: c.name })), [contracts]);
    const skillOptions = useMemo(() => skills.sort((a,b) => a.name.localeCompare(b.name)).map(s => ({ value: s.id!, label: s.name })), [skills]);


    const columns: ColumnDef<EnrichedProject>[] = [
        { header: 'Nome Progetto', sortKey: 'name', cell: p => (
            <div className="flex items-center sticky left-0 bg-inherit pl-6">
                <span className="font-medium text-on-surface">{p.name}</span>
                {!p.isStaffed && p.status === 'In corso' && <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-on-yellow-container bg-yellow-container rounded-full">Senza Staff</span>}
            </div>
        )},
        { header: 'Cliente', sortKey: 'clientName', cell: p => <span className="text-sm text-on-surface-variant">{p.clientName}</span> },
        { header: 'Risorse Assegnate', sortKey: 'assignedResources', cell: p => <span className="text-sm text-center font-semibold text-on-surface-variant">{p.assignedResources}</span> },
        { header: 'Stato', sortKey: 'status', cell: p => <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(p.status)}`}>{p.status || 'Non definito'}</span> },
        { header: 'Data Inizio', sortKey: 'startDate', cell: p => <span className="text-sm text-on-surface-variant">{formatDateForDisplay(p.startDate)}</span> },
        { header: 'Budget', sortKey: 'budget', cell: p => <span className="text-sm text-on-surface-variant">{p.budget.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span> },
    ];
    
     const renderRow = (project: EnrichedProject) => {
        const isEditing = inlineEditingId === project.id;
        const isSaving = isActionLoading(`updateProject-${project.id}`);
        if(isEditing){
            return (
                <tr key={project.id} className="h-16">
                    <td className="px-6 py-4 sticky left-0 bg-inherit"><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                    <td className="px-6 py-4"><SearchableSelect name="clientId" value={inlineEditingData!.clientId || ''} onChange={handleInlineSelectChange} options={clientOptions} placeholder="Nessun cliente" /></td>
                    <td className="px-6 py-4 text-center text-on-surface-variant">{project.assignedResources}</td>
                    <td className="px-6 py-4"><SearchableSelect name="status" value={inlineEditingData!.status || ''} onChange={handleInlineSelectChange} options={statusOptions} placeholder="Nessuno stato" /></td>
                    <td className="px-6 py-4"><input type="date" name="startDate" value={inlineEditingData!.startDate || ''} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                    <td className="px-6 py-4"><input type="number" name="budget" value={inlineEditingData!.budget} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                    <td className="px-6 py-4 text-right sticky right-0 bg-inherit"><div className="flex items-center justify-end space-x-2">
                        <button onClick={handleSaveInlineEdit} disabled={isSaving} className="p-1 text-primary hover:opacity-80 disabled:opacity-50">
                           {isSaving ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">check</span>}
                        </button>
                        <button onClick={handleCancelInlineEdit} className="p-1 text-on-surface-variant hover:opacity-80"><span className="material-symbols-outlined">close</span></button>
                    </div></td>
                </tr>
            );
        }
        return (
            <tr key={project.id} className="group h-16 hover:bg-surface-container">
                {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap overflow-hidden text-ellipsis bg-inherit" title={col.sortKey ? String((project as any)[col.sortKey]) : undefined}>{col.cell(project)}</td>)}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 bg-inherit">
                    <div className="flex items-center justify-end space-x-3">
                        <button onClick={() => openModalForEdit(project)} className="text-on-surface-variant hover:text-primary" title="Modifica Dettagli"><span className="material-symbols-outlined">edit_note</span></button>
                        <button onClick={() => handleStartInlineEdit(project)} className="text-on-surface-variant hover:text-primary" title="Modifica Rapida"><span className="material-symbols-outlined">edit</span></button>
                        <button onClick={() => deleteProject(project.id!)} className="text-on-surface-variant hover:text-error" title="Elimina">
                             {isActionLoading(`deleteProject-${project.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">delete</span>}
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
               <div key={project.id} className="p-4 rounded-lg shadow-md bg-surface-container border border-primary">
                   <div className="space-y-3">
                       <div><label className="text-xs font-medium text-on-surface-variant">Nome Progetto</label><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full form-input p-1" /></div>
                       <div><label className="text-xs font-medium text-on-surface-variant">Cliente</label><SearchableSelect name="clientId" value={inlineEditingData!.clientId || ''} onChange={handleInlineSelectChange} options={clientOptions} placeholder="Nessun cliente" /></div>
                       <div><label className="text-xs font-medium text-on-surface-variant">Stato</label><SearchableSelect name="status" value={inlineEditingData!.status || ''} onChange={handleInlineSelectChange} options={statusOptions} placeholder="Nessuno stato" /></div>
                       <div><label className="text-xs font-medium text-on-surface-variant">Data Inizio</label><input type="date" name="startDate" value={inlineEditingData!.startDate || ''} onChange={handleInlineFormChange} className="w-full form-input p-1" /></div>
                       <div><label className="text-xs font-medium text-on-surface-variant">Budget</label><input type="number" name="budget" value={inlineEditingData!.budget} onChange={handleInlineFormChange} className="w-full form-input p-1" /></div>
                       <div className="flex justify-end space-x-2 pt-2">
                           <button onClick={handleSaveInlineEdit} disabled={isSaving} className="p-2 bg-primary-container text-on-primary-container rounded-full disabled:opacity-50">
                                {isSaving ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">check</span>}
                           </button>
                           <button onClick={handleCancelInlineEdit} className="p-2 bg-surface-container-high text-on-surface-variant rounded-full"><span className="material-symbols-outlined">close</span></button>
                       </div>
                   </div>
               </div>
           );
        }
        return (
            <div key={project.id} className="p-4 rounded-lg shadow-md bg-surface-container">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="font-bold text-lg text-on-surface">{project.name}</p>
                             {!project.isStaffed && project.status === 'In corso' && <span className="px-2 py-0.5 text-xs font-semibold text-on-yellow-container bg-yellow-container rounded-full">Senza Staff</span>}
                        </div>
                        <p className="text-sm text-on-surface-variant">{project.clientName}</p>
                    </div>
                     <div className="flex items-center space-x-1 flex-shrink-0 ml-4">
                        <button onClick={() => openModalForEdit(project)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high"><span className="material-symbols-outlined">edit_note</span></button>
                        <button onClick={() => handleStartInlineEdit(project)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high"><span className="material-symbols-outlined">edit</span></button>
                        <button onClick={() => deleteProject(project.id!)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high">
                             {isActionLoading(`deleteProject-${project.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">delete</span>}
                        </button>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-outline-variant grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-on-surface-variant">Stato</p><p><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(project.status)}`}>{project.status || 'Non definito'}</span></p></div>
                    <div><p className="text-on-surface-variant">Risorse Assegnate</p><p className="font-medium text-on-surface">{project.assignedResources}</p></div>
                    <div><p className="text-on-surface-variant">Data Inizio</p><p className="font-medium text-on-surface">{formatDateForDisplay(project.startDate)}</p></div>
                    <div><p className="text-on-surface-variant">Budget</p><p className="font-medium text-on-surface">{project.budget.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</p></div>
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
                <label htmlFor="unstaffed-filter" className="flex items-center cursor-pointer">
                    <div className="relative">
                        <input
                            type="checkbox"
                            id="unstaffed-filter"
                            className="sr-only"
                            checked={showOnlyUnstaffed}
                            onChange={(e) => setShowOnlyUnstaffed(e.target.checked)}
                        />
                        <div className="block bg-surface-variant w-14 h-8 rounded-full"></div>
                        <div className={`dot absolute left-1 top-1 bg-outline w-6 h-6 rounded-full transition-transform duration-300 ease-in-out ${showOnlyUnstaffed ? 'transform translate-x-6 !bg-primary' : ''}`}></div>
                    </div>
                    <span className="ml-3 text-sm text-on-surface">Solo senza staff</span>
                </label>
                <button onClick={resetFilters} className="px-6 py-2 bg-secondary-container text-on-secondary-container font-semibold rounded-full hover:opacity-90 w-full md:w-auto">Reset</button>
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
                isLoading={loading}
                tableLayout={{
                    dense: true,
                    striped: true,
                    headerSticky: true,
                    headerBackground: true,
                    headerBorder: true,
                    width: 'fixed',
                }}
                tableClassNames={{
                    base: 'w-full text-sm',
                }}
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
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tecnologie / Competenze</label>
                            <MultiSelectDropdown
                                name="skills"
                                selectedValues={selectedSkills}
                                onChange={(_, values) => setSelectedSkills(values)}
                                options={skillOptions}
                                placeholder="Seleziona competenze..."
                            />
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
                        <div className="flex justify-end space-x-2 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addProject') || isActionLoading(`updateProject-${'id' in editingProject ? editingProject.id : ''}`)} className="flex justify-center items-center px-6 py-2 bg-primary text-on-primary rounded-full disabled:opacity-50 font-semibold">
                               {(isActionLoading('addProject') || isActionLoading(`updateProject-${'id' in editingProject ? editingProject.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default ProjectsPage;