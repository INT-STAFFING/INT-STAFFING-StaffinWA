/**
 * @file context/PlanningContext.tsx
 * @description Gestisce i dati operativi e transazionali (Progetti, Allocazioni, Contratti).
 */

import React, { createContext, useState, useEffect, ReactNode, useContext, useCallback, useMemo } from 'react';
import {
    Project, Assignment, Contract, ContractProject, ContractManager,
    WbsTask, ResourceRequest, Interview, ProjectSkill, LeaveRequest,
    BillingMilestone, ProjectExpense, RoleCostHistory, RateCard, RateCardEntry, Allocation
} from '../types';
import { apiFetch } from '../services/apiClient';
import { useToast } from './ToastContext';
import { useCatalog } from './CatalogContext';

export interface PlanningState {
    projects: Project[];
    contracts: Contract[];
    contractProjects: ContractProject[];
    contractManagers: ContractManager[];
    assignments: Assignment[];
    allocations: Allocation;
    roleCostHistory: RoleCostHistory[];
    rateCards: RateCard[];
    rateCardEntries: RateCardEntry[];
    projectExpenses: ProjectExpense[];
    billingMilestones: BillingMilestone[];
    wbsTasks: WbsTask[];
    resourceRequests: ResourceRequest[];
    interviews: Interview[];
    projectSkills: ProjectSkill[];
    leaveRequests: LeaveRequest[];
    notifications: any[];
    isPlanningLoading: boolean;
    planningError: string | null;
    actionLoadingMap: Record<string, boolean>;
}

export interface PlanningActions {
    fetchPlanningData: (start?: string, end?: string) => Promise<void>;
    fetchAllocationsForRange: (start: string, end: string) => Promise<void>;
    fetchNotifications: () => Promise<void>;
    markNotificationAsRead: (id?: string) => Promise<void>;
    forceRecalculateAnalytics: () => Promise<void>;
    getBestFitResources: (params: any) => Promise<any[]>;
    addProject: (project: Omit<Project, 'id'>) => Promise<Project | null>;
    updateProject: (project: Project) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
    addContract: (contract: Omit<Contract, 'id'>, projectIds: string[], managerIds: string[]) => Promise<void>;
    updateContract: (contract: Contract, projectIds: string[], managerIds: string[]) => Promise<void>;
    deleteContract: (id: string) => Promise<void>;
    recalculateContractBacklog: (id: string) => Promise<void>;
    addMultipleAssignments: (assignments: { resourceId: string; projectId: string }[]) => Promise<void>;
    deleteAssignment: (id: string) => Promise<void>;
    addRateCard: (rateCard: Omit<RateCard, 'id'>) => Promise<void>;
    updateRateCard: (rateCard: RateCard) => Promise<void>;
    deleteRateCard: (id: string) => Promise<void>;
    upsertRateCardEntries: (entries: RateCardEntry[]) => Promise<void>;
    addProjectExpense: (expense: Omit<ProjectExpense, 'id'>) => Promise<void>;
    updateProjectExpense: (expense: ProjectExpense) => Promise<void>;
    deleteProjectExpense: (id: string) => Promise<void>;
    addBillingMilestone: (milestone: Omit<BillingMilestone, 'id'>) => Promise<void>;
    updateBillingMilestone: (milestone: BillingMilestone) => Promise<void>;
    deleteBillingMilestone: (id: string) => Promise<void>;
    addResourceRequest: (req: Omit<ResourceRequest, 'id'>) => Promise<void>;
    updateResourceRequest: (req: ResourceRequest) => Promise<void>;
    deleteResourceRequest: (id: string) => Promise<void>;
    addInterview: (interview: Omit<Interview, 'id'>) => Promise<void>;
    updateInterview: (interview: Interview) => Promise<void>;
    deleteInterview: (id: string) => Promise<void>;
    addLeaveRequest: (req: Omit<LeaveRequest, 'id'>) => Promise<void>;
    updateLeaveRequest: (req: LeaveRequest) => Promise<void>;
    deleteLeaveRequest: (id: string) => Promise<void>;
    addProjectSkill: (ps: ProjectSkill) => Promise<void>;
    deleteProjectSkill: (projectId: string, skillId: string) => Promise<void>;
    getRoleCost: (roleId: string, date: Date, resourceId?: string) => number;
    getSellRate: (rateCardId: string | null | undefined, resourceId: string) => number;
}

export type PlanningContextType = PlanningState & PlanningActions;

const PlanningContext = createContext<PlanningContextType | undefined>(undefined);

