
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
    RateCard, RateCardEntry, ProjectExpense
} from '../types';
import { useToast } from './ToastContext';
import { apiFetch } from '../services/apiClient';

// --- Default Constants ---
const DEFAULT_SIDEBAR_CONFIG: SidebarItem[] = []; 
const DEFAULT_SIDEBAR_SECTIONS = ['Principale', 'Progetti', 'Risorse', 'Operatività', 'Supporto', 'Configurazione', 'Dati'];
const DEFAULT_SIDEBAR_FOOTER_ACTIONS: SidebarFooterAction[] = [
    { id: 'changePassword', label: 'Cambia Password', icon: 'lock_reset' },
    { id: 'logout', label: 'Logout', icon: 'logout' }
];
const DEFAULT_DASHBOARD_LAYOUT: DashboardCategory[] = [
  { id: 'generale', label: 'Generale', cards: ['kpiHeader', 'attentionCards', 'leavesOverview', 'unallocatedFte'] },
  { id: 'staffing', label: 'Staffing', cards: ['averageAllocation', 'underutilizedResources', 'saturationTrend'] },
  { id: 'progetti', label: 'Progetti', cards: ['ftePerProject', 'budgetAnalysis', 'temporalBudgetAnalysis', 'averageDailyRate'] },
  { id: 'contratti', label: 'Economico', cards: ['monthlyClientCost', 'effortByHorizontal', 'locationAnalysis', 'costForecast'] }
];
const DEFAULT_ROLE_HOME_PAGES: Record<string, string> = {
    'SIMPLE': '/staffing',
    'MANAGER': '/dashboard',
    'ADMIN': '/dashboard'
};

// --- Types ---
type MetadataResponse = Partial<EntitiesState>;
type PlanningResponse = Partial<EntitiesContextType> & { allocations?: Allocation };

// --- Context Definitions ---
const EntitiesContext = createContext<EntitiesContextType | undefined>(undefined);
const AllocationsContext = createContext<AllocationsContextType | undefined>(undefined);
const AppStateContext = createContext<{ loading: boolean; fetchError: string | null } | undefined>(undefined);

const CatalogsContext = createContext<Pick<EntitiesContextType,
    'clients' | 'roles' | 'roleCostHistory' | 'rateCards' | 'rateCardEntries' | 'resources' | 'projects' | 'contracts' |
    'contractProjects' | 'contractManagers' | 'skills' | 'skillCategories' | 'skillMacroCategories' |
    'resourceSkills' | 'projectSkills' | 'addResource' | 'updateResource' | 'deleteResource' |
    'addProject' | 'updateProject' | 'deleteProject' | 'addClient' | 'updateClient' | 'deleteClient' |
    'addRole' | 'updateRole' | 'deleteRole' | 'addSkill' | 'updateSkill' | 'deleteSkill' |
    'addResourceSkill' | 'deleteResourceSkill' | 'addProjectSkill' | 'deleteProjectSkill' |
    'addContract' | 'updateContract' | 'deleteContract' | 'recalculateContractBacklog' |
    'addRateCard' | 'updateRateCard' | 'deleteRateCard' | 'upsertRateCardEntries' |
    'addSkillCategory' | 'updateSkillCategory' | 'deleteSkillCategory' |
    'addSkillMacro' | 'updateSkillMacro' | 'deleteSkillMacro' | 'getRoleCost' | 'getSellRate' | 'getResourceComputedSkills'
> | undefined>(undefined);

const PlanningContext = createContext<(Pick<EntitiesContextType,
    'assignments' | 'wbsTasks' | 'resourceRequests' | 'interviews' | 'planningSettings' |
    'leaveRequests' | 'companyCalendar' | 'addMultipleAssignments' | 'deleteAssignment' |
    'addResourceRequest' | 'updateResourceRequest' | 'deleteResourceRequest' |
    'addInterview' | 'updateInterview' | 'deleteInterview' |
    'addLeaveRequest' | 'updateLeaveRequest' | 'deleteLeaveRequest' | 'updatePlanningSettings' | 'getBestFitResources'
> & AllocationsContextType) | undefined>(undefined);

const ConfigContext = createContext<Pick<EntitiesContextType,
    'horizontals' | 'seniorityLevels' | 'projectStatuses' | 'clientSectors' | 'locations' | 'leaveTypes' |
    'pageVisibility' | 'skillThresholds' | 'sidebarConfig' | 'sidebarSections' | 'sidebarSectionColors' | 'sidebarFooterActions' |
    'dashboardLayout' | 'roleHomePages' | 'bottomNavPaths' | 'addConfigOption' | 'updateConfigOption' | 'deleteConfigOption' |
    'addLeaveType' | 'updateLeaveType' | 'deleteLeaveType' | 'updatePageVisibility' | 'updateSkillThresholds' |
    'updateSidebarConfig' | 'updateSidebarSections' | 'updateSidebarSectionColors' | 'updateSidebarFooterActions' |
    'updateDashboardLayout' | 'updateRoleHomePages' | 'updateBottomNavPaths'
> | undefined>(undefined);

const NotificationsContext = createContext<Pick<EntitiesContextType,
    'notifications' | 'fetchNotifications' | 'markNotificationAsRead'
> | undefined>(undefined);

// --- Sub-Providers ---
const CatalogsProvider: React.FC<{children: ReactNode}> = ({ children }) => {
    const entities = useContext(EntitiesContext);
    if (!entities) throw new Error("CatalogsProvider must be used within AppProviders");
    
    const value = useMemo(() => ({
        clients: entities.clients,
        roles: entities.roles,
        roleCostHistory: entities.roleCostHistory,
        rateCards: entities.rateCards,
        rateCardEntries: entities.rateCardEntries,
        resources: entities.resources,
        projects: entities.projects,
        contracts: entities.contracts,
        contractProjects: entities.contractProjects,
        contractManagers: entities.contractManagers,
        skills: entities.skills,
        skillCategories: entities.skillCategories,
        skillMacroCategories: entities.skillMacroCategories,
        resourceSkills: entities.resourceSkills,
        projectSkills: entities.projectSkills,
        addResource: entities.addResource,
        updateResource: entities.updateResource,
        deleteResource: entities.deleteResource,
        addProject: entities.addProject,
        updateProject: entities.updateProject,
        deleteProject: entities.deleteProject,
        addClient: entities.addClient,
        updateClient: entities.updateClient,
        deleteClient: entities.deleteClient,
        addRole: entities.addRole,
        updateRole: entities.updateRole,
        deleteRole: entities.deleteRole,
        addSkill: entities.addSkill,
        updateSkill: entities.updateSkill,
        deleteSkill: entities.deleteSkill,
        addResourceSkill: entities.addResourceSkill,
        deleteResourceSkill: entities.deleteResourceSkill,
        addProjectSkill: entities.addProjectSkill,
        deleteProjectSkill: entities.deleteProjectSkill,
        addContract: entities.addContract,
        updateContract: entities.updateContract,
        deleteContract: entities.deleteContract,
        recalculateContractBacklog: entities.recalculateContractBacklog,
        addRateCard: entities.addRateCard,
        updateRateCard: entities.updateRateCard,
        deleteRateCard: entities.deleteRateCard,
        upsertRateCardEntries: entities.upsertRateCardEntries,
        addSkillCategory: entities.addSkillCategory,
        updateSkillCategory: entities.updateSkillCategory,
        deleteSkillCategory: entities.deleteSkillCategory,
        addSkillMacro: entities.addSkillMacro,
        updateSkillMacro: entities.updateSkillMacro,
        deleteSkillMacro: entities.deleteSkillMacro,
        getRoleCost: entities.getRoleCost,
        getSellRate: entities.getSellRate,
        getResourceComputedSkills: entities.getResourceComputedSkills
    }), [entities]);

    return <CatalogsContext.Provider value={value}>{children}</CatalogsContext.Provider>;
};

