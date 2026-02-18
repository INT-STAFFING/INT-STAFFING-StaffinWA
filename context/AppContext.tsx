
/**
 * @file AppContext.tsx
 * @description Provider di contesto principale per la gestione dello stato globale dell'applicazione.
 */

import React, { createContext, useState, useEffect, ReactNode, useContext, useCallback, useMemo } from 'react';
import {
    Client, Role, Resource, Project, Assignment, Allocation, ConfigOption,
    CalendarEvent, WbsTask, ResourceRequest, Interview, Contract, Skill,
    ResourceSkill, ProjectSkill, PageVisibility, SkillThresholds, RoleCostHistory,
    LeaveType, LeaveRequest, ContractManager, ContractProject, SidebarItem, SidebarSectionColors,
    Notification, DashboardCategory, SkillCategory, SkillMacroCategory, EntitiesContextType, AllocationsContextType, EntitiesState, SidebarFooterAction,
    RateCard, RateCardEntry, ProjectExpense, BillingMilestone, NotificationConfig, NotificationRule, ComputedSkill, QuickAction, ResourceEvaluation
} from '../types';
import { useToast } from './ToastContext';
import { apiFetch } from '../services/apiClient';
import { isHoliday, parseISODate, toISODateString } from '../utils/dateUtils';

// --- Default Constants ---
const DEFAULT_SIDEBAR_CONFIG: SidebarItem[] = []; 
const DEFAULT_SIDEBAR_SECTIONS = ['Principale', 'Progetti', 'Risorse', 'Operatività', 'Supporto', 'Configurazione', 'Dati'];
const DEFAULT_SIDEBAR_FOOTER_ACTIONS: SidebarFooterAction[] = [
    { id: 'changePassword', label: 'Cambia Password', icon: 'lock_reset' },
    { id: 'logout', label: 'Logout', icon: 'logout' }
];
const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
    { label: 'Vai allo Staffing', icon: 'calendar_month', link: '/staffing' },
    { label: 'Apri Dashboard', icon: 'dashboard', link: '/dashboard' },
    { label: 'Mappa Competenze', icon: 'school', link: '/skills-map' },
    { label: 'Carico Risorse', icon: 'groups', link: '/workload' },
];
const DEFAULT_DASHBOARD_LAYOUT: DashboardCategory[] = [
  { id: 'generale', label: 'Generale', cards: ['kpiHeader', 'attentionCards', 'leavesOverview', 'unallocatedFte'] },
  { id: 'staffing', label: 'Staffing', cards: ['averageAllocation', 'underutilizedResources', 'saturationTrend'] },
  { id: 'progetti', label: 'Progetti', cards: ['ftePerProject', 'budgetAnalysis', 'temporalBudgetAnalysis', 'averageDailyRate'] },
  { id: 'contratti', label: 'Economico', cards: ['monthlyClientCost', 'effortByFunction', 'effortByIndustry', 'locationAnalysis', 'costForecast'] }
];
const DEFAULT_ROLE_HOME_PAGES: Record<string, string> = {
    'SIMPLE': '/staffing',
    'MANAGER': '/dashboard',
    'ADMIN': '/dashboard'
};

export interface AppState {
    loading: boolean;
    fetchError: string | null;
    isSearchOpen: boolean;
    setSearchOpen: (open: boolean) => void;
}

const EntitiesContext = createContext<EntitiesContextType | undefined>(undefined);
export const AllocationsContext = createContext<AllocationsContextType | undefined>(undefined);
const AppStateContext = createContext<AppState | undefined>(undefined);

