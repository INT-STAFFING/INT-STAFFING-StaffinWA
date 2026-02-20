/**
 * @file AppContext.tsx
 * @description Coordinator del contesto applicativo.
 * Orchestrates sub-contexts (Resources, Projects, Skills, HR, Lookup, UIConfig),
 * gestisce fetchData bulk, operazioni con cascade tra domini, e fornisce
 * useEntitiesContext() per compatibilità backward con il codice esistente.
 *
 * Gerarchia provider:
 *   AppStateContext → AllocationsContext → ResourcesProvider → ProjectsProvider
 *   → SkillsProvider → HRProvider → LookupProvider → UIConfigProvider → AppCoordinator
 */

import React, {
    createContext, useState, useEffect, ReactNode, useContext,
    useCallback, useMemo
} from 'react';
import { EntitiesContextType, AllocationsContextType, ComputedSkill } from '../types';
import { useToast } from './ToastContext';
import { apiFetch } from '../services/apiClient';
import { parseISODate, toISODateString } from '../utils/dateUtils';

import { ResourcesProvider, useResourcesContext } from './ResourcesContext';
import { ProjectsProvider, useProjectsContext } from './ProjectsContext';
import { SkillsProvider, useSkillsContext } from './SkillsContext';
import { HRProvider, useHRContext } from './HRContext';
import { LookupProvider, useLookupContext } from './LookupContext';
import { UIConfigProvider, useUIConfigContext } from './UIConfigContext';

// --- Interfaccia AppState estesa ---
export interface AppState {
    loading: boolean;
    fetchError: string | null;
    isSearchOpen: boolean;
    setSearchOpen: (open: boolean) => void;
    setLoading: (loading: boolean) => void;
    setFetchError: (error: string | null) => void;
    isActionLoading: (action: string) => boolean;
    setActionLoading: (action: string, loading: boolean) => void;
}

// --- Contesti ---
const EntitiesContext = createContext<EntitiesContextType | undefined>(undefined);
export const AllocationsContext = createContext<AllocationsContextType | undefined>(undefined);
const AppStateContext = createContext<AppState | undefined>(undefined);
const FetchDataContext = createContext<() => Promise<void>>(() => Promise.resolve());
const UpdatePlanningContext = createContext<(settings: { monthsBefore: number; monthsAfter: number }) => Promise<void>>(() => Promise.resolve());
interface CascadeOpsContextType {
    deleteProject: (id: string) => Promise<void>;
    deleteResource: (id: string) => Promise<void>;
}
const CascadeOpsContext = createContext<CascadeOpsContextType>({
    deleteProject: async () => {},
    deleteResource: async () => {},
});

// --- Coordinator interno: aggrega tutti i sub-context e fornisce operazioni cross-domain ---
interface AppCoordinatorProps {
    children: ReactNode;
    planningMonthsBefore: number;
    planningMonthsAfter: number;
}

