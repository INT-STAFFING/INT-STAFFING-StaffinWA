/**
 * @file context/CatalogContext.tsx
 * @description Gestisce i dati anagrafici (Master Data) che cambiano raramente.
 */

import React, { createContext, useState, useEffect, ReactNode, useContext, useCallback, useMemo } from 'react';
import {
    Client, Role, Resource, ConfigOption, CalendarEvent, Skill, 
    SkillCategory, SkillMacroCategory, ResourceSkill, 
    LeaveType, NotificationConfig,
    SidebarItem, SidebarFooterAction, SidebarSectionColors, DashboardCategory
} from '../types';
import { apiFetch } from '../services/apiClient';
import { useToast } from './ToastContext';

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

export interface CatalogState {
    clients: Client[];
    roles: Role[];
    resources: Resource[];
    skills: Skill[];
    skillCategories: SkillCategory[];
    skillMacroCategories: SkillMacroCategory[];
    resourceSkills: ResourceSkill[];
    horizontals: ConfigOption[];
    seniorityLevels: ConfigOption[];
    projectStatuses: ConfigOption[];
    clientSectors: ConfigOption[];
    locations: ConfigOption[];
    companyCalendar: CalendarEvent[];
    leaveTypes: LeaveType[];
    notificationConfigs: NotificationConfig[];
    managerResourceIds: string[];
    pageVisibility: Record<string, boolean>;
    skillThresholds: any;
    planningSettings: { monthsBefore: number; monthsAfter: number };
    sidebarConfig: SidebarItem[];
    sidebarSections: string[];
    sidebarSectionColors: SidebarSectionColors;
    sidebarFooterActions: SidebarFooterAction[];
    dashboardLayout: DashboardCategory[];
    roleHomePages: Record<string, string>;
    bottomNavPaths: string[];
    analyticsCache: Record<string, unknown>;
    isCatalogLoading: boolean;
    catalogError: string | null;
    actionLoadingMap: Record<string, boolean>;
}

export interface CatalogActions {
    fetchCatalog: () => Promise<void>;
    addResource: (resource: Omit<Resource, 'id'>) => Promise<Resource>;
    updateResource: (resource: Resource) => Promise<void>;
    deleteResource: (id: string) => Promise<void>;
    getPaginatedResources: (page: number, limit: number, filters?: any) => Promise<{ data: Resource[], total: number }>;
    addClient: (client: Omit<Client, 'id'>) => Promise<void>;
    updateClient: (client: Client) => Promise<void>;
    deleteClient: (id: string) => Promise<void>;
    addRole: (role: Omit<Role, 'id'>) => Promise<void>;
    updateRole: (role: Role) => Promise<void>;
    deleteRole: (id: string) => Promise<void>;
    addConfigOption: (type: string, value: string) => Promise<void>;
    updateConfigOption: (type: string, option: ConfigOption) => Promise<void>;
    deleteConfigOption: (type: string, id: string) => Promise<void>;
    addSkill: (skill: Omit<Skill, 'id'>) => Promise<void>;
    updateSkill: (skill: Skill) => Promise<void>;
    deleteSkill: (id: string) => Promise<void>;
    addSkillCategory: (cat: Omit<SkillCategory, 'id'>) => Promise<void>;
    updateSkillCategory: (cat: SkillCategory) => Promise<void>;
    deleteSkillCategory: (id: string) => Promise<void>;
    addSkillMacro: (macro: { name: string }) => Promise<void>;
    updateSkillMacro: (id: string, name: string) => Promise<void>;
    deleteSkillMacro: (id: string) => Promise<void>;
    addResourceSkill: (rs: ResourceSkill) => Promise<void>;
    deleteResourceSkill: (resourceId: string, skillId: string) => Promise<void>;
    getResourceComputedSkills: (resourceId: string) => any[];
    addCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<void>;
    updateCalendarEvent: (event: CalendarEvent) => Promise<void>;
    deleteCalendarEvent: (id: string) => Promise<void>;
    addLeaveType: (type: Omit<LeaveType, 'id'>) => Promise<void>;
    updateLeaveType: (type: LeaveType) => Promise<void>;
    deleteLeaveType: (id: string) => Promise<void>;
    addNotificationConfig: (config: Omit<NotificationConfig, 'id'>) => Promise<void>;
    updateNotificationConfig: (config: NotificationConfig) => Promise<void>;
    deleteNotificationConfig: (id: string) => Promise<void>;
    updatePageVisibility: (visibility: any) => Promise<void>;
    updateSidebarConfig: (config: SidebarItem[]) => Promise<void>;
    updateSidebarSections: (sections: string[]) => Promise<void>;
    updateSidebarSectionColors: (colors: SidebarSectionColors) => Promise<void>;
    updateSidebarFooterActions: (actions: SidebarFooterAction[]) => Promise<void>;
    updateDashboardLayout: (layout: DashboardCategory[]) => Promise<void>;
    updateRoleHomePages: (config: Record<string, string>) => Promise<void>;
    updateBottomNavPaths: (paths: string[]) => Promise<void>;
    updateSkillThresholds: (thresholds: any) => Promise<void>;
    updatePlanningSettings: (settings: { monthsBefore: number; monthsAfter: number }) => Promise<void>;
    setLoadingState: (key: string, value: boolean) => void;
}