export const AppProviders: React.FC<any> = ({ children, planningWindow, configKeys }) => {
    const planningMonthsBefore = planningWindow?.monthsBefore ?? 6;
    const planningMonthsAfter = planningWindow?.monthsAfter ?? 18;

    const [loading, setLoading] = useState(true);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [actionLoadingState, setActionLoadingState] = useState<Record<string, boolean>>({});
    const { addToast } = useToast();

    // Data States
    const [clients, setClients] = useState<Client[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [roleCostHistory, setRoleCostHistory] = useState<RoleCostHistory[]>([]);
    const [rateCards, setRateCards] = useState<RateCard[]>([]);
    const [rateCardEntries, setRateCardEntries] = useState<RateCardEntry[]>([]);
    const [projectExpenses, setProjectExpenses] = useState<ProjectExpense[]>([]);
    const [billingMilestones, setBillingMilestones] = useState<BillingMilestone[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [contractProjects, setContractProjects] = useState<ContractProject[]>([]);
    const [contractManagers, setContractManagers] = useState<ContractManager[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [allocations, setAllocations] = useState<Allocation>({});
    const [functions, setFunctions] = useState<ConfigOption[]>([]);
    const [industries, setIndustries] = useState<ConfigOption[]>([]);
    const [seniorityLevels, setSeniorityLevels] = useState<ConfigOption[]>([]);
    const [projectStatuses, setProjectStatuses] = useState<ConfigOption[]>([]);
    const [clientSectors, setClientSectors] = useState<ConfigOption[]>([]);
    const [locations, setLocations] = useState<ConfigOption[]>([]);
    const [companyCalendar, setCompanyCalendar] = useState<CalendarEvent[]>([]);
    const [wbsTasks, setWbsTasks] = useState<WbsTask[]>([]);
    const [resourceRequests, setResourceRequests] = useState<ResourceRequest[]>([]);
    const [interviews, setInterviews] = useState<Interview[]>([]);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [skillCategories, setSkillCategories] = useState<SkillCategory[]>([]);
    const [skillMacroCategories, setSkillMacroCategories] = useState<SkillMacroCategory[]>([]);
    const [resourceSkills, setResourceSkills] = useState<ResourceSkill[]>([]);
    const [projectSkills, setProjectSkills] = useState<ProjectSkill[]>([]);
    const [pageVisibility, setPageVisibility] = useState<PageVisibility>({});
    const [skillThresholds, setSkillThresholds] = useState<SkillThresholds>({ NOVICE: 0, JUNIOR: 60, MIDDLE: 150, SENIOR: 350, EXPERT: 700 });
    const [planningSettings, setPlanningSettings] = useState<{ monthsBefore: number; monthsAfter: number }>({ monthsBefore: planningMonthsBefore, monthsAfter: planningMonthsAfter });
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [managerResourceIds, setManagerResourceIds] = useState<string[]>([]);
    const [sidebarConfig, setSidebarConfig] = useState<SidebarItem[]>(DEFAULT_SIDEBAR_CONFIG);
    const [quickActions, setQuickActions] = useState<QuickAction[]>(DEFAULT_QUICK_ACTIONS);
    const [sidebarSections, setSidebarSections] = useState<string[]>(DEFAULT_SIDEBAR_SECTIONS);
    const [sidebarSectionColors, setSidebarSectionColors] = useState<SidebarSectionColors>({});
    const [sidebarFooterActions, setSidebarFooterActions] = useState<SidebarFooterAction[]>(DEFAULT_SIDEBAR_FOOTER_ACTIONS);
    const [dashboardLayout, setDashboardLayout] = useState<DashboardCategory[]>(DEFAULT_DASHBOARD_LAYOUT);
    const [roleHomePages, setRoleHomePages] = useState<Record<string, string>>(DEFAULT_ROLE_HOME_PAGES);
    const [bottomNavPaths, setBottomNavPaths] = useState<string[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [notificationConfigs, setNotificationConfigs] = useState<NotificationConfig[]>([]);
    const [notificationRules, setNotificationRules] = useState<NotificationRule[]>([]);
    const [analyticsCache, setAnalyticsCache] = useState<Record<string, unknown>>({});
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [evaluations, setEvaluations] = useState<ResourceEvaluation[]>([]);

    const setActionLoading = useCallback((action: string, isLoading: boolean) => {
        setActionLoadingState(prev => ({ ...prev, [action]: isLoading }));
    }, []);

    const isActionLoading = useCallback((action: string) => !!actionLoadingState[action], [actionLoadingState]);

    // --- CRUD Factory Helpers ---
    // Generates standard add/update/delete functions for a given entity, reducing code duplication.
    const makeCrud = <T extends { id?: string }>(
        entity: string,
        setter: React.Dispatch<React.SetStateAction<T[]>>,
        label: string,
        opts: { loadingPrefix?: string; baseUrl?: string } = {}
    ) => {
        const base = opts.baseUrl || `/api/resources?entity=${entity}`;
        const sep = base.includes('?') ? '&' : '?';
        return {
            add: async (item: Omit<T, 'id'>): Promise<void> => {
                if (opts.loadingPrefix) setActionLoading(`add${opts.loadingPrefix}`, true);
                try {
                    const created = await apiFetch<T>(base, { method: 'POST', body: JSON.stringify(item) });
                    setter(prev => [...prev, created]);
                } catch (e) { addToast(`Errore durante l'aggiunta: ${label}.`, 'error'); }
                finally { if (opts.loadingPrefix) setActionLoading(`add${opts.loadingPrefix}`, false); }
            },
            update: async (item: T): Promise<void> => {
                if (opts.loadingPrefix) setActionLoading(`update${opts.loadingPrefix}-${item.id}`, true);
                try {
                    const updated = await apiFetch<T>(`${base}${sep}id=${item.id}`, { method: 'PUT', body: JSON.stringify(item) });
                    setter(prev => prev.map(x => x.id === item.id ? updated : x));
                } catch (e) { addToast(`Errore durante l'aggiornamento: ${label}.`, 'error'); }
                finally { if (opts.loadingPrefix) setActionLoading(`update${opts.loadingPrefix}-${item.id}`, false); }
            },
            del: async (id: string): Promise<void> => {
                if (opts.loadingPrefix) setActionLoading(`delete${opts.loadingPrefix}-${id}`, true);
                try {
                    await apiFetch(`${base}${sep}id=${id}`, { method: 'DELETE' });
                    setter(prev => prev.filter(x => x.id !== id));
                } catch (e) { addToast(`Errore durante l'eliminazione: ${label}.`, 'error'); }
                finally { if (opts.loadingPrefix) setActionLoading(`delete${opts.loadingPrefix}-${id}`, false); }
            }
        };
    };

    // Generates a config-batch update function for a single JSON config key.
    const makeConfigUpdate = <T,>(key: string, setter: React.Dispatch<React.SetStateAction<T>>, label: string) => {
        return async (value: T) => {
            try {
                await apiFetch('/api/resources?entity=app-config-batch', { method: 'POST', body: JSON.stringify({ updates: [{ key, value: JSON.stringify(value) }] }) });
                setter(value);
            } catch (e) { addToast(`Errore durante l'aggiornamento: ${label}.`, 'error'); }
        };
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const metaData = await apiFetch<any>('/api/data?scope=metadata');
            setClients(metaData.clients || []);
            setRoles(metaData.roles || []);
            setRoleCostHistory(metaData.roleCostHistory || []);
            setResources(metaData.resources || []);
            setProjects(metaData.projects || []);
            setFunctions(metaData.functions || []);
            setIndustries(metaData.industries || []);
            setSeniorityLevels(metaData.seniorityLevels || []);
            setProjectStatuses(metaData.projectStatuses || []);
            setClientSectors(metaData.clientSectors || []);
            setLocations(metaData.locations || []);
            setCompanyCalendar(metaData.companyCalendar || []);
            setSkills(metaData.skills || []);
            setSkillCategories(metaData.skillCategories || []);
            setSkillMacroCategories(metaData.skillMacroCategories || []);
            setResourceSkills(metaData.resourceSkills || []);
            setPageVisibility(metaData.pageVisibility || {});
            setLeaveTypes(metaData.leaveTypes || []);
            setManagerResourceIds(metaData.managerResourceIds || []);
            setAnalyticsCache(metaData.analyticsCache || {});
            setRateCards(metaData.rateCards || []);
            setRateCardEntries(metaData.rateCardEntries || []);
            setProjectExpenses(metaData.projectExpenses || []);
            setNotificationConfigs(metaData.notificationConfigs || []);
            setNotificationRules(metaData.notificationRules || []);
            
            if (metaData.skillThresholds) setSkillThresholds(prev => ({ ...prev, ...metaData.skillThresholds }));
            if (metaData.sidebarConfig) setSidebarConfig(metaData.sidebarConfig);
            if (metaData.quickActions) setQuickActions(metaData.quickActions);
            if (metaData.sidebarSections) setSidebarSections(metaData.sidebarSections);
            if (metaData.sidebarSectionColors) setSidebarSectionColors(metaData.sidebarSectionColors);
            if (metaData.sidebarFooterActions) setSidebarFooterActions(metaData.sidebarFooterActions);
            if (metaData.dashboardLayout) setDashboardLayout(metaData.dashboardLayout);
            if (metaData.roleHomePages) setRoleHomePages(metaData.roleHomePages);
            if (metaData.bottomNavPaths) setBottomNavPaths(metaData.bottomNavPaths);

            let monthsBefore = planningMonthsBefore;
            let monthsAfter = planningMonthsAfter;
            if (metaData.planningSettings) {
                if (metaData.planningSettings.monthsBefore) monthsBefore = metaData.planningSettings.monthsBefore;
                if (metaData.planningSettings.monthsAfter) monthsAfter = metaData.planningSettings.monthsAfter;
            }
            setPlanningSettings({ monthsBefore, monthsAfter });

            const today = new Date();
            const start = new Date(today);
            start.setMonth(start.getMonth() - monthsBefore);
            const end = new Date(today);
            end.setMonth(end.getMonth() + monthsAfter);
            
            const startStr = start.toISOString().split('T')[0];
            const endStr = end.toISOString().split('T')[0];

            const planningData = await apiFetch<any>(`/api/data?scope=planning&start=${startStr}&end=${endStr}`);
            setAssignments(planningData.assignments || []);
            setAllocations(planningData.allocations || {});
            setWbsTasks(planningData.wbsTasks || []);
            setResourceRequests(planningData.resourceRequests || []);
            setInterviews(planningData.interviews || []);
            setContracts(planningData.contracts || []);
            setContractProjects(planningData.contractProjects || []);
            setContractManagers(planningData.contractManagers || []);
            setProjectSkills(planningData.projectSkills || []);
            setLeaveRequests(planningData.leaveRequests || []);
            setBillingMilestones(planningData.billingMilestones || []);

        } catch (error) {
            console.error("Failed to fetch data", error);
            setFetchError((error as Error).message || 'Errore durante il caricamento dei dati.');
        } finally {
            setLoading(false);
        }
    }, [planningMonthsBefore, planningMonthsAfter]);

    const fetchNotifications = useCallback(async () => {
        try {
            const notifs = await apiFetch<Notification[]>('/api/resources?entity=notifications');
            setNotifications(notifs);
        } catch (error) { /* Notification fetch failures are non-critical */ }
    }, []);

    // FIX: Trigger data fetching on mount
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const markNotificationAsRead = useCallback(async (id?: string) => {
        try {
            const url = id 
                ? `/api/resources?entity=notifications&action=mark_read&id=${id}`
                : `/api/resources?entity=notifications&action=mark_read`;
            await apiFetch(url, { method: 'PUT', body: JSON.stringify({ version: 1 }) });
            setNotifications(prev => prev.map(n => id ? (n.id === id ? { ...n, isRead: true } : n) : { ...n, isRead: true }));
        } catch (error) { console.error("Failed to mark notification as read", error); }
    }, []);
    
    // FIX: Added implementation for updateAllocation and bulkUpdateAllocations
    const updateAllocation = useCallback(async (assignmentId: string, date: string, percentage: number) => {
        try {
            await apiFetch('/api/allocations', {
                method: 'POST',
                body: JSON.stringify({ updates: [{ assignmentId, date, percentage }] })
            });
            setAllocations(prev => {
                const next = { ...prev };
                const assignAlloc = { ...(next[assignmentId] || {}) };
                if (percentage === 0) {
                    delete assignAlloc[date];
                } else {
                    assignAlloc[date] = percentage;
                }
                next[assignmentId] = assignAlloc;
                return next;
            });
        } catch (error) {
            addToast('Errore durante l\'aggiornamento dell\'allocazione.', 'error');
        }
    }, [addToast]);

    const bulkUpdateAllocations = useCallback(async (assignmentId: string, startDate: string, endDate: string, percentage: number) => {
        const start = parseISODate(startDate);
        const end = parseISODate(endDate);
        const updates: { assignmentId: string; date: string; percentage: number }[] = [];
        
        let curr = new Date(start.getTime());
        while (curr.getTime() <= end.getTime()) {
            const day = curr.getUTCDay(); // 0 = Sun, 6 = Sat
            if (day !== 0 && day !== 6) {
                const dateStr = toISODateString(curr);
                updates.push({ assignmentId, date: dateStr, percentage });
            }
            curr.setUTCDate(curr.getUTCDate() + 1);
        }

        if (updates.length === 0) return;

        try {
            await apiFetch('/api/allocations', {
                method: 'POST',
                body: JSON.stringify({ updates })
            });
            setAllocations(prev => {
                const next = { ...prev };
                const assignAlloc = { ...(next[assignmentId] || {}) };
                updates.forEach(u => {
                    if (u.percentage === 0) delete assignAlloc[u.date];
                    else assignAlloc[u.date] = u.percentage;
                });
                next[assignmentId] = assignAlloc;
                return next;
            });
            addToast(`Aggiornate ${updates.length} giornate.`, 'success');
        } catch (error) {
            addToast('Errore durante l\'aggiornamento massivo.', 'error');
        }
    }, [addToast]);

    // Optimized CRUD Operations
    const addResource = async (resource: Omit<Resource, 'id'>) => { setActionLoading('addResource', true); try { const newResource = await apiFetch<Resource>('/api/resources?entity=resources', { method: 'POST', body: JSON.stringify(resource) }); setResources(prev => [...prev, newResource]); return newResource; } finally { setActionLoading('addResource', false); } };
    const updateResource = async (resource: Resource) => { setActionLoading(`updateResource-${resource.id}`, true); try { const updated = await apiFetch<Resource>(`/api/resources?entity=resources&id=${resource.id}`, { method: 'PUT', body: JSON.stringify(resource) }); setResources(prev => prev.map(r => r.id === resource.id ? updated : r)); addToast('Risorsa aggiornata', 'success'); } catch (e: any) { addToast(e.message, 'error'); } finally { setActionLoading(`updateResource-${resource.id}`, false); } };
    const deleteResource = async (id: string) => { 
        setActionLoading(`deleteResource-${id}`, true); 
        try { 
            await apiFetch(`/api/resources?entity=resources&id=${id}`, { method: 'DELETE' }); 
            setResources(prev => prev.filter(r => r.id !== id)); 
            // Local cleanup
            setAssignments(prev => prev.filter(a => a.resourceId !== id));
            setResourceSkills(prev => prev.filter(rs => rs.resourceId !== id));
            setLeaveRequests(prev => prev.filter(l => l.resourceId !== id));
        } finally { 
            setActionLoading(`deleteResource-${id}`, false); 
        } 
    };

    const addProject = async (project: Omit<Project, 'id'>) => { setActionLoading('addProject', true); try { const newProject = await apiFetch<Project | null>('/api/resources?entity=projects', { method: 'POST', body: JSON.stringify(project) }); setProjects(prev => [...prev, newProject!]); return newProject; } finally { setActionLoading('addProject', false); } };
    const updateProject = async (project: Project) => { setActionLoading(`updateProject-${project.id}`, true); try { const updated = await apiFetch<Project>(`/api/resources?entity=projects&id=${project.id}`, { method: 'PUT', body: JSON.stringify(project) }); setProjects(prev => prev.map(p => p.id === project.id ? updated : p)); addToast('Progetto aggiornato', 'success'); } catch (e: any) { addToast(e.message, 'error'); } finally { setActionLoading(`updateProject-${project.id}`, false); } };
    const deleteProject = async (id: string) => { 
        setActionLoading(`deleteProject-${id}`, true); 
        try { 
            await apiFetch(`/api/resources?entity=projects&id=${id}`, { method: 'DELETE' }); 
            setProjects(prev => prev.filter(p => p.id !== id)); 
            // Local cleanup
            setAssignments(prev => prev.filter(a => a.projectId !== id));
            setProjectSkills(prev => prev.filter(ps => ps.projectId !== id));
        } finally { 
            setActionLoading(`deleteProject-${id}`, false); 
        } 
    };

    const addClient = async (client: Omit<Client, 'id'>) => { setActionLoading('addClient', true); try { const newClient = await apiFetch<Client>('/api/resources?entity=clients', { method: 'POST', body: JSON.stringify(client) }); setClients(prev => [...prev, newClient]); } finally { setActionLoading('addClient', false); } };
    const updateClient = async (client: Client) => { setActionLoading(`updateClient-${client.id}`, true); try { const updated = await apiFetch<Client>(`/api/resources?entity=clients&id=${client.id}`, { method: 'PUT', body: JSON.stringify(client) }); setClients(prev => prev.map(c => c.id === client.id ? updated : c)); addToast('Cliente aggiornato', 'success'); } catch (e: any) { addToast(e.message, 'error'); } finally { setActionLoading(`updateClient-${client.id}`, false); } };
    const deleteClient = async (id: string) => { setActionLoading(`deleteClient-${id}`, true); try { await apiFetch(`/api/resources?entity=clients&id=${id}`, { method: 'DELETE' }); setClients(prev => prev.filter(c => c.id !== id)); } finally { setActionLoading(`deleteClient-${id}`, false); } };
    
    const addRole = async (role: Omit<Role, 'id'>) => { setActionLoading('addRole', true); try { const newRole = await apiFetch<Role>('/api/resources?entity=roles', { method: 'POST', body: JSON.stringify(role) }); setRoles(prev => [...prev, newRole]); } finally { setActionLoading('addRole', false); } };
    const updateRole = async (role: Role) => { setActionLoading(`updateRole-${role.id}`, true); try { const updated = await apiFetch<Role>(`/api/resources?entity=roles&id=${role.id}`, { method: 'PUT', body: JSON.stringify(role) }); setRoles(prev => prev.map(r => r.id === role.id ? updated : r)); const historyRes = await apiFetch<RoleCostHistory[]>('/api/resources?entity=role_cost_history'); setRoleCostHistory(historyRes); addToast('Ruolo aggiornata', 'success'); } catch (e: any) { addToast(e.message, 'error'); } finally { setActionLoading(`updateRole-${role.id}`, false); } };
    const deleteRole = async (id: string) => { setActionLoading(`deleteRole-${id}`, true); try { await apiFetch(`/api/resources?entity=roles&id=${id}`, { method: 'DELETE' }); setRoles(prev => prev.filter(r => r.id !== id)); } finally { setActionLoading(`deleteRole-${id}`, false); } };
    
    const addContract = async (contract: Omit<Contract, 'id'>, projectIds: string[], managerIds: string[]) => { 
        setActionLoading('addContract', true); 
        try { 
            const newContract = await apiFetch<Contract>('/api/resources?entity=contracts', { method: 'POST', body: JSON.stringify(contract) }); 
            await Promise.all([ 
                ...projectIds.map(pid => apiFetch('/api/resources?entity=contract_projects', { method: 'POST', body: JSON.stringify({ contractId: newContract.id, projectId: pid }) })), 
                ...managerIds.map(mid => apiFetch('/api/resources?entity=contract_managers', { method: 'POST', body: JSON.stringify({ contractId: newContract.id, resourceId: mid }) })) 
            ]); 
            setContracts(prev => [...prev, newContract]);
            setContractProjects(prev => [...prev, ...projectIds.map(pid => ({ contractId: newContract.id!, projectId: pid }))]);
            setContractManagers(prev => [...prev, ...managerIds.map(mid => ({ contractId: newContract.id!, resourceId: mid }))]);
        } finally { 
            setActionLoading('addContract', false); 
        } 
    };
    const updateContract = async (contract: Contract, projectIds: string[], managerIds: string[]) => { 
        setActionLoading(`updateContract-${contract.id}`, true); 
        try { 
            const updated = await apiFetch<Contract>(`/api/resources?entity=contracts&id=${contract.id}`, { method: 'PUT', body: JSON.stringify(contract) }); 
            setContracts(prev => prev.map(c => c.id === contract.id ? updated : c));
            // Relations update skipped as per architecture limitation discussed
        } finally { 
            setActionLoading(`updateContract-${contract.id}`, false); 
        } 
    };
    const deleteContract = async (id: string) => { 
        setActionLoading(`deleteContract-${id}`, true); 
        try { 
            await apiFetch(`/api/resources?entity=contracts&id=${id}`, { method: 'DELETE' }); 
            setContracts(prev => prev.filter(c => c.id !== id)); 
            setContractProjects(prev => prev.filter(cp => cp.contractId !== id));
            setContractManagers(prev => prev.filter(cm => cm.contractId !== id));
        } finally { 
            setActionLoading(`deleteContract-${id}`, false); 
        } 
    };
    const recalculateContractBacklog = async (id: string) => { setActionLoading(`recalculateBacklog-${id}`, true); try { const contract = contracts.find(c => c.id === id); if (!contract) return; const linkedProjects = contractProjects.filter(cp => cp.contractId === id).map(cp => cp.projectId); const usedBudget = projects.filter(p => linkedProjects.includes(p.id!)).reduce((sum, p) => sum + Number(p.budget || 0), 0); const newBacklog = Number(contract.capienza) - usedBudget; await updateContract({ ...contract, backlog: newBacklog }, linkedProjects, []); } finally { setActionLoading(`recalculateBacklog-${id}`, false); } };

    const addSkill = async (skill: Omit<Skill, 'id'>) => { setActionLoading('addSkill', true); try { const newSkill = await apiFetch<Skill>('/api/resources?entity=skills', { method: 'POST', body: JSON.stringify(skill) }); setSkills(prev => [...prev, newSkill]); } finally { setActionLoading('addSkill', false); } };
    const updateSkill = async (skill: Skill) => { setActionLoading(`updateSkill-${skill.id}`, true); try { const updated = await apiFetch<Skill>(`/api/resources?entity=skills&id=${skill.id}`, { method: 'PUT', body: JSON.stringify(skill) }); setSkills(prev => prev.map(s => s.id === skill.id ? updated : s)); } finally { setActionLoading(`updateSkill-${skill.id}`, false); } };
    const deleteSkill = async (id: string) => { 
        setActionLoading(`deleteSkill-${id}`, true); 
        try { 
            await apiFetch(`/api/resources?entity=skills&id=${id}`, { method: 'DELETE' }); 
            setSkills(prev => prev.filter(s => s.id !== id)); 
            setResourceSkills(prev => prev.filter(rs => rs.skillId !== id));
            setProjectSkills(prev => prev.filter(ps => ps.skillId !== id));
        } finally { 
            setActionLoading(`deleteSkill-${id}`, false); 
        } 
    };

    // --- Entity CRUD via factory (with loading) ---
    const rateCardCrud = makeCrud<RateCard>('rate_cards', setRateCards, 'rate card', { loadingPrefix: 'RateCard' });
    const addRateCard = rateCardCrud.add; const updateRateCard = rateCardCrud.update; const deleteRateCard = rateCardCrud.del;
    const upsertRateCardEntries = async (entries: RateCardEntry[]) => { if (entries.length === 0) return; setActionLoading('upsertRateCardEntries', true); try { await apiFetch('/api/resources?entity=rate_card_entries', { method: 'POST', body: JSON.stringify({ entries }) }); const entriesRes = await apiFetch<RateCardEntry[]>('/api/resources?entity=rate_card_entries'); setRateCardEntries(entriesRes || []); } finally { setActionLoading('upsertRateCardEntries', false); } };
    const projectExpenseCrud = makeCrud<ProjectExpense>('project_expenses', setProjectExpenses, 'spesa progetto', { loadingPrefix: 'ProjectExpense' });
    const addProjectExpense = projectExpenseCrud.add; const updateProjectExpense = projectExpenseCrud.update; const deleteProjectExpense = projectExpenseCrud.del;
    const calendarEventCrud = makeCrud<CalendarEvent>('company_calendar', setCompanyCalendar, 'evento calendario', { loadingPrefix: 'CalendarEvent' });
    const addCalendarEvent = calendarEventCrud.add; const updateCalendarEvent = calendarEventCrud.update; const deleteCalendarEvent = calendarEventCrud.del;
    const resourceRequestCrud = makeCrud<ResourceRequest>('resource-requests', setResourceRequests, 'richiesta risorsa', { loadingPrefix: 'ResourceRequest', baseUrl: '/api/resource-requests' });
    const addResourceRequest = resourceRequestCrud.add; const updateResourceRequest = resourceRequestCrud.update; const deleteResourceRequest = resourceRequestCrud.del;
    const interviewCrud = makeCrud<Interview>('interviews', setInterviews, 'colloquio', { loadingPrefix: 'Interview' });
    const addInterview = interviewCrud.add; const updateInterview = interviewCrud.update; const deleteInterview = interviewCrud.del;

    // --- Entity CRUD via factory (without loading) ---
    const billingMilestoneCrud = makeCrud<BillingMilestone>('billing_milestones', setBillingMilestones, 'milestone');
    const addBillingMilestone = billingMilestoneCrud.add; const updateBillingMilestone = billingMilestoneCrud.update; const deleteBillingMilestone = billingMilestoneCrud.del;
    const skillCategoryCrud = makeCrud<SkillCategory>('skill_categories', setSkillCategories, 'categoria competenza');
    const addSkillCategory = skillCategoryCrud.add; const updateSkillCategory = skillCategoryCrud.update; const deleteSkillCategory = skillCategoryCrud.del;
    const notifConfigCrud = makeCrud<NotificationConfig>('notification_configs', setNotificationConfigs, 'configurazione notifica');
    const addNotificationConfig = notifConfigCrud.add; const updateNotificationConfig = notifConfigCrud.update; const deleteNotificationConfig = notifConfigCrud.del;
    const notifRuleCrud = makeCrud<NotificationRule>('notification_rules', setNotificationRules, 'regola notifica');
    const addNotificationRule = notifRuleCrud.add; const updateNotificationRule = notifRuleCrud.update; const deleteNotificationRule = notifRuleCrud.del;
    const leaveTypeCrud = makeCrud<LeaveType>('leave_types', setLeaveTypes, 'tipo di assenza');
    const addLeaveType = leaveTypeCrud.add; const updateLeaveType = leaveTypeCrud.update; const deleteLeaveType = leaveTypeCrud.del;
    const leaveRequestCrud = makeCrud<LeaveRequest>('leaves', setLeaveRequests, 'richiesta di assenza');
    const addLeaveRequest = leaveRequestCrud.add; const updateLeaveRequest = leaveRequestCrud.update; const deleteLeaveRequest = leaveRequestCrud.del;
    const evaluationCrud = makeCrud<ResourceEvaluation>('resource_evaluations', setEvaluations, 'valutazione');
    const addEvaluation = evaluationCrud.add; const updateEvaluation = evaluationCrud.update; const deleteEvaluation = evaluationCrud.del;

    // --- Special cases (custom logic, composite keys, etc.) ---
    const addConfigOption = async (type: string, value: string) => { setActionLoading(`addConfig-${type}`, true); try { const newOpt = await apiFetch<ConfigOption>(`/api/config?type=${type}`, { method: 'POST', body: JSON.stringify({ value }) }); const setter = type === 'functions' ? setFunctions : type === 'industries' ? setIndustries : type === 'seniorityLevels' ? setSeniorityLevels : type === 'projectStatuses' ? setProjectStatuses : type === 'clientSectors' ? setClientSectors : setLocations; setter(prev => [...prev, newOpt]); } finally { setActionLoading(`addConfig-${type}`, false); } };
    const updateConfigOption = async (type: string, option: ConfigOption) => { setActionLoading(`updateConfig-${type}-${option.id}`, true); try { await apiFetch(`/api/config?type=${type}&id=${option.id}`, { method: 'PUT', body: JSON.stringify({ value: option.value }) }); const setter = type === 'functions' ? setFunctions : type === 'industries' ? setIndustries : type === 'seniorityLevels' ? setSeniorityLevels : type === 'projectStatuses' ? setProjectStatuses : type === 'clientSectors' ? setClientSectors : setLocations; setter(prev => prev.map(o => o.id === option.id ? option : o)); } finally { setActionLoading(`updateConfig-${type}-${option.id}`, false); } };
    const deleteConfigOption = async (type: string, id: string) => { setActionLoading(`deleteConfig-${type}-${id}`, true); try { await apiFetch(`/api/config?type=${type}&id=${id}`, { method: 'DELETE' }); const setter = type === 'functions' ? setFunctions : type === 'industries' ? setIndustries : type === 'seniorityLevels' ? setSeniorityLevels : type === 'projectStatuses' ? setProjectStatuses : type === 'clientSectors' ? setClientSectors : setLocations; setter(prev => prev.filter(o => o.id !== id)); addToast('Opzione eliminata con successo', 'success'); } catch (error) { addToast('Errore durante l\'eliminazione', 'error'); } finally { setActionLoading(`deleteConfig-${type}-${id}`, false); } };
    const addMultipleAssignments = async (newAssignments: { resourceId: string; projectId: string }[]) => { try { const createdAssignments = await Promise.all(newAssignments.map(async (a) => { return await apiFetch<Assignment | { message: string }>('/api/assignments', { method: 'POST', body: JSON.stringify(a) }); })); setAssignments(prev => [...prev, ...createdAssignments.filter((a): a is Assignment => !('message' in a))]); } catch (error) { addToast('Errore durante la creazione delle assegnazioni.', 'error'); } };
    const deleteAssignment = async (id: string) => { setActionLoading(`deleteAssignment-${id}`, true); try { await apiFetch(`/api/assignments?id=${id}`, { method: 'DELETE' }); setAssignments(prev => prev.filter(a => a.id !== id)); } finally { setActionLoading(`deleteAssignment-${id}`, false); } };
    const addResourceSkill = async (rs: ResourceSkill) => { setActionLoading(`addResourceSkill-${rs.resourceId}`, true); try { const savedSkill = await apiFetch<ResourceSkill>('/api/resources?entity=resource_skills', { method: 'POST', body: JSON.stringify(rs) }); setResourceSkills(prev => [...prev.filter(i => !(i.resourceId === rs.resourceId && i.skillId === rs.skillId)), savedSkill]); } finally { setActionLoading(`addResourceSkill-${rs.resourceId}`, false); } };
    const deleteResourceSkill = async (resourceId: string, skillId: string) => { try { await apiFetch(`/api/resources?entity=resource_skills&resourceId=${resourceId}&skillId=${skillId}`, { method: 'DELETE' }); setResourceSkills(prev => prev.filter(rs => !(rs.resourceId === resourceId && rs.skillId === skillId))); } catch (e) { addToast('Errore durante l\'eliminazione della competenza.', 'error'); } };
    const addProjectSkill = async (ps: ProjectSkill) => { try { const savedPs = await apiFetch<ProjectSkill>('/api/resources?entity=project_skills', { method: 'POST', body: JSON.stringify(ps) }); setProjectSkills(prev => [...prev, savedPs]); } catch (e) { addToast('Errore durante l\'aggiunta della competenza al progetto.', 'error'); } };
    const deleteProjectSkill = async (projectId: string, skillId: string) => { try { await apiFetch(`/api/resources?entity=project_skills&projectId=${projectId}&skillId=${skillId}`, { method: 'DELETE' }); setProjectSkills(prev => prev.filter(ps => !(ps.projectId === projectId && ps.skillId === skillId))); } catch (e) { addToast('Errore durante l\'eliminazione della competenza dal progetto.', 'error'); } };
    const updateSkillThresholds = async (thresholds: SkillThresholds) => { try { const updates = Object.entries(thresholds).map(([key, value]) => ({ key: `skill_threshold.${key}`, value: String(value) })); await apiFetch('/api/resources?entity=app-config-batch', { method: 'POST', body: JSON.stringify({ updates }) }); setSkillThresholds(thresholds); } catch (e) { addToast('Errore durante l\'aggiornamento delle soglie competenze.', 'error'); } };
    const updatePlanningSettings = async (settings: { monthsBefore: number; monthsAfter: number }) => { try { const updates = [ { key: 'planning_range_months_before', value: String(settings.monthsBefore) }, { key: 'planning_range_months_after', value: String(settings.monthsAfter) } ]; await apiFetch('/api/resources?entity=app-config-batch', { method: 'POST', body: JSON.stringify({ updates }) }); setPlanningSettings(settings); fetchData(); } catch (e) { addToast('Errore durante l\'aggiornamento delle impostazioni di planning.', 'error'); } };
    const addSkillMacro = async (macro: { name: string }) => { try { const newMacro = await apiFetch<SkillMacroCategory>('/api/resources?entity=skill_macro_categories', { method: 'POST', body: JSON.stringify(macro) }); setSkillMacroCategories(prev => [...prev, newMacro]); } catch (e) { addToast('Errore durante l\'aggiunta della macro categoria.', 'error'); } };
    const updateSkillMacro = async (id: string, name: string) => { try { const updated = await apiFetch<SkillMacroCategory>(`/api/resources?entity=skill_macro_categories&id=${id}`, { method: 'PUT', body: JSON.stringify({ name }) }); setSkillMacroCategories(prev => prev.map(m => m.id === id ? updated : m)); } catch (e) { addToast('Errore durante l\'aggiornamento della macro categoria.', 'error'); } };
    const deleteSkillMacro = async (id: string) => { try { await apiFetch(`/api/resources?entity=skill_macro_categories&id=${id}`, { method: 'DELETE' }); setSkillMacroCategories(prev => prev.filter(m => m.id !== id)); } catch (e) { addToast('Errore durante l\'eliminazione della macro categoria.', 'error'); } };
    const forceRecalculateAnalytics = async () => { try { const res = await apiFetch<{ data: Record<string, unknown> }>('/api/resources?entity=analytics_cache&action=recalc_all', { method: 'POST' }); setAnalyticsCache(res.data); } catch (e) { addToast('Errore durante il ricalcolo delle analytics.', 'error'); } };
    const getBestFitResources = useCallback(async (params: any) => { try { return await apiFetch<any[]>('/api/resources?entity=resources&action=best_fit', { method: 'POST', body: JSON.stringify(params) }); } catch (e) { return []; } }, []);
    const updatePageVisibility = async (visibility: PageVisibility) => { try { const updates = Object.entries(visibility).map(([path, onlyAdmin]) => ({ key: `page_vis.${path}`, value: String(onlyAdmin) })); await apiFetch('/api/resources?entity=app-config-batch', { method: 'POST', body: JSON.stringify({ updates }) }); setPageVisibility(visibility); } catch (e) { addToast('Errore durante l\'aggiornamento della visibilità pagine.', 'error'); } };
    const fetchEvaluations = useCallback(async (resourceId?: string) => { try { const url = resourceId ? `/api/resources?entity=resource_evaluations&resourceId=${resourceId}` : `/api/resources?entity=resource_evaluations`; const data = await apiFetch<ResourceEvaluation[]>(url); setEvaluations(prev => data); } catch(e) { addToast('Errore durante il caricamento delle valutazioni.', 'error'); } }, [addToast]);

    // --- Config batch updates via factory ---
    const updateSidebarConfig = makeConfigUpdate<SidebarItem[]>('sidebar_layout_v1', setSidebarConfig, 'configurazione sidebar');
    const updateQuickActions = makeConfigUpdate<QuickAction[]>('quick_actions_v1', setQuickActions, 'azioni rapide');
    const updateSidebarSections = makeConfigUpdate<string[]>('sidebar_sections_v1', setSidebarSections, 'sezioni sidebar');
    const updateSidebarSectionColors = makeConfigUpdate<SidebarSectionColors>('sidebar_section_colors', setSidebarSectionColors, 'colori sezioni');
    const updateSidebarFooterActions = makeConfigUpdate<SidebarFooterAction[]>('sidebar_footer_actions_v1', setSidebarFooterActions, 'azioni footer');
    const updateDashboardLayout = makeConfigUpdate<DashboardCategory[]>('dashboard_layout_v2', setDashboardLayout, 'layout dashboard');
    const updateRoleHomePages = makeConfigUpdate<Record<string, string>>('role_home_pages_v1', setRoleHomePages, 'home page per ruolo');
    const updateBottomNavPaths = makeConfigUpdate<string[]>('bottom_nav_paths_v1', setBottomNavPaths, 'percorsi bottom nav');

    const getRoleCost = (roleId: string, date: Date, resourceId?: string): number => { 
        if (resourceId) { const resource = resources.find(r => r.id === resourceId); if (resource && resource.dailyCost && Number(resource.dailyCost) > 0) return Number(resource.dailyCost); }
        const dateStr = date.toISOString().split('T')[0]; 
        const historicRecord = roleCostHistory.find(h => { if (h.roleId !== roleId) return false; return dateStr >= h.startDate && (!h.endDate || dateStr <= h.endDate); }); 
        if (historicRecord) return Number(historicRecord.dailyCost); 
        const role = roles.find(r => r.id === roleId); 
        return role ? Number(role.dailyCost) : 0; 
    };

    const getSellRate = (rateCardId: string | null | undefined, resourceId: string): number => { 
        if (!rateCardId) return 0; 
        const entry = rateCardEntries.find(e => e.rateCardId === rateCardId && e.resourceId === resourceId); 
        return entry ? Number(entry.dailyRate) : 0; 
    };

    const getResourceComputedSkills = useCallback((resourceId: string): ComputedSkill[] => {
        const manual = resourceSkills.filter(rs => rs.resourceId === resourceId);
        const resourceAssignments = assignments.filter(a => a.resourceId === resourceId);
        const assignedProjectIds = new Set(resourceAssignments.map(a => a.projectId));
        const projectOccurrences = new Map<string, number>();
        projectSkills.forEach(ps => { if (assignedProjectIds.has(ps.projectId)) { projectOccurrences.set(ps.skillId, (projectOccurrences.get(ps.skillId) || 0) + 1); } });
        return skills.map(skill => {
            const manualEntry = manual.find(m => m.skillId === skill.id);
            const pCount = projectOccurrences.get(skill.id!) || 0;
            const inferredDays = pCount * 10;
            let inferredLevel = 1;
            if (inferredDays >= skillThresholds.EXPERT) inferredLevel = 5;
            else if (inferredDays >= skillThresholds.SENIOR) inferredLevel = 4;
            else if (inferredDays >= skillThresholds.MIDDLE) inferredLevel = 3;
            else if (inferredDays >= skillThresholds.JUNIOR) inferredLevel = 2;
            return { skill, manualDetails: manualEntry, inferredDays, inferredLevel, projectCount: pCount };
        }).filter(cs => cs.manualDetails || cs.projectCount > 0);
    }, [resourceSkills, assignments, projectSkills, skills, skillThresholds]);

    const providerValue = useMemo(() => ({
        clients, roles, roleCostHistory, rateCards, rateCardEntries, projectExpenses, resources, projects, contracts, contractProjects, contractManagers, 
        assignments, functions, industries, seniorityLevels, projectStatuses, clientSectors, locations, companyCalendar,
        wbsTasks, resourceRequests, interviews, skills, skillCategories, skillMacroCategories, resourceSkills, projectSkills, pageVisibility, skillThresholds,
        planningSettings, leaveTypes, leaveRequests, managerResourceIds, sidebarConfig, quickActions, sidebarSections, sidebarSectionColors, sidebarFooterActions, dashboardLayout, roleHomePages, bottomNavPaths,
        notifications, analyticsCache, loading, isActionLoading, billingMilestones, notificationConfigs, notificationRules, evaluations,
        fetchData, fetchNotifications, markNotificationAsRead, addResource, updateResource, deleteResource, addProject, updateProject, deleteProject,
        addClient, updateClient, deleteClient, addRole, updateRole, deleteRole, addRateCard, updateRateCard, deleteRateCard, upsertRateCardEntries,
        addProjectExpense, updateProjectExpense, deleteProjectExpense, addConfigOption, updateConfigOption, deleteConfigOption, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
        addMultipleAssignments, deleteAssignment, getRoleCost, getSellRate, addResourceRequest, updateResourceRequest, deleteResourceRequest,
        addInterview, updateInterview, deleteInterview, addContract, updateContract, deleteContract, recalculateContractBacklog,
        addSkill, updateSkill, deleteSkill, addResourceSkill, deleteResourceSkill, addProjectSkill, deleteProjectSkill,
        updateSkillThresholds, updatePlanningSettings, getResourceComputedSkills, addSkillCategory, updateSkillCategory, deleteSkillCategory,
        addSkillMacro, updateSkillMacro, deleteSkillMacro, addBillingMilestone, updateBillingMilestone, deleteBillingMilestone, getBestFitResources,
        addNotificationConfig, updateNotificationConfig, deleteNotificationConfig,
        addNotificationRule, updateNotificationRule, deleteNotificationRule,
        forceRecalculateAnalytics, addLeaveType, updateLeaveType, deleteLeaveType, addLeaveRequest, updateLeaveRequest, deleteLeaveRequest, updatePageVisibility,
        updateSidebarConfig, updateQuickActions, updateSidebarSections, updateSidebarSectionColors, updateSidebarFooterActions, updateDashboardLayout, updateRoleHomePages, updateBottomNavPaths,
        fetchEvaluations, addEvaluation, updateEvaluation, deleteEvaluation
    }), [
        clients, roles, roleCostHistory, rateCards, rateCardEntries, projectExpenses, resources, projects, contracts, contractProjects, contractManagers,
        assignments, functions, industries, seniorityLevels, projectStatuses, clientSectors, locations, companyCalendar,
        wbsTasks, resourceRequests, interviews, skills, skillCategories, skillMacroCategories, resourceSkills, projectSkills, pageVisibility, skillThresholds,
        planningSettings, leaveTypes, leaveRequests, managerResourceIds, sidebarConfig, quickActions, sidebarSections, sidebarSectionColors, sidebarFooterActions, dashboardLayout, roleHomePages, bottomNavPaths,
        notifications, analyticsCache, loading, isActionLoading, getBestFitResources, billingMilestones, notificationConfigs, notificationRules, getResourceComputedSkills, evaluations,
        fetchData, fetchNotifications, markNotificationAsRead, addResource, updateResource, deleteResource, addProject, updateProject, deleteProject,
        addClient, updateClient, deleteClient, addRole, updateRole, deleteRole, addRateCard, updateRateCard, deleteRateCard, upsertRateCardEntries,
        addProjectExpense, updateProjectExpense, deleteProjectExpense, addConfigOption, updateConfigOption, deleteConfigOption, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
        addMultipleAssignments, deleteAssignment, addResourceRequest, updateResourceRequest, deleteResourceRequest, addInterview, updateInterview, deleteInterview,
        addContract, updateContract, deleteContract, recalculateContractBacklog, addSkill, updateSkill, deleteSkill, addResourceSkill, deleteResourceSkill, addProjectSkill, deleteProjectSkill,
        updateSkillThresholds, updatePlanningSettings, addSkillCategory, updateSkillCategory, deleteSkillCategory, addSkillMacro, updateSkillMacro, deleteSkillMacro,
        addBillingMilestone, updateBillingMilestone, deleteBillingMilestone, addNotificationConfig, updateNotificationConfig, deleteNotificationConfig,
        addNotificationRule, updateNotificationRule, deleteNotificationRule,
        forceRecalculateAnalytics, addLeaveType, updateLeaveType, deleteLeaveType, addLeaveRequest, updateLeaveRequest, deleteLeaveRequest, updatePageVisibility,
        updateSidebarConfig, updateQuickActions, updateSidebarSections, updateSidebarSectionColors, updateSidebarFooterActions, updateDashboardLayout, updateRoleHomePages, updateBottomNavPaths,
        fetchEvaluations, addEvaluation, updateEvaluation, deleteEvaluation
    ]);

    const appStateValue = useMemo(() => ({ loading, fetchError, isSearchOpen, setSearchOpen: setIsSearchOpen }), [loading, fetchError, isSearchOpen]);

    return (
        <AppStateContext.Provider value={appStateValue}>
            <EntitiesContext.Provider value={providerValue}>
                <AllocationsContext.Provider value={{ allocations, updateAllocation, bulkUpdateAllocations }}>
                    {children}
                </AllocationsContext.Provider>
            </EntitiesContext.Provider>
        </AppStateContext.Provider>
    );
};

export const useEntitiesContext = () => { const context = useContext(EntitiesContext); if (!context) throw new Error("useEntitiesContext must be used within AppProviders"); return context; };
export const useAllocationsContext = () => { const context = useContext(AllocationsContext); if (!context) throw new Error("useAllocationsContext must be used within AppProviders"); return context; };
export const useAppState = () => { const context = useContext(AppStateContext); if (!context) throw new Error("useAppState must be used within AppProviders"); return context; };
