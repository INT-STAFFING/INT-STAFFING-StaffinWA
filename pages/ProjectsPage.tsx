
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
import { useSearchParams, useNavigate } from 'react-router-dom';
import { formatCurrency } from '../utils/formatters';
import { formatDateFull } from '../utils/dateUtils';


type EnrichedProject = Project & { 
    clientName: string; 
    isStaffed: boolean;
    assignedResources: number;
};

const buildProjectPayload = (project: Project | Omit<Project, 'id'>): Project | Omit<Project, 'id'> => {
    const basePayload: Omit<Project, 'id'> = {
        name: project.name,
        clientId: project.clientId || null,
        startDate: project.startDate || null,
        endDate: project.endDate || null,
        budget: project.budget,
        realizationPercentage: project.realizationPercentage,
        projectManager: project.projectManager || null,
        status: project.status || null,
        notes: project.notes ?? null,
        contractId: project.contractId ?? null,
    };

    if ('id' in project) {
        return { id: project.id, ...basePayload };
    }

    return basePayload;
};

const ProjectsPage: React.FC = () => {
    const { projects, clients, resources, projectStatuses, contracts, addProject, updateProject, deleteProject, isActionLoading, assignments, loading, skills, projectSkills, addProjectSkill, deleteProjectSkill } = useEntitiesContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | Omit<Project, 'id'> | null>(null);
    const [filters, setFilters] = useState({ name: '', clientId: '', status: '' });
    const [debouncedFilters, setDebouncedFilters] = useState(filters);

    // Debounce Effect
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedFilters(filters);
        }, 400);
        return () => clearTimeout(handler);
    }, [filters]);

    const [showOnlyUnstaffed, setShowOnlyUnstaffed] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

     useEffect(() => {
        const projectId = searchParams.get('projectId');
        const clientId = searchParams.get('clientId');
        const filter = searchParams.get('filter');

        if (projectId) {
            setFilters(prev => ({ ...prev, name: projects.find(p => p.id === projectId)?.name || '', clientId: '', status: '' }));
            setShowOnlyUnstaffed(false);
            setSearchParams({});
        } else if (clientId) {
            setFilters(prev => ({ ...prev, clientId, name: '', status: '' }));
            setShowOnlyUnstaffed(false);
            setSearchParams({});
        } else if (filter === 'unstaffed') {
            setShowOnlyUnstaffed(true);
            setSearchParams({});
        }
    }, [searchParams, projects, setSearchParams]);

    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
    const [inlineEditingData, setInlineEditingData] = useState<Project | null>(null);

    const emptyProject: Omit<Project, 'id'> = {
        name: '', clientId: '', startDate: '', endDate: '', budget: 0,
        realizationPercentage: 100, projectManager: '', status: projectStatuses[0]?.value || '', notes: '', contractId: null
    };
    
    // KPI Calculations
    const kpis = useMemo(() => {
        const activeProjects = projects.filter(p => p.status === 'In corso');
        const countActive = activeProjects.length;
        // Ensure p.budget is treated as a number to prevent string concatenation issues
        const totalBudget = activeProjects.reduce((sum, p) => sum + Number(p.budget || 0), 0);
        
        const today = new Date();
        const nextMonth = new Date();
        nextMonth.setDate(today.getDate() + 30);
        
        const endingSoon = activeProjects.filter(p => {
            if (!p.endDate) return false;
            const end = new Date(p.endDate);
            return end >= today && end <= nextMonth;
        }).length;

        return { countActive, totalBudget, endingSoon };
    }, [projects]);

    // Uses debouncedFilters for heavy calculations
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
                // Use debouncedFilters
                const nameMatch = project.name.toLowerCase().includes(debouncedFilters.name.toLowerCase());
                const clientMatch = debouncedFilters.clientId ? project.clientId === debouncedFilters.clientId : true;
                const statusMatch = debouncedFilters.status ? project.status === debouncedFilters.status : true;
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
    }, [projects, debouncedFilters, clients, assignments, showOnlyUnstaffed]);
    
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
                const projectPayload = buildProjectPayload(editingProject);
                if ('id' in projectPayload) {
                    // Update Project
                    await updateProject(projectPayload as Project);
                    
                    // Update Skills
                    const projectId = projectPayload.id!;
                    const oldSkills = projectSkills.filter(ps => ps.projectId === projectId).map(ps => ps.skillId);
                    const toAdd = selectedSkills.filter(id => !oldSkills.includes(id));
                    const toRemove = oldSkills.filter(id => !selectedSkills.includes(id));
                    
                    await Promise.all([
                        ...toAdd.map(skillId => addProjectSkill({ projectId, skillId })),
                        ...toRemove.map(skillId => deleteProjectSkill(projectId, skillId))
                    ]);

                } else {
                    // Create Project
                    const newProject = await addProject(projectPayload as Omit<Project, 'id'>);
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

    const handleSaveInlineEdit = async () => { 
        if (inlineEditingData) { 
            const projectPayload = buildProjectPayload(inlineEditingData);
            await updateProject(projectPayload as Project); 
            handleCancelInlineEdit(); 
        } 
    };

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
        // Updated Date Format
        { header: 'Data Inizio', sortKey: 'startDate', cell: p => <span className="text-sm text-on-surface-variant">{formatDateFull(p.startDate)}</span> },
        { header: 'Budget', sortKey: 'budget', cell: p => <span className="text-sm text-on-surface-variant">{formatCurrency(p.budget)}</span> },
    ];
    
     const renderRow = (project: EnrichedProject) => {
        const isEditing = inlineEditingId === project.id;
        const isSaving = isActionLoading(`updateProject-${project.id}`);
        if(isEditing){
            return (
                <tr key={project.id} className="h-16">
                    <td className="px-6 py-4 sticky left-0 bg-inherit"><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                    <td className="px-6 py-4"><SearchableSelect name="clientId" value={inlineEditingData!.clientId || ''} onChange={handleInlineSelectChange} options={clientOptions} placeholder="Seleziona cliente" /></td>
                    <td className="px-6 py-4"><input type="number" name="budget" value={inlineEditingData!.budget} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                    <td className="px-6 py-4"><SearchableSelect name="status" value={inlineEditingData!.status || ''} onChange={handleInlineSelectChange} options={statusOptions} placeholder="Seleziona stato" /></td>
                    <td className="px-6 py-4"><input type="date" name="startDate" value={inlineEditingData!.startDate || ''} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                    <td className="px-6 py-4 text-right sticky right-0 bg-inherit">
                        <div className="flex items-center justify-end space-x-2">
                            <button onClick={handleSaveInlineEdit} disabled={isSaving} className="p-2 rounded-full text-tertiary hover:bg-surface-container disabled:opacity-50">
                                {isSaving ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">check</span>}
                            </button>
                            <button onClick={handleCancelInlineEdit} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container"><span className="material-symbols-outlined">close</span></button>
                        </div>
                    </td>
                </tr>
            );
        }
        return (
            <tr key={project.id} className="group h-16 hover:bg-surface-container">
                {columns.map((col, i) => <td key={i} className={`px-6 py-4 whitespace-nowrap overflow-hidden text-ellipsis bg-inherit`} title={col.sortKey ? String((project as Project)[col.sortKey]) : undefined}>{col.cell(project)}</td>)}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 bg-inherit">
                    <div className="flex items-center justify-end space-x-2">
                        <button onClick={() => navigate(`/workload?projectId=${project.id}`)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-primary" title="Vedi Carichi"><span className="material-symbols-outlined">bar_chart</span></button>
                        <button onClick={() => openModalForEdit(project)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-primary" title="Modifica Dettagli"><span className="material-symbols-outlined">edit_note</span></button>
                        <button onClick={() => handleStartInlineEdit(project)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-primary" title="Modifica Rapida"><span className="material-symbols-outlined">edit</span></button>
                        <button onClick={() => deleteProject(project.id!)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-error" title="Elimina">
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
        if(isEditing){
            return (
                <div key={project.id} className="p-4 rounded-lg shadow-md bg-surface-container border border-primary">
                    <div className="space-y-3">
                        <div><label className="text-xs font-medium text-on-surface-variant">Nome Progetto</label><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full form-input p-1" /></div>
                        <div><label className="text-xs font-medium text-on-surface-variant">Cliente</label><SearchableSelect name="clientId" value={inlineEditingData!.clientId || ''} onChange={handleInlineSelectChange} options={clientOptions} placeholder="Seleziona cliente" /></div>
                        <div><label className="text-xs font-medium text-on-surface-variant">Budget</label><input type="number" name="budget" value={inlineEditingData!.budget} onChange={handleInlineFormChange} className="w-full form-input p-1" /></div>
                        <div><label className="text-xs font-medium text-on-surface-variant">Stato</label><SearchableSelect name="status" value={inlineEditingData!.status || ''} onChange={handleInlineSelectChange} options={statusOptions} placeholder="Seleziona stato" /></div>
                        <div><label className="text-xs font-medium text-on-surface-variant">Data Inizio</label><input type="date" name="startDate" value={inlineEditingData!.startDate || ''} onChange={handleInlineFormChange} className="w-full form-input p-1" /></div>
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
            <div key={project.id} className={`p-4 rounded-lg shadow-md bg-surface-container border-l-4 ${project.status === 'Completato' ? 'border-tertiary' : project.status === 'In corso' ? 'border-primary' : 'border-outline'}`}>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-bold text-lg text-on-surface">{project.name}</p>
                        <p className="text-sm text-on-surface-variant">{project.clientName}</p>
                    </div>
                    <div className="flex items-center space-x-1">
                        <button onClick={() => navigate(`/workload?projectId=${project.id}`)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high"><span className="material-symbols-outlined">bar_chart</span></button>
                        <button onClick={() => openModalForEdit(project)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high"><span className="material-symbols-outlined">edit_note</span></button>
                        <button onClick={() => deleteProject(project.id!)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high">
                            {isActionLoading(`deleteProject-${project.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">delete</span>}
                        </button>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-outline-variant grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-on-surface-variant">Budget</p><p className="font-medium text-on-surface">{formatCurrency(project.budget)}</p></div>
                    <div><p className="text-on-surface-variant">Data Inizio</p><p className="font-medium text-on-surface">{formatDateFull(project.startDate)}</p></div>
                </div>
            </div>
        );
    };

    const filtersNode = (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per nome..."/>
            <SearchableSelect name="clientId" value={filters.clientId} onChange={handleFilterSelectChange} options={clientOptions} placeholder="Tutti i clienti" />
            <SearchableSelect name="status" value={filters.status} onChange={handleFilterSelectChange} options={statusOptions} placeholder="Tutti gli stati" />
            <div className="flex items-center space-x-3">
                <input type="checkbox" id="showOnlyUnstaffed" checked={showOnlyUnstaffed} onChange={(e) => setShowOnlyUnstaffed(e.target.checked)} className="form-checkbox" />
                <label htmlFor="showOnlyUnstaffed" className="text-sm text-on-surface">Solo senza staff</label>
            </div>
        </div>
    );

    return (
        <div>
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-primary">
                    <p className="text-sm text-on-surface-variant">Progetti Attivi</p>
                    <p className="text-2xl font-bold text-on-surface">{kpis.countActive}</p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-secondary">
                    <p className="text-sm text-on-surface-variant">Budget Totale</p>
                    <p className="text-2xl font-bold text-on-surface">{formatCurrency(kpis.totalBudget)}</p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-tertiary">
                    <p className="text-sm text-on-surface-variant">Progetti in Scadenza</p>
                    <p className="text-2xl font-bold text-on-surface">{kpis.endingSoon}</p>
                </div>
            </div>

            <DataTable<EnrichedProject>
                title="Gestione Progetti"
                addNewButtonLabel="Aggiungi Progetto"
                data={dataForTable}
                columns={columns}
                filtersNode={filtersNode}
                onAddNew={openModalForNew}
                renderRow={renderRow}
                renderMobileCard={renderMobileCard}
                initialSortKey="name"
                isLoading={loading}
                tableLayout={{ dense: true, striped: true, headerSticky: true, headerBackground: true, headerBorder: true }}
                tableClassNames={{ base: 'w-full text-sm' }}
                numActions={4} // VEDI CARICHI, MODIFICA, EDIT VELOCE, ELIMINA
            />

            {editingProject && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingProject ? 'Modifica Progetto' : 'Aggiungi Progetto'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Nome Progetto *</label>
                            <input type="text" name="name" value={editingProject.name} onChange={handleChange} required className="form-input" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Cliente *</label>
                            <SearchableSelect name="clientId" value={editingProject.clientId || ''} onChange={handleSelectChange} options={clientOptions} placeholder="Seleziona cliente" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-1">Data Inizio</label>
                                <input type="date" name="startDate" value={editingProject.startDate || ''} onChange={handleChange} className="form-input" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-1">Data Fine</label>
                                <input type="date" name="endDate" value={editingProject.endDate || ''} onChange={handleChange} className="form-input" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-1">Budget *</label>
                                <input type="number" name="budget" value={editingProject.budget} onChange={handleChange} required className="form-input" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-1">Realization %</label>
                                <input type="number" name="realizationPercentage" value={editingProject.realizationPercentage} onChange={handleChange} className="form-input" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Project Manager</label>
                            <SearchableSelect name="projectManager" value={editingProject.projectManager || ''} onChange={handleSelectChange} options={projectManagerOptions} placeholder="Seleziona PM" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Stato</label>
                            <SearchableSelect name="status" value={editingProject.status || ''} onChange={handleSelectChange} options={statusOptions} placeholder="Seleziona stato" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Contratto</label>
                            <SearchableSelect name="contractId" value={editingProject.contractId || ''} onChange={handleSelectChange} options={contractOptions} placeholder="Seleziona contratto" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Note</label>
                            <textarea name="notes" value={editingProject.notes || ''} onChange={handleChange} className="form-textarea" rows={2}></textarea>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Skill Richieste</label>
                            <MultiSelectDropdown name="skills" selectedValues={selectedSkills} onChange={(_, values) => setSelectedSkills(values)} options={skillOptions} placeholder="Seleziona skill" />
                        </div>
                        <div className="flex justify-end space-x-3 pt-4 border-t border-outline-variant mt-4">
                            <button type="button" onClick={handleCloseModal} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addProject') || isActionLoading(`updateProject-${'id' in editingProject ? editingProject.id : ''}`)} className="flex justify-center items-center px-6 py-2 bg-primary text-on-primary rounded-full disabled:opacity-50 font-semibold hover:opacity-90">
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
