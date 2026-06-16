/**
 * @file pages/simulation/simulationReducer.ts
 * @description Stato, azioni e reducer della pagina di simulazione staffing.
 * Estratto da SimulationPage.tsx: contiene SimulationState, lo stato iniziale,
 * il tipo Action e la funzione reducer. Nessun JSX — solo logica di stato.
 */
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
} from '../../types';

// --- INITIAL STATE ---
export interface SimulationState {
    id: string;
    name: string;
    description: string;
    resources: SimulationResource[];
    projects: SimulationProject[];
    assignments: Assignment[];
    allocations: Allocation;
    financials: SimulationFinancials;
    projectExpenses: ProjectExpense[];
    billingMilestones: BillingMilestone[];

    hasUnsavedChanges: boolean;
}

export const initialState: SimulationState = {
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
export type Action =
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


export const simulationReducer = (state: SimulationState, action: Action): SimulationState => {
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
                projectExpenses: action.payload.data.projectExpenses || [],
                billingMilestones: action.payload.data.billingMilestones || [],
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