const AppCoordinator: React.FC<AppCoordinatorProps> = ({
    children,
    planningMonthsBefore,
    planningMonthsAfter,
}) => {
    const { addToast } = useToast();
    // Destructura setters stabili (garantiti da React useState/useCallback[]).
    // Evita che fetchData e le cascade ops vengano ricreati a ogni cambio di loading/actionLoading.
    const appState = useAppState();
    const { setLoading, setFetchError, setActionLoading } = appState;
    // Destructura solo setAllocations: stabile (garantito da useState)
    const { setAllocations } = useAllocationsInternal();

    const resourcesCtx = useResourcesContext();
    const projectsCtx = useProjectsContext();
    const skillsCtx = useSkillsContext();
    const hrCtx = useHRContext();
    const lookupCtx = useLookupContext();
    const uiCtx = useUIConfigContext();

    // --- fetchData: carica tutti i dati e li distribuisce ai sub-context ---
    const fetchData = useCallback(async (): Promise<void> => {
        setLoading(true);
        setFetchError(null);
        try {
            const metaData = await apiFetch<any>('/api/data?scope=metadata');

            resourcesCtx.initialize({
                resources: metaData.resources || [],
                roles: metaData.roles || [],
                roleCostHistory: metaData.roleCostHistory || [],
                managerResourceIds: metaData.managerResourceIds || [],
            });

            projectsCtx.initialize({
                clients: metaData.clients || [],
                projects: metaData.projects || [],
                rateCards: metaData.rateCards || [],
                rateCardEntries: metaData.rateCardEntries || [],
                projectExpenses: metaData.projectExpenses || [],
            });

            skillsCtx.initialize({
                skills: metaData.skills || [],
                skillCategories: metaData.skillCategories || [],
                skillMacroCategories: metaData.skillMacroCategories || [],
                resourceSkills: metaData.resourceSkills || [],
                skillThresholds: metaData.skillThresholds,
            });

            hrCtx.initialize({
                leaveTypes: metaData.leaveTypes || [],
            });

            uiCtx.initialize({
                pageVisibility: metaData.pageVisibility || {},
                analyticsCache: metaData.analyticsCache || {},
                notificationConfigs: metaData.notificationConfigs || [],
                notificationRules: (metaData.notificationRules || []).map((r: any) => ({
                    ...r,
                    templateBlocks: Array.isArray(r.templateBlocks) ? r.templateBlocks : [],
                })),
                ...(metaData.sidebarConfig && { sidebarConfig: metaData.sidebarConfig }),
                ...(metaData.quickActions && { quickActions: metaData.quickActions }),
                ...(metaData.sidebarSections && { sidebarSections: metaData.sidebarSections }),
                ...(metaData.sidebarSectionColors && { sidebarSectionColors: metaData.sidebarSectionColors }),
                ...(metaData.sidebarFooterActions && { sidebarFooterActions: metaData.sidebarFooterActions }),
                ...(metaData.dashboardLayout && { dashboardLayout: metaData.dashboardLayout }),
                ...(metaData.roleHomePages && { roleHomePages: metaData.roleHomePages }),
                ...(metaData.bottomNavPaths && { bottomNavPaths: metaData.bottomNavPaths }),
            });

            let monthsBefore = planningMonthsBefore;
            let monthsAfter = planningMonthsAfter;
            if (metaData.planningSettings) {
                if (metaData.planningSettings.monthsBefore) monthsBefore = metaData.planningSettings.monthsBefore;
                if (metaData.planningSettings.monthsAfter) monthsAfter = metaData.planningSettings.monthsAfter;
            }
            lookupCtx.initialize({
                functions: metaData.functions || [],
                industries: metaData.industries || [],
                seniorityLevels: metaData.seniorityLevels || [],
                projectStatuses: metaData.projectStatuses || [],
                clientSectors: metaData.clientSectors || [],
                locations: metaData.locations || [],
                companyCalendar: metaData.companyCalendar || [],
                planningSettings: { monthsBefore, monthsAfter },
            });

            const today = new Date();
            const start = new Date(today);
            start.setMonth(start.getMonth() - monthsBefore);
            const end = new Date(today);
            end.setMonth(end.getMonth() + monthsAfter);
            const startStr = start.toISOString().split('T')[0];
            const endStr = end.toISOString().split('T')[0];

            const planningData = await apiFetch<any>(`/api/data?scope=planning&start=${startStr}&end=${endStr}`);

            projectsCtx.initialize({
                assignments: planningData.assignments || [],
                wbsTasks: planningData.wbsTasks || [],
                contracts: planningData.contracts || [],
                contractProjects: planningData.contractProjects || [],
                contractManagers: planningData.contractManagers || [],
                billingMilestones: planningData.billingMilestones || [],
            });

            skillsCtx.initialize({
                projectSkills: planningData.projectSkills || [],
            });

            hrCtx.initialize({
                leaveRequests: planningData.leaveRequests || [],
                resourceRequests: planningData.resourceRequests || [],
                interviews: planningData.interviews || [],
            });

            setAllocations(planningData.allocations || {});

        } catch (error) {
            console.error('Failed to fetch data', error);
            setFetchError((error as Error).message || 'Errore durante il caricamento dei dati.');
        } finally {
            setLoading(false);
        }
    }, [
        planningMonthsBefore, planningMonthsAfter,
        setLoading, setFetchError, setAllocations,
        resourcesCtx, projectsCtx, skillsCtx, hrCtx, lookupCtx, uiCtx,
    ]);

    // Carica i dati al montaggio
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- Operazioni cross-domain: cascade delete ---

    const deleteResource = useCallback(async (id: string): Promise<void> => {
        setActionLoading(`deleteResource-${id}`, true);
        try {
            await apiFetch(`/api/resources?entity=resources&id=${id}`, { method: 'DELETE' });
            resourcesCtx._removeResource(id);
            projectsCtx._removeAssignmentsByResource(id);
            skillsCtx._removeResourceSkillsByResource(id);
            hrCtx._removeLeaveRequestsByResource(id);
        } finally {
            setActionLoading(`deleteResource-${id}`, false);
        }
    }, [setActionLoading, resourcesCtx, projectsCtx, skillsCtx, hrCtx]);

    const deleteProject = useCallback(async (id: string): Promise<void> => {
        setActionLoading(`deleteProject-${id}`, true);
        try {
            await apiFetch(`/api/resources?entity=projects&id=${id}`, { method: 'DELETE' });
            projectsCtx._removeProject(id);
            skillsCtx._removeProjectSkillsByProject(id);
        } finally {
            setActionLoading(`deleteProject-${id}`, false);
        }
    }, [setActionLoading, projectsCtx, skillsCtx]);

    // --- getResourceComputedSkills: cross-domain (skills + assignments) ---
    const getResourceComputedSkills = useCallback((resourceId: string): ComputedSkill[] => {
        const { resourceSkills, projectSkills, skills, skillThresholds } = skillsCtx;
        const { assignments } = projectsCtx;

        const manual = resourceSkills.filter(rs => rs.resourceId === resourceId);
        const resourceAssignments = assignments.filter(a => a.resourceId === resourceId);
        const assignedProjectIds = new Set(resourceAssignments.map(a => a.projectId));
        const projectOccurrences = new Map<string, number>();
        projectSkills.forEach(ps => {
            if (assignedProjectIds.has(ps.projectId)) {
                projectOccurrences.set(ps.skillId, (projectOccurrences.get(ps.skillId) || 0) + 1);
            }
        });
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
    }, [skillsCtx, projectsCtx]);

    // --- updatePlanningSettings: salva + aggiorna lookup + ricarica dati ---
    const updatePlanningSettings = useCallback(async (settings: { monthsBefore: number; monthsAfter: number }): Promise<void> => {
        try {
            const updates = [
                { key: 'planning_range_months_before', value: String(settings.monthsBefore) },
                { key: 'planning_range_months_after', value: String(settings.monthsAfter) }
            ];
            await apiFetch('/api/resources?entity=app-config-batch', {
                method: 'POST', body: JSON.stringify({ updates })
            });
            lookupCtx._setPlanningSettings(settings);
            fetchData();
        } catch (e) { addToast('Errore durante l\'aggiornamento delle impostazioni di planning.', 'error'); }
    }, [addToast, lookupCtx, fetchData]);

    // --- Valore combinato per compatibilità backward con useEntitiesContext() ---
    const entitiesValue = useMemo<EntitiesContextType>(() => ({
        // ResourcesContext
        resources: resourcesCtx.resources,
        roles: resourcesCtx.roles,
        roleCostHistory: resourcesCtx.roleCostHistory,
        managerResourceIds: resourcesCtx.managerResourceIds,
        evaluations: resourcesCtx.evaluations,
        addResource: resourcesCtx.addResource,
        updateResource: resourcesCtx.updateResource,
        deleteResource,
        addRole: resourcesCtx.addRole,
        updateRole: resourcesCtx.updateRole,
        deleteRole: resourcesCtx.deleteRole,
        getRoleCost: resourcesCtx.getRoleCost,
        fetchEvaluations: resourcesCtx.fetchEvaluations,
        addEvaluation: resourcesCtx.addEvaluation,
        updateEvaluation: resourcesCtx.updateEvaluation,
        deleteEvaluation: resourcesCtx.deleteEvaluation,
        // ProjectsContext
        projects: projectsCtx.projects,
        clients: projectsCtx.clients,
        contracts: projectsCtx.contracts,
        contractProjects: projectsCtx.contractProjects,
        contractManagers: projectsCtx.contractManagers,
        assignments: projectsCtx.assignments,
        billingMilestones: projectsCtx.billingMilestones,
        projectExpenses: projectsCtx.projectExpenses,
        wbsTasks: projectsCtx.wbsTasks,
        rateCards: projectsCtx.rateCards,
        rateCardEntries: projectsCtx.rateCardEntries,
        addProject: projectsCtx.addProject,
        updateProject: projectsCtx.updateProject,
        deleteProject,
        addClient: projectsCtx.addClient,
        updateClient: projectsCtx.updateClient,
        deleteClient: projectsCtx.deleteClient,
        addContract: projectsCtx.addContract,
        updateContract: projectsCtx.updateContract,
        deleteContract: projectsCtx.deleteContract,
        recalculateContractBacklog: projectsCtx.recalculateContractBacklog,
        addMultipleAssignments: projectsCtx.addMultipleAssignments,
        deleteAssignment: projectsCtx.deleteAssignment,
        addBillingMilestone: projectsCtx.addBillingMilestone,
        updateBillingMilestone: projectsCtx.updateBillingMilestone,
        deleteBillingMilestone: projectsCtx.deleteBillingMilestone,
        addProjectExpense: projectsCtx.addProjectExpense,
        updateProjectExpense: projectsCtx.updateProjectExpense,
        deleteProjectExpense: projectsCtx.deleteProjectExpense,
        addRateCard: projectsCtx.addRateCard,
        updateRateCard: projectsCtx.updateRateCard,
        deleteRateCard: projectsCtx.deleteRateCard,
        upsertRateCardEntries: projectsCtx.upsertRateCardEntries,
        getSellRate: projectsCtx.getSellRate,
        // SkillsContext
        skills: skillsCtx.skills,
        skillCategories: skillsCtx.skillCategories,
        skillMacroCategories: skillsCtx.skillMacroCategories,
        resourceSkills: skillsCtx.resourceSkills,
        projectSkills: skillsCtx.projectSkills,
        skillThresholds: skillsCtx.skillThresholds,
        addSkill: skillsCtx.addSkill,
        updateSkill: skillsCtx.updateSkill,
        deleteSkill: skillsCtx.deleteSkill,
        addResourceSkill: skillsCtx.addResourceSkill,
        deleteResourceSkill: skillsCtx.deleteResourceSkill,
        addProjectSkill: skillsCtx.addProjectSkill,
        deleteProjectSkill: skillsCtx.deleteProjectSkill,
        addSkillCategory: skillsCtx.addSkillCategory,
        updateSkillCategory: skillsCtx.updateSkillCategory,
        deleteSkillCategory: skillsCtx.deleteSkillCategory,
        addSkillMacro: skillsCtx.addSkillMacro,
        updateSkillMacro: skillsCtx.updateSkillMacro,
        deleteSkillMacro: skillsCtx.deleteSkillMacro,
        updateSkillThresholds: skillsCtx.updateSkillThresholds,
        getResourceComputedSkills,
        // HRContext
        leaveRequests: hrCtx.leaveRequests,
        leaveTypes: hrCtx.leaveTypes,
        resourceRequests: hrCtx.resourceRequests,
        interviews: hrCtx.interviews,
        addLeaveType: hrCtx.addLeaveType,
        updateLeaveType: hrCtx.updateLeaveType,
        deleteLeaveType: hrCtx.deleteLeaveType,
        addLeaveRequest: hrCtx.addLeaveRequest,
        updateLeaveRequest: hrCtx.updateLeaveRequest,
        deleteLeaveRequest: hrCtx.deleteLeaveRequest,
        addResourceRequest: hrCtx.addResourceRequest,
        updateResourceRequest: hrCtx.updateResourceRequest,
        deleteResourceRequest: hrCtx.deleteResourceRequest,
        addInterview: hrCtx.addInterview,
        updateInterview: hrCtx.updateInterview,
        deleteInterview: hrCtx.deleteInterview,
        getBestFitResources: hrCtx.getBestFitResources,
        // LookupContext
        functions: lookupCtx.functions,
        industries: lookupCtx.industries,
        seniorityLevels: lookupCtx.seniorityLevels,
        projectStatuses: lookupCtx.projectStatuses,
        clientSectors: lookupCtx.clientSectors,
        locations: lookupCtx.locations,
        companyCalendar: lookupCtx.companyCalendar,
        planningSettings: lookupCtx.planningSettings,
        addConfigOption: lookupCtx.addConfigOption,
        updateConfigOption: lookupCtx.updateConfigOption,
        deleteConfigOption: lookupCtx.deleteConfigOption,
        addCalendarEvent: lookupCtx.addCalendarEvent,
        updateCalendarEvent: lookupCtx.updateCalendarEvent,
        deleteCalendarEvent: lookupCtx.deleteCalendarEvent,
        updatePlanningSettings,
        // UIConfigContext
        sidebarConfig: uiCtx.sidebarConfig,
        quickActions: uiCtx.quickActions,
        sidebarSections: uiCtx.sidebarSections,
        sidebarSectionColors: uiCtx.sidebarSectionColors,
        sidebarFooterActions: uiCtx.sidebarFooterActions,
        dashboardLayout: uiCtx.dashboardLayout,
        roleHomePages: uiCtx.roleHomePages,
        bottomNavPaths: uiCtx.bottomNavPaths,
        pageVisibility: uiCtx.pageVisibility,
        notifications: uiCtx.notifications,
        notificationConfigs: uiCtx.notificationConfigs,
        notificationRules: uiCtx.notificationRules,
        analyticsCache: uiCtx.analyticsCache,
        updateSidebarConfig: uiCtx.updateSidebarConfig,
        updateQuickActions: uiCtx.updateQuickActions,
        updateSidebarSections: uiCtx.updateSidebarSections,
        updateSidebarSectionColors: uiCtx.updateSidebarSectionColors,
        updateSidebarFooterActions: uiCtx.updateSidebarFooterActions,
        updateDashboardLayout: uiCtx.updateDashboardLayout,
        updateRoleHomePages: uiCtx.updateRoleHomePages,
        updateBottomNavPaths: uiCtx.updateBottomNavPaths,
        updatePageVisibility: uiCtx.updatePageVisibility,
        fetchNotifications: uiCtx.fetchNotifications,
        markNotificationAsRead: uiCtx.markNotificationAsRead,
        addNotificationConfig: uiCtx.addNotificationConfig,
        updateNotificationConfig: uiCtx.updateNotificationConfig,
        deleteNotificationConfig: uiCtx.deleteNotificationConfig,
        addNotificationRule: uiCtx.addNotificationRule,
        updateNotificationRule: uiCtx.updateNotificationRule,
        deleteNotificationRule: uiCtx.deleteNotificationRule,
        forceRecalculateAnalytics: uiCtx.forceRecalculateAnalytics,
        // Coordinator
        fetchData,
        isActionLoading: appState.isActionLoading,
        loading: appState.loading,
    }), [
        resourcesCtx, projectsCtx, skillsCtx, hrCtx, lookupCtx, uiCtx,
        deleteResource, deleteProject, getResourceComputedSkills, updatePlanningSettings,
        fetchData, appState,
    ]);

    const cascadeOpsValue = useMemo<CascadeOpsContextType>(() => ({
        deleteProject,
        deleteResource,
    }), [deleteProject, deleteResource]);

    return (
        <FetchDataContext.Provider value={fetchData}>
            <UpdatePlanningContext.Provider value={updatePlanningSettings}>
                <CascadeOpsContext.Provider value={cascadeOpsValue}>
                    <EntitiesContext.Provider value={entitiesValue}>
                        {children}
                    </EntitiesContext.Provider>
                </CascadeOpsContext.Provider>
            </UpdatePlanningContext.Provider>
        </FetchDataContext.Provider>
    );
};