export const PlanningProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { addToast } = useToast();
    const { resources, roles, setLoadingState: setCatalogLoadingState, planningSettings } = useCatalog(); 

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoadingMap, setActionLoadingMap] = useState<Record<string, boolean>>({});

    const [projects, setProjects] = useState<Project[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [contractProjects, setContractProjects] = useState<ContractProject[]>([]);
    const [contractManagers, setContractManagers] = useState<ContractManager[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [allocations, setAllocations] = useState<Allocation>({});
    const [roleCostHistory, setRoleCostHistory] = useState<RoleCostHistory[]>([]);
    const [rateCards, setRateCards] = useState<RateCard[]>([]);
    const [rateCardEntries, setRateCardEntries] = useState<RateCardEntry[]>([]);
    const [projectExpenses, setProjectExpenses] = useState<ProjectExpense[]>([]);
    const [billingMilestones, setBillingMilestones] = useState<BillingMilestone[]>([]);
    const [wbsTasks, setWbsTasks] = useState<WbsTask[]>([]);
    const [resourceRequests, setResourceRequests] = useState<ResourceRequest[]>([]);
    const [interviews, setInterviews] = useState<Interview[]>([]);
    const [projectSkills, setProjectSkills] = useState<ProjectSkill[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);

    const setPlanningLoadingState = useCallback((key: string, value: boolean) => {
        setActionLoadingMap(prev => ({ ...prev, [key]: value }));
    }, []);

    const fetchPlanningData = useCallback(async (startOverride?: string, endOverride?: string) => {
        setLoading(true);
        setError(null);
        try {
            const today = new Date();
            const start = new Date(today);
            start.setMonth(start.getMonth() - planningSettings.monthsBefore);
            const end = new Date(today);
            end.setMonth(end.getMonth() + planningSettings.monthsAfter);
            const startStr = startOverride || start.toISOString().split('T')[0];
            const endStr = endOverride || end.toISOString().split('T')[0];

            const data = await apiFetch<any>(`/api/data?scope=planning&start=${startStr}&end=${endStr}`);
            setProjects(data.projects || []);
            setAssignments(data.assignments || []);
            setAllocations(data.allocations || {});
            setContracts(data.contracts || []);
            setContractProjects(data.contractProjects || []);
            setContractManagers(data.contractManagers || []);
            setRoleCostHistory(data.roleCostHistory || []);
            setRateCards(data.rateCards || []);
            setRateCardEntries(data.rateCardEntries || []);
            setProjectExpenses(data.projectExpenses || []);
            setBillingMilestones(data.billingMilestones || []);
            setWbsTasks(data.wbsTasks || []);
            setResourceRequests(data.resourceRequests || []);
            setInterviews(data.interviews || []);
            setProjectSkills(data.projectSkills || []);
            setLeaveRequests(data.leaveRequests || []);
        } catch (e) {
            setError("Errore caricamento dati planning");
        } finally {
            setLoading(false);
        }
    }, [planningSettings]);

    const fetchAllocationsForRange = useCallback(async (start: string, end: string) => {
        await fetchPlanningData(start, end);
    }, [fetchPlanningData]);

    const fetchNotifications = useCallback(async () => {
        try {
            const notifs = await apiFetch<any[]>('/api/resources?entity=notifications');
            setNotifications(notifs);
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => {
        fetchPlanningData();
        fetchNotifications();
    }, [fetchPlanningData, fetchNotifications]);

    const getRoleCost = useCallback((roleId: string, date: Date, resourceId?: string) => {
        if (resourceId) {
            const resource = resources.find(r => r.id === resourceId);
            if (resource && resource.dailyCost && Number(resource.dailyCost) > 0) return Number(resource.dailyCost);
        }
        const dateStr = date.toISOString().split('T')[0];
        const historicRecord = roleCostHistory.find(h => h.roleId === roleId && dateStr >= h.startDate && (!h.endDate || dateStr <= h.endDate));
        if (historicRecord) return Number(historicRecord.dailyCost);
        const role = roles.find(r => r.id === roleId);
        return role ? Number(role.dailyCost) : 0;
    }, [resources, roleCostHistory, roles]);

    const getSellRate = useCallback((rateCardId: string | null | undefined, resourceId: string) => {
        if (!rateCardId) return 0;
        const entry = rateCardEntries.find(e => e.rateCardId === rateCardId && e.resourceId === resourceId);
        return entry ? Number(entry.dailyRate) : 0;
    }, [rateCardEntries]);

    const addProject = async (p: any) => {
        setPlanningLoadingState('addProject', true);
        try {
            const newP = await apiFetch<Project>('/api/resources?entity=projects', { method: 'POST', body: JSON.stringify(p) });
            setProjects(prev => [...prev, newP]);
            return newP;
        } finally { setPlanningLoadingState('addProject', false); }
    };
    const updateProject = async (p: Project) => {
        setPlanningLoadingState(`updateProject-${p.id}`, true);
        try {
            const up = await apiFetch<Project>(`/api/resources?entity=projects&id=${p.id}`, { method: 'PUT', body: JSON.stringify(p) });
            setProjects(prev => prev.map(proj => proj.id === p.id ? up : proj));
        } finally { setPlanningLoadingState(`updateProject-${p.id}`, false); }
    };
    const deleteProject = async (id: string) => {
        setPlanningLoadingState(`deleteProject-${id}`, true);
        try {
            await apiFetch(`/api/resources?entity=projects&id=${id}`, { method: 'DELETE' });
            setProjects(prev => prev.filter(p => p.id !== id));
        } finally { setPlanningLoadingState(`deleteProject-${id}`, false); }
    };
    const addContract = async (c: any, p: any, m: any) => { await apiFetch('/api/resources?entity=contracts', {method:'POST', body: JSON.stringify(c)}); fetchPlanningData(); };
    const updateContract = async (c: Contract, pIds: string[], mIds: string[]) => {
        setPlanningLoadingState(`updateContract-${c.id}`, true);
        try {
            await apiFetch(`/api/resources?entity=contracts&id=${c.id}`, { method: 'PUT', body: JSON.stringify(c) });
            fetchPlanningData(); 
        } finally { setPlanningLoadingState(`updateContract-${c.id}`, false); }
    };
    const deleteContract = async (id: string) => { await apiFetch(`/api/resources?entity=contracts&id=${id}`, {method:'DELETE'}); fetchPlanningData(); };
    const recalculateContractBacklog = async (id: string) => { fetchPlanningData(); };
    const addMultipleAssignments = async (list: any[]) => {
        await Promise.all(list.map(a => apiFetch('/api/assignments', { method: 'POST', body: JSON.stringify(a) })));
        fetchPlanningData();
        addToast('Assegnazioni create', 'success');
    };
    const deleteAssignment = async (id: string) => {
        setPlanningLoadingState(`deleteAssignment-${id}`, true);
        try {
            await apiFetch(`/api/assignments?id=${id}`, { method: 'DELETE' });
            setAssignments(prev => prev.filter(a => a.id !== id));
        } finally { setPlanningLoadingState(`deleteAssignment-${id}`, false); }
    };
    const addRateCard = async (c: any) => { await apiFetch('/api/resources?entity=rate_cards', {method:'POST', body: JSON.stringify(c)}); fetchPlanningData(); };
    const updateRateCard = async (c: any) => { await apiFetch(`/api/resources?entity=rate_cards&id=${c.id}`, {method:'PUT', body: JSON.stringify(c)}); fetchPlanningData(); };
    const deleteRateCard = async (id: string) => { await apiFetch(`/api/resources?entity=rate_cards&id=${id}`, {method:'DELETE'}); fetchPlanningData(); };
    const upsertRateCardEntries = async (e: any) => { await apiFetch('/api/resources?entity=rate_card_entries', {method:'POST', body: JSON.stringify({entries: e})}); fetchPlanningData(); };
    const addProjectExpense = async (e: any) => { await apiFetch('/api/resources?entity=project_expenses', {method:'POST', body: JSON.stringify(e)}); fetchPlanningData(); };
    const updateProjectExpense = async (e: any) => { await apiFetch(`/api/resources?entity=project_expenses&id=${e.id}`, {method:'PUT', body: JSON.stringify(e)}); fetchPlanningData(); };
    const deleteProjectExpense = async (id: string) => { await apiFetch(`/api/resources?entity=project_expenses&id=${id}`, {method:'DELETE'}); fetchPlanningData(); };
    const addBillingMilestone = async (m: any) => { await apiFetch('/api/resources?entity=billing_milestones', {method:'POST', body: JSON.stringify(m)}); fetchPlanningData(); };
    const updateBillingMilestone = async (m: any) => { await apiFetch(`/api/resources?entity=billing_milestones&id=${m.id}`, {method:'PUT', body: JSON.stringify(m)}); fetchPlanningData(); };
    const deleteBillingMilestone = async (id: string) => { await apiFetch(`/api/resources?entity=billing_milestones&id=${id}`, {method:'DELETE'}); fetchPlanningData(); };
    const addResourceRequest = async (r: any) => { setPlanningLoadingState('addResourceRequest', true); try { await apiFetch('/api/resource-requests', {method:'POST', body: JSON.stringify(r)}); fetchPlanningData(); } finally { setPlanningLoadingState('addResourceRequest', false); } };
    const updateResourceRequest = async (r: any) => { setPlanningLoadingState(`updateResourceRequest-${r.id}`, true); try { await apiFetch(`/api/resource-requests?id=${r.id}`, {method:'PUT', body: JSON.stringify(r)}); fetchPlanningData(); } finally { setPlanningLoadingState(`updateResourceRequest-${r.id}`, false); } };
    const deleteResourceRequest = async (id: string) => { await apiFetch(`/api/resource-requests?id=${id}`, {method:'DELETE'}); fetchPlanningData(); };
    const addInterview = async (i: any) => { await apiFetch('/api/resources?entity=interviews', {method:'POST', body: JSON.stringify(i)}); fetchPlanningData(); };
    const updateInterview = async (i: any) => { await apiFetch(`/api/resources?entity=interviews&id=${i.id}`, {method:'PUT', body: JSON.stringify(i)}); fetchPlanningData(); };
    const deleteInterview = async (id: string) => { await apiFetch(`/api/resources?entity=interviews&id=${id}`, {method:'DELETE'}); fetchPlanningData(); };
    const addLeaveRequest = async (l: any) => { await apiFetch('/api/resources?entity=leave_requests', {method:'POST', body: JSON.stringify(l)}); fetchPlanningData(); };
    const updateLeaveRequest = async (l: any) => { await apiFetch(`/api/resources?entity=leave_requests&id=${l.id}`, {method:'PUT', body: JSON.stringify(l)}); fetchPlanningData(); };
    const deleteLeaveRequest = async (id: string) => { await apiFetch(`/api/resources?entity=leave_requests&id=${id}`, {method:'DELETE'}); fetchPlanningData(); };
    const addProjectSkill = async (ps: any) => { await apiFetch('/api/resources?entity=project_skills', {method:'POST', body: JSON.stringify(ps)}); fetchPlanningData(); };
    const deleteProjectSkill = async (pid: string, sid: string) => { fetchPlanningData(); }; 
    const markNotificationAsRead = async (id?: string) => {
        const url = id ? `/api/resources?entity=notifications&action=mark_read&id=${id}` : `/api/resources?entity=notifications&action=mark_read`;
        await apiFetch(url, { method: 'PUT' });
        setNotifications(prev => prev.map(n => id ? (n.id === id ? { ...n, isRead: true } : n) : { ...n, isRead: true }));
    };
    const forceRecalculateAnalytics = async () => { await apiFetch('/api/resources?entity=analytics_cache&action=recalc'); };
    const getBestFitResources = async (p: any) => await apiFetch<any[]>('/api/resources?action=best_fit', { method: 'POST', body: JSON.stringify(p) });

    const value = useMemo(() => ({
        projects, contracts, contractProjects, contractManagers, assignments, allocations,
        roleCostHistory, rateCards, rateCardEntries, projectExpenses, billingMilestones,
        wbsTasks, resourceRequests, interviews, projectSkills, leaveRequests, notifications,
        isPlanningLoading: loading, planningError: error, actionLoadingMap,
        fetchPlanningData, fetchAllocationsForRange, fetchNotifications, markNotificationAsRead, forceRecalculateAnalytics, getBestFitResources,
        addProject, updateProject, deleteProject, addContract, updateContract, deleteContract, recalculateContractBacklog,
        addMultipleAssignments, deleteAssignment, addRateCard, updateRateCard, deleteRateCard, upsertRateCardEntries,
        addProjectExpense, updateProjectExpense, deleteProjectExpense, addBillingMilestone, updateBillingMilestone, deleteBillingMilestone,
        addResourceRequest, updateResourceRequest, deleteResourceRequest, addInterview, updateInterview, deleteInterview,
        addLeaveRequest, updateLeaveRequest, deleteLeaveRequest, addProjectSkill, deleteProjectSkill, getRoleCost, getSellRate
    }), [
        projects, contracts, contractProjects, contractManagers, assignments, allocations,
        roleCostHistory, rateCards, rateCardEntries, projectExpenses, billingMilestones,
        wbsTasks, resourceRequests, interviews, projectSkills, leaveRequests, notifications,
        loading, error, actionLoadingMap, fetchPlanningData, fetchAllocationsForRange, fetchNotifications,
        markNotificationAsRead, forceRecalculateAnalytics, getBestFitResources, addProject, updateProject,
        deleteProject, addContract, updateContract, deleteContract, recalculateContractBacklog,
        addMultipleAssignments, deleteAssignment, addRateCard, updateRateCard, deleteRateCard,
        upsertRateCardEntries, addProjectExpense, updateProjectExpense, deleteProjectExpense,
        addBillingMilestone, updateBillingMilestone, deleteBillingMilestone, addResourceRequest,
        updateResourceRequest, deleteResourceRequest, addInterview, updateInterview, deleteInterview,
        addLeaveRequest, updateLeaveRequest, deleteLeaveRequest, addProjectSkill, deleteProjectSkill,
        getRoleCost, getSellRate
    ]);

    return <PlanningContext.Provider value={value}>{children}</PlanningContext.Provider>;
};

export const usePlanning = () => {
    const context = useContext(PlanningContext);
    if (!context) throw new Error("usePlanning must be used within PlanningProvider");
    return context;
};
