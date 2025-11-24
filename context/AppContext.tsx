

import React, { createContext, useState, useEffect, ReactNode, useContext, useCallback, useMemo } from 'react';
import { 
    Client, Role, Resource, Project, Assignment, Allocation, ConfigOption, 
    CalendarEvent, WbsTask, ResourceRequest, Interview, Contract, Skill, 
    ResourceSkill, ProjectSkill, PageVisibility, SkillThresholds, RoleCostHistory,
    LeaveType, LeaveRequest, ContractManager, ContractProject, SidebarItem, SidebarSectionColors,
    Notification
} from '../types';

// DEFAULT SIDEBAR CONFIGURATION
const DEFAULT_SIDEBAR_CONFIG: SidebarItem[] = [
    { path: "/dashboard", label: "Dashboard", icon: "dashboard", section: "Principale" },
    { path: "/notifications", label: "Notifiche", icon: "notifications", section: "Principale" }, // Added Notifications
    { path: "/staffing", label: "Staffing", icon: "calendar_month", section: "Principale" },
    { path: "/workload", label: "Carico Risorse", icon: "groups", section: "Principale" },
    
    { path: "/gantt", label: "Gantt", icon: "align_horizontal_left", section: "Progetti" },
    { path: "/projects", label: "Progetti", icon: "folder", section: "Progetti" },
    { path: "/contracts", label: "Contratti", icon: "description", section: "Progetti" },
    { path: "/clients", label: "Clienti", icon: "domain", section: "Progetti" },
    { path: "/forecasting", label: "Forecasting", icon: "trending_up", section: "Progetti" },

    { path: "/resources", label: "Risorse", icon: "person", section: "Risorse" },
    { path: "/skills", label: "Competenze", icon: "school", section: "Risorse" },
    { path: "/skill-analysis", label: "Analisi Competenze", icon: "insights", section: "Risorse" },
    { path: "/roles", label: "Ruoli", icon: "badge", section: "Risorse" },
    { path: "/leaves", label: "Assenze", icon: "event_busy", section: "Risorse" },

    { path: "/resource-requests", label: "Richieste Risorse", icon: "assignment", section: "Operatività" },
    { path: "/interviews", label: "Colloqui", icon: "groups", section: "Operatività" },
    { path: "/skills-map", label: "Mappa Competenze", icon: "school", section: "Operatività" },
    { path: "/staffing-visualization", label: "Visualizzazione Staffing", icon: "hub", section: "Operatività" },

    { path: "/manuale-utente", label: "Manuale Utente", icon: "menu_book", section: "Supporto" },
    { path: "/simple-user-manual", label: "Guida Assenze", icon: "help_center", section: "Supporto" },
    { path: "/reports", label: "Report", icon: "bar_chart", section: "Supporto" },

    { path: "/calendar", label: "Calendario Aziendale", icon: "event", section: "Configurazione" },
    { path: "/config", label: "Opzioni", icon: "settings", section: "Configurazione" },
    { path: "/import", label: "Importa Dati", icon: "upload", section: "Dati" },
    { path: "/export", label: "Esporta Dati", icon: "download", section: "Dati" },
    
    { path: "/test-staffing", label: "Test Staffing", icon: "science", section: "Configurazione" }
];

const DEFAULT_SIDEBAR_SECTIONS = ['Principale', 'Progetti', 'Risorse', 'Operatività', 'Supporto', 'Configurazione', 'Dati'];

export interface AllocationsContextType {
    allocations: Allocation;
    updateAllocation: (assignmentId: string, date: string, percentage: number) => Promise<void>;
    bulkUpdateAllocations: (assignmentId: string, startDate: string, endDate: string, percentage: number) => Promise<void>;
}

export interface EntitiesContextType {
    clients: Client[];
    roles: Role[];
    roleCostHistory: RoleCostHistory[];
    resources: Resource[];
    projects: Project[];
    contracts: Contract[];
    contractProjects: ContractProject[];
    contractManagers: ContractManager[];
    assignments: Assignment[];
    horizontals: ConfigOption[];
    seniorityLevels: ConfigOption[];
    projectStatuses: ConfigOption[];
    clientSectors: ConfigOption[];
    locations: ConfigOption[];
    companyCalendar: CalendarEvent[];
    wbsTasks: WbsTask[];
    resourceRequests: ResourceRequest[];
    interviews: Interview[];
    skills: Skill[];
    resourceSkills: ResourceSkill[];
    projectSkills: ProjectSkill[];
    pageVisibility: PageVisibility;
    skillThresholds: SkillThresholds;
    leaveTypes: LeaveType[];
    leaveRequests: LeaveRequest[];
    managerResourceIds: string[];
    sidebarConfig: SidebarItem[]; 
    sidebarSections: string[]; 
    sidebarSectionColors: SidebarSectionColors; 
    notifications: Notification[]; // Added
    loading: boolean;
    isActionLoading: (action: string) => boolean;
    