// --- Provider interno per gestire allocations con setAllocations ---
interface AllocationsState {
    allocations: AllocationsContextType['allocations'];
    setAllocations: (a: AllocationsContextType['allocations']) => void;
    updateAllocation: AllocationsContextType['updateAllocation'];
    bulkUpdateAllocations: AllocationsContextType['bulkUpdateAllocations'];
}

const AllocationsStateContext = createContext<AllocationsState | undefined>(undefined);

const AllocationsInternalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { addToast } = useToast();
    const [allocations, setAllocations] = useState<AllocationsContextType['allocations']>({});

    const updateAllocation = useCallback(async (assignmentId: string, date: string, percentage: number): Promise<void> => {
        try {
            await apiFetch('/api/allocations', {
                method: 'POST',
                body: JSON.stringify({ updates: [{ assignmentId, date, percentage }] })
            });
            setAllocations(prev => {
                const next = { ...prev };
                const assignAlloc = { ...(next[assignmentId] || {}) };
                if (percentage === 0) { delete assignAlloc[date]; }
                else { assignAlloc[date] = percentage; }
                next[assignmentId] = assignAlloc;
                return next;
            });
        } catch (e) { addToast('Errore durante l\'aggiornamento dell\'allocazione.', 'error'); }
    }, [addToast]);

    const bulkUpdateAllocations = useCallback(async (
        assignmentId: string, startDate: string, endDate: string, percentage: number
    ): Promise<void> => {
        const start = parseISODate(startDate);
        const end = parseISODate(endDate);
        const updates: { assignmentId: string; date: string; percentage: number }[] = [];
        let curr = new Date(start.getTime());
        while (curr.getTime() <= end.getTime()) {
            const day = curr.getUTCDay();
            if (day !== 0 && day !== 6) {
                updates.push({ assignmentId, date: toISODateString(curr), percentage });
            }
            curr.setUTCDate(curr.getUTCDate() + 1);
        }
        if (updates.length === 0) return;
        try {
            await apiFetch('/api/allocations', {
                method: 'POST', body: JSON.stringify({ updates })
            });
            setAllocations(prev => {
                const next = { ...prev };
                const assignAlloc = { ...(next[assignmentId] || {}) };
                updates.forEach(u => { if (u.percentage === 0) delete assignAlloc[u.date]; else assignAlloc[u.date] = u.percentage; });
                next[assignmentId] = assignAlloc;
                return next;
            });
            addToast(`Aggiornate ${updates.length} giornate.`, 'success');
        } catch (e) { addToast('Errore durante l\'aggiornamento massivo.', 'error'); }
    }, [addToast]);

    const allocState = useMemo<AllocationsState>(() => ({
        allocations, setAllocations, updateAllocation, bulkUpdateAllocations
    }), [allocations, updateAllocation, bulkUpdateAllocations]);

    const allocValue = useMemo<AllocationsContextType>(() => ({
        allocations, updateAllocation, bulkUpdateAllocations
    }), [allocations, updateAllocation, bulkUpdateAllocations]);

    return (
        <AllocationsStateContext.Provider value={allocState}>
            <AllocationsContext.Provider value={allocValue}>
                {children}
            </AllocationsContext.Provider>
        </AllocationsStateContext.Provider>
    );
};

