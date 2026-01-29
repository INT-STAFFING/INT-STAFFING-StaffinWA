import React, { useState, useReducer, useEffect, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../services/apiClient';
import { 
    SimulationResource, 
    SimulationProject, 
    SimulationScenario, 
    SimulationFinancials, 
    Assignment, 
    Allocation,
    ProjectExpense,
    BillingMilestone,
    BillingType,
    MilestoneStatus
} from '../types';
import Modal from '../components/Modal';
import { SpinnerIcon } from '../components/icons';
import SearchableSelect from '../components/SearchableSelect';
import { formatDate, getWorkingDaysBetween, formatDateFull } from '../utils/dateUtils';
import ExportButton from '../components/ExportButton';
import { formatCurrency } from '../utils/formatters';

// --- INITIAL STATE ---
interface SimulationState {
    id: string;
    name: string;
    description: string;
    resources: SimulationResource[];
    projects: SimulationProject[];
    assignments: Assignment[];
    allocations: Allocation;
    financials: SimulationFinancials;
    // New Fields
    projectExpenses: ProjectExpense[];
    billingMilestones: BillingMilestone[];
    
    hasUnsavedChanges: boolean;
}

const initialState: SimulationState = {
    id: '',
    name: 'Nuova Simulazione',
    description: '',
    resources: [],
    projects: [],
    assignments: [],
    allocations: {},
    financials: {},
    projectExpenses: [],
    billingMilestones: [],
    hasUnsavedChanges: false
};

// --- ACTIONS ---
type Action = 
    | { type: 'LOAD_SCENARIO'; payload: SimulationScenario }
    | { type: 'IMPORT_DATA'; payload: { resources: SimulationResource[], projects: SimulationProject[], assignments: Assignment[], allocations: Allocation, financials: SimulationFinancials, projectExpenses: ProjectExpense[], billingMilestones: BillingMilestone[] } }
    | { type: 'UPDATE_META'; payload: { name?: string; description?: string } }
    | { type: 'SET_SCENARIO_ID'; payload: string }
    | { type: 'ADD_GHOST_RESOURCE'; payload: SimulationResource }
    | { type: 'UPDATE_RESOURCE_COST'; payload: { resourceId: string; dailyCost: number; dailyExpenses: number; sellRate: number } }
    | { type: 'UPDATE_PROJECT_RATE_CARD'; payload: { projectId: string; rateCardId: string } }
    | { type: 'UPDATE_PROJECT_BILLING_TYPE'; payload: { projectId: string; billingType: BillingType } }
    | { type: 'BULK_UPDATE_PROJECT_RATE_CARD'; payload: string }
    | { type: 'ADD_ASSIGNMENT'; payload: Assignment }
    | { type: 'DELETE_ASSIGNMENT'; payload: string }
    | { type: 'UPDATE_ALLOCATION'; payload: { assignmentId: string; date: string; percentage: number } }
    | { type: 'BULK_UPDATE_ALLOCATION'; payload: { assignmentId: string; startDate: string; endDate: string; percentage: number } }
    // Expenses Actions
    | { type: 'ADD_EXPENSE'; payload: ProjectExpense }
    | { type: 'DELETE_EXPENSE'; payload: string }
    // Billing Milestones Actions
    | { type: 'ADD_MILESTONE'; payload: BillingMilestone }
    | { type: 'UPDATE_MILESTONE'; payload: BillingMilestone }
    | { type: 'DELETE_MILESTONE'; payload: string }
    | { type: 'RESET_CHANGES' };


const simulationReducer = (state: SimulationState, action: Action): SimulationState => {
    switch (action.type) {
        case 'LOAD_SCENARIO':
            return {
                ...initialState,
                id: action.payload.id,
                name: action.payload.name,
                description: action.payload.description || '',
                resources: action.payload.data.resources || [],
                projects: action.payload.data.projects || [],
                assignments: action.payload.data.assignments || [],
                allocations: action.payload.data.allocations || {},
                financials: action.payload.data.financials || {},
                // Safe check for legacy scenarios without these fields
                projectExpenses: (action.payload.data as any).projectExpenses || [],
                billingMilestones: (action.payload.data as any).billingMilestones || [],
                hasUnsavedChanges: false
            };
        case 'IMPORT_DATA':
            return {
                ...state,
                resources: action.payload.resources,
                projects: action.payload.projects,
                assignments: action.payload.assignments,
                allocations: action.payload.allocations,
                financials: action.payload.financials,
                projectExpenses: action.payload.projectExpenses,
                billingMilestones: action.payload.billingMilestones,
                hasUnsavedChanges: true
            };
        case 'UPDATE_META':
            return { ...state, ...action.payload, hasUnsavedChanges: true };
        case 'SET_SCENARIO_ID':
            return { ...state, id: action.payload }; // DOES NOT set unsaved changes
        case 'ADD_GHOST_RESOURCE':
            const newFin = { ...state.financials };
            // Initialize financials for ghost
            newFin[action.payload.id!] = { 
                dailyCost: action.payload.dailyCost || 0, 
                dailyExpenses: action.payload.dailyExpenses || 0,
                sellRate: 0 // Will be set in UI
            };
            return { 
                ...state, 
                resources: [...state.resources, action.payload], 
                financials: newFin,
                hasUnsavedChanges: true 
            };
        case 'UPDATE_RESOURCE_COST':
            return {
                ...state,
                financials: {
                    ...state.financials,
                    [action.payload.resourceId]: {
                        dailyCost: action.payload.dailyCost,
                        dailyExpenses: action.payload.dailyExpenses,
                        sellRate: action.payload.sellRate
                    }
                },
                hasUnsavedChanges: true
            };
        case 'UPDATE_PROJECT_RATE_CARD':
            return {
                ...state,
                projects: state.projects.map(p => p.id === action.payload.projectId ? { ...p, simulatedRateCardId: action.payload.rateCardId } : p),
                hasUnsavedChanges: true
            };
        case 'UPDATE_PROJECT_BILLING_TYPE':
            return {
                ...state,
                projects: state.projects.map(p => p.id === action.payload.projectId ? { ...p, billingType: action.payload.billingType } : p),
                hasUnsavedChanges: true
            };
        case 'BULK_UPDATE_PROJECT_RATE_CARD':
            return {
                ...state,
                projects: state.projects.map(p => ({ ...p, simulatedRateCardId: action.payload })),
                hasUnsavedChanges: true
            };
        case 'ADD_ASSIGNMENT':
             // Avoid duplicates
             if (state.assignments.some(a => a.resourceId === action.payload.resourceId && a.projectId === action.payload.projectId)) {
                 return state;
             }
             return { ...state, assignments: [...state.assignments, action.payload], hasUnsavedChanges: true };
        case 'DELETE_ASSIGNMENT':
             const newAlloc = { ...state.allocations };
             delete newAlloc[action.payload];
             return { 
                 ...state, 
                 assignments: state.assignments.filter(a => a.id !== action.payload), 
                 allocations: newAlloc,
                 hasUnsavedChanges: true 
             };
        case 'UPDATE_ALLOCATION':
             const assignAlloc = { ...(state.allocations[action.payload.assignmentId] || {}) };
             if (action.payload.percentage === 0) delete assignAlloc[action.payload.date];
             else assignAlloc[action.payload.date] = action.payload.percentage;
             
             return {
                 ...state,
                 allocations: { ...state.allocations, [action.payload.assignmentId]: assignAlloc },
                 hasUnsavedChanges: true
             };
        case 'BULK_UPDATE_ALLOCATION':
             const { assignmentId, startDate, endDate, percentage } = action.payload;
             const start = new Date(startDate);
             const end = new Date(endDate);
             const bulkAssignAlloc = { ...(state.allocations[assignmentId] || {}) };
             
             // Iterate through dates and set percentage
             for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
                 const day = d.getDay();
                 if (day !== 0 && day !== 6) {
                     const dateStr = d.toISOString().split('T')[0];
                     if (percentage === 0) delete bulkAssignAlloc[dateStr];
                     else bulkAssignAlloc[dateStr] = percentage;
                 }
             }
             return {
                 ...state,
                 allocations: { ...state.allocations, [assignmentId]: bulkAssignAlloc },
                 hasUnsavedChanges: true
             };
        
        // --- EXPENSES ---
        case 'ADD_EXPENSE':
            return { ...state, projectExpenses: [...state.projectExpenses, action.payload], hasUnsavedChanges: true };
        case 'DELETE_EXPENSE':
            return { ...state, projectExpenses: state.projectExpenses.filter(e => e.id !== action.payload), hasUnsavedChanges: true };

        // --- MILESTONES ---
        case 'ADD_MILESTONE':
            return { ...state, billingMilestones: [...state.billingMilestones, action.payload], hasUnsavedChanges: true };
        case 'UPDATE_MILESTONE':
            return { ...state, billingMilestones: state.billingMilestones.map(m => m.id === action.payload.id ? action.payload : m), hasUnsavedChanges: true };
        case 'DELETE_MILESTONE':
            return { ...state, billingMilestones: state.billingMilestones.filter(m => m.id !== action.payload), hasUnsavedChanges: true };

        case 'RESET_CHANGES':
            return { ...state, hasUnsavedChanges: false };
        default:
            return state;
    }
};


