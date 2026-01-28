import React, { useState, useReducer, useEffect, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useEntitiesContext, useAllocationsContext, AllocationsContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../services/apiClient';
import { 
    SimulationResource, 
    SimulationProject, 
    SimulationScenario, 
    SimulationFinancials, 
    Assignment, 
    Allocation, 
    RateCard 
} from '../types';
import Modal from '../components/Modal';
import { SpinnerIcon } from '../components/icons';
import SearchableSelect from '../components/SearchableSelect';
import { getCalendarDays, formatDate, isHoliday, getWorkingDaysBetween } from '../utils/dateUtils';
import VirtualStaffingGrid from '../components/VirtualStaffingGrid';
import { DataTable, ColumnDef } from '../components/DataTable';
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
    hasUnsavedChanges: false
};

// --- ACTIONS ---
type Action = 
    | { type: 'LOAD_SCENARIO'; payload: SimulationScenario }
    | { type: 'IMPORT_DATA'; payload: { resources: SimulationResource[], projects: SimulationProject[], assignments: Assignment[], allocations: Allocation, financials: SimulationFinancials } }
    | { type: 'UPDATE_META'; payload: { name?: string; description?: string } }
    | { type: 'ADD_GHOST_RESOURCE'; payload: SimulationResource }
    | { type: 'UPDATE_RESOURCE_COST'; payload: { resourceId: string; dailyCost: number; dailyExpenses: number; sellRate: number } }
    | { type: 'UPDATE_PROJECT_RATE_CARD'; payload: { projectId: string; rateCardId: string } }
    | { type: 'ADD_ASSIGNMENT'; payload: Assignment }
    | { type: 'DELETE_ASSIGNMENT'; payload: string }
    | { type: 'UPDATE_ALLOCATION'; payload: { assignmentId: string; date: string; percentage: number } }
    | { type: 'BULK_UPDATE_ALLOCATION'; payload: { assignmentId: string; startDate: string; endDate: string; percentage: number } }
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
                hasUnsavedChanges: true
            };
        case 'UPDATE_META':
            return { ...state, ...action.payload, hasUnsavedChanges: true };
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
             
             for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                 if (d.getDay() !== 0 && d.getDay() !== 6) {
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
        rateCards, rateCardEntries, roles, horizontals, locations, companyCalendar, getRoleCost, getSellRate, clients 
    } = useEntitiesContext();
    const { allocations: realAllocations } = useAllocationsContext();
    const { addToast } = useToast();

    const [state, dispatch] = useReducer(simulationReducer, initialState);
    const [scenarios, setScenarios] = useState<any[]>([]); // Metadata list
    const [activeTab, setActiveTab] = useState<'config' | 'staffing' | 'analysis'>('config');
    const [isLoading, setIsLoading] = useState(false);
    
    // UI Local State
    const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
    const [isGhostModalOpen, setIsGhostModalOpen] = useState(false);
    const [newGhost, setNewGhost] = useState<Partial<SimulationResource>>({ 
        horizontal: horizontals[0]?.value, 
        location: locations[0]?.value, 
        roleId: roles[0]?.id 
    });
    
    // For Staffing Grid Interaction
    const [currentDate, setCurrentDate] = useState(new Date());

    // Load Scenarios List
    const loadScenariosList = useCallback(async () => {
        try {
            // Fetch from analytics_cache where key starts with 'scenario_'
            const allCache = await apiFetch<any[]>('/api/resources?entity=analytics_cache');
            const scenarioList = allCache
                .filter(item => item.key && item.key.startsWith('scenario_'))
                .map(item => {
                    // Robust extraction
                    const data = item.data || {};
                    return { 
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
        // Validation: Ensure data is loaded
        if (!realResources || realResources.length === 0) {
            addToast('Nessuna risorsa disponibile da importare.', 'warning');
            return;
        }
        
        if (!confirm('Importando i dati reali sovrascriverai l\'attuale simulazione. Continuare?')) return;

        try {
            // 1. Transform Resources (Safe check for undefined)
            const simResources: SimulationResource[] = (realResources || []).map(r => ({
                ...r,
                isGhost: false,
                dailyExpenses: 0
            }));

            // 2. Transform Projects
            const simProjects: SimulationProject[] = (realProjects || []).map(p => {
                 const contract = (realContracts || []).find(c => c.id === p.contractId);
                 return { 
                     ...p, 
                     simulatedRateCardId: contract?.rateCardId || undefined 
                 };
            });

            // 3. Deep Copy Assignments & Allocations (Handle potential nulls)
            const simAssignments: Assignment[] = realAssignments ? JSON.parse(JSON.stringify(realAssignments)) : [];
            const simAllocations: Allocation = realAllocations ? JSON.parse(JSON.stringify(realAllocations)) : {};

            // 4. Initial Financials Calculation
            const simFinancials: SimulationFinancials = {};
            
            simResources.forEach(r => {
                const role = roles.find(ro => ro.id === r.roleId);
                // Robust number conversion
                const dailyCost: number = Number(r.dailyCost) > 0 ? Number(r.dailyCost) : (Number(role?.dailyCost) || 0);
                
                // Calculate daily expenses
                const dailyExpenses: number = (role?.dailyExpenses && Number(role.dailyExpenses) > 0)
                    ? Number(role.dailyExpenses) 
                    : (dailyCost * 0.035);
                
                // Calculate Sell Rate
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

                if (r.id) {
                    simFinancials[r.id] = { dailyCost, dailyExpenses, sellRate };
                }
            });

            dispatch({
                type: 'IMPORT_DATA',
                payload: {
                    resources: simResources,
                    projects: simProjects,
                    assignments: simAssignments,
                    allocations: simAllocations,
                    financials: simFinancials
                }
            });
            
            setActiveTab('config');
            addToast(`Importati con successo: ${simResources.length} risorse, ${simProjects.length} progetti.`, 'success');
        } catch (e) {
            console.error("Import failed", e);
            addToast('Errore tecnico durante l\'importazione dei dati.', 'error');
        }
    };

    const handleSaveScenario = async () => {
        if (!state.name) {
            addToast('Inserisci un nome per lo scenario.', 'error');
            return;
        }
        setIsLoading(true);
        try {
            const scenarioId = state.id || uuidv4();
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
                    financials: state.financials
                }
            };
            
            await apiFetch('/api/resources?entity=analytics_cache', {
                method: 'POST',
                body: JSON.stringify({
                    key: `scenario_${scenarioId}`,
                    data: scenarioData
                })
            });

            dispatch({ type: 'RESET_CHANGES' });
            // Update the ID in state so subsequent saves update the same scenario
            if (!state.id) {
                 // Hack to update ID without full reload, leveraging UPDATE_META which spreads payload
                 dispatch({ type: 'UPDATE_META', payload: { ...state, id: scenarioId } } as any); 
            }
            
            addToast('Scenario salvato correttamente.', 'success');
            loadScenariosList(); // Refresh list
        } catch (e) {
            addToast('Errore durante il salvataggio dello scenario.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoadScenario = async (key: string) => {
        setIsLoading(true);
        try {
            // Fetch ALL cache to find the key - in production better to have specific endpoint, 
            // but here we use the generic resource endpoint
            const res = await apiFetch<any[]>(`/api/resources?entity=analytics_cache`);
            const scenarioRow = res.find(r => r.key === key);
            
            if (scenarioRow && scenarioRow.data) {
                const scenarioData = scenarioRow.data as SimulationScenario;
                dispatch({ type: 'LOAD_SCENARIO', payload: scenarioData });
                setIsLoadModalOpen(false);
                setActiveTab('config'); // Reset to config tab to show loaded data
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
                dailyCost, // Base values
                dailyExpenses
            }
        });
        setNewGhost({ horizontal: horizontals[0]?.value, location: locations[0]?.value, roleId: roles[0]?.id, name: '' });
        setIsGhostModalOpen(false);
        addToast('Risorsa simulata aggiunta.', 'success');
    };

    // --- GRID ADAPTER ---
    const gridProps = useMemo(() => {
        const daysToRender = 30;
        const timeColumns = getCalendarDays(currentDate, daysToRender).map((day) => {
             const dayOfWeek = day.getDay();
             const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
             const dateIso = formatDate(day, 'iso');
             const holiday = companyCalendar.find((e) => e.date === dateIso && e.type !== 'LOCAL_HOLIDAY');
             return { 
                 label: formatDate(day, 'short'), 
                 subLabel: formatDate(day, 'day'), 
                 startDate: day, 
                 endDate: day, 
                 isNonWorkingDay: isWeekend || !!holiday, 
                 dateIso 
             };
        });

        const projectsById = new Map(state.projects.map(p => [p.id!, p]));
        const clientsById = new Map(clients.map(c => [c.id!, c]));
        const rolesById = new Map(roles.map(r => [r.id!, r]));
        
        return {
            resources: state.resources,
            timeColumns,
            assignments: state.assignments,
            viewMode: 'day' as const,
            projectsById,
            clientsById,
            rolesById
        };
    }, [state.resources, state.assignments, state.projects, currentDate, clients, roles, companyCalendar]);

    // Local Context Wrapper for the Grid
    const SimulationAllocationsProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
        const updateAllocation = useCallback(async (assignmentId: string, date: string, percentage: number) => {
            dispatch({ type: 'UPDATE_ALLOCATION', payload: { assignmentId, date, percentage } });
        }, []);
        
        const bulkUpdateAllocations = useCallback(async (assignmentId: string, startDate: string, endDate: string, percentage: number) => {
            dispatch({ type: 'BULK_UPDATE_ALLOCATION', payload: { assignmentId, startDate, endDate, percentage } });
        }, []);

        const value = useMemo(() => ({
            allocations: state.allocations,
            updateAllocation,
            bulkUpdateAllocations
        }), [updateAllocation, bulkUpdateAllocations]);

        return (
            <AllocationsContext.Provider value={value}> 
                 {children}
            </AllocationsContext.Provider> 
        );
    };
    
    // --- Analysis Data Calculation ---
    const analysisData = useMemo(() => {
        const monthlyData: Record<string, { revenue: number, cost: number }> = {};
        
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
                
                const fraction = pct / 100;
                const cost = fraction * (financials.dailyCost + financials.dailyExpenses);
                const revenue = fraction * sellRate; 
                
                monthlyData[month].cost += cost;
                monthlyData[month].revenue += revenue;
            });
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

    // --- RENDER ---
    return (
        <div className="h-full flex flex-col space-y-4">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-surface p-4 rounded-2xl shadow border border-outline-variant gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                        <span className="material-symbols-outlined">science</span> Simulazione
                    </h1>
                    <input 
                        type="text" 
                        value={state.name} 
                        onChange={(e) => dispatch({ type: 'UPDATE_META', payload: { name: e.target.value } })}
                        className="bg-transparent border-b border-transparent hover:border-primary focus:border-primary focus:outline-none text-on-surface font-semibold mt-1"
                        placeholder="Nome Scenario..."
                    />
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
                    <button onClick={handleSaveScenario} disabled={isLoading || !state.hasUnsavedChanges} className="px-4 py-2 bg-primary text-on-primary rounded-full font-bold shadow hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
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
                            <h3 className="text-lg font-bold mb-4">Configurazione Progetti e Listini</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-surface-container-low text-xs uppercase font-bold text-on-surface-variant">
                                        <tr>
                                            <th className="p-3">Progetto</th>
                                            <th className="p-3">Cliente</th>
                                            <th className="p-3">Listino Applicato</th>
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
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'staffing' && (
                    <div className="h-full flex flex-col">
                        <div className="flex-shrink-0 mb-4 flex justify-between items-center bg-surface p-2 rounded-xl">
                            <div className="flex gap-2">
                                <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 30); setCurrentDate(d); }} className="p-1 rounded hover:bg-surface-container">← Mese</button>
                                <span className="font-bold">{currentDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}</span>
                                <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 30); setCurrentDate(d); }} className="p-1 rounded hover:bg-surface-container">Mese →</button>
                            </div>
                        </div>
                        
                        <SimulationAllocationsProvider>
                             <VirtualStaffingGrid 
                                 {...gridProps}
                                 onAddAssignment={() => { /* Mock or implement */ }}
                                 onBulkEdit={(assignment) => { /* Mock or implement - needs local state */ }}
                                 onDeleteAssignment={(assignment) => dispatch({ type: 'DELETE_ASSIGNMENT', payload: assignment.id! })}
                             />
                        </SimulationAllocationsProvider>
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
        </div>
    );
};

export default SimulationPage;