// Hook interno per leggere/scrivere allocations dal coordinator
const useAllocationsInternal = (): AllocationsState => {
    const ctx = useContext(AllocationsStateContext);
    if (!ctx) throw new Error('useAllocationsInternal must be used within AllocationsInternalProvider');
    return ctx;
};

// --- Provider principale esportato ---
export const AppProviders: React.FC<{
    children: ReactNode;
    planningWindow?: { monthsBefore: number; monthsAfter: number };
    configKeys?: Record<string, string>;
}> = ({ children, planningWindow }) => {
    const planningMonthsBefore = planningWindow?.monthsBefore ?? 6;
    const planningMonthsAfter = planningWindow?.monthsAfter ?? 18;

    const [loading, setLoading] = useState(true);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [actionLoadingState, setActionLoadingState] = useState<Record<string, boolean>>({});
    const [fetchError, setFetchError] = useState<string | null>(null);

    const setActionLoading = useCallback((action: string, isLoading: boolean) => {
        setActionLoadingState(prev => ({ ...prev, [action]: isLoading }));
    }, []);
    const isActionLoading = useCallback((action: string) => !!actionLoadingState[action], [actionLoadingState]);

    const appStateValue = useMemo<AppState>(() => ({
        loading, fetchError, isSearchOpen,
        setSearchOpen: setIsSearchOpen,
        setLoading, setFetchError,
        isActionLoading, setActionLoading,
    }), [loading, fetchError, isSearchOpen, isActionLoading, setActionLoading]);

    return (
        <AppStateContext.Provider value={appStateValue}>
            <AllocationsInternalProvider>
                <ResourcesProvider>
                    <ProjectsProvider>
                        <SkillsProvider>
                            <HRProvider>
                                <LookupProvider initialPlanningSettings={{ monthsBefore: planningMonthsBefore, monthsAfter: planningMonthsAfter }}>
                                    <UIConfigProvider>
                                        <AppCoordinatorWrapper
                                            planningMonthsBefore={planningMonthsBefore}
                                            planningMonthsAfter={planningMonthsAfter}
                                        >
                                            {children}
                                        </AppCoordinatorWrapper>
                                    </UIConfigProvider>
                                </LookupProvider>
                            </HRProvider>
                        </SkillsProvider>
                    </ProjectsProvider>
                </ResourcesProvider>
            </AllocationsInternalProvider>
        </AppStateContext.Provider>
    );
};