// --- COMPONENT ---

const SimulationPage: React.FC = () => {
    const { 
        resources: realResources, projects: realProjects, assignments: realAssignments, contracts: realContracts, 
        rateCards, rateCardEntries, roles, horizontals, locations, companyCalendar, clients,
        projectExpenses: realExpenses, billingMilestones: realMilestones
    } = useEntitiesContext();
    const { allocations: realAllocations } = useAllocationsContext();
    const { addToast } = useToast();

    const [state, dispatch] = useReducer(simulationReducer, initialState);
    const [scenarios, setScenarios] = useState<any[]>([]); // Metadata list
    const [activeTab, setActiveTab] = useState<'config' | 'staffing' | 'analysis'>('config');
    const [isLoading, setIsLoading] = useState(false);
    
    // UI Local State
    const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [isGhostModalOpen, setIsGhostModalOpen] = useState(false);
    const [newGhost, setNewGhost] = useState<Partial<SimulationResource>>({ 
        horizontal: horizontals[0]?.value, 
        location: locations[0]?.value, 
        roleId: roles[0]?.id 
    });
    const [bulkRateCardId, setBulkRateCardId] = useState('');

    // Modals for Expenses/Billing
    const [activeExpenseProject, setActiveExpenseProject] = useState<SimulationProject | null>(null);
    const [activeBillingProject, setActiveBillingProject] = useState<SimulationProject | null>(null);
    
    // For Staffing Table Interaction
    const [currentDate, setCurrentDate] = useState(new Date());

    // Load Scenarios List
    const loadScenariosList = useCallback(async () => {
        try {
            const allCache = await apiFetch<any[]>('/api/resources?entity=analytics_cache');
            const scenarioList = allCache
                .filter(item => item.key && item.key.startsWith('scenario_'))
                .map(item => {
                    const data = item.data || {};
                    return { 
                        dbId: item.id, 
                        key: item.key, 
                        id: data.id,
                        name: data.name || 'Scenario Senza Nome', 
                        description: data.description || '', 
                        updatedAt: item.updated_at || item.updatedAt || data.updatedAt || new Date().toISOString()
                    };
                })
                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            setScenarios(scenarioList);
        } catch (e) { console.error("Failed to load scenarios list", e); }
    }, []);

    useEffect(() => {
        loadScenariosList();
    }, [loadScenariosList]);

    // --- Actions ---

    const handleImportRealData = () => {
        if (!realResources || realResources.length === 0) {
            addToast('Nessuna risorsa disponibile da importare.', 'warning');
            return;
        }
        
        if (!confirm('Importando i dati reali sovrascriverai l\'attuale simulazione. Continuare?')) return;

        try {
            const simResources: SimulationResource[] = (realResources || []).map(r => ({ ...r, isGhost: false, dailyExpenses: 0 }));

            const simProjects: SimulationProject[] = (realProjects || []).map(p => {
                 const contract = (realContracts || []).find(c => c.id === p.contractId);
                 return { ...p, simulatedRateCardId: contract?.rateCardId || undefined };
            });

            const simAssignments: Assignment[] = realAssignments ? JSON.parse(JSON.stringify(realAssignments)) : [];
            const simAllocations: Allocation = realAllocations && Object.keys(realAllocations).length > 0
                ? JSON.parse(JSON.stringify(realAllocations)) 
                : {};
            
            // Import Expenses & Milestones
            const simExpenses: ProjectExpense[] = realExpenses ? JSON.parse(JSON.stringify(realExpenses)) : [];
            const simMilestones: BillingMilestone[] = realMilestones ? JSON.parse(JSON.stringify(realMilestones)) : [];

            const simFinancials: SimulationFinancials = {};
            
            simResources.forEach(r => {
                const role = roles.find(ro => ro.id === r.roleId);
                const dailyCost: number = Number(r.dailyCost) > 0 ? Number(r.dailyCost) : (Number(role?.dailyCost) || 0);
                const dailyExpenses: number = (role?.dailyExpenses && Number(role.dailyExpenses) > 0) ? Number(role.dailyExpenses) : (dailyCost * 0.035);
                
                let sellRate = 0;
                const resourceAssignments = simAssignments.filter(a => a.resourceId === r.id);
                for (const assignment of resourceAssignments) {
                    const project = simProjects.find(p => p.id === assignment.projectId);
                    if (project && project.simulatedRateCardId) {
                        const entry = (rateCardEntries || []).find(e => e.rateCardId === project.simulatedRateCardId && e.resourceId === r.id);
                        if (entry) {
                            sellRate = Number(entry.dailyRate);
                            break; 
                        }
                    }
                }
                if (r.id) simFinancials[r.id] = { dailyCost, dailyExpenses, sellRate };
            });

            dispatch({
                type: 'IMPORT_DATA',
                payload: {
                    resources: simResources,
                    projects: simProjects,
                    assignments: simAssignments,
                    allocations: simAllocations,
                    financials: simFinancials,
                    projectExpenses: simExpenses,
                    billingMilestones: simMilestones
                }
            });
            
            // FIND EARLIEST ALLOCATION TO JUMP CALENDAR
            let earliestDate = new Date().toISOString();
            let found = false;
            Object.values(simAllocations).forEach(assignmentAlloc => {
                Object.keys(assignmentAlloc).forEach(dateStr => {
                    if (dateStr < earliestDate) {
                        earliestDate = dateStr;
                        found = true;
                    }
                });
            });
            
            if (found) {
                const d = new Date(earliestDate);
                setCurrentDate(d);
            }
            
            setActiveTab('config');
            addToast(`Importati: ${simResources.length} ris., ${simProjects.length} prog., ${simExpenses.length} spese.`, 'success');
        } catch (e) {
            console.error("Import failed", e);
            addToast('Errore tecnico durante l\'importazione dei dati.', 'error');
        }
    };

    // Open Modal instead of direct save
    const openSaveModal = () => {
        if (!state.name) {
             dispatch({ type: 'UPDATE_META', payload: { name: 'Nuova Simulazione' } } as any);
        }
        setIsSaveModalOpen(true);
    };

    const performSave = async () => {
        if (!state.name) {
            addToast('Inserisci un nome per lo scenario.', 'error');
            return;
        }
        setIsLoading(true);
        try {
            // Generate or reuse ID for the logical scenario
            const scenarioId = state.id || uuidv4();
            const scenarioKey = `scenario_${scenarioId}`;

            const scenarioData: SimulationScenario = {
                id: scenarioId,
                name: state.name,
                description: state.description,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                data: {
                    resources: state.resources,
                    projects: state.projects,
                    assignments: state.assignments,
                    allocations: state.allocations,
                    financials: state.financials,
                    // Save new fields
                    projectExpenses: state.projectExpenses,
                    billingMilestones: state.billingMilestones
                } as any
            };

            const existingEntry = scenarios.find(s => s.id === scenarioId || s.key === scenarioKey);
            const dbId = existingEntry?.dbId;

            let result;

            if (dbId) {
                result = await apiFetch<{id: string}>(`/api/resources?entity=analytics_cache&id=${dbId}`, { 
                    method: 'PUT', 
                    body: JSON.stringify({ 
                        key: scenarioKey, 
                        data: scenarioData,
                        scope: 'SIMULATION' 
                    }) 
                });
            } else {
                result = await apiFetch<{id: string}>('/api/resources?entity=analytics_cache', { 
                    method: 'POST', 
                    body: JSON.stringify({ 
                        key: scenarioKey, 
                        data: scenarioData,
                        scope: 'SIMULATION'
                    }) 
                });
            }

            if (!state.id) {
                 dispatch({ type: 'SET_SCENARIO_ID', payload: scenarioId }); 
            }
            
            dispatch({ type: 'RESET_CHANGES' });
            
            addToast('Scenario salvato correttamente.', 'success');
            setIsSaveModalOpen(false);
            loadScenariosList(); 
        } catch (e) {
            console.error("Save failed:", e);
            const msg = e instanceof Error ? e.message : 'Errore sconosciuto';
            addToast(`Errore durante il salvataggio: ${msg}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoadScenario = async (key: string) => {
        setIsLoading(true);
        try {
            const res = await apiFetch<any[]>(`/api/resources?entity=analytics_cache`);
            const scenarioRow = res.find(r => r.key === key);
            
            if (scenarioRow && scenarioRow.data) {
                const scenarioData = scenarioRow.data as SimulationScenario;
                dispatch({ type: 'LOAD_SCENARIO', payload: scenarioData });
                setIsLoadModalOpen(false);
                setActiveTab('config');
                 let earliestDate = new Date().toISOString();
                let found = false;
                if (scenarioData.data.allocations) {
                     Object.values(scenarioData.data.allocations).forEach((assignmentAlloc: any) => {
                        Object.keys(assignmentAlloc).forEach(dateStr => {
                            if (dateStr < earliestDate) {
                                earliestDate = dateStr;
                                found = true;
                            }
                        });
                    });
                }
                if (found) setCurrentDate(new Date(earliestDate));

                addToast(`Scenario "${scenarioData.name}" caricato.`, 'success');
            } else {
                addToast('Dati dello scenario non trovati o corrotti.', 'error');
            }
        } catch (e) {
            console.error(e);
            addToast('Errore durante il caricamento dello scenario.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddGhost = () => {
        const id = `ghost-${uuidv4().substring(0, 8)}`;
        const role = roles.find(r => r.id === newGhost.roleId);
        const dailyCost = role?.dailyCost || 0;
        const dailyExpenses = role?.dailyExpenses || (dailyCost * 0.035);

        dispatch({
            type: 'ADD_GHOST_RESOURCE',
            payload: {
                id,
                name: newGhost.name || 'Nuova Risorsa',
                email: `ghost.${id}@sim.local`,
                roleId: newGhost.roleId || '',
                horizontal: newGhost.horizontal || '',
                location: newGhost.location || '',
                hireDate: new Date().toISOString().split('T')[0],
                workSeniority: 0,
                maxStaffingPercentage: 100,
                resigned: false,
                lastDayOfWork: null,
                isGhost: true,
                dailyCost, 
                dailyExpenses
            }
        });
        setNewGhost({ horizontal: horizontals[0]?.value, location: locations[0]?.value, roleId: roles[0]?.id, name: '' });
        setIsGhostModalOpen(false);
        addToast('Risorsa simulata aggiunta.', 'success');
    };

    const handleBulkApplyRateCard = () => {
        if (!bulkRateCardId) return;
        const cardName = rateCards.find(rc => rc.id === bulkRateCardId)?.name;
        if (confirm(`Sei sicuro di voler applicare il listino "${cardName}" a TUTTI i progetti della simulazione?`)) {
            dispatch({ type: 'BULK_UPDATE_PROJECT_RATE_CARD', payload: bulkRateCardId });
            addToast('Listino applicato a tutti i progetti.', 'success');
        }
    };

    // --- Helper Functions for Staffing Table ---
    
    const monthsToRender = useMemo(() => {
        const months = [];
        const start = new Date(currentDate);
        start.setDate(1); 
        for (let i = 0; i < 6; i++) {
            const d = new Date(start);
            d.setMonth(start.getMonth() + i);
            months.push(d);
        }
        return months;
    }, [currentDate]);

    const getMonthlyAllocationDays = useCallback((assignmentId: string, monthDate: Date, resourceLocation: string) => {
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth();
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
        
        const assignmentAllocations = state.allocations[assignmentId];
        if (!assignmentAllocations) return 0;
        
        let totalDays = 0;
        
        for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
            const dateStr = formatDate(d, 'iso');
            const pct = (assignmentAllocations[dateStr] ?? 0) as number;
            if (pct > 0) {
                 totalDays += (pct / 100);
            }
        }
        return totalDays;
    }, [state.allocations]);

    const getWorkingDaysInMonth = useCallback((monthDate: Date, location: string) => {
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth();
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
        return getWorkingDaysBetween(start, end, companyCalendar, location);
    }, [companyCalendar]);

    const handleMonthValueChange = (assignmentId: string, monthDate: Date, newValue: string, location: string) => {
        let days = parseFloat(newValue);
        if (isNaN(days) || days < 0) days = 0;
        
        const maxDays = getWorkingDaysInMonth(monthDate, location);
        if (maxDays === 0) return; 
        
        let percentage = (days / maxDays) * 100;
        if (percentage > 100) percentage = 100;
        
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth();
        const start = new Date(Date.UTC(year, month, 1));
        const end = new Date(Date.UTC(year, month + 1, 0));
        
        dispatch({
            type: 'BULK_UPDATE_ALLOCATION',
            payload: {
                assignmentId,
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0],
                percentage: Math.round(percentage)
            }
        });
    };
    
    // --- Analysis Data Calculation ---
    const analysisData = useMemo(() => {
        const monthlyData: Record<string, { revenue: number, cost: number }> = {};
        
        // 1. Calculate Assignments Labor Cost & Revenue
        state.assignments.forEach(assignment => {
            const allocs = state.allocations[assignment.id!] || {};
            const resource = state.resources.find(r => r.id === assignment.resourceId);
            const project = state.projects.find(p => p.id === assignment.projectId);
            
            if (!resource || !project) return;
            
            const financials = state.financials[resource.id!] || { dailyCost: 0, dailyExpenses: 0, sellRate: 0 };
            
            let sellRate = financials.sellRate;
            if (sellRate === 0 && project.simulatedRateCardId) {
                const entry = rateCardEntries.find(e => e.rateCardId === project.simulatedRateCardId && e.resourceId === resource.id);
                if (entry) sellRate = Number(entry.dailyRate);
            }
            
            Object.entries(allocs).forEach(([date, pct]) => {
                const month = date.substring(0, 7); // YYYY-MM
                if (!monthlyData[month]) monthlyData[month] = { revenue: 0, cost: 0 };
                
                const fraction = (pct as number) / 100;
                const cost = fraction * (financials.dailyCost + financials.dailyExpenses);
                
                // Revenue only if T&M
                let revenue = 0;
                if (project.billingType === 'TIME_MATERIAL' || !project.billingType) {
                    revenue = fraction * sellRate; 
                }
                
                monthlyData[month].cost += cost;
                monthlyData[month].revenue += revenue;
            });
        });

        // 2. Add Project Expenses (Costs)
        state.projectExpenses.forEach(exp => {
            const month = exp.date.substring(0, 7);
            if (!monthlyData[month]) monthlyData[month] = { revenue: 0, cost: 0 };
            monthlyData[month].cost += Number(exp.amount);
        });

        // 3. Add Billing Milestones (Fixed Price Revenue)
        state.billingMilestones.forEach(bm => {
            // Find project to check type (defensive)
            const project = state.projects.find(p => p.id === bm.projectId);
            if (project?.billingType === 'FIXED_PRICE') {
                const month = bm.date.substring(0, 7);
                if (!monthlyData[month]) monthlyData[month] = { revenue: 0, cost: 0 };
                monthlyData[month].revenue += Number(bm.amount);
            }
        });
        
        return Object.entries(monthlyData)
            .sort((a,b) => a[0].localeCompare(b[0]))
            .map(([month, val]) => ({
                month,
                ...val,
                margin: val.revenue - val.cost,
                marginPct: val.revenue > 0 ? ((val.revenue - val.cost) / val.revenue) * 100 : 0
            }));
    }, [state, rateCardEntries]);

    // --- SUB-COMPONENTS FOR MODALS (Internal to SimulationPage for access to dispatch) ---

    const SimulationExpensesModal: React.FC<{ project: SimulationProject; onClose: () => void }> = ({ project, onClose }) => {
        const [newExpense, setNewExpense] = useState<Partial<ProjectExpense>>({ category: 'Altro', date: new Date().toISOString().split('T')[0], amount: 0, billable: false });
        
        const projectExpenses = state.projectExpenses.filter(e => e.projectId === project.id);
        const total = projectExpenses.reduce((s, e) => s + Number(e.amount), 0);

        const handleAdd = () => {
            if (!newExpense.amount) return;
            dispatch({
                type: 'ADD_EXPENSE',
                payload: {
                    id: uuidv4(),
                    projectId: project.id!,
                    category: newExpense.category || 'Altro',
                    description: newExpense.description || '',
                    amount: Number(newExpense.amount),
                    date: newExpense.date || new Date().toISOString().split('T')[0],
                    billable: !!newExpense.billable
                }
            });
            setNewExpense({ category: 'Altro', date: new Date().toISOString().split('T')[0], amount: 0, billable: false });
        };

        return (
            <Modal isOpen={true} onClose={onClose} title={`Spese Simulate: ${project.name}`}>
                <div className="space-y-4">
                    <div className="bg-surface-container-low p-3 rounded-lg flex justify-between items-center border border-outline-variant">
                        <span className="text-sm font-bold">Totale Spese</span>
                        <span className="text-lg font-mono text-primary">{formatCurrency(total)}</span>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2 border border-outline-variant rounded-lg p-2 bg-surface">
                        {projectExpenses.length === 0 && <p className="text-center text-xs text-on-surface-variant p-4">Nessuna spesa inserita.</p>}
                        {projectExpenses.map(exp => (
                            <div key={exp.id} className="flex justify-between items-center p-2 bg-surface-container-low rounded border border-outline-variant text-sm">
                                <div>
                                    <div className="font-bold">{exp.category}</div>
                                    <div className="text-xs text-on-surface-variant">{formatDateFull(exp.date)} - {exp.description}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono">{formatCurrency(exp.amount)}</span>
                                    <button onClick={() => dispatch({ type: 'DELETE_EXPENSE', payload: exp.id! })} className="text-error hover:bg-error-container p-1 rounded">
                                        <span className="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-4 gap-2 items-end pt-2 border-t border-outline-variant">
                        <div className="col-span-2">
                            <label className="text-[10px] uppercase font-bold text-on-surface-variant">Descrizione</label>
                            <input type="text" className="form-input text-xs p-1" value={newExpense.description || ''} onChange={e => setNewExpense({...newExpense, description: e.target.value})} />
                        </div>
                         <div>
                            <label className="text-[10px] uppercase font-bold text-on-surface-variant">Data</label>
                            <input type="date" className="form-input text-xs p-1" value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase font-bold text-on-surface-variant">Importo</label>
                            <input type="number" className="form-input text-xs p-1" value={newExpense.amount || ''} onChange={e => setNewExpense({...newExpense, amount: Number(e.target.value)})} />
                        </div>
                        <button onClick={handleAdd} className="col-span-4 bg-primary text-on-primary text-xs font-bold py-2 rounded">Aggiungi Spesa</button>
                    </div>
                </div>
            </Modal>
        );
    };

    const SimulationBillingModal: React.FC<{ project: SimulationProject; onClose: () => void }> = ({ project, onClose }) => {
        const [newMilestone, setNewMilestone] = useState<Partial<BillingMilestone>>({ name: '', date: new Date().toISOString().split('T')[0], amount: 0, status: 'PLANNED' });
        
        const milestones = state.billingMilestones.filter(m => m.projectId === project.id).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const total = milestones.reduce((s, m) => s + Number(m.amount), 0);

        const handleAdd = () => {
             if (!newMilestone.amount || !newMilestone.name) return;
             dispatch({
                 type: 'ADD_MILESTONE',
                 payload: {
                     id: uuidv4(),
                     projectId: project.id!,
                     name: newMilestone.name,
                     date: newMilestone.date || new Date().toISOString().split('T')[0],
                     amount: Number(newMilestone.amount),
                     status: newMilestone.status as MilestoneStatus || 'PLANNED'
                 }
             });
             setNewMilestone({ name: '', date: new Date().toISOString().split('T')[0], amount: 0, status: 'PLANNED' });
        };

        const handleBillingTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
            dispatch({
                type: 'UPDATE_PROJECT_BILLING_TYPE',
                payload: { projectId: project.id!, billingType: e.target.value as BillingType }
            });
        };

        return (
            <Modal isOpen={true} onClose={onClose} title={`Piano Fatturazione Simulato: ${project.name}`}>
                <div className="space-y-4">
                     <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant flex justify-between items-center">
                        <div>
                            <label className="text-[10px] uppercase font-bold text-on-surface-variant block">Tipo Contratto</label>
                            <select 
                                className="bg-transparent border-none font-bold text-sm focus:ring-0 p-0 cursor-pointer text-primary"
                                value={project.billingType || 'TIME_MATERIAL'}
                                onChange={handleBillingTypeChange}
                            >
                                <option value="TIME_MATERIAL">Time & Material</option>
                                <option value="FIXED_PRICE">Fixed Price</option>
                            </select>
                        </div>
                        <div className="text-right">
                             <div className="text-[10px] uppercase font-bold text-on-surface-variant">Totale Piano</div>
                             <div className={`text-lg font-mono ${total > (project.budget || 0) ? 'text-error' : 'text-primary'}`}>{formatCurrency(total)}</div>
                        </div>
                    </div>

                    {project.billingType === 'FIXED_PRICE' ? (
                        <>
                            <div className="max-h-60 overflow-y-auto space-y-2 border border-outline-variant rounded-lg p-2 bg-surface">
                                {milestones.length === 0 && <p className="text-center text-xs text-on-surface-variant p-4">Nessuna milestone pianificata.</p>}
                                {milestones.map(ms => (
                                    <div key={ms.id} className="flex justify-between items-center p-2 bg-surface-container-low rounded border border-outline-variant text-sm">
                                        <div>
                                            <div className="font-bold">{ms.name}</div>
                                            <div className="text-xs text-on-surface-variant">{formatDateFull(ms.date)} - {ms.status}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono">{formatCurrency(ms.amount)}</span>
                                            <button onClick={() => dispatch({ type: 'DELETE_MILESTONE', payload: ms.id! })} className="text-error hover:bg-error-container p-1 rounded">
                                                <span className="material-symbols-outlined text-sm">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-4 gap-2 items-end pt-2 border-t border-outline-variant">
                                <div className="col-span-2">
                                    <label className="text-[10px] uppercase font-bold text-on-surface-variant">Nome Rata</label>
                                    <input type="text" className="form-input text-xs p-1" value={newMilestone.name} onChange={e => setNewMilestone({...newMilestone, name: e.target.value})} placeholder="es. Anticipo"/>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-on-surface-variant">Data</label>
                                    <input type="date" className="form-input text-xs p-1" value={newMilestone.date} onChange={e => setNewMilestone({...newMilestone, date: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-on-surface-variant">Importo</label>
                                    <input type="number" className="form-input text-xs p-1" value={newMilestone.amount || ''} onChange={e => setNewMilestone({...newMilestone, amount: Number(e.target.value)})} />
                                </div>
                                <button onClick={handleAdd} className="col-span-4 bg-primary text-on-primary text-xs font-bold py-2 rounded">Aggiungi Rata</button>
                            </div>
                        </>
                    ) : (
                        <div className="p-6 text-center text-sm text-on-surface-variant border border-dashed border-outline-variant rounded-lg bg-surface-container-lowest">
                            In modalità <strong>Time & Material</strong>, i ricavi sono calcolati automaticamente in base alle allocazioni e alle tariffe del listino.
                        </div>
                    )}
                </div>
            </Modal>
        );
    };


    // --- RENDER ---
    return (
        <div className="h-full flex flex-col space-y-4">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-surface p-4 rounded-2xl shadow border border-outline-variant gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                        <span className="material-symbols-outlined">science</span> Simulazione
                    </h1>
                    <div 
                        className="text-on-surface font-semibold mt-1 cursor-pointer hover:underline" 
                        onClick={openSaveModal}
                        title="Clicca per modificare"
                    >
                        {state.name || 'Nuova Simulazione'}
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-surface-container rounded-full p-1 mr-4">
                        <button onClick={() => setActiveTab('config')} className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${activeTab === 'config' ? 'bg-surface shadow text-primary' : 'text-on-surface-variant'}`}>Configurazione</button>
                        <button onClick={() => setActiveTab('staffing')} className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${activeTab === 'staffing' ? 'bg-surface shadow text-primary' : 'text-on-surface-variant'}`}>Staffing</button>
                        <button onClick={() => setActiveTab('analysis')} className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${activeTab === 'analysis' ? 'bg-surface shadow text-primary' : 'text-on-surface-variant'}`}>Analisi</button>
                    </div>

                    <button onClick={handleImportRealData} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant" title="Importa Dati Reali">
                        <span className="material-symbols-outlined">cloud_download</span>
                    </button>
                    <button onClick={() => setIsLoadModalOpen(true)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant" title="Carica Scenario">
                        <span className="material-symbols-outlined">folder_open</span>
                    </button>
                    <button onClick={openSaveModal} disabled={isLoading || !state.hasUnsavedChanges} className="px-4 py-2 bg-primary text-on-primary rounded-full font-bold shadow hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                        {isLoading ? <SpinnerIcon className="w-4 h-4"/> : <span className="material-symbols-outlined text-sm">save</span>}
                        Salva
                    </button>
                </div>
            </div>

            {/* CONTENT */}
            <div className="flex-grow overflow-hidden relative">
                {activeTab === 'config' && (
                    <div className="h-full overflow-y-auto space-y-6 p-1">
                        {/* Resource Config */}
                        <div className="bg-surface p-6 rounded-2xl shadow border border-outline-variant">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold">Configurazione Risorse e Costi</h3>
                                <button onClick={() => setIsGhostModalOpen(true)} className="px-3 py-1.5 bg-tertiary-container text-on-tertiary-container rounded-full text-xs font-bold flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">add_ghost</span> Aggiungi Risorsa Simulata
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-surface-container-low text-xs uppercase font-bold text-on-surface-variant">
                                        <tr>
                                            <th className="p-3">Risorsa</th>
                                            <th className="p-3">Ruolo</th>
                                            <th className="p-3 text-right">Costo G. (€)</th>
                                            <th className="p-3 text-right">Spese G. (€)</th>
                                            <th className="p-3 text-right">Tariffa Vendita (€)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-outline-variant">
                                        {state.resources.map(res => {
                                            const fin = state.financials[res.id!] || { dailyCost: 0, dailyExpenses: 0, sellRate: 0 };
                                            return (
                                                <tr key={res.id} className="hover:bg-surface-container-low">
                                                    <td className="p-3 font-medium flex items-center gap-2">
                                                        {res.isGhost && <span className="material-symbols-outlined text-tertiary text-sm" title="Simulata">smart_toy</span>}
                                                        {res.name}
                                                    </td>
                                                    <td className="p-3 text-on-surface-variant">{roles.find(r => r.id === res.roleId)?.name}</td>
                                                    <td className="p-3 text-right">
                                                        <input 
                                                            type="number" 
                                                            className="w-24 text-right bg-transparent border-b border-outline-variant focus:border-primary outline-none"
                                                            value={fin.dailyCost}
                                                            onChange={e => dispatch({ type: 'UPDATE_RESOURCE_COST', payload: { resourceId: res.id!, dailyCost: Number(e.target.value), dailyExpenses: fin.dailyExpenses, sellRate: fin.sellRate } })}
                                                        />
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <input 
                                                            type="number" 
                                                            className="w-24 text-right bg-transparent border-b border-outline-variant focus:border-primary outline-none"
                                                            value={fin.dailyExpenses}
                                                            onChange={e => dispatch({ type: 'UPDATE_RESOURCE_COST', payload: { resourceId: res.id!, dailyCost: fin.dailyCost, dailyExpenses: Number(e.target.value), sellRate: fin.sellRate } })}
                                                        />
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <input 
                                                            type="number" 
                                                            className="w-24 text-right bg-transparent border-b border-outline-variant focus:border-primary outline-none"
                                                            value={fin.sellRate}
                                                            onChange={e => dispatch({ type: 'UPDATE_RESOURCE_COST', payload: { resourceId: res.id!, dailyCost: fin.dailyCost, dailyExpenses: fin.dailyExpenses, sellRate: Number(e.target.value) } })}
                                                            placeholder="Default"
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Project Config */}
                        <div className="bg-surface p-6 rounded-2xl shadow border border-outline-variant">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                                <h3 className="text-lg font-bold">Configurazione Progetti e Listini</h3>
                                <div className="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-lg border border-outline-variant">
                                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Massivo:</span>
                                    <select
                                        className="bg-transparent text-sm border-none focus:ring-0 cursor-pointer py-1 pl-2 pr-8"
                                        value={bulkRateCardId}
                                        onChange={(e) => setBulkRateCardId(e.target.value)}
                                    >
                                        <option value="">Seleziona Listino...</option>
                                        {rateCards.map(rc => (
                                            <option key={rc.id} value={rc.id}>{rc.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleBulkApplyRateCard}
                                        disabled={!bulkRateCardId}
                                        className="px-3 py-1 bg-primary text-on-primary text-xs font-bold rounded-md disabled:opacity-50 hover:opacity-90"
                                    >
                                        Applica
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-surface-container-low text-xs uppercase font-bold text-on-surface-variant">
                                        <tr>
                                            <th className="p-3">Progetto</th>
                                            <th className="p-3">Cliente</th>
                                            <th className="p-3">Listino Applicato</th>
                                            <th className="p-3 text-center">Gestione Finanziaria</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-outline-variant">
                                        {state.projects.map(proj => (
                                            <tr key={proj.id} className="hover:bg-surface-container-low">
                                                <td className="p-3 font-medium">{proj.name}</td>
                                                <td className="p-3 text-on-surface-variant">{clients.find(c => c.id === proj.clientId)?.name}</td>
                                                <td className="p-3">
                                                    <select 
                                                        className="bg-transparent border border-outline-variant rounded p-1 text-sm w-full max-w-xs"
                                                        value={proj.simulatedRateCardId || ''}
                                                        onChange={e => dispatch({ type: 'UPDATE_PROJECT_RATE_CARD', payload: { projectId: proj.id!, rateCardId: e.target.value } })}
                                                    >
                                                        <option value="">Nessun Listino</option>
                                                        {rateCards.map(rc => (
                                                            <option key={rc.id} value={rc.id}>{rc.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="p-3 text-center flex items-center justify-center gap-2">
                                                    <button 
                                                        onClick={() => setActiveBillingProject(proj)} 
                                                        className="px-2 py-1 bg-surface-container border border-outline-variant rounded text-xs font-medium hover:bg-surface-container-high"
                                                        title="Piano Fatturazione"
                                                    >
                                                        {proj.billingType === 'FIXED_PRICE' ? 'Fixed Price' : 'T&M'}
                                                    </button>
                                                    <button 
                                                        onClick={() => setActiveExpenseProject(proj)}
                                                        className="px-2 py-1 bg-surface-container border border-outline-variant rounded text-xs font-medium hover:bg-surface-container-high"
                                                        title="Spese Extra"
                                                    >
                                                        Spese
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'staffing' && (
                    <div className="h-full flex flex-col bg-surface rounded-2xl shadow border border-outline-variant">
                        {/* Period Navigation */}
                        <div className="flex-shrink-0 p-3 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
                            <div className="flex gap-2">
                                <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 6); setCurrentDate(d); }} className="p-1 rounded hover:bg-surface-container text-on-surface-variant">
                                    <span className="material-symbols-outlined">chevron_left</span> 6 Mesi
                                </button>
                                <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d); }} className="p-1 rounded hover:bg-surface-container text-on-surface-variant">
                                    <span className="material-symbols-outlined">chevron_left</span>
                                </button>
                                <span className="font-bold text-on-surface px-2">
                                    {monthsToRender[0].toLocaleString('it-IT', { month: 'short', year: '2-digit' })} - {monthsToRender[monthsToRender.length-1].toLocaleString('it-IT', { month: 'short', year: '2-digit' })}
                                </span>
                                <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d); }} className="p-1 rounded hover:bg-surface-container text-on-surface-variant">
                                    <span className="material-symbols-outlined">chevron_right</span>
                                </button>
                                <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() + 6); setCurrentDate(d); }} className="p-1 rounded hover:bg-surface-container text-on-surface-variant">
                                     6 Mesi <span className="material-symbols-outlined">chevron_right</span>
                                </button>
                            </div>
                            <div className="text-xs text-on-surface-variant italic">Modifica i "Giorni Uomo" (G/U) per ricalcolare l'allocazione</div>
                        </div>
                        
                        {/* Simulation Table (Simplified Monthly View) */}
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-surface-container sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-3 border-b border-r border-outline-variant bg-surface-container z-20 sticky left-0 w-64">Risorsa / Progetto</th>
                                        {monthsToRender.map(m => (
                                            <th key={m.toISOString()} className="p-3 border-b border-outline-variant text-center min-w-[80px]">
                                                {m.toLocaleString('it-IT', { month: 'short', year: '2-digit' })}
                                                <div className="text-[10px] font-normal text-on-surface-variant">Max: {getWorkingDaysInMonth(m, '')}gg</div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-outline-variant">
                                    {state.resources.map(res => {
                                        const resAssignments = state.assignments.filter(a => a.resourceId === res.id);
                                        const role = roles.find(r => r.id === res.roleId);
                                        return (
                                            <React.Fragment key={res.id}>
                                                {/* Resource Header Row */}
                                                <tr className="bg-surface-container/50">
                                                    <td className="p-3 font-bold sticky left-0 bg-surface-container/50 border-r border-outline-variant z-10">
                                                        <div className="flex items-center gap-2">
                                                            {res.isGhost && <span className="material-symbols-outlined text-tertiary text-xs">smart_toy</span>}
                                                            {res.name}
                                                        </div>
                                                        <div className="text-[10px] font-normal text-on-surface-variant">{role?.name}</div>
                                                    </td>
                                                    {monthsToRender.map(m => (
                                                        <td key={m.toISOString()} className="p-3 text-center bg-surface-container/50 text-xs text-on-surface-variant">
                                                            {/* Placeholder for total */}
                                                        </td>
                                                    ))}
                                                </tr>
                                                {/* Assignment Rows */}
                                                {resAssignments.map(asg => {
                                                    const project = state.projects.find(p => p.id === asg.projectId);
                                                    return (
                                                        <tr key={asg.id} className="hover:bg-surface-container-low transition-colors">
                                                            <td className="p-3 pl-8 text-sm sticky left-0 bg-surface border-r border-outline-variant z-10">
                                                                <div className="font-medium text-primary truncate" title={project?.name}>{project?.name}</div>
                                                                <div className="text-[10px] text-on-surface-variant truncate">{clients.find(c => c.id === project?.clientId)?.name}</div>
                                                            </td>
                                                            {monthsToRender.map(m => {
                                                                const days = getMonthlyAllocationDays(asg.id!, m, res.location);
                                                                return (
                                                                    <td key={m.toISOString()} className="p-1 text-center border-l border-dashed border-outline-variant">
                                                                        <input 
                                                                            type="number"
                                                                            min="0"
                                                                            step="0.5"
                                                                            className="w-full text-center bg-transparent border-b border-transparent focus:border-primary focus:outline-none text-sm font-mono hover:bg-surface-container"
                                                                            value={days > 0 ? days.toFixed(1) : ''}
                                                                            placeholder="-"
                                                                            onChange={(e) => handleMonthValueChange(asg.id!, m, e.target.value, res.location)}
                                                                        />
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'analysis' && (
                    <div className="h-full bg-surface rounded-2xl shadow border border-outline-variant p-6 overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Analisi Finanziaria (Simulazione)</h3>
                            <ExportButton data={analysisData} title={`Report Simulazione ${state.name}`} />
                        </div>
                        
                        <div className="overflow-auto flex-grow">
                             <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-surface-container-low text-xs uppercase font-bold text-on-surface-variant sticky top-0">
                                    <tr>
                                        <th className="p-3 border-b border-outline-variant">Mese</th>
                                        <th className="p-3 border-b border-outline-variant text-right">Ricavi (€)</th>
                                        <th className="p-3 border-b border-outline-variant text-right">Costi (€)</th>
                                        <th className="p-3 border-b border-outline-variant text-right">Margine (€)</th>
                                        <th className="p-3 border-b border-outline-variant text-right">Margine %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-outline-variant">
                                    {analysisData.map(row => (
                                        <tr key={row.month} className="hover:bg-surface-container-low">
                                            <td className="p-3 font-medium">{row.month}</td>
                                            <td className="p-3 text-right text-primary font-mono">{formatCurrency(row.revenue)}</td>
                                            <td className="p-3 text-right text-error font-mono">{formatCurrency(row.cost)}</td>
                                            <td className={`p-3 text-right font-mono font-bold ${row.margin >= 0 ? 'text-tertiary' : 'text-error'}`}>{formatCurrency(row.margin)}</td>
                                            <td className="p-3 text-right font-bold">{row.marginPct.toFixed(1)}%</td>
                                        </tr>
                                    ))}
                                    {analysisData.length === 0 && (
                                        <tr><td colSpan={5} className="p-8 text-center text-on-surface-variant">Nessun dato allocato nel periodo.</td></tr>
                                    )}
                                </tbody>
                             </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Ghost Modal */}
            {isGhostModalOpen && (
                <Modal isOpen={isGhostModalOpen} onClose={() => setIsGhostModalOpen(false)} title="Nuova Risorsa Simulata">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold mb-1">Nome (Ghost)</label>
                            <input type="text" className="form-input" value={newGhost.name} onChange={e => setNewGhost({...newGhost, name: e.target.value})} placeholder="es. Java Dev Senior 1" />
                        </div>
                        <div>
                             <label className="block text-sm font-bold mb-1">Ruolo</label>
                             <SearchableSelect name="role" value={newGhost.roleId || ''} onChange={(_, v) => setNewGhost({...newGhost, roleId: v})} options={roles.map(r => ({ value: r.id!, label: r.name }))} placeholder="Seleziona Ruolo" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold mb-1">Horizontal</label>
                                <SearchableSelect name="horizontal" value={newGhost.horizontal || ''} onChange={(_, v) => setNewGhost({...newGhost, horizontal: v})} options={horizontals.map(h => ({ value: h.value, label: h.value }))} placeholder="Horizontal" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1">Sede</label>
                                <SearchableSelect name="location" value={newGhost.location || ''} onChange={(_, v) => setNewGhost({...newGhost, location: v})} options={locations.map(l => ({ value: l.value, label: l.value }))} placeholder="Sede" />
                            </div>
                        </div>
                        <div className="flex justify-end pt-4">
                            <button onClick={() => setIsGhostModalOpen(false)} className="px-4 py-2 border rounded-full mr-2">Annulla</button>
                            <button onClick={handleAddGhost} disabled={!newGhost.name || !newGhost.roleId} className="px-6 py-2 bg-primary text-on-primary rounded-full font-bold">Aggiungi</button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Save Scenario Modal */}
            {isSaveModalOpen && (
                <Modal isOpen={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)} title="Salva Scenario">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold mb-1">Nome Scenario</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                value={state.name} 
                                onChange={(e) => dispatch({ type: 'UPDATE_META', payload: { name: e.target.value } })}
                                placeholder="es. Budget 2025 - Variante A"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1">Descrizione</label>
                            <textarea 
                                className="form-textarea" 
                                value={state.description} 
                                onChange={(e) => dispatch({ type: 'UPDATE_META', payload: { description: e.target.value } })}
                                placeholder="Note aggiuntive..."
                                rows={3}
                            />
                        </div>
                        <div className="flex justify-end pt-4">
                            <button onClick={() => setIsSaveModalOpen(false)} className="px-4 py-2 border rounded-full mr-2 hover:bg-surface-container">Annulla</button>
                            <button 
                                onClick={performSave} 
                                disabled={isLoading || !state.name}
                                className="px-6 py-2 bg-primary text-on-primary rounded-full font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isLoading ? <SpinnerIcon className="w-4 h-4"/> : 'Conferma e Salva'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Load Modal */}
            {isLoadModalOpen && (
                <Modal isOpen={isLoadModalOpen} onClose={() => setIsLoadModalOpen(false)} title="Carica Scenario">
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                        {scenarios.length === 0 ? <p className="text-center p-4">Nessuno scenario salvato.</p> : scenarios.map(s => (
                            <div key={s.key} onClick={() => handleLoadScenario(s.key)} className="p-4 border rounded-xl hover:bg-surface-container cursor-pointer">
                                <h4 className="font-bold">{s.name}</h4>
                                <p className="text-xs text-on-surface-variant">{s.description}</p>
                                <p className="text-[10px] text-on-surface-variant mt-1">Ultima modifica: {new Date(s.updatedAt).toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                </Modal>
            )}

            {/* EXPENSES MODAL */}
            {activeExpenseProject && (
                <SimulationExpensesModal 
                    project={activeExpenseProject} 
                    onClose={() => setActiveExpenseProject(null)} 
                />
            )}

            {/* BILLING MODAL */}
            {activeBillingProject && (
                <SimulationBillingModal
                    project={activeBillingProject}
                    onClose={() => setActiveBillingProject(null)}
                />
            )}

        </div>
    );
};

export default SimulationPage;