export type CatalogContextType = CatalogState & CatalogActions;

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

export const CatalogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoadingMap, setActionLoadingMap] = useState<Record<string, boolean>>({});

    const [clients, setClients] = useState<Client[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    const [horizontals, setHorizontals] = useState<ConfigOption[]>([]);
    const [seniorityLevels, setSeniorityLevels] = useState<ConfigOption[]>([]);
    const [projectStatuses, setProjectStatuses] = useState<ConfigOption[]>([]);
    const [clientSectors, setClientSectors] = useState<ConfigOption[]>([]);
    const [locations, setLocations] = useState<ConfigOption[]>([]);
    const [companyCalendar, setCompanyCalendar] = useState<CalendarEvent[]>([]);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [skillCategories, setSkillCategories] = useState<SkillCategory[]>([]);
    const [skillMacroCategories, setSkillMacroCategories] = useState<SkillMacroCategory[]>([]);
    const [resourceSkills, setResourceSkills] = useState<ResourceSkill[]>([]);
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [notificationConfigs, setNotificationConfigs] = useState<NotificationConfig[]>([]);
    
    const [pageVisibility, setPageVisibility] = useState<Record<string, boolean>>({});
    const [skillThresholds, setSkillThresholds] = useState<any>({ NOVICE: 0, JUNIOR: 60, MIDDLE: 150, SENIOR: 350, EXPERT: 700 });
    const [planningSettings, setPlanningSettings] = useState({ monthsBefore: 6, monthsAfter: 18 });
    const [managerResourceIds, setManagerResourceIds] = useState<string[]>([]);
    const [analyticsCache, setAnalyticsCache] = useState<Record<string, unknown>>({});
    
    const [sidebarConfig, setSidebarConfig] = useState<SidebarItem[]>(DEFAULT_SIDEBAR_CONFIG);
    const [sidebarSections, setSidebarSections] = useState<string[]>(DEFAULT_SIDEBAR_SECTIONS);
    const [sidebarSectionColors, setSidebarSectionColors] = useState<SidebarSectionColors>({});
    const [sidebarFooterActions, setSidebarFooterActions] = useState<SidebarFooterAction[]>(DEFAULT_SIDEBAR_FOOTER_ACTIONS);
    const [dashboardLayout, setDashboardLayout] = useState<DashboardCategory[]>(DEFAULT_DASHBOARD_LAYOUT);
    const [roleHomePages, setRoleHomePages] = useState<Record<string, string>>(DEFAULT_ROLE_HOME_PAGES);
    const [bottomNavPaths, setBottomNavPaths] = useState<string[]>([]);

    const setLoadingState = useCallback((key: string, value: boolean) => {
        setActionLoadingMap(prev => ({ ...prev, [key]: value }));
    }, []);

    const fetchCatalog = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const metaData = await apiFetch<any>('/api/data?scope=metadata');
            setClients(metaData.clients || []);
            setRoles(metaData.roles || []);
            setResources(metaData.resources || []);
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
            setLeaveTypes(metaData.leaveTypes || []);
            setNotificationConfigs(metaData.notificationConfigs || []);
            setPageVisibility(metaData.pageVisibility || {});
            setManagerResourceIds(metaData.managerResourceIds || []);
            setAnalyticsCache(metaData.analyticsCache || {});
            if (metaData.skillThresholds) setSkillThresholds(metaData.skillThresholds);
            if (metaData.sidebarConfig) setSidebarConfig(metaData.sidebarConfig);
            if (metaData.sidebarSections) setSidebarSections(metaData.sidebarSections);
            if (metaData.sidebarSectionColors) setSidebarSectionColors(metaData.sidebarSectionColors);
            if (metaData.sidebarFooterActions) setSidebarFooterActions(metaData.sidebarFooterActions);
            if (metaData.dashboardLayout) setDashboardLayout(metaData.dashboardLayout);
            if (metaData.roleHomePages) setRoleHomePages(metaData.roleHomePages);
            if (metaData.bottomNavPaths) setBottomNavPaths(metaData.bottomNavPaths);
            if (metaData.planningSettings) setPlanningSettings(metaData.planningSettings);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

    const addResource = async (resource: Omit<Resource, 'id'>) => {
        setLoadingState('addResource', true);
        try {
            const newRes = await apiFetch<Resource>('/api/resources?entity=resources', { method: 'POST', body: JSON.stringify(resource) });
            setResources(prev => [...prev, newRes]);
            return newRes;
        } finally { setLoadingState('addResource', false); }
    };

    const updateResource = async (resource: Resource) => {
        setLoadingState(`updateResource-${resource.id}`, true);
        try {
            const updated = await apiFetch<Resource>(`/api/resources?entity=resources&id=${resource.id}`, { method: 'PUT', body: JSON.stringify(resource) });
            setResources(prev => prev.map(r => r.id === resource.id ? updated : r));
        } finally { setLoadingState(`updateResource-${resource.id}`, false); }
    };

    const deleteResource = async (id: string) => {
        setLoadingState(`deleteResource-${id}`, true);
        try {
            await apiFetch(`/api/resources?entity=resources&id=${id}`, { method: 'DELETE' });
            setResources(prev => prev.filter(r => r.id !== id));
        } finally { setLoadingState(`deleteResource-${id}`, false); }
    };
    
    const getPaginatedResources = async (page: number, limit: number, filters?: any) => {
        let query = `/api/resources?entity=resources&page=${page}&limit=${limit}`;
        if (filters?.search) query += `&search=${encodeURIComponent(filters.search)}`;
        return await apiFetch<{ data: Resource[], total: number }>(query);
    };

    const addClient = async (client: Omit<Client, 'id'>) => {
        setLoadingState('addClient', true);
        try {
            const newClient = await apiFetch<Client>('/api/resources?entity=clients', { method: 'POST', body: JSON.stringify(client) });
            setClients(prev => [...prev, newClient]);
        } finally { setLoadingState('addClient', false); }
    };

    const updateClient = async (client: Client) => {
        setLoadingState(`updateClient-${client.id}`, true);
        try {
            const updated = await apiFetch<Client>(`/api/resources?entity=clients&id=${client.id}`, { method: 'PUT', body: JSON.stringify(client) });
            setClients(prev => prev.map(c => c.id === client.id ? updated : c));
        } finally { setLoadingState(`updateClient-${client.id}`, false); }
    };

    const deleteClient = async (id: string) => {
        setLoadingState(`deleteClient-${id}`, true);
        try {
            await apiFetch(`/api/resources?entity=clients&id=${id}`, { method: 'DELETE' });
            setClients(prev => prev.filter(c => c.id !== id));
        } finally { setLoadingState(`deleteClient-${id}`, false); }
    };

    const addRole = async (role: Omit<Role, 'id'>) => {
        setLoadingState('addRole', true);
        try {
            const newRole = await apiFetch<Role>('/api/resources?entity=roles', { method: 'POST', body: JSON.stringify(role) });
            setRoles(prev => [...prev, newRole]);
        } finally { setLoadingState('addRole', false); }
    };

    const updateRole = async (role: Role) => {
        setLoadingState(`updateRole-${role.id}`, true);
        try {
            const updated = await apiFetch<Role>(`/api/resources?entity=roles&id=${role.id}`, { method: 'PUT', body: JSON.stringify(role) });
            setRoles(prev => prev.map(r => r.id === role.id ? updated : r));
        } finally { setLoadingState(`updateRole-${role.id}`, false); }
    };

    const deleteRole = async (id: string) => {
        setLoadingState(`deleteRole-${id}`, true);
        try {
            await apiFetch(`/api/resources?entity=roles&id=${id}`, { method: 'DELETE' });
            setRoles(prev => prev.filter(r => r.id !== id));
        } finally { setLoadingState(`deleteRole-${id}`, false); }
    };

    const addConfigOption = async (type: string, value: string) => {
        await apiFetch(`/api/config?type=${type}`, { method: 'POST', body: JSON.stringify({ value }) });
        fetchCatalog(); 
    };
    const updateConfigOption = async (type: string, option: ConfigOption) => {
        await apiFetch(`/api/config?type=${type}&id=${option.id}`, { method: 'PUT', body: JSON.stringify({ value: option.value }) });
        fetchCatalog();
    };
    const deleteConfigOption = async (type: string, id: string) => {
        await apiFetch(`/api/config?type=${type}&id=${id}`, { method: 'DELETE' });
        fetchCatalog();
    };

    const addCalendarEvent = async (e: any) => { await apiFetch('/api/resources?entity=company_calendar', { method: 'POST', body: JSON.stringify(e) }); fetchCatalog(); };
    const updateCalendarEvent = async (e: any) => { await apiFetch(`/api/resources?entity=company_calendar&id=${e.id}`, { method: 'PUT', body: JSON.stringify(e) }); fetchCatalog(); };
    const deleteCalendarEvent = async (id: string) => { await apiFetch(`/api/resources?entity=company_calendar&id=${id}`, { method: 'DELETE' }); fetchCatalog(); };

    const getResourceComputedSkills = useCallback((resourceId: string) => {
         const manual = resourceSkills.filter(rs => rs.resourceId === resourceId);
         return manual.map(rs => {
             const skill = skills.find(s => s.id === rs.skillId);
             return skill ? { skill, manualDetails: rs, inferredDays: 0, inferredLevel: 0, projectCount: 0 } : null;
         }).filter(Boolean);
    }, [resourceSkills, skills]);

    const addSkill = async (s: any) => { await apiFetch('/api/resources?entity=skills', { method: 'POST', body: JSON.stringify(s) }); fetchCatalog(); };
    const updateSkill = async (s: any) => { await apiFetch(`/api/resources?entity=skills&id=${s.id}`, { method: 'PUT', body: JSON.stringify(s) }); fetchCatalog(); };
    const deleteSkill = async (id: string) => { await apiFetch(`/api/resources?entity=skills&id=${id}`, { method: 'DELETE' }); fetchCatalog(); };
    const addSkillCategory = async (c: any) => { await apiFetch('/api/resources?entity=skill_categories', { method: 'POST', body: JSON.stringify(c) }); fetchCatalog(); };
    const updateSkillCategory = async (c: any) => { await apiFetch(`/api/resources?entity=skill_categories&id=${c.id}`, { method: 'PUT', body: JSON.stringify(c) }); fetchCatalog(); };
    const deleteSkillCategory = async (id: string) => { await apiFetch(`/api/resources?entity=skill_categories&id=${id}`, { method: 'DELETE' }); fetchCatalog(); };
    const addSkillMacro = async (m: any) => { await apiFetch('/api/resources?entity=skill_macro_categories', { method: 'POST', body: JSON.stringify(m) }); fetchCatalog(); };
    const updateSkillMacro = async (id: string, name: string) => { await apiFetch(`/api/resources?entity=skill_macro_categories&id=${id}`, { method: 'PUT', body: JSON.stringify({name}) }); fetchCatalog(); };
    const deleteSkillMacro = async (id: string) => { await apiFetch(`/api/resources?entity=skill_macro_categories&id=${id}`, { method: 'DELETE' }); fetchCatalog(); };
    const addResourceSkill = async (rs: ResourceSkill) => { await apiFetch('/api/resources?entity=resource_skills', { method: 'POST', body: JSON.stringify(rs) }); fetchCatalog(); };
    const deleteResourceSkill = async (rid: string, sid: string) => { fetchCatalog(); };
    const addLeaveType = async (l: any) => { await apiFetch('/api/resources?entity=leave_types', { method: 'POST', body: JSON.stringify(l) }); fetchCatalog(); };
    const updateLeaveType = async (l: any) => { await apiFetch(`/api/resources?entity=leave_types&id=${l.id}`, { method: 'PUT', body: JSON.stringify(l) }); fetchCatalog(); };
    const deleteLeaveType = async (id: string) => { await apiFetch(`/api/resources?entity=leave_types&id=${id}`, { method: 'DELETE' }); fetchCatalog(); };
    const addNotificationConfig = async (c: any) => { await apiFetch('/api/resources?entity=notification_configs', { method: 'POST', body: JSON.stringify(c) }); fetchCatalog(); };
    const updateNotificationConfig = async (c: any) => { await apiFetch(`/api/resources?entity=notification_configs&id=${c.id}`, { method: 'PUT', body: JSON.stringify(c) }); fetchCatalog(); };
    const deleteNotificationConfig = async (id: string) => { await apiFetch(`/api/resources?entity=notification_configs&id=${id}`, { method: 'DELETE' }); fetchCatalog(); };

    const updateConfigGeneric = async (key: string, value: any) => { fetchCatalog(); };

    const value = useMemo(() => ({
        clients, roles, resources, skills, skillCategories, skillMacroCategories, resourceSkills,
        horizontals, seniorityLevels, projectStatuses, clientSectors, locations, companyCalendar, leaveTypes, notificationConfigs,
        managerResourceIds, pageVisibility, skillThresholds, planningSettings, 
        sidebarConfig, sidebarSections, sidebarSectionColors, sidebarFooterActions, dashboardLayout, roleHomePages, bottomNavPaths, analyticsCache,
        isCatalogLoading: loading, catalogError: error, actionLoadingMap,
        fetchCatalog, addResource, updateResource, deleteResource, getPaginatedResources, addClient, updateClient, deleteClient, addRole, updateRole, deleteRole,
        addConfigOption, updateConfigOption, deleteConfigOption, addSkill, updateSkill, deleteSkill, addSkillCategory, updateSkillCategory, deleteSkillCategory,
        addSkillMacro, updateSkillMacro, deleteSkillMacro, addResourceSkill, deleteResourceSkill, getResourceComputedSkills, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
        addLeaveType, updateLeaveType, deleteLeaveType, addNotificationConfig, updateNotificationConfig, deleteNotificationConfig,
        updatePageVisibility: (v: any) => updateConfigGeneric('pageVisibility', v),
        updateSidebarConfig: (v: any) => updateConfigGeneric('sidebarConfig', v),
        updateSidebarSections: (v: any) => updateConfigGeneric('sidebarSections', v),
        updateSidebarSectionColors: (v: any) => updateConfigGeneric('sidebarSectionColors', v),
        updateSidebarFooterActions: (v: any) => updateConfigGeneric('sidebarFooterActions', v),
        updateDashboardLayout: (v: any) => updateConfigGeneric('dashboardLayout', v),
        updateRoleHomePages: (v: any) => updateConfigGeneric('roleHomePages', v),
        updateBottomNavPaths: (v: any) => updateConfigGeneric('bottomNavPaths', v),
        updateSkillThresholds: (v: any) => updateConfigGeneric('skillThresholds', v),
        updatePlanningSettings: (v: any) => updateConfigGeneric('planningSettings', v),
        setLoadingState
    }), [
        clients, roles, resources, skills, loading, error, horizontals, locations, actionLoadingMap,
        skillCategories, skillMacroCategories, resourceSkills, seniorityLevels, projectStatuses, clientSectors,
        companyCalendar, leaveTypes, notificationConfigs, managerResourceIds, pageVisibility, skillThresholds,
        planningSettings, sidebarConfig, sidebarSections, sidebarSectionColors, sidebarFooterActions, dashboardLayout,
        roleHomePages, bottomNavPaths, analyticsCache, fetchCatalog, addResource, updateResource, deleteResource,
        getPaginatedResources, addClient, updateClient, deleteClient, addRole, updateRole, deleteRole, addConfigOption,
        updateConfigOption, deleteConfigOption, addSkill, updateSkill, deleteSkill, addSkillCategory, updateSkillCategory,
        deleteSkillCategory, addSkillMacro, updateSkillMacro, deleteSkillMacro, addResourceSkill, deleteResourceSkill,
        getResourceComputedSkills, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent, addLeaveType,
        updateLeaveType, deleteLeaveType, addNotificationConfig, updateNotificationConfig, deleteNotificationConfig,
        setLoadingState
    ]);

    return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
};

export const useCatalog = () => {
    const context = useContext(CatalogContext);
    if (!context) throw new Error("useCatalog must be used within CatalogProvider");
    return context;
};