const PlanningProvider: React.FC<{children: ReactNode}> = ({ children }) => {
    const entities = useContext(EntitiesContext);
    const allocationsCtx = useContext(AllocationsContext);
    if (!entities || !allocationsCtx) throw new Error("PlanningProvider must be used within AppProviders");

    const value = useMemo(() => ({
        assignments: entities.assignments,
        wbsTasks: entities.wbsTasks,
        resourceRequests: entities.resourceRequests,
        interviews: entities.interviews,
        planningSettings: entities.planningSettings,
        leaveRequests: entities.leaveRequests,
        companyCalendar: entities.companyCalendar,
        addMultipleAssignments: entities.addMultipleAssignments,
        deleteAssignment: entities.deleteAssignment,
        addResourceRequest: entities.addResourceRequest,
        updateResourceRequest: entities.updateResourceRequest,
        deleteResourceRequest: entities.deleteResourceRequest,
        addInterview: entities.addInterview,
        updateInterview: entities.updateInterview,
        deleteInterview: entities.deleteInterview,
        addLeaveRequest: entities.addLeaveRequest,
        updateLeaveRequest: entities.updateLeaveRequest,
        deleteLeaveRequest: entities.deleteLeaveRequest,
        updatePlanningSettings: entities.updatePlanningSettings,
        allocations: allocationsCtx.allocations,
        updateAllocation: allocationsCtx.updateAllocation,
        bulkUpdateAllocations: allocationsCtx.bulkUpdateAllocations,
        getBestFitResources: entities.getBestFitResources
    }), [entities, allocationsCtx]);

    return <PlanningContext.Provider value={value}>{children}</PlanningContext.Provider>;
};

const ConfigProvider: React.FC<{children: ReactNode}> = ({ children }) => {
    const entities = useContext(EntitiesContext);
    if (!entities) throw new Error("ConfigProvider must be used within AppProviders");

    const value = useMemo(() => ({
        horizontals: entities.horizontals,
        seniorityLevels: entities.seniorityLevels,
        projectStatuses: entities.projectStatuses,
        clientSectors: entities.clientSectors,
        locations: entities.locations,
        leaveTypes: entities.leaveTypes,
        pageVisibility: entities.pageVisibility,
        skillThresholds: entities.skillThresholds,
        sidebarConfig: entities.sidebarConfig,
        sidebarSections: entities.sidebarSections,
        sidebarSectionColors: entities.sidebarSectionColors,
        sidebarFooterActions: entities.sidebarFooterActions,
        dashboardLayout: entities.dashboardLayout,
        roleHomePages: entities.roleHomePages,
        bottomNavPaths: entities.bottomNavPaths,
        addConfigOption: entities.addConfigOption,
        updateConfigOption: entities.updateConfigOption,
        deleteConfigOption: entities.deleteConfigOption,
        addLeaveType: entities.addLeaveType,
        updateLeaveType: entities.updateLeaveType,
        deleteLeaveType: entities.deleteLeaveType,
        updatePageVisibility: entities.updatePageVisibility,
        updateSkillThresholds: entities.updateSkillThresholds,
        updateSidebarConfig: entities.updateSidebarConfig,
        updateSidebarSections: entities.updateSidebarSections,
        updateSidebarSectionColors: entities.updateSidebarSectionColors,
        updateSidebarFooterActions: entities.updateSidebarFooterActions,
        updateDashboardLayout: entities.updateDashboardLayout,
        updateRoleHomePages: entities.updateRoleHomePages,
        updateBottomNavPaths: entities.updateBottomNavPaths
    }), [entities]);

    return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
};

const NotificationsProvider: React.FC<{children: ReactNode}> = ({ children }) => {
    const entities = useContext(EntitiesContext);
    if (!entities) throw new Error("NotificationsProvider must be used within AppProviders");

    const value = useMemo(() => ({
        notifications: entities.notifications,
        fetchNotifications: entities.fetchNotifications,
        markNotificationAsRead: entities.markNotificationAsRead
    }), [entities]);

    return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};