// Wrapper necessario per accedere ai sub-context hooks dall'interno di AppProviders
const AppCoordinatorWrapper: React.FC<{
    children: ReactNode;
    planningMonthsBefore: number;
    planningMonthsAfter: number;
}> = ({ children, planningMonthsBefore, planningMonthsAfter }) => {
    return (
        <AppCoordinator
            planningMonthsBefore={planningMonthsBefore}
            planningMonthsAfter={planningMonthsAfter}
        >
            {children}
        </AppCoordinator>
    );
};

// --- Hook pubblici ---
export const useEntitiesContext = (): EntitiesContextType => {
    const ctx = useContext(EntitiesContext);
    if (!ctx) throw new Error('useEntitiesContext must be used within AppProviders');
    return ctx;
};

export const useAllocationsContext = (): AllocationsContextType => {
    const ctx = useContext(AllocationsContext);
    if (!ctx) throw new Error('useAllocationsContext must be used within AppProviders');
    return ctx;
};

export const useAppState = (): AppState => {
    const ctx = useContext(AppStateContext);
    if (!ctx) throw new Error('useAppState must be used within AppProviders');
    return ctx;
};

export const useFetchData = (): (() => Promise<void>) => {
    return useContext(FetchDataContext);
};

export const useUpdatePlanningSettings = (): ((settings: { monthsBefore: number; monthsAfter: number }) => Promise<void>) => {
    return useContext(UpdatePlanningContext);
};

export const useCascadeOps = (): CascadeOpsContextType => {
    return useContext(CascadeOpsContext);
};