    // Methods
    fetchData: () => Promise<void>;
    fetchNotifications: () => Promise<void>; // Added
    markNotificationAsRead: (id?: string) => Promise<void>; // Added
    addResource: (resource: Omit<Resource, 'id'>) => Promise<Resource>;
    updateResource: (resource: Resource) => Promise<void>;
    deleteResource: (id: string) => Promise<void>;
    addProject: (project: Omit<Project, 'id'>) => Promise<Project | null>;
    updateProject: (project: Project) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
    addClient: (client: Omit<Client, 'id'>) => Promise<void>;
    updateClient: (client: Client) => Promise<void>;
    deleteClient: (id: string) => Promise<void>;
    addRole: (role: Omit<Role, 'id'>) => Promise<void>;
    updateRole: (role: Role) => Promise<void>;
    deleteRole: (id: string) => Promise<void>;
    addConfigOption: (type: string, value: string) => Promise<void>;
    updateConfigOption: (type: string, option: ConfigOption) => Promise<void>;
    deleteConfigOption: (type: string, id: string) => Promise<void>;
    addCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<void>;
    updateCalendarEvent: (event: CalendarEvent) => Promise<void>;
    deleteCalendarEvent: (id: string) => Promise<void>;
    addMultipleAssignments: (newAssignments: { resourceId: string; projectId: string }[]) => Promise<void>;
    deleteAssignment: (id: string) => Promise<void>;
    getRoleCost: (roleId: string, date: Date) => number;
    addResourceRequest: (req: Omit<ResourceRequest, 'id'>) => Promise<void>;
    updateResourceRequest: (req: ResourceRequest) => Promise<void>;
    deleteResourceRequest: (id: string) => Promise<void>;
    addInterview: (interview: Omit<Interview, 'id'>) => Promise<void>;
    updateInterview: (interview: Interview) => Promise<void>;
    deleteInterview: (id: string) => Promise<void>;
    addContract: (contract: Omit<Contract, 'id'>, projectIds: string[], managerIds: string[]) => Promise<void>;
    updateContract: (contract: Contract, projectIds: string[], managerIds: string[]) => Promise<void>;
    deleteContract: (id: string) => Promise<void>;
    recalculateContractBacklog: (id: string) => Promise<void>;
    addSkill: (skill: Omit<Skill, 'id'>) => Promise<void>;
    updateSkill: (skill: Skill) => Promise<void>;
    deleteSkill: (id: string) => Promise<void>;
    addResourceSkill: (rs: ResourceSkill) => Promise<void>;
    deleteResourceSkill: (resourceId: string, skillId: string) => Promise<void>;
    addProjectSkill: (ps: ProjectSkill) => Promise<void>;
    deleteProjectSkill: (projectId: string, skillId: string) => Promise<void>;
    updateSkillThresholds: (thresholds: SkillThresholds) => Promise<void>;
    getResourceComputedSkills: (resourceId: string) => any[];
    addLeaveType: (type: Omit<LeaveType, 'id'>) => Promise<void>;
    updateLeaveType: (type: LeaveType) => Promise<void>;
    deleteLeaveType: (id: string) => Promise<void>;
    addLeaveRequest: (req: Omit<LeaveRequest, 'id'>) => Promise<void>;
    updateLeaveRequest: (req: LeaveRequest) => Promise<void>;
    deleteLeaveRequest: (id: string) => Promise<void>;
    updateSidebarConfig: (config: SidebarItem[]) => Promise<void>;
    updateSidebarSections: (sections: string[]) => Promise<void>;
    updateSidebarSectionColors: (colors: SidebarSectionColors) => Promise<void>;
}

const EntitiesContext = createContext<EntitiesContextType | undefined>(undefined);
const AllocationsContext = createContext<AllocationsContextType | undefined>(undefined);

const apiFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('authToken');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || `API request failed: ${response.status}`);
    }
    return response.json();
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [loading, setLoading] = useState(true);
    const [actionLoadingState, setActionLoadingState] = useState<Record<string, boolean>>({});

    // Data States
    const [clients, setClients] = useState<Client[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [roleCostHistory, setRoleCostHistory] = useState<RoleCostHistory[]>([]);
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
    const [resourceSkills, setResourceSkills] = useState<ResourceSkill[]>([]);
    const [projectSkills, setProjectSkills] = useState<ProjectSkill[]>([]);
    const [pageVisibility, setPageVisibility] = useState<PageVisibility>({});
    const [skillThresholds, setSkillThresholds] = useState<SkillThresholds>({ NOVICE: 0, JUNIOR: 60, MIDDLE: 150, SENIOR: 350, EXPERT: 700 });
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [managerResourceIds, setManagerResourceIds] = useState<string[]>([]);
    const [sidebarConfig, setSidebarConfig] = useState<SidebarItem[]>(DEFAULT_SIDEBAR_CONFIG);
    const [sidebarSections, setSidebarSections] = useState<string[]>(DEFAULT_SIDEBAR_SECTIONS);
    const [sidebarSectionColors, setSidebarSectionColors] = useState<SidebarSectionColors>({});
    const [notifications, setNotifications] = useState<Notification[]>([]); // Added

    const setActionLoading = (action: string, isLoading: boolean) => {
        setActionLoadingState(prev => ({ ...prev, [action]: isLoading }));
    };

    const isActionLoading = (action: string) => !!actionLoadingState[action];

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Metadata
            const metaData = await apiFetch('/api/data?scope=metadata');
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
            setResourceSkills(metaData.resourceSkills || []);
            setPageVisibility(metaData.pageVisibility || {});
            setLeaveTypes(metaData.leaveTypes || []);
            setManagerResourceIds(metaData.managerResourceIds || []);
            if (metaData.skillThresholds) setSkillThresholds(prev => ({ ...prev, ...metaData.skillThresholds }));
            
            // Sidebar Config Loading
            if (metaData.sidebarConfig) {
                setSidebarConfig(metaData.sidebarConfig);
            }
            if (metaData.sidebarSections) {
                setSidebarSections(metaData.sidebarSections);
            }
            if (metaData.sidebarSectionColors) {
                setSidebarSectionColors(metaData.sidebarSectionColors);
            }

            // 2. Planning
            const planningData = await apiFetch('/api/data?scope=planning');
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
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchNotifications = useCallback(async () => {
        try {
            const notifs = await apiFetch('/api/resources?entity=notifications');
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
            
            // Update local state
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
        // Poll notifications every 60s
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, [fetchData, fetchNotifications]);

    // ... (CRUD Operations - Only showing new/modified ones for brevity, keep others as is) ...
    
    const addResource = async (resource: Omit<Resource, 'id'>) => {
        setActionLoading('addResource', true);
        try {
            const newResource = await apiFetch('/api/resources?entity=resources', { method: 'POST', body: JSON.stringify(resource) });
            setResources(prev => [...prev, newResource]);
            return newResource;
        } finally { setActionLoading('addResource', false); }
    };

    // ... other CRUDs same as before ...
    const updateResource = async (resource: Resource) => {
        setActionLoading(`updateResource-${resource.id}`, true);
        try {
            const updated = await apiFetch(`/api/resources?entity=resources&id=${resource.id}`, { method: 'PUT', body: JSON.stringify(resource) });
            setResources(prev => prev.map(r => r.id === resource.id ? updated : r));
        } finally { setActionLoading(`updateResource-${resource.id}`, false); }
    };

    const deleteResource = async (id: string) => {
        setActionLoading(`deleteResource-${id}`, true);
        try {
            await apiFetch(`/api/resources?entity=resources&id=${id}`, { method: 'DELETE' });
            setResources(prev => prev.filter(r => r.id !== id));
        } finally { setActionLoading(`deleteResource-${id}`, false); }
    };

    const addProject = async (project: Omit<Project, 'id'>) => {
        setActionLoading('addProject', true);
        try {
            const newProject = await apiFetch('/api/resources?entity=projects', { method: 'POST', body: JSON.stringify(project) });
            setProjects(prev => [...prev, newProject]);
            return newProject;
        } finally { setActionLoading('addProject', false); }
    };

    const updateProject = async (project: Project) => {
        setActionLoading(`updateProject-${project.id}`, true);
        try {
            const updated = await apiFetch(`/api/resources?entity=projects&id=${project.id}`, { method: 'PUT', body: JSON.stringify(project) });
            setProjects(prev => prev.map(p => p.id === project.id ? updated : p));
        } finally { setActionLoading(`updateProject-${project.id}`, false); }
    };

    const deleteProject = async (id: string) => {
        setActionLoading(`deleteProject-${id}`, true);
        try {
            await apiFetch(`/api/resources?entity=projects&id=${id}`, { method: 'DELETE' });
            setProjects(prev => prev.filter(p => p.id !== id));
        } finally { setActionLoading(`deleteProject-${id}`, false); }
    };

    const addClient = async (client: Omit<Client, 'id'>) => {
        setActionLoading('addClient', true);
        try {
            const newClient = await apiFetch('/api/resources?entity=clients', { method: 'POST', body: JSON.stringify(client) });
            setClients(prev => [...prev, newClient]);
        } finally { setActionLoading('addClient', false); }
    };

    const updateClient = async (client: Client) => {
        setActionLoading(`updateClient-${client.id}`, true);
        try {
            const updated = await apiFetch(`/api/resources?entity=clients&id=${client.id}`, { method: 'PUT', body: JSON.stringify(client) });
            setClients(prev => prev.map(c => c.id === client.id ? updated : c));
        } finally { setActionLoading(`updateClient-${client.id}`, false); }
    };

    const deleteClient = async (id: string) => {
        setActionLoading(`deleteClient-${id}`, true);
        try {
            await apiFetch(`/api/resources?entity=clients&id=${id}`, { method: 'DELETE' });
            setClients(prev => prev.filter(c => c.id !== id));
        } finally { setActionLoading(`deleteClient-${id}`, false); }
    };

    const addRole = async (role: Omit<Role, 'id'>) => {
        setActionLoading('addRole', true);
        try {
            const newRole = await apiFetch('/api/resources?entity=roles', { method: 'POST', body: JSON.stringify(role) });
            setRoles(prev => [...prev, newRole]);
        } finally { setActionLoading('addRole', false); }
    };

    const updateRole = async (role: Role) => {
        setActionLoading(`updateRole-${role.id}`, true);
        try {
            const updated = await apiFetch(`/api/resources?entity=roles&id=${role.id}`, { method: 'PUT', body: JSON.stringify(role) });
            setRoles(prev => prev.map(r => r.id === role.id ? updated : r));
            const historyRes = await apiFetch('/api/resources?entity=role_cost_history');
            setRoleCostHistory(historyRes);
        } finally { setActionLoading(`updateRole-${role.id}`, false); }
    };

    const deleteRole = async (id: string) => {
        setActionLoading(`deleteRole-${id}`, true);
        try {
            await apiFetch(`/api/resources?entity=roles&id=${id}`, { method: 'DELETE' });
            setRoles(prev => prev.filter(r => r.id !== id));
        } finally { setActionLoading(`deleteRole-${id}`, false); }
    };

    const addConfigOption = async (type: string, value: string) => {
        setActionLoading(`addConfig-${type}`, true);
        try {
            const newOpt = await apiFetch(`/api/config?type=${type}`, { method: 'POST', body: JSON.stringify({ value }) });
            const setter = type === 'horizontals' ? setHorizontals : type === 'seniorityLevels' ? setSeniorityLevels : type === 'projectStatuses' ? setProjectStatuses : type === 'clientSectors' ? setClientSectors : setLocations;
            setter(prev => [...prev, newOpt]);
        } finally { setActionLoading(`addConfig-${type}`, false); }
    };

    const updateConfigOption = async (type: string, option: ConfigOption) => {
        setActionLoading(`updateConfig-${type}-${option.id}`, true);
        try {
            await apiFetch(`/api/config?type=${type}&id=${option.id}`, { method: 'PUT', body: JSON.stringify({ value: option.value }) });
            const setter = type === 'horizontals' ? setHorizontals : type === 'seniorityLevels' ? setSeniorityLevels : type === 'projectStatuses' ? setProjectStatuses : type === 'clientSectors' ? setClientSectors : setLocations;
            setter(prev => prev.map(o => o.id === option.id ? option : o));
        } finally { setActionLoading(`updateConfig-${type}-${option.id}`, false); }
    };

    const deleteConfigOption = async (type: string, id: string) => {
        setActionLoading(`deleteConfig-${type}-${id}`, true);
        try {
            await apiFetch(`/api/config?type=${type}&id=${id}`, { method: 'DELETE' });
            const setter = type === 'horizontals' ? setHorizontals : type === 'seniorityLevels' ? setSeniorityLevels : type === 'projectStatuses' ? setProjectStatuses : type === 'clientSectors' ? setClientSectors : setLocations;
            setter(prev => prev.filter(o => o.id !== id));
        } finally { setActionLoading(`deleteConfig-${type}-${id}`, false); }
    };

    const addCalendarEvent = async (event: Omit<CalendarEvent, 'id'>) => {
        setActionLoading('addCalendarEvent', true);
        try {
            const newEvent = await apiFetch('/api/resources?entity=company_calendar', { method: 'POST', body: JSON.stringify(event) });
            setCompanyCalendar(prev => [...prev, newEvent]);
        } finally { setActionLoading('addCalendarEvent', false); }
    };

    const updateCalendarEvent = async (event: CalendarEvent) => {
        setActionLoading(`updateCalendarEvent-${event.id}`, true);
        try {
            const updated = await apiFetch(`/api/resources?entity=company_calendar&id=${event.id}`, { method: 'PUT', body: JSON.stringify(event) });
            setCompanyCalendar(prev => prev.map(e => e.id === event.id ? updated : e));
        } finally { setActionLoading(`updateCalendarEvent-${event.id}`, false); }
    };

    const deleteCalendarEvent = async (id: string) => {
        setActionLoading(`deleteCalendarEvent-${id}`, true);
        try {
            await apiFetch(`/api/resources?entity=company_calendar&id=${id}`, { method: 'DELETE' });
            setCompanyCalendar(prev => prev.filter(e => e.id !== id));
        } finally { setActionLoading(`deleteCalendarEvent-${id}`, false); }
    };

    const addMultipleAssignments = async (newAssignments: { resourceId: string; projectId: string }[]) => {
        try {
            const createdAssignments = [];
            for (const assignment of newAssignments) {
                const res = await apiFetch('/api/assignments', { method: 'POST', body: JSON.stringify(assignment) });
                if (!assignments.find(a => a.id === res.id)) createdAssignments.push(res);
            }
            setAssignments(prev => [...prev, ...createdAssignments]);
        } catch (e) { console.error(e); }
    };

    const deleteAssignment = async (id: string) => {
        setActionLoading(`deleteAssignment-${id}`, true);
        try {
            await apiFetch(`/api/assignments?id=${id}`, { method: 'DELETE' });
            setAssignments(prev => prev.filter(a => a.id !== id));
            setAllocations(prev => {
                const newAllocations = { ...prev };
                delete newAllocations[id];
                return newAllocations;
            });
        } finally { setActionLoading(`deleteAssignment-${id}`, false); }
    };

    const updateAllocation = async (assignmentId: string, date: string, percentage: number) => {
        setAllocations(prev => ({
            ...prev,
            [assignmentId]: { ...prev[assignmentId], [date]: percentage }
        }));
        try {
            await apiFetch('/api/allocations', { method: 'POST', body: JSON.stringify({ updates: [{ assignmentId, date, percentage }] }) });
        } catch (e) { console.error(e); }
    };

    const bulkUpdateAllocations = async (assignmentId: string, startDate: string, endDate: string, percentage: number) => {
        const updates: { assignmentId: string, date: string, percentage: number }[] = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        const tempAllocations = { ...(allocations[assignmentId] || {}) };

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            if (d.getDay() !== 0 && d.getDay() !== 6) {
                const dateStr = d.toISOString().split('T')[0];
                tempAllocations[dateStr] = percentage;
                updates.push({ assignmentId, date: dateStr, percentage });
            }
        }
        
        setAllocations(prev => ({ ...prev, [assignmentId]: tempAllocations }));
        try {
            await apiFetch('/api/allocations', { method: 'POST', body: JSON.stringify({ updates }) });
        } catch (e) { console.error(e); }
    };

    const addResourceRequest = async (req: Omit<ResourceRequest, 'id'>) => {
        setActionLoading('addResourceRequest', true);
        try {
            const newReq = await apiFetch('/api/resource-requests', { method: 'POST', body: JSON.stringify(req) });
            setResourceRequests(prev => [...prev, newReq]);
        } finally { setActionLoading('addResourceRequest', false); }
    };

    const updateResourceRequest = async (req: ResourceRequest) => {
        setActionLoading(`updateResourceRequest-${req.id}`, true);
        try {
            const updated = await apiFetch(`/api/resource-requests?id=${req.id}`, { method: 'PUT', body: JSON.stringify(req) });
            setResourceRequests(prev => prev.map(r => r.id === req.id ? updated : r));
        } finally { setActionLoading(`updateResourceRequest-${req.id}`, false); }
    };

    const deleteResourceRequest = async (id: string) => {
        setActionLoading(`deleteResourceRequest-${id}`, true);
        try {
            await apiFetch(`/api/resource-requests?id=${id}`, { method: 'DELETE' });
            setResourceRequests(prev => prev.filter(r => r.id !== id));
        } finally { setActionLoading(`deleteResourceRequest-${id}`, false); }
    };

    const addInterview = async (interview: Omit<Interview, 'id'>) => {
        setActionLoading('addInterview', true);
        try {
            const newInt = await apiFetch('/api/resources?entity=interviews', { method: 'POST', body: JSON.stringify(interview) });
            setInterviews(prev => [...prev, newInt]);
        } finally { setActionLoading('addInterview', false); }
    };

    const updateInterview = async (interview: Interview) => {
        setActionLoading(`updateInterview-${interview.id}`, true);
        try {
            const updated = await apiFetch(`/api/resources?entity=interviews&id=${interview.id}`, { method: 'PUT', body: JSON.stringify(interview) });
            setInterviews(prev => prev.map(i => i.id === interview.id ? updated : i));
        } finally { setActionLoading(`updateInterview-${interview.id}`, false); }
    };

    const deleteInterview = async (id: string) => {
        setActionLoading(`deleteInterview-${id}`, true);
        try {
            await apiFetch(`/api/resources?entity=interviews&id=${id}`, { method: 'DELETE' });
            setInterviews(prev => prev.filter(i => i.id !== id));
        } finally { setActionLoading(`deleteInterview-${id}`, false); }
    };

    const addContract = async (contract: Omit<Contract, 'id'>, projectIds: string[], managerIds: string[]) => {
        setActionLoading('addContract', true);
        try {
            const newContract = await apiFetch('/api/resources?entity=contracts', { method: 'POST', body: JSON.stringify({ ...contract, projectIds, managerIds }) });
            setContracts(prev => [...prev, newContract]);
            fetchData();
        } finally { setActionLoading('addContract', false); }
    };

    const updateContract = async (contract: Contract, projectIds: string[], managerIds: string[]) => {
        setActionLoading(`updateContract-${contract.id}`, true);
        try {
            const updated = await apiFetch(`/api/resources?entity=contracts&id=${contract.id}`, { method: 'PUT', body: JSON.stringify({ ...contract, projectIds, managerIds }) });
            setContracts(prev => prev.map(c => c.id === contract.id ? updated : c));
            fetchData();
        } finally { setActionLoading(`updateContract-${contract.id}`, false); }
    };

    const deleteContract = async (id: string) => {
        setActionLoading(`deleteContract-${id}`, true);
        try {
            await apiFetch(`/api/resources?entity=contracts&id=${id}`, { method: 'DELETE' });
            setContracts(prev => prev.filter(c => c.id !== id));
        } finally { setActionLoading(`deleteContract-${id}`, false); }
    };

    const recalculateContractBacklog = async (id: string) => {
        setActionLoading(`recalculateBacklog-${id}`, true);
        try {
            await apiFetch(`/api/resources?entity=contracts&action=recalculate_backlog&id=${id}`, { method: 'POST' });
            fetchData();
        } finally { setActionLoading(`recalculateBacklog-${id}`, false); }
    };

    const addSkill = async (skill: Omit<Skill, 'id'>) => {
        setActionLoading('addSkill', true);
        try {
            const newSkill = await apiFetch('/api/resources?entity=skills', { method: 'POST', body: JSON.stringify(skill) });
            setSkills(prev => [...prev, newSkill]);
        } finally { setActionLoading('addSkill', false); }
    };

    const updateSkill = async (skill: Skill) => {
        setActionLoading(`updateSkill-${skill.id}`, true);
        try {
            const updated = await apiFetch(`/api/resources?entity=skills&id=${skill.id}`, { method: 'PUT', body: JSON.stringify(skill) });
            setSkills(prev => prev.map(s => s.id === skill.id ? updated : s));
        } finally { setActionLoading(`updateSkill-${skill.id}`, false); }
    };

    const deleteSkill = async (id: string) => {
        setActionLoading(`deleteSkill-${id}`, true);
        try {
            await apiFetch(`/api/resources?entity=skills&id=${id}`, { method: 'DELETE' });
            setSkills(prev => prev.filter(s => s.id !== id));
        } finally { setActionLoading(`deleteSkill-${id}`, false); }
    };

    const addResourceSkill = async (rs: ResourceSkill) => {
        setActionLoading(`addResourceSkill-${rs.resourceId}`, true);
        try {
            await apiFetch('/api/resources?entity=resource_skills', { method: 'POST', body: JSON.stringify(rs) });
            setResourceSkills(prev => {
                const existing = prev.findIndex(p => p.resourceId === rs.resourceId && p.skillId === rs.skillId);
                if (existing >= 0) return prev.map((item, i) => i === existing ? rs : item);
                return [...prev, rs];
            });
        } finally { setActionLoading(`addResourceSkill-${rs.resourceId}`, false); }
    };

    const deleteResourceSkill = async (resourceId: string, skillId: string) => {
        try {
            await apiFetch(`/api/resources?entity=resource_skills&resourceId=${resourceId}&skillId=${skillId}`, { method: 'DELETE' });
            setResourceSkills(prev => prev.filter(rs => !(rs.resourceId === resourceId && rs.skillId === skillId)));
        } catch (e) { console.error(e); }
    };

    const addProjectSkill = async (ps: ProjectSkill) => {
        try {
            await apiFetch('/api/resources?entity=project_skills', { method: 'POST', body: JSON.stringify(ps) });
            setProjectSkills(prev => {
                const existing = prev.findIndex(p => p.projectId === ps.projectId && p.skillId === ps.skillId);
                if (existing >= 0) return prev;
                return [...prev, ps];
            });
        } catch (e) { console.error(e); }
    };

    const deleteProjectSkill = async (projectId: string, skillId: string) => {
        try {
            await apiFetch(`/api/resources?entity=project_skills&projectId=${projectId}&skillId=${skillId}`, { method: 'DELETE' });
            setProjectSkills(prev => prev.filter(ps => !(ps.projectId === projectId && ps.skillId === skillId)));
        } catch (e) { console.error(e); }
    };

    const updateSkillThresholds = async (thresholds: SkillThresholds) => {
        setActionLoading('updateSkillThresholds', true);
        try {
            await apiFetch('/api/resources?entity=app-config-batch', { 
                method: 'POST', 
                body: JSON.stringify({ 
                    updates: Object.entries(thresholds).map(([k, v]) => ({ key: `skill_threshold.${k}`, value: String(v) })) 
                }) 
            });
            setSkillThresholds(thresholds);
        } finally { setActionLoading('updateSkillThresholds', false); }
    };

    const getResourceComputedSkills = useCallback((resourceId: string) => {
        const manual = resourceSkills.filter(rs => rs.resourceId === resourceId);
        const assignmentsList = assignments.filter(a => a.resourceId === resourceId);
        
        const inferredMap = new Map<string, { days: number; projects: Set<string> }>();
        
        assignmentsList.forEach(a => {
            const pSkills = projectSkills.filter(ps => ps.projectId === a.projectId);
            if (pSkills.length === 0) return;
            
            const assignmentAllocations = allocations[a.id!] || {};
            let days = 0;
            for (const dateStr in assignmentAllocations) {
                days += (assignmentAllocations[dateStr] || 0) / 100;
            }
            
            if (days > 0) {
                pSkills.forEach(ps => {
                    if (!inferredMap.has(ps.skillId)) inferredMap.set(ps.skillId, { days: 0, projects: new Set() });
                    const entry = inferredMap.get(ps.skillId)!;
                    entry.days += days;
                    entry.projects.add(a.projectId);
                });
            }
        });

        const allSkillIds = new Set([...manual.map(m => m.skillId), ...inferredMap.keys()]);
        const computed = [];

        for (const skillId of allSkillIds) {
            const skill = skills.find(s => s.id === skillId);
            if (!skill) continue;

            const manDetails = manual.find(m => m.skillId === skillId);
            const infDetails = inferredMap.get(skillId);
            const inferredDays = infDetails ? infDetails.days : 0;
            
            let inferredLevel = 1;
            if (inferredDays >= skillThresholds.EXPERT) inferredLevel = 5;
            else if (inferredDays >= skillThresholds.SENIOR) inferredLevel = 4;
            else if (inferredDays >= skillThresholds.MIDDLE) inferredLevel = 3;
            else if (inferredDays >= skillThresholds.JUNIOR) inferredLevel = 2;

            computed.push({
                skill,
                manualDetails: manDetails,
                inferredDays,
                inferredLevel,
                projectCount: infDetails ? infDetails.projects.size : 0
            });
        }
        return computed;
    }, [resourceSkills, assignments, projectSkills, allocations, skills, skillThresholds]);

    const getRoleCost = useCallback((roleId: string, date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        const history = roleCostHistory.find(h => h.roleId === roleId && dateStr >= h.startDate && (!h.endDate || dateStr <= h.endDate));
        if (history) return Number(history.dailyCost);
        const role = roles.find(r => r.id === roleId);
        return role ? Number(role.dailyCost) : 0;
    }, [roleCostHistory, roles]);

    const addLeaveType = async (type: Omit<LeaveType, 'id'>) => {
        setActionLoading('addLeaveType', true);
        try {
            const newType = await apiFetch('/api/resources?entity=leave_types', { method: 'POST', body: JSON.stringify(type) });
            setLeaveTypes(prev => [...prev, newType]);
        } finally { setActionLoading('addLeaveType', false); }
    };

    const updateLeaveType = async (type: LeaveType) => {
        setActionLoading(`updateLeaveType-${type.id}`, true);
        try {
            const updated = await apiFetch(`/api/resources?entity=leave_types&id=${type.id}`, { method: 'PUT', body: JSON.stringify(type) });
            setLeaveTypes(prev => prev.map(t => t.id === type.id ? updated : t));
        } finally { setActionLoading(`updateLeaveType-${type.id}`, false); }
    };

    const deleteLeaveType = async (id: string) => {
        setActionLoading(`deleteLeaveType-${id}`, true);
        try {
            await apiFetch(`/api/resources?entity=leave_types&id=${id}`, { method: 'DELETE' });
            setLeaveTypes(prev => prev.filter(t => t.id !== id));
        } finally { setActionLoading(`deleteLeaveType-${id}`, false); }
    };

    const addLeaveRequest = async (req: Omit<LeaveRequest, 'id'>) => {
        setActionLoading('addLeaveRequest', true);
        try {
            const newReq = await apiFetch('/api/resources?entity=leaves', { method: 'POST', body: JSON.stringify(req) });
            setLeaveRequests(prev => [...prev, newReq]);
            await fetchNotifications(); // Refresh notifications after action
        } finally { setActionLoading('addLeaveRequest', false); }
    };

    const updateLeaveRequest = async (req: LeaveRequest) => {
        setActionLoading('updateLeaveRequest', true); 
        try {
            const updated = await apiFetch(`/api/resources?entity=leaves&id=${req.id}`, { method: 'PUT', body: JSON.stringify(req) });
            setLeaveRequests(prev => prev.map(r => r.id === req.id ? updated : r));
            await fetchNotifications(); // Refresh notifications after action
        } finally { setActionLoading('updateLeaveRequest', false); }
    };

    const deleteLeaveRequest = async (id: string) => {
        setActionLoading(`deleteLeaveRequest-${id}`, true);
        try {
            await apiFetch(`/api/resources?entity=leaves&id=${id}`, { method: 'DELETE' });
            setLeaveRequests(prev => prev.filter(r => r.id !== id));
        } finally { setActionLoading(`deleteLeaveRequest-${id}`, false); }
    };

    const updateSidebarConfig = async (config: SidebarItem[]) => {
        setActionLoading('updateSidebarConfig', true);
        try {
            await apiFetch('/api/resources?entity=app-config-batch', {
                method: 'POST',
                body: JSON.stringify({
                    updates: [{ key: 'sidebar_layout_v1', value: JSON.stringify(config) }]
                })
            });
            setSidebarConfig(config);
        } finally {
            setActionLoading('updateSidebarConfig', false);
        }
    };

    const updateSidebarSections = async (sections: string[]) => {
        setActionLoading('updateSidebarSections', true);
        try {
            await apiFetch('/api/resources?entity=app-config-batch', {
                method: 'POST',
                body: JSON.stringify({
                    updates: [{ key: 'sidebar_sections_v1', value: JSON.stringify(sections) }]
                })
            });
            setSidebarSections(sections);
        } finally {
            setActionLoading('updateSidebarSections', false);
        }
    };

    const updateSidebarSectionColors = async (colors: SidebarSectionColors) => {
        setActionLoading('updateSidebarSectionColors', true);
        try {
            await apiFetch('/api/resources?entity=app-config-batch', {
                method: 'POST',
                body: JSON.stringify({
                    updates: [{ key: 'sidebar_section_colors', value: JSON.stringify(colors) }]
                })
            });
            setSidebarSectionColors(colors);
        } finally {
            setActionLoading('updateSidebarSectionColors', false);
        }
    };

    const entitiesValue: EntitiesContextType = {
        clients, roles, roleCostHistory, resources, projects, contracts, contractProjects, contractManagers, assignments, horizontals, seniorityLevels, projectStatuses, clientSectors, locations, companyCalendar, wbsTasks, resourceRequests, interviews, skills, resourceSkills, projectSkills, pageVisibility, skillThresholds, leaveTypes, leaveRequests, managerResourceIds, sidebarConfig, sidebarSections, sidebarSectionColors, notifications, loading, isActionLoading,
        fetchData, fetchNotifications, markNotificationAsRead, addResource, updateResource, deleteResource, addProject, updateProject, deleteProject, addClient, updateClient, deleteClient, addRole, updateRole, deleteRole, addConfigOption, updateConfigOption, deleteConfigOption, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent, addMultipleAssignments, deleteAssignment, getRoleCost, addResourceRequest, updateResourceRequest, deleteResourceRequest, addInterview, updateInterview, deleteInterview, addContract, updateContract, deleteContract, recalculateContractBacklog, addSkill, updateSkill, deleteSkill, addResourceSkill, deleteResourceSkill, addProjectSkill, deleteProjectSkill, updateSkillThresholds, getResourceComputedSkills, addLeaveType, updateLeaveType, deleteLeaveType, addLeaveRequest, updateLeaveRequest, deleteLeaveRequest, updateSidebarConfig, updateSidebarSections, updateSidebarSectionColors
    };

    const allocationsValue: AllocationsContextType = {
        allocations,
        updateAllocation,
        bulkUpdateAllocations
    };

    return (
        <EntitiesContext.Provider value={entitiesValue}>
            <AllocationsContext.Provider value={allocationsValue}>
                {children}
            </AllocationsContext.Provider>
        </EntitiesContext.Provider>
    );
};

export const useEntitiesContext = () => {
    const context = useContext(EntitiesContext);
    if (context === undefined) throw new Error('useEntitiesContext must be used within an AppProvider');
    return context;
};

export const useAllocationsContext = () => {
    const context = useContext(AllocationsContext);
    if (context === undefined) throw new Error('useAllocationsContext must be used within an AppProvider');
    return context;
};
