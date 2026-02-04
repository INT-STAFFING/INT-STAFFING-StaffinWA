
import React, { useState, useMemo, useEffect } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Project, ProjectExpense, BillingType, BillingMilestone, MilestoneStatus } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { SpinnerIcon } from '../components/icons';
import { DataTable, ColumnDef } from '../components/DataTable';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { formatCurrency } from '../utils/formatters';
import { formatDateFull } from '../utils/dateUtils';
import ExportButton from '../components/ExportButton';
import { useToast } from '../context/ToastContext';
import ConfirmationModal from '../components/ConfirmationModal';

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
        billingType: project.billingType ?? 'TIME_MATERIAL',
    };

    if ('id' in project) {
        return { id: project.id, ...basePayload };
    }

    return basePayload;
};

const BillingPlanModal: React.FC<{ 
    project: Project; 
    isOpen: boolean; 
    onClose: () => void; 
}> = ({ project, isOpen, onClose }) => {
    const { billingMilestones, addBillingMilestone, updateBillingMilestone, deleteBillingMilestone, updateProject, contracts, rateCards, isActionLoading } = useEntitiesContext();
    const { addToast } = useToast();

    const [billingType, setBillingType] = useState<BillingType>(project.billingType || 'TIME_MATERIAL');
    const [milestones, setMilestones] = useState<BillingMilestone[]>([]);
    
    // New Milestone State
    const [newMilestone, setNewMilestone] = useState<Omit<BillingMilestone, 'id' | 'projectId'>>({
        name: '',
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        status: 'PLANNED'
    });

    useEffect(() => {
        setBillingType(project.billingType || 'TIME_MATERIAL');
    }, [project]);

    useEffect(() => {
        setMilestones(billingMilestones.filter(bm => bm.projectId === project.id).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    }, [billingMilestones, project.id]);

    const handleSaveType = async () => {
        try {
            await updateProject({ ...project, billingType });
            addToast('Tipo di fatturazione aggiornato', 'success');
        } catch (e) { addToast('Errore aggiornamento', 'error'); }
    };

    const handleAddMilestone = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addBillingMilestone({ ...newMilestone, projectId: project.id! });
            setNewMilestone({ name: '', date: new Date().toISOString().split('T')[0], amount: 0, status: 'PLANNED' });
            addToast('Milestone aggiunta', 'success');
        } catch (e) { addToast('Errore aggiunta milestone', 'error'); }
    };

    const handleDeleteMilestone = async (id: string) => {
        try {
            await deleteBillingMilestone(id);
            addToast('Milestone rimossa', 'success');
        } catch (e) { addToast('Errore rimozione', 'error'); }
    };
    
    const handleUpdateMilestoneStatus = async (ms: BillingMilestone, newStatus: MilestoneStatus) => {
        try {
            await updateBillingMilestone({ ...ms, status: newStatus });
        } catch (e) { addToast('Errore aggiornamento stato', 'error'); }
    };

    const totalMilestoneAmount = milestones.reduce((sum, m) => sum + Number(m.amount), 0);
    const contract = contracts.find(c => c.id === project.contractId);
    const rateCard = rateCards.find(rc => rc.id === contract?.rateCardId);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Piano Fatturazione: ${project.name}`}>
            <div className="flex flex-col h-[70vh] space-y-6">
                
                {/* Billing Type Selector */}
                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-outline-variant">
                    <div>
                        <h4 className="text-sm font-bold text-on-surface">Modalità Contratto</h4>
                        <p className="text-xs text-on-surface-variant">Definisce come viene calcolata la revenue.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <select 
                            value={billingType} 
                            onChange={(e) => setBillingType(e.target.value as BillingType)}
                            className="form-select text-sm py-1"
                        >
                            <option value="TIME_MATERIAL">Time & Material</option>
                            <option value="FIXED_PRICE">Fixed Price (A Corpo)</option>
                        </select>
                        {billingType !== project.billingType && (
                            <button onClick={handleSaveType} className="p-2 bg-primary text-on-primary rounded-full hover:opacity-90">
                                <span className="material-symbols-outlined text-sm">save</span>
                            </button>
                        )}
                    </div>
                </div>

                {billingType === 'TIME_MATERIAL' ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-surface-container-lowest border border-dashed border-outline-variant rounded-xl">
                        <span className="material-symbols-outlined text-5xl text-primary/20 mb-4">schedule</span>
                        <h3 className="text-lg font-bold text-on-surface mb-2">Fatturazione a Consuntivo</h3>
                        <p className="text-sm text-on-surface-variant max-w-md">
                            La revenue viene calcolata moltiplicando i giorni lavorati per le tariffe di vendita definite nel listino.
                        </p>
                        {contract ? (
                            <div className="mt-6 p-4 bg-surface rounded border border-outline-variant text-left w-full max-w-sm">
                                <p className="text-xs text-on-surface-variant uppercase font-bold">Contratto Collegato</p>
                                <p className="text-sm font-medium">{contract.name}</p>
                                <p className="text-xs text-on-surface-variant mt-2 uppercase font-bold">Listino Applicato</p>
                                <p className="text-sm font-medium">{rateCard?.name || 'Standard (Costo + Markup)'}</p>
                            </div>
                        ) : (
                            <p className="mt-4 text-xs text-error font-bold bg-error-container/20 p-2 rounded">
                                Nessun contratto collegato. Assicurati di collegare un contratto al progetto.
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex justify-between items-center mb-2 px-1">
                            <h4 className="text-sm font-bold text-on-surface">Piano Rate (Milestones)</h4>
                            <div className="text-xs">
                                <span className="text-on-surface-variant">Totale: </span>
                                <span className={`font-bold ${totalMilestoneAmount > project.budget ? 'text-error' : 'text-primary'}`}>
                                    {formatCurrency(totalMilestoneAmount)}
                                </span>
                                <span className="text-on-surface-variant"> / {formatCurrency(project.budget)}</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4">
                            {milestones.length === 0 ? (
                                <p className="text-center text-xs text-on-surface-variant py-8 italic">Nessuna milestone definita.</p>
                            ) : (
                                milestones.map(ms => (
                                    <div key={ms.id} className="flex justify-between items-center p-3 bg-surface border border-outline-variant rounded-lg">
                                        <div>
                                            <p className="text-sm font-bold text-on-surface">{ms.name}</p>
                                            <p className="text-xs text-on-surface-variant">{formatDateFull(ms.date)}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono font-bold text-sm">{formatCurrency(ms.amount)}</span>
                                            <select 
                                                value={ms.status} 
                                                onChange={(e) => handleUpdateMilestoneStatus(ms, e.target.value as MilestoneStatus)}
                                                className={`text-xs rounded py-1 px-2 border-none font-bold ${
                                                    ms.status === 'PAID' ? 'bg-tertiary-container text-on-tertiary-container' : 
                                                    ms.status === 'INVOICED' ? 'bg-secondary-container text-on-secondary-container' : 
                                                    'bg-surface-container-high text-on-surface-variant'
                                                }`}
                                            >
                                                <option value="PLANNED">Pianificata</option>
                                                <option value="INVOICED">Fatturata</option>
                                                <option value="PAID">Pagata</option>
                                            </select>
                                            <button onClick={() => handleDeleteMilestone(ms.id!)} className="text-error hover:bg-error-container p-1 rounded">
                                                <span className="material-symbols-outlined text-sm">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <form onSubmit={handleAddMilestone} className="pt-4 border-t border-outline-variant grid grid-cols-12 gap-2 items-end bg-surface-container-low p-3 rounded-lg">
                            <div className="col-span-5">
                                <label className="text-[10px] font-bold text-on-surface-variant">Descrizione</label>
                                <input type="text" className="form-input text-xs p-2" required value={newMilestone.name} onChange={e => setNewMilestone({...newMilestone, name: e.target.value})} placeholder="es. Anticipo 20%"/>
                            </div>
                            <div className="col-span-3">
                                <label className="text-[10px] font-bold text-on-surface-variant">Data Prevista</label>
                                <input type="date" className="form-input text-xs p-2" required value={newMilestone.date} onChange={e => setNewMilestone({...newMilestone, date: e.target.value})}/>
                            </div>
                            <div className="col-span-3">
                                <label className="text-[10px] font-bold text-on-surface-variant">Importo</label>
                                <input type="number" step="0.01" className="form-input text-xs p-2" required value={newMilestone.amount || ''} onChange={e => setNewMilestone({...newMilestone, amount: parseFloat(e.target.value)})}/>
                            </div>
                            <div className="col-span-1">
                                <button type="submit" className="w-full bg-primary text-on-primary rounded-lg py-2 flex justify-center items-center hover:opacity-90 disabled:opacity-50" disabled={isActionLoading('addBillingMilestone')}>
                                    <span className="material-symbols-outlined text-sm">add</span>
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </Modal>
    );
};

const ProjectExpensesModal: React.FC<{ 
    project: Project; 
    isOpen: boolean; 
    onClose: () => void; 
}> = ({ project, isOpen, onClose }) => {
    const { projectExpenses, addProjectExpense, updateProjectExpense, deleteProjectExpense, isActionLoading } = useEntitiesContext();
    const { addToast } = useToast();
    
    // Local state for the new expense form
    const [newExpense, setNewExpense] = useState<Omit<ProjectExpense, 'id' | 'projectId'>>({
        category: 'Altro',
        description: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        billable: false
    });
    
    const [expenseToDelete, setExpenseToDelete] = useState<ProjectExpense | null>(null);

    const projectSpecificExpenses = useMemo(() => 
        projectExpenses.filter(e => e.projectId === project.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [projectExpenses, project.id]);

    const totalExpenses = useMemo(() => 
        projectSpecificExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    [projectSpecificExpenses]);

    const categoryOptions = ['Licenze Software', 'Hardware', 'Viaggi & Trasferte', 'Consulenza Esterna', 'Marketing', 'Altro'];

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addProjectExpense({ ...newExpense, projectId: project.id! });
            addToast('Spesa aggiunta', 'success');
            setNewExpense({ category: 'Altro', description: '', amount: 0, date: new Date().toISOString().split('T')[0], billable: false });
        } catch (err) {
            addToast('Errore aggiunta spesa', 'error');
        }
    };

    const confirmDelete = async () => {
        if (expenseToDelete) {
            try {
                await deleteProjectExpense(expenseToDelete.id!);
                addToast('Spesa eliminata', 'success');
            } catch (err) { 
                addToast('Errore eliminazione', 'error'); 
            } finally {
                setExpenseToDelete(null);
            }
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Spese Extra: ${project.name}`}>
            <div className="flex flex-col h-[70vh]">
                <div className="flex-shrink-0 bg-surface-container-low p-4 rounded-xl border border-outline-variant mb-4 flex justify-between items-center">
                    <div>
                        <p className="text-sm text-on-surface-variant font-medium">Totale Spese Extra</p>
                        <p className="text-2xl font-bold text-primary">{formatCurrency(totalExpenses)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-on-surface-variant">Budget Progetto: {formatCurrency(project.budget)}</p>
                        <p className="text-xs text-on-surface-variant">Incidenza: {project.budget > 0 ? ((totalExpenses / project.budget) * 100).toFixed(1) : 0}%</p>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto pr-1 space-y-2 mb-4">
                    {projectSpecificExpenses.length === 0 ? (
                        <p className="text-center text-sm text-on-surface-variant py-8">Nessuna spesa registrata.</p>
                    ) : (
                        projectSpecificExpenses.map(expense => (
                            <div key={expense.id} className="flex justify-between items-center p-3 bg-surface border border-outline-variant rounded-lg hover:bg-surface-container-low transition-colors group">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm text-on-surface">{expense.category}</span>
                                        {expense.billable && <span className="px-1.5 py-0.5 rounded text-[10px] bg-tertiary-container text-on-tertiary-container font-bold">Rifatturabile</span>}
                                    </div>
                                    <p className="text-xs text-on-surface-variant">{expense.description || '-'}</p>
                                    <p className="text-[10px] text-on-surface-variant">{formatDateFull(expense.date)}</p>
                                </div>
                                <div className="text-right flex items-center gap-2">
                                    <p className="font-mono font-bold text-sm text-on-surface">{formatCurrency(expense.amount)}</p>
                                    <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setExpenseToDelete(expense); }}
                                        className="text-error hover:bg-error-container p-2 rounded transition-colors"
                                        disabled={isActionLoading(`deleteProjectExpense-${expense.id}`)}
                                        title="Elimina"
                                    >
                                        <span className="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <form onSubmit={handleAdd} className="flex-shrink-0 pt-4 border-t border-outline-variant grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-3">
                        <label className="text-[10px] font-bold uppercase text-on-surface-variant">Categoria</label>
                        <select 
                            className="form-select text-xs p-2" 
                            value={newExpense.category} 
                            onChange={e => setNewExpense({...newExpense, category: e.target.value})}
                        >
                            {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="col-span-3">
                        <label className="text-[10px] font-bold uppercase text-on-surface-variant">Descrizione</label>
                        <input 
                            type="text" 
                            className="form-input text-xs p-2" 
                            placeholder="Dettagli..." 
                            value={newExpense.description} 
                            onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                            required
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="text-[10px] font-bold uppercase text-on-surface-variant">Data</label>
                        <input 
                            type="date" 
                            className="form-input text-xs p-2" 
                            value={newExpense.date} 
                            onChange={e => setNewExpense({...newExpense, date: e.target.value})}
                            required
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="text-[10px] font-bold uppercase text-on-surface-variant">Importo</label>
                        <input 
                            type="number" 
                            step="0.01" 
                            className="form-input text-xs p-2" 
                            placeholder="€" 
                            value={newExpense.amount || ''} 
                            onChange={e => setNewExpense({...newExpense, amount: parseFloat(e.target.value)})}
                            required
                        />
                    </div>
                    <div className="col-span-2 flex justify-end">
                        <button type="submit" className="w-full bg-primary text-on-primary rounded-lg py-2 flex justify-center items-center hover:opacity-90 disabled:opacity-50" disabled={isActionLoading('addProjectExpense')}>
                            {isActionLoading('addProjectExpense') ? <SpinnerIcon className="w-4 h-4"/> : <span className="material-symbols-outlined text-sm">add</span>}
                        </button>
                    </div>
                    <div className="col-span-12 flex items-center gap-2 mt-1">
                         <input 
                            type="checkbox" 
                            id="billable" 
                            className="form-checkbox h-4 w-4"
                            checked={newExpense.billable}
                            onChange={e => setNewExpense({...newExpense, billable: e.target.checked})}
                        />
                        <label htmlFor="billable" className="text-xs text-on-surface cursor-pointer select-none">Spesa rifatturabile al cliente</label>
                    </div>
                </form>
            </div>

            {expenseToDelete && (
                <ConfirmationModal
                    isOpen={!!expenseToDelete}
                    onClose={() => setExpenseToDelete(null)}
                    onConfirm={confirmDelete}
                    title="Elimina Spesa"
                    message="Sei sicuro di voler eliminare questa spesa dal progetto? L'operazione è irreversibile."
                    isConfirming={isActionLoading(`deleteProjectExpense-${expenseToDelete.id}`)}
                />
            )}
        </Modal>
    );
};

export const ProjectsPage: React.FC = () => {
    const { projects, clients, resources, projectStatuses, contracts, addProject, updateProject, deleteProject, isActionLoading, assignments, loading, skills, projectSkills, addProjectSkill, deleteProjectSkill } = useEntitiesContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | Omit<Project, 'id'> | null>(null);
    const [filters, setFilters] = useState({ name: '', clientId: '', status: '' });
    const [debouncedFilters, setDebouncedFilters] = useState(filters);
    
    // State for Modals
    const [expenseModalProject, setExpenseModalProject] = useState<Project | null>(null);
    const [billingModalProject, setBillingModalProject] = useState<Project | null>(null);

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
        const editId = searchParams.get('editId');

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

        // Handle Deep Linking for Edit
        if (editId && !isModalOpen && projects.length > 0) {
            const target = projects.find(p => p.id === editId);
            if (target) {
                openModalForEdit(target);
                setSearchParams({});
            }
        }
    }, [searchParams, projects, setSearchParams, isModalOpen]);

    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
    const [inlineEditingData, setInlineEditingData] = useState<Project | null>(null);

    const emptyProject: Omit<Project, 'id'> = {
        name: '', clientId: '', startDate: '', endDate: '', budget: 0,
        realizationPercentage: 100, projectManager: '', status: projectStatuses[0]?.value || '', notes: '', contractId: null, billingType: 'TIME_MATERIAL'
    };
    
    // KPI Calculations
    const kpis = useMemo(() => {
        const activeProjects = projects.filter(p => p.status === 'In corso');
        const countActive = activeProjects.length;
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

    const dataForTable = useMemo<EnrichedProject[]>(() => {
        const staffedProjectIds = new Set(assignments.map(a => a.projectId));
        return projects
            .filter(project => {
                const isStaffed = staffedProjectIds.has(project.id!);
                if (showOnlyUnstaffed) {
                    if (isStaffed || project.status !== 'In corso') {
                        return false;
                    }
                }
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

    const exportData = useMemo(() => {
        return dataForTable.map(p => ({
            'Nome Progetto': p.name,
            'Cliente': p.clientName,
            'Project Manager': p.projectManager || '',
            'Stato': p.status || '',
            'Budget': formatCurrency(p.budget),
            'Data Inizio': formatDateFull(p.startDate),
            'Data Fine': formatDateFull(p.endDate),
            'Risorse Assegnate': p.assignedResources,
            'Note': p.notes || ''
        }));
    }, [dataForTable]);
    
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
                    await updateProject(projectPayload as Project);
                    const projectId = projectPayload.id!;
                    const oldSkills = projectSkills.filter(ps => ps.projectId === projectId).map(ps => ps.skillId);
                    const toAdd = selectedSkills.filter(id => !oldSkills.includes(id));
                    const toRemove = oldSkills.filter(id => !selectedSkills.includes(id));
                    await Promise.all([
                        ...toAdd.map(skillId => addProjectSkill({ projectId, skillId })),
                        ...toRemove.map(skillId => deleteProjectSkill(projectId, skillId))
                    ]);
                } else {
                    const newProject = await addProject(projectPayload as Omit<Project, 'id'>);
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
                         <button onClick={() => setBillingModalProject(project)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-primary" title="Piano Fatturazione">
                            <span className="material-symbols-outlined">payments</span>
                        </button>
                        <button onClick={() => setExpenseModalProject(project)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-secondary" title="Gestisci Spese Extra">
                            <span className="material-symbols-outlined">receipt_long</span>
                        </button>
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
                        <button onClick={() => setBillingModalProject(project)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high" title="Fatturazione"><span className="material-symbols-outlined">payments</span></button>
                        <button onClick={() => setExpenseModalProject(project)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high" title="Spese"><span className="material-symbols-outlined">receipt_long</span></button>
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
                headerActions={<ExportButton data={exportData} title="Gestione Progetti" />}
                initialSortKey="name"
                isLoading={loading}
                tableLayout={{ dense: true, striped: true, headerSticky: true, headerBackground: true, headerBorder: true }}
                tableClassNames={{ base: 'w-full text-sm' }}
                numActions={6} // BILLING, SPESE, VEDI CARICHI, MODIFICA, EDIT VELOCE, ELIMINA
            />

            {editingProject && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingProject ? 'Modifica Progetto' : 'Aggiungi Progetto'}>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        
                        {/* Sezione Dati Base */}
                        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                            <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">business_center</span> Dati Base
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Nome Progetto *</label>
                                    <input type="text" name="name" value={editingProject.name} onChange={handleChange} required className="form-input" placeholder="Nome descrittivo progetto" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Cliente *</label>
                                    <SearchableSelect name="clientId" value={editingProject.clientId || ''} onChange={handleSelectChange} options={clientOptions} placeholder="Seleziona cliente" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Project Manager</label>
                                    <SearchableSelect name="projectManager" value={editingProject.projectManager || ''} onChange={handleSelectChange} options={projectManagerOptions} placeholder="Seleziona PM" />
                                </div>
                            </div>
                        </div>

                        {/* Sezione Pianificazione e Budget */}
                        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                            <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">payments</span> Pianificazione & Budget
                            </h4>
                            <div className="space-y-4">
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
                                        <label className="block text-sm font-medium text-on-surface-variant mb-1">Budget (€) *</label>
                                        <input type="number" name="budget" value={editingProject.budget} onChange={handleChange} required className="form-input" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-on-surface-variant mb-1">Realization (%)</label>
                                        <input type="number" name="realizationPercentage" value={editingProject.realizationPercentage} onChange={handleChange} className="form-input" min="0" max="200" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Stato</label>
                                    <SearchableSelect name="status" value={editingProject.status || ''} onChange={handleSelectChange} options={statusOptions} placeholder="Seleziona stato" />
                                </div>
                            </div>
                        </div>

                        {/* Sezione Associazioni */}
                        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                            <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">link</span> Associazioni & Note
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Contratto Quadro</label>
                                    <SearchableSelect name="contractId" value={editingProject.contractId || ''} onChange={handleSelectChange} options={contractOptions} placeholder="Seleziona contratto" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Skill Richieste</label>
                                    <MultiSelectDropdown name="skills" selectedValues={selectedSkills} onChange={(_, values) => setSelectedSkills(values)} options={skillOptions} placeholder="Seleziona skill richieste..." />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Note Progetto</label>
                                    <textarea name="notes" value={editingProject.notes || ''} onChange={handleChange} className="form-textarea" rows={3} placeholder="Dettagli aggiuntivi sul progetto..."></textarea>
                                </div>
                            </div>
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

            {expenseModalProject && (
                <ProjectExpensesModal 
                    project={expenseModalProject} 
                    isOpen={!!expenseModalProject} 
                    onClose={() => setExpenseModalProject(null)} 
                />
            )}

            {billingModalProject && (
                <BillingPlanModal
                    project={billingModalProject}
                    isOpen={!!billingModalProject}
                    onClose={() => setBillingModalProject(null)}
                />
            )}
        </div>
    );
};

export default ProjectsPage;