export interface AppProvidersProps {
    children: ReactNode;
    planningWindow?: { monthsBefore?: number; monthsAfter?: number };
    configKeys?: {
        sidebarLayoutKey?: string;
        sidebarSectionsKey?: string;
        sidebarSectionColorsKey?: string;
        sidebarFooterActionsKey?: string;
        dashboardLayoutKey?: string;
        roleHomePagesKey?: string;
        bottomNavPathsKey?: string;
    };
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children, planningWindow, configKeys }) => {
    // FIX: Destructure primitives to avoid re-creating object on every render
    const planningMonthsBefore = planningWindow?.monthsBefore ?? 6;
    const planningMonthsAfter = planningWindow?.monthsAfter ?? 18;

    const resolvedConfigKeys = {
        sidebarLayoutKey: configKeys?.sidebarLayoutKey ?? 'sidebar_layout_v1',
        sidebarSectionsKey: configKeys?.sidebarSectionsKey ?? 'sidebar_sections_v1',
        sidebarSectionColorsKey: configKeys?.sidebarSectionColorsKey ?? 'sidebar_section_colors',
        sidebarFooterActionsKey: configKeys?.sidebarFooterActionsKey ?? 'sidebar_footer_actions_v1',
        dashboardLayoutKey: configKeys?.dashboardLayoutKey ?? 'dashboard_layout_v2',
        roleHomePagesKey: configKeys?.roleHomePagesKey ?? 'role_home_pages_v1',
        bottomNavPathsKey: configKeys?.bottomNavPathsKey ?? 'bottom_nav_paths_v1'
    };

    const [loading, setLoading] = useState(true);
    const [actionLoadingState, setActionLoadingState] = useState<Record<string, boolean>>({});
    const { addToast } = useToast();

    // Data States
    const [clients, setClients] = useState<Client[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [roleCostHistory, setRoleCostHistory] = useState<RoleCostHistory[]>([]);
    const [rateCards, setRateCards] = useState<RateCard[]>([]);
    const [rateCardEntries, setRateCardEntries] = useState<RateCardEntry[]>([]);
    const [projectExpenses, setProjectExpenses] = useState<ProjectExpense[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [contractProjects, setContractProjects] = useState<ContractProject[]>([]);
    const [contractManagers, setContractManagers] = useState<ContractManager[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [allocations, setAllocations] = useState<Allocation>({});
    const [horizontals, setHorizontals] = useState<ConfigOption[]>([]);
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
    const [sidebarSections, setSidebarSections] = useState<string[]>(DEFAULT_SIDEBAR_SECTIONS);
    const [sidebarSectionColors, setSidebarSectionColors] = useState<SidebarSectionColors>({});
    const [sidebarFooterActions, setSidebarFooterActions] = useState<SidebarFooterAction[]>(DEFAULT_SIDEBAR_FOOTER_ACTIONS);
    const [dashboardLayout, setDashboardLayout] = useState<DashboardCategory[]>(DEFAULT_DASHBOARD_LAYOUT);
    const [roleHomePages, setRoleHomePages] = useState<Record<string, string>>(DEFAULT_ROLE_HOME_PAGES);
    const [bottomNavPaths, setBottomNavPaths] = useState<string[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [analyticsCache, setAnalyticsCache] = useState<Record<string, unknown>>({});
    const [fetchError, setFetchError] = useState<string | null>(null);

    // FIX: Memoize helpers to prevent context instability
    const setActionLoading = useCallback((action: string, isLoading: boolean) => {
        setActionLoadingState(prev => ({ ...prev, [action]: isLoading }));
    }, []);

    const isActionLoading = useCallback((action: string) => !!actionLoadingState[action], [actionLoadingState]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            // 1. Metadata
            const metaData = await apiFetch<MetadataResponse>('/api/data?scope=metadata');
            setClients(metaData.clients || []);
            setRoles(metaData.roles || []);
            setRoleCostHistory(metaData.roleCostHistory || []);
            setResources(metaData.resources || []);
            setProjects(metaData.projects || []);
            setHorizontals(metaData.horizontals || []);
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
            
            const rateCardsRes = await apiFetch<RateCard[]>('/api/resources?entity=rate_cards');
            setRateCards(rateCardsRes || []);
            const rateCardEntriesRes = await apiFetch<RateCardEntry[]>('/api/resources?entity=rate_card_entries');
            setRateCardEntries(rateCardEntriesRes || []);
            
            const projectExpensesRes = await apiFetch<ProjectExpense[]>('/api/resources?entity=project_expenses');
            setProjectExpenses(projectExpensesRes || []);
            
            if (metaData.skillThresholds) setSkillThresholds(prev => ({ ...prev, ...metaData.skillThresholds }));
            
            if (metaData.sidebarConfig) setSidebarConfig(metaData.sidebarConfig);
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

            const planningData = await apiFetch<PlanningResponse>(`/api/data?scope=planning&start=${startStr}&end=${endStr}`);
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
        } catch (error) {
            console.error("Failed to fetch notifications", error);
        }
    }, []);

    const markNotificationAsRead = useCallback(async (id?: string) => {
        try {
            const url = id 
                ? `/api/resources?entity=notifications&action=mark_read&id=${id}`
                : `/api/resources?entity=notifications&action=mark_read`;
            
            await apiFetch(url, { method: 'PUT' });
            
            setNotifications(prev => prev.map(n => {
                if (id) {
                    return n.id === id ? { ...n, isRead: true } : n;
                }
                return { ...n, isRead: true };
            }));
        } catch (error) {
            console.error("Failed to mark notification as read", error);
        }
    }, []);

    useEffect(() => {
        fetchData();
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, [fetchData, fetchNotifications]);

    // Actions implementation
    const forceRecalculateAnalytics = async () => {
        setActionLoading('recalculateAnalytics', true);
        try {
            const res = await apiFetch<{ data: Record<string, unknown> }>(
                '/api/resources?entity=analytics_cache&action=recalc_all',
                { method: 'POST' }
            );
            setAnalyticsCache(res.data);
            addToast('Analisi ricalcolate con successo', 'success');
        } catch (e) {
            addToast('Errore nel ricalcolo', 'error');
        } finally {
            setActionLoading('recalculateAnalytics', false);
        }
    };
    
    // CRUD Functions (no change in logic, just ensuring they use stable setActionLoading)
    const addResource = async (resource: Omit<Resource, 'id'>) => { setActionLoading('addResource', true); try { const newResource = await apiFetch<Resource>('/api/resources?entity=resources', { method: 'POST', body: JSON.stringify(resource) }); setResources(prev => [...prev, newResource]); return newResource; } finally { setActionLoading('addResource', false); } };
    const updateResource = async (resource: Resource) => { setActionLoading(`updateResource-${resource.id}`, true); try { const updated = await apiFetch<Resource>(`/api/resources?entity=resources&id=${resource.id}`, { method: 'PUT', body: JSON.stringify(resource) }); setResources(prev => prev.map(r => r.id === resource.id ? updated : r)); } finally { setActionLoading(`updateResource-${resource.id}`, false); } };
    const deleteResource = async (id: string) => { setActionLoading(`deleteResource-${id}`, true); try { await apiFetch(`/api/resources?entity=resources&id=${id}`, { method: 'DELETE' }); setResources(prev => prev.filter(r => r.id !== id)); } finally { setActionLoading(`deleteResource-${id}`, false); } };
    
    const addProject = async (project: Omit<Project, 'id'>) => { setActionLoading('addProject', true); try { const newProject = await apiFetch<Project | null>('/api/resources?entity=projects', { method: 'POST', body: JSON.stringify(project) }); setProjects(prev => [...prev, newProject]); return newProject; } finally { setActionLoading('addProject', false); } };
    const updateProject = async (project: Project) => { setActionLoading(`updateProject-${project.id}`, true); try { const updated = await apiFetch<Project>(`/api/resources?entity=projects&id=${project.id}`, { method: 'PUT', body: JSON.stringify(project) }); setProjects(prev => prev.map(p => p.id === project.id ? updated : p)); } finally { setActionLoading(`updateProject-${project.id}`, false); } };
    const deleteProject = async (id: string) => { setActionLoading(`deleteProject-${id}`, true); try { await apiFetch(`/api/resources?entity=projects&id=${id}`, { method: 'DELETE' }); setProjects(prev => prev.filter(p => p.id !== id)); } finally { setActionLoading(`deleteProject-${id}`, false); } };
    
    const addClient = async (client: Omit<Client, 'id'>) => { setActionLoading('addClient', true); try { const newClient = await apiFetch<Client>('/api/resources?entity=clients', { method: 'POST', body: JSON.stringify(client) }); setClients(prev => [...prev, newClient]); } finally { setActionLoading('addClient', false); } };
    const updateClient = async (client: Client) => { setActionLoading(`updateClient-${client.id}`, true); try { const updated = await apiFetch<Client>(`/api/resources?entity=clients&id=${client.id}`, { method: 'PUT', body: JSON.stringify(client) }); setClients(prev => prev.map(c => c.id === client.id ? updated : c)); } finally { setActionLoading(`updateClient-${client.id}`, false); } };
    const deleteClient = async (id: string) => { setActionLoading(`deleteClient-${id}`, true); try { await apiFetch(`/api/resources?entity=clients&id=${id}`, { method: 'DELETE' }); setClients(prev => prev.filter(c => c.id !== id)); } finally { setActionLoading(`deleteClient-${id}`, false); } };
    
    const addRole = async (role: Omit<Role, 'id'>) => { setActionLoading('addRole', true); try { const newRole = await apiFetch<Role>('/api/resources?entity=roles', { method: 'POST', body: JSON.stringify(role) }); setRoles(prev => [...prev, newRole]); } finally { setActionLoading('addRole', false); } };
    const updateRole = async (role: Role) => { setActionLoading(`updateRole-${role.id}`, true); try { const updated = await apiFetch<Role>(`/api/resources?entity=roles&id=${role.id}`, { method: 'PUT', body: JSON.stringify(role) }); setRoles(prev => prev.map(r => r.id === role.id ? updated : r)); const historyRes = await apiFetch<RoleCostHistory[]>('/api/resources?entity=role_cost_history'); setRoleCostHistory(historyRes); } finally { setActionLoading(`updateRole-${role.id}`, false); } };
    const deleteRole = async (id: string) => { setActionLoading(`deleteRole-${id}`, true); try { await apiFetch(`/api/resources?entity=roles&id=${id}`, { method: 'DELETE' }); setRoles(prev => prev.filter(r => r.id !== id)); } finally { setActionLoading(`deleteRole-${id}`, false); } };
    
    const addRateCard = async (rateCard: Omit<RateCard, 'id'>) => { setActionLoading('addRateCard', true); try { const newRateCard = await apiFetch<RateCard>('/api/resources?entity=rate_cards', { method: 'POST', body: JSON.stringify(rateCard) }); setRateCards(prev => [...prev, newRateCard]); } finally { setActionLoading('addRateCard', false); } };
    const updateRateCard = async (rateCard: RateCard) => { setActionLoading(`updateRateCard-${rateCard.id}`, true); try { const updated = await apiFetch<RateCard>(`/api/resources?entity=rate_cards&id=${rateCard.id}`, { method: 'PUT', body: JSON.stringify(rateCard) }); setRateCards(prev => prev.map(rc => rc.id === rateCard.id ? updated : rc)); } finally { setActionLoading(`updateRateCard-${rateCard.id}`, false); } };
    const deleteRateCard = async (id: string) => { setActionLoading(`deleteRateCard-${id}`, true); try { await apiFetch(`/api/resources?entity=rate_cards&id=${id}`, { method: 'DELETE' }); setRateCards(prev => prev.filter(rc => rc.id !== id)); setRateCardEntries(prev => prev.filter(e => e.rateCardId !== id)); } finally { setActionLoading(`deleteRateCard-${id}`, false); } };
    const upsertRateCardEntries = async (entries: RateCardEntry[]) => { if (entries.length === 0) return; setActionLoading('upsertRateCardEntries', true); try { await apiFetch('/api/resources?entity=rate_card_entries', { method: 'POST', body: JSON.stringify({ entries }) }); const entriesRes = await apiFetch<RateCardEntry[]>('/api/resources?entity=rate_card_entries'); setRateCardEntries(entriesRes || []); } finally { setActionLoading('upsertRateCardEntries', false); } };
    
    const addProjectExpense = async (expense: Omit<ProjectExpense, 'id'>) => { setActionLoading('addProjectExpense', true); try { const newExpense = await apiFetch<ProjectExpense>('/api/resources?entity=project_expenses', { method: 'POST', body: JSON.stringify(expense) }); setProjectExpenses(prev => [...prev, newExpense]); } finally { setActionLoading('addProjectExpense', false); } };
    const updateProjectExpense = async (expense: ProjectExpense) => { setActionLoading(`updateProjectExpense-${expense.id}`, true); try { const updated = await apiFetch<ProjectExpense>(`/api/resources?entity=project_expenses&id=${expense.id}`, { method: 'PUT', body: JSON.stringify(expense) }); setProjectExpenses(prev => prev.map(e => e.id === expense.id ? updated : e)); } finally { setActionLoading(`updateProjectExpense-${expense.id}`, false); } };
    const deleteProjectExpense = async (id: string) => { setActionLoading(`deleteProjectExpense-${id}`, true); try { await apiFetch(`/api/resources?entity=project_expenses&id=${id}`, { method: 'DELETE' }); setProjectExpenses(prev => prev.filter(e => e.id !== id)); } finally { setActionLoading(`deleteProjectExpense-${id}`, false); } };
    
    const addConfigOption = async (type: string, value: string) => { setActionLoading(`addConfig-${type}`, true); try { const newOpt = await apiFetch<ConfigOption>(`/api/config?type=${type}`, { method: 'POST', body: JSON.stringify({ value }) }); const setter = type === 'horizontals' ? setHorizontals : type === 'seniorityLevels' ? setSeniorityLevels : type === 'projectStatuses' ? setProjectStatuses : type === 'clientSectors' ? setClientSectors : setLocations; setter(prev => [...prev, newOpt]); } finally { setActionLoading(`addConfig-${type}`, false); } };
    const updateConfigOption = async (type: string, option: ConfigOption) => { setActionLoading(`updateConfig-${type}-${option.id}`, true); try { await apiFetch(`/api/config?type=${type}&id=${option.id}`, { method: 'PUT', body: JSON.stringify({ value: option.value }) }); const setter = type === 'horizontals' ? setHorizontals : type === 'seniorityLevels' ? setSeniorityLevels : type === 'projectStatuses' ? setProjectStatuses : type === 'clientSectors' ? setClientSectors : setLocations; setter(prev => prev.map(o => o.id === option.id ? option : o)); } finally { setActionLoading(`updateConfig-${type}-${option.id}`, false); } };
    const deleteConfigOption = async (type: string, id: string) => { setActionLoading(`deleteConfig-${type}-${id}`, true); try { await apiFetch(`/api/config?type=${type}&id=${id}`, { method: 'DELETE' }); const setter = type === 'horizontals' ? setHorizontals : type === 'seniorityLevels' ? setSeniorityLevels : type === 'projectStatuses' ? setProjectStatuses : type === 'clientSectors' ? setClientSectors : setLocations; setter(prev => prev.filter(o => o.id !== id)); addToast('Opzione eliminata con successo', 'success'); } catch (error) { console.error("Failed to delete config option:", error); addToast((error as Error).message || 'Errore durante l\'eliminazione', 'error'); } finally { setActionLoading(`deleteConfig-${type}-${id}`, false); } };
    
    const addCalendarEvent = async (event: Omit<CalendarEvent, 'id'>) => { setActionLoading('addCalendarEvent', true); try { const newEvent = await apiFetch<CalendarEvent>('/api/resources?entity=company_calendar', { method: 'POST', body: JSON.stringify(event) }); setCompanyCalendar(prev => [...prev, newEvent]); } finally { setActionLoading('addCalendarEvent', false); } };
    const updateCalendarEvent = async (event: CalendarEvent) => { setActionLoading(`updateCalendarEvent-${event.id}`, true); try { const updated = await apiFetch<CalendarEvent>(`/api/resources?entity=company_calendar&id=${event.id}`, { method: 'PUT', body: JSON.stringify(event) }); setCompanyCalendar(prev => prev.map(e => e.id === event.id ? updated : e)); } finally { setActionLoading(`updateCalendarEvent-${event.id}`, false); } };
    const deleteCalendarEvent = async (id: string) => { setActionLoading(`deleteCalendarEvent-${id}`, true); try { await apiFetch(`/api/resources?entity=company_calendar&id=${id}`, { method: 'DELETE' }); setCompanyCalendar(prev => prev.filter(e => e.id !== id)); } finally { setActionLoading(`deleteCalendarEvent-${id}`, false); } };
    
    const addMultipleAssignments = async (newAssignments: { resourceId: string; projectId: string }[]) => { try { const createdAssignments = await Promise.all(newAssignments.map(async (a) => { return await apiFetch<Assignment | { message: string }>('/api/assignments', { method: 'POST', body: JSON.stringify(a) }); })); const validAssignments = createdAssignments.filter((a): a is Assignment => !('message' in a)); const newAss = validAssignments.map(a => ({ id: a.id, resourceId: a.resourceId, projectId: a.projectId })); setAssignments(prev => { const existingIds = new Set(prev.map(p => p.id)); const uniqueNew = newAss.filter(a => !existingIds.has(a.id)); return [...prev, ...uniqueNew]; }); if (validAssignments.length < newAssignments.length) { addToast('Alcune assegnazioni esistevano già.', 'error'); } else { addToast('Assegnazioni create con successo.', 'success'); } } catch (error) { addToast('Errore durante la creazione delle assegnazioni.', 'error'); } };
    const deleteAssignment = async (id: string) => { setActionLoading(`deleteAssignment-${id}`, true); try { await apiFetch(`/api/assignments?id=${id}`, { method: 'DELETE' }); setAssignments(prev => prev.filter(a => a.id !== id)); setAllocations(prev => { const newAllocations = { ...prev }; delete newAllocations[id]; return newAllocations; }); } finally { setActionLoading(`deleteAssignment-${id}`, false); } };
    
    // Updated Logic: Check Resource Specific Cost First
    const getRoleCost = (roleId: string, date: Date, resourceId?: string): number => { 
        if (resourceId) {
            const resource = resources.find(r => r.id === resourceId);
            if (resource && resource.dailyCost && Number(resource.dailyCost) > 0) {
                return Number(resource.dailyCost);
            }
        }
        
        const dateStr = date.toISOString().split('T')[0]; 
        const historicRecord = roleCostHistory.find(h => { if (h.roleId !== roleId) return false; return dateStr >= h.startDate && (!h.endDate || dateStr <= h.endDate); }); 
        if (historicRecord) return Number(historicRecord.dailyCost); 
        const role = roles.find(r => r.id === roleId); 
        return role ? Number(role.dailyCost) : 0; 
    };

    // Updated Logic: Check Rate Card by Resource ID
    const getSellRate = (rateCardId: string | null | undefined, resourceId: string): number => { 
        if (!rateCardId) return 0; 
        const entry = rateCardEntries.find(e => e.rateCardId === rateCardId && e.resourceId === resourceId); 
        return entry ? Number(entry.dailyRate) : 0; 
    };
    
    const getBestFitResources = useCallback(async (params: { startDate: string; endDate: string; roleId: string; projectId: string; commitmentPercentage: number }) => {
        setActionLoading('getBestFitResources', true);
        try {
            const results = await apiFetch<any[]>('/api/resources?entity=resources&action=best_fit', {
                method: 'POST',
                body: JSON.stringify(params)
            });
            return results;
        } catch (error) {
            addToast('Errore durante la ricerca dei candidati.', 'error');
            return [];
        } finally {
            setActionLoading('getBestFitResources', false);
        }
    }, [addToast, setActionLoading]);

    const updateAllocation = useCallback(async (assignmentId: string, date: string, percentage: number) => { try { setAllocations(prev => ({ ...prev, [assignmentId]: { ...prev[assignmentId], [date]: percentage } })); await apiFetch('/api/allocations', { method: 'POST', body: JSON.stringify({ updates: [{ assignmentId, date, percentage }] }) }); } catch (error) { console.error("Failed to update allocation", error); fetchData(); } }, [fetchData]);
    const bulkUpdateAllocations = useCallback(async (assignmentId: string, startDate: string, endDate: string, percentage: number) => { try { const start = new Date(startDate); const end = new Date(endDate); const updates = []; const currentDate = new Date(start); while (currentDate.getTime() <= end.getTime()) { const day = currentDate.getUTCDay(); if (day !== 0 && day !== 6) { const dateStr = currentDate.toISOString().split('T')[0]; updates.push({ assignmentId, date: dateStr, percentage }); } currentDate.setUTCDate(currentDate.getUTCDate() + 1); } setAllocations(prev => { const newAllocations = { ...prev }; if (!newAllocations[assignmentId]) newAllocations[assignmentId] = {}; updates.forEach(u => { newAllocations[assignmentId][u.date] = u.percentage; }); return newAllocations; }); await apiFetch('/api/allocations', { method: 'POST', body: JSON.stringify({ updates }) }); addToast('Allocazioni aggiornate con successo.', 'success'); } catch (error) { console.error("Failed to bulk update allocations", error); addToast('Errore aggiornamento allocazioni', 'error'); fetchData(); } }, [fetchData, addToast]);
    
    const addResourceRequest = async (req: Omit<ResourceRequest, 'id'>) => { setActionLoading('addResourceRequest', true); try { const newReq = await apiFetch<ResourceRequest>('/api/resource-requests', { method: 'POST', body: JSON.stringify(req) }); setResourceRequests(prev => [...prev, newReq]); } finally { setActionLoading('addResourceRequest', false); } };
    const updateResourceRequest = async (req: ResourceRequest) => { setActionLoading(`updateResourceRequest-${req.id}`, true); try { const updated = await apiFetch<ResourceRequest>(`/api/resource-requests?id=${req.id}`, { method: 'PUT', body: JSON.stringify(req) }); setResourceRequests(prev => prev.map(r => r.id === req.id ? updated : r)); } finally { setActionLoading(`updateResourceRequest-${req.id}`, false); } };
    const deleteResourceRequest = async (id: string) => { setActionLoading(`deleteResourceRequest-${id}`, true); try { await apiFetch(`/api/resource-requests?id=${id}`, { method: 'DELETE' }); setResourceRequests(prev => prev.filter(r => r.id !== id)); } finally { setActionLoading(`deleteResourceRequest-${id}`, false); } };
    
    const addInterview = async (interview: Omit<Interview, 'id'>) => { setActionLoading('addInterview', true); try { const newInt = await apiFetch<Interview>('/api/resources?entity=interviews', { method: 'POST', body: JSON.stringify(interview) }); setInterviews(prev => [...prev, newInt]); } finally { setActionLoading('addInterview', false); } };
    const updateInterview = async (interview: Interview) => { setActionLoading(`updateInterview-${interview.id}`, true); try { const updated = await apiFetch<Interview>(`/api/resources?entity=interviews&id=${interview.id}`, { method: 'PUT', body: JSON.stringify(interview) }); setInterviews(prev => prev.map(i => i.id === interview.id ? updated : i)); } finally { setActionLoading(`updateInterview-${interview.id}`, false); } };
    const deleteInterview = async (id: string) => { setActionLoading(`deleteInterview-${id}`, true); try { await apiFetch(`/api/resources?entity=interviews&id=${id}`, { method: 'DELETE' }); setInterviews(prev => prev.filter(i => i.id !== id)); } finally { setActionLoading(`deleteInterview-${id}`, false); } };
    
    const addContract = async (contract: Omit<Contract, 'id'>, projectIds: string[], managerIds: string[]) => { setActionLoading('addContract', true); try { const newContract = await apiFetch<Contract>('/api/resources?entity=contracts', { method: 'POST', body: JSON.stringify(contract) }); const linkPromises = [ ...projectIds.map(pid => apiFetch('/api/resources?entity=contract_projects', { method: 'POST', body: JSON.stringify({ contractId: newContract.id, projectId: pid }) })), ...managerIds.map(mid => apiFetch('/api/resources?entity=contract_managers', { method: 'POST', body: JSON.stringify({ contractId: newContract.id, resourceId: mid }) })) ]; await Promise.all(linkPromises); await fetchData(); addToast('Contratto creato con successo', 'success'); } catch (e) { addToast('Errore durante la creazione del contratto', 'error'); } finally { setActionLoading('addContract', false); } };
    const updateContract = async (contract: Contract, projectIds: string[], managerIds: string[]) => { setActionLoading(`updateContract-${contract.id}`, true); try { await apiFetch<Contract>(`/api/resources?entity=contracts&id=${contract.id}`, { method: 'PUT', body: JSON.stringify(contract) }); const linkPromises = [ ...projectIds.map(pid => apiFetch('/api/resources?entity=contract_projects', { method: 'POST', body: JSON.stringify({ contractId: contract.id, projectId: pid }) })), ...managerIds.map(mid => apiFetch('/api/resources?entity=contract_managers', { method: 'POST', body: JSON.stringify({ contractId: contract.id, resourceId: mid }) })) ]; await Promise.all(linkPromises); await fetchData(); addToast('Contratto aggiornato con successo', 'success'); } catch (e) { addToast('Errore durante l\'aggiornamento del contratto', 'error'); } finally { setActionLoading(`updateContract-${contract.id}`, false); } };
    const deleteContract = async (id: string) => { setActionLoading(`deleteContract-${id}`, true); try { await apiFetch(`/api/resources?entity=contracts&id=${id}`, { method: 'DELETE' }); setContracts(prev => prev.filter(c => c.id !== id)); addToast('Contratto eliminato', 'success'); } finally { setActionLoading(`deleteContract-${id}`, false); } };
    const recalculateContractBacklog = async (id: string) => { setActionLoading(`recalculateBacklog-${id}`, true); try { const contract = contracts.find(c => c.id === id); if (!contract) return; const linkedProjects = contractProjects.filter(cp => cp.contractId === id).map(cp => cp.projectId); const usedBudget = projects.filter(p => linkedProjects.includes(p.id!)).reduce((sum, p) => sum + Number(p.budget || 0), 0); const newBacklog = Number(contract.capienza) - usedBudget; await updateContract({ ...contract, backlog: newBacklog }, linkedProjects, []); } finally { setActionLoading(`recalculateBacklog-${id}`, false); } };
    
    const addSkill = async (skill: Omit<Skill, 'id'>) => { setActionLoading('addSkill', true); try { const newSkill = await apiFetch<Skill>('/api/resources?entity=skills', { method: 'POST', body: JSON.stringify(skill) }); setSkills(prev => [...prev, newSkill]); await fetchData(); } finally { setActionLoading('addSkill', false); } };
    const updateSkill = async (skill: Skill) => { setActionLoading(`updateSkill-${skill.id}`, true); try { await apiFetch<Skill>(`/api/resources?entity=skills&id=${skill.id}`, { method: 'PUT', body: JSON.stringify(skill) }); await fetchData(); } finally { setActionLoading(`updateSkill-${skill.id}`, false); } };
    const deleteSkill = async (id: string) => { setActionLoading(`deleteSkill-${id}`, true); try { await apiFetch(`/api/resources?entity=skills&id=${id}`, { method: 'DELETE' }); setSkills(prev => prev.filter(s => s.id !== id)); } finally { setActionLoading(`deleteSkill-${id}`, false); } };
    
    const addSkillCategory = async (cat: Omit<SkillCategory, 'id'>) => { try { await apiFetch<SkillCategory>('/api/resources?entity=skill_categories', { method: 'POST', body: JSON.stringify(cat) }); await fetchData(); } catch(e) { console.error(e); } };
    const updateSkillCategory = async (cat: SkillCategory) => { try { await apiFetch<SkillCategory>(`/api/resources?entity=skill_categories&id=${cat.id}`, { method: 'PUT', body: JSON.stringify(cat) }); await fetchData(); } catch(e) { console.error(e); } };
    const deleteSkillCategory = async (id: string) => { try { await apiFetch(`/api/resources?entity=skill_categories&id=${id}`, { method: 'DELETE' }); setSkillCategories(prev => prev.filter(c => c.id !== id)); } catch(e) { console.error(e); } };
    const addSkillMacro = async (macro: { name: string }) => { try { await apiFetch<SkillMacroCategory>('/api/resources?entity=skill_macro_categories', { method: 'POST', body: JSON.stringify(macro) }); await fetchData(); } catch(e) { console.error(e); } };
    const updateSkillMacro = async (id: string, name: string) => { try { await apiFetch<SkillMacroCategory>(`/api/resources?entity=skill_macro_categories&id=${id}`, { method: 'PUT', body: JSON.stringify({ name }) }); await fetchData(); } catch(e) { console.error(e); } };
    const deleteSkillMacro = async (id: string) => { try { await apiFetch(`/api/resources?entity=skill_macro_categories&id=${id}`, { method: 'DELETE' }); setSkillMacroCategories(prev => prev.filter(m => m.id !== id)); } catch(e) { console.error(e); } };
    
    const addResourceSkill = async (rs: ResourceSkill) => { setActionLoading(`addResourceSkill-${rs.resourceId}`, true); try { const savedSkill = await apiFetch<ResourceSkill>('/api/resources?entity=resource_skills', { method: 'POST', body: JSON.stringify(rs) }); setResourceSkills(prev => { const index = prev.findIndex(item => item.resourceId === rs.resourceId && item.skillId === rs.skillId); if (index >= 0) { const newSkills = [...prev]; newSkills[index] = savedSkill; return newSkills; } return [...prev, savedSkill]; }); } finally { setActionLoading(`addResourceSkill-${rs.resourceId}`, false); } };
    const deleteResourceSkill = async (resourceId: string, skillId: string) => { try { await apiFetch(`/api/resources?entity=resource_skills&resourceId=${resourceId}&skillId=${skillId}`, { method: 'DELETE' }); setResourceSkills(prev => prev.filter(rs => !(rs.resourceId === resourceId && rs.skillId === skillId))); } catch (e) { console.error(e); } };
    const addProjectSkill = async (ps: ProjectSkill) => { try { const savedPs = await apiFetch<ProjectSkill>('/api/resources?entity=project_skills', { method: 'POST', body: JSON.stringify(ps) }); setProjectSkills(prev => { const exists = prev.some(item => item.projectId === ps.projectId && item.skillId === ps.skillId); if (exists) return prev; return [...prev, savedPs]; }); } catch (e) { console.error(e); } };
    const deleteProjectSkill = async (projectId: string, skillId: string) => { try { await apiFetch(`/api/resources?entity=project_skills&projectId=${projectId}&skillId=${skillId}`, { method: 'DELETE' }); setProjectSkills(prev => prev.filter(ps => !(ps.projectId === projectId && ps.skillId === skillId))); } catch (e) { console.error(e); } };
    
    const updateSkillThresholds = async (thresholds: SkillThresholds) => { setActionLoading('updateSkillThresholds', true); try { const updates = Object.entries(thresholds).map(([key, value]) => ({ key: `skill_threshold.${key}`, value: String(value) })); await apiFetch('/api/resources?entity=app-config-batch', { method: 'POST', body: JSON.stringify({ updates }) }); setSkillThresholds(thresholds); addToast('Soglie aggiornate', 'success'); } catch (e) { console.error(e); } finally { setActionLoading('updateSkillThresholds', false); } };
    const updatePlanningSettings = async (settings: { monthsBefore: number; monthsAfter: number }) => { setActionLoading('updatePlanningSettings', true); try { const updates = [ { key: 'planning_range_months_before', value: String(settings.monthsBefore) }, { key: 'planning_range_months_after', value: String(settings.monthsAfter) } ]; await apiFetch('/api/resources?entity=app-config-batch', { method: 'POST', body: JSON.stringify({ updates }) }); setPlanningSettings(settings); addToast('Range di planning aggiornato. Ricarica la pagina per vedere i dati completi.', 'success'); fetchData(); } catch (e) { console.error(e); } finally { setActionLoading('updatePlanningSettings', false); } };
    
    const getResourceComputedSkills = useCallback((resourceId: string) => { const manualSkills = resourceSkills.filter(rs => rs.resourceId === resourceId); const resourceAssignments = assignments.filter(a => a.resourceId === resourceId); const inferredSkillsMap = new Map<string, number>(); resourceAssignments.forEach(assignment => { const pSkills = projectSkills.filter(ps => ps.projectId === assignment.projectId); if (pSkills.length === 0) return; const assignmentAllocations = allocations[assignment.id!]; let days = 0; if (assignmentAllocations) { Object.values(assignmentAllocations).forEach((pct: any) => days += (pct / 100)); } pSkills.forEach(ps => { inferredSkillsMap.set(ps.skillId, (inferredSkillsMap.get(ps.skillId) || 0) + days); }); }); const allSkillIds = new Set([...manualSkills.map(ms => ms.skillId), ...inferredSkillsMap.keys()]); return Array.from(allSkillIds).map(skillId => { const skill = skills.find(s => s.id === skillId); if (!skill) return null; const manual = manualSkills.find(ms => ms.skillId === skillId); const inferredDays = inferredSkillsMap.get(skillId) || 0; let inferredLevel = 1; if (inferredDays >= skillThresholds.EXPERT) inferredLevel = 5; else if (inferredDays >= skillThresholds.SENIOR) inferredLevel = 4; else if (inferredDays >= skillThresholds.MIDDLE) inferredLevel = 3; else if (inferredDays >= skillThresholds.JUNIOR) inferredLevel = 2; return { skill, manualDetails: manual, inferredDays, inferredLevel, projectCount: 0 }; }).filter(Boolean) as any[]; }, [resourceSkills, assignments, projectSkills, allocations, skills, skillThresholds]);
    
    const addLeaveType = async (type: Omit<LeaveType, 'id'>) => { setActionLoading('addLeaveType', true); try { const newType = await apiFetch<LeaveType>('/api/resources?entity=leave_types', { method: 'POST', body: JSON.stringify(type) }); setLeaveTypes(prev => [...prev, newType]); } finally { setActionLoading('addLeaveType', false); } };
    const updateLeaveType = async (type: LeaveType) => { setActionLoading(`updateLeaveType-${type.id}`, true); try { const updated = await apiFetch<LeaveType>(`/api/resources?entity=leave_types&id=${type.id}`, { method: 'PUT', body: JSON.stringify(type) }); setLeaveTypes(prev => prev.map(t => t.id === type.id ? updated : t)); } finally { setActionLoading(`updateLeaveType-${type.id}`, false); } };
    const deleteLeaveType = async (id: string) => { setActionLoading(`deleteLeaveType-${id}`, true); try { await apiFetch(`/api/resources?entity=leave_types&id=${id}`, { method: 'DELETE' }); setLeaveTypes(prev => prev.filter(t => t.id !== id)); } finally { setActionLoading(`deleteLeaveType-${id}`, false); } };
    
    const addLeaveRequest = async (req: Omit<LeaveRequest, 'id'>) => { setActionLoading('addLeaveRequest', true); try { const newReq = await apiFetch<LeaveRequest>('/api/resources?entity=leaves', { method: 'POST', body: JSON.stringify(req) }); setLeaveRequests(prev => [...prev, newReq]); addToast('Richiesta inserita con successo', 'success'); } catch (e) { addToast('Errore inserimento richiesta', 'error'); } finally { setActionLoading('addLeaveRequest', false); } };
    const updateLeaveRequest = async (req: LeaveRequest) => { setActionLoading(`updateLeaveRequest`, true); try { const updated = await apiFetch<LeaveRequest>(`/api/resources?entity=leaves&id=${req.id}`, { method: 'PUT', body: JSON.stringify(req) }); setLeaveRequests(prev => prev.map(r => r.id === req.id ? updated : r)); addToast(`Richiesta aggiornata: ${req.status}`, 'success'); } catch (e) { addToast('Errore aggiornamento richiesta', 'error'); } finally { setActionLoading('updateLeaveRequest', false); } };
    const deleteLeaveRequest = async (id: string) => { setActionLoading(`deleteLeaveRequest-${id}`, true); try { await apiFetch(`/api/resources?entity=leaves&id=${id}`, { method: 'DELETE' }); setLeaveRequests(prev => prev.filter(r => r.id !== id)); addToast('Richiesta eliminata', 'success'); } finally { setActionLoading(`deleteLeaveRequest-${id}`, false); } };
    
    const updateSidebarConfig = async (config: SidebarItem[]) => { setActionLoading('updateSidebarConfig', true); try { await apiFetch('/api/resources?entity=app-config-batch', { method: 'POST', body: JSON.stringify({ updates: [{ key: resolvedConfigKeys.sidebarLayoutKey, value: JSON.stringify(config) }] }) }); setSidebarConfig(config); } finally { setActionLoading('updateSidebarConfig', false); } };
    const updateSidebarSections = async (sections: string[]) => { setActionLoading('updateSidebarSections', true); try { await apiFetch('/api/resources?entity=app-config-batch', { method: 'POST', body: JSON.stringify({ updates: [{ key: resolvedConfigKeys.sidebarSectionsKey, value: JSON.stringify(sections) }] }) }); setSidebarSections(sections); } finally { setActionLoading('updateSidebarSections', false); } };
    const updateSidebarSectionColors = async (colors: SidebarSectionColors) => { try { await apiFetch('/api/resources?entity=app-config-batch', { method: 'POST', body: JSON.stringify({ updates: [{ key: resolvedConfigKeys.sidebarSectionColorsKey, value: JSON.stringify(colors) }] }) }); setSidebarSectionColors(colors); } catch (e) { console.error(e); } };
    const updateSidebarFooterActions = async (actions: SidebarFooterAction[]) => { setActionLoading('updateSidebarFooterActions', true); try { await apiFetch('/api/resources?entity=app-config-batch', { method: 'POST', body: JSON.stringify({ updates: [{ key: resolvedConfigKeys.sidebarFooterActionsKey, value: JSON.stringify(actions) }] }) }); setSidebarFooterActions(actions); } finally { setActionLoading('updateSidebarFooterActions', false); } };
    const updatePageVisibility = async (visibility: PageVisibility) => { setActionLoading('updatePageVisibility', true); try { const updates = Object.entries(visibility).map(([path, onlyAdmin]) => ({ key: `page_vis.${path}`, value: String(onlyAdmin) })); await apiFetch('/api/resources?entity=app-config-batch', { method: 'POST', body: JSON.stringify({ updates }) }); setPageVisibility(visibility); } finally { setActionLoading('updatePageVisibility', false); } };
    const updateDashboardLayout = async (layout: DashboardCategory[]) => { setActionLoading('updateDashboardLayout', true); try { await apiFetch('/api/resources?entity=app-config-batch', { method: 'POST', body: JSON.stringify({ updates: [{ key: resolvedConfigKeys.dashboardLayoutKey, value: JSON.stringify(layout) }] }) }); setDashboardLayout(layout); } finally { setActionLoading('updateDashboardLayout', false); } };
    const updateRoleHomePages = async (config: Record<string, string>) => { setActionLoading('updateRoleHomePages', true); try { await apiFetch('/api/resources?entity=app-config-batch', { method: 'POST', body: JSON.stringify({ updates: [{ key: resolvedConfigKeys.roleHomePagesKey, value: JSON.stringify(config) }] }) }); setRoleHomePages(config); } finally { setActionLoading('updateRoleHomePages', false); } };
    const updateBottomNavPaths = async (paths: string[]) => { setActionLoading('updateBottomNavPaths', true); try { await apiFetch('/api/resources?entity=app-config-batch', { method: 'POST', body: JSON.stringify({ updates: [{ key: resolvedConfigKeys.bottomNavPathsKey, value: JSON.stringify(paths) }] }) }); setBottomNavPaths(paths); } finally { setActionLoading('updateBottomNavPaths', false); } };

    const providerValue = useMemo(() => ({
        clients, roles, roleCostHistory, rateCards, rateCardEntries, projectExpenses, resources, projects, contracts, contractProjects, contractManagers, 
        assignments, horizontals, seniorityLevels, projectStatuses, clientSectors, locations, companyCalendar,
        wbsTasks, resourceRequests, interviews, skills, skillCategories, skillMacroCategories, resourceSkills, projectSkills, pageVisibility, skillThresholds,
        planningSettings, leaveTypes, leaveRequests, managerResourceIds, sidebarConfig, sidebarSections, sidebarSectionColors, sidebarFooterActions, dashboardLayout, roleHomePages, bottomNavPaths,
        notifications, analyticsCache, loading, isActionLoading,
        fetchData, fetchNotifications, markNotificationAsRead,
        addResource, updateResource, deleteResource,
        addProject, updateProject, deleteProject,
        addClient, updateClient, deleteClient,
        addRole, updateRole, deleteRole,
        addRateCard, updateRateCard, deleteRateCard, upsertRateCardEntries,
        addProjectExpense, updateProjectExpense, deleteProjectExpense,
        addConfigOption, updateConfigOption, deleteConfigOption,
        addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
        addMultipleAssignments, deleteAssignment,
        getRoleCost, getSellRate,
        addResourceRequest, updateResourceRequest, deleteResourceRequest,
        addInterview, updateInterview, deleteInterview,
        addContract, updateContract, deleteContract, recalculateContractBacklog,
        addSkill, updateSkill, deleteSkill,
        addResourceSkill, deleteResourceSkill,
        addProjectSkill, deleteProjectSkill,
        updateSkillThresholds, updatePlanningSettings, getResourceComputedSkills,
        addLeaveType, updateLeaveType, deleteLeaveType,
        addLeaveRequest, updateLeaveRequest, deleteLeaveRequest,
        updatePageVisibility,
        updateSidebarConfig, updateSidebarSections, updateSidebarSectionColors, updateSidebarFooterActions, updateDashboardLayout, updateRoleHomePages, updateBottomNavPaths,
        forceRecalculateAnalytics,
        addSkillCategory, updateSkillCategory, deleteSkillCategory,
        addSkillMacro, updateSkillMacro, deleteSkillMacro,
        getBestFitResources
    }), [
        clients, roles, roleCostHistory, rateCards, rateCardEntries, projectExpenses, resources, projects, contracts, contractProjects, contractManagers,
        assignments, horizontals, seniorityLevels, projectStatuses, clientSectors, locations, companyCalendar,
        wbsTasks, resourceRequests, interviews, skills, skillCategories, skillMacroCategories, resourceSkills, projectSkills, pageVisibility, skillThresholds,
        planningSettings, leaveTypes, leaveRequests, managerResourceIds, sidebarConfig, sidebarSections, sidebarSectionColors, sidebarFooterActions, dashboardLayout, roleHomePages, bottomNavPaths,
        notifications, analyticsCache, loading, isActionLoading, getBestFitResources
    ]);

    const allocationContextValue = useMemo(() => ({
        allocations, updateAllocation, bulkUpdateAllocations
    }), [allocations, updateAllocation, bulkUpdateAllocations]);

    const appStateValue = useMemo(() => ({
        loading, fetchError
    }), [loading, fetchError]);


    return (
        <AppStateContext.Provider value={appStateValue}>
            <EntitiesContext.Provider value={providerValue}>
                <AllocationsContext.Provider value={allocationContextValue}>
                    <CatalogsProvider>
                        <PlanningProvider>
                            <ConfigProvider>
                                <NotificationsProvider>
                                    {children}
                                </NotificationsProvider>
                            </ConfigProvider>
                        </PlanningProvider>
                    </CatalogsProvider>
                </AllocationsContext.Provider>
            </EntitiesContext.Provider>
        </AppStateContext.Provider>
    );
};

export const AppProvider = AppProviders;

// --- Hooks ---

export const useAppState = () => {
    const context = useContext(AppStateContext);
    if (!context) throw new Error('useAppState must be used within AppProviders');
    return context;
};

export const useEntitiesContext = () => {
    const context = useContext(EntitiesContext);
    if (!context) throw new Error('useEntitiesContext must be used within AppProviders');
    return context;
};

export const useAllocationsContext = () => {
    const context = useContext(AllocationsContext);
    if (!context) throw new Error('useAllocationsContext must be used within AppProviders');
    return context;
};

export const usePlanningContext = () => {
    const context = useContext(PlanningContext);
    if (!context) throw new Error('usePlanningContext must be used within AppProviders');
    return context;
};

export const useCatalogsContext = () => {
    const context = useContext(CatalogsContext);
    if (!context) throw new Error('useCatalogsContext must be used within AppProviders');
    return context;
};

export const useConfigContext = () => {
    const context = useContext(ConfigContext);
    if (!context) throw new Error('useConfigContext must be used within AppProviders');
    return context;
};

export const useNotificationsContext = () => {
    const context = useContext(NotificationsContext);
    if (!context) throw new Error('useNotificationsContext must be used within AppProviders');
    return context;
};
