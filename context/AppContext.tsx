
import React, { createContext, useState, useEffect, ReactNode, useContext, useCallback, useMemo } from 'react';
import { Client, Role, Resource, Project, Assignment, Allocation, ConfigOption, CalendarEvent, WbsTask, ResourceRequest, Interview, Contract, Skill, ResourceSkill, ProjectSkill, ComputedSkill, PageVisibility, RoleCostHistory, DEFAULT_SKILL_LEVEL_THRESHOLDS, SkillThresholds } from '../types';
import { isHoliday } from '../utils/dateUtils';
import { useToast } from './ToastContext';
import { getRoleCostForDate } from '../utils/costUtils';

// --- Definizione Tipi Contesti ---

type ConfigLists = {
    horizontals: ConfigOption[],
    seniorityLevels: ConfigOption[],
    projectStatuses: ConfigOption[],
    clientSectors: ConfigOption[],
    locations: ConfigOption[],
};

export interface EntitiesContextType {
    clients: Client[];
    roles: Role[];
    roleCostHistory: RoleCostHistory[];
    resources: Resource[];
    projects: Project[];
    contracts: Contract[];
    contractProjects: { contractId: string; projectId: string; }[];
    contractManagers: { contractId: string; resourceId: string; }[];
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
    loading: boolean;
    isActionLoading: (key: string) => boolean;
    addClient: (client: Omit<Client, 'id'>) => Promise<void>;
    updateClient: (client: Client) => Promise<void>;
    deleteClient: (clientId: string) => Promise<void>;
    addRole: (role: Omit<Role, 'id'>) => Promise<void>;
    updateRole: (role: Role) => Promise<void>;
    deleteRole: (roleId: string) => Promise<void>;
    addResource: (resource: Omit<Resource, 'id'>) => Promise<Resource>;
    updateResource: (resource: Resource) => Promise<void>;
    deleteResource: (resourceId: string) => Promise<void>;
    addProject: (project: Omit<Project, 'id'>) => Promise<Project>;
    updateProject: (project: Project) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    addContract: (contract: Omit<Contract, 'id'>, projectIds: string[], managerIds: string[]) => Promise<void>;
    updateContract: (contract: Contract, projectIds: string[], managerIds: string[]) => Promise<void>;
    deleteContract: (contractId: string) => Promise<void>;
    recalculateContractBacklog: (contractId: string) => Promise<void>;
    addAssignment: (assignment: Omit<Assignment, 'id'>) => Promise<void>;
    addMultipleAssignments: (assignments: Omit<Assignment, 'id'>[]) => Promise<void>;
    deleteAssignment: (assignmentId: string) => Promise<void>;
    addConfigOption: (type: keyof ConfigLists, value: string) => Promise<void>;
    updateConfigOption: (type: keyof ConfigLists, option: ConfigOption) => Promise<void>;
    deleteConfigOption: (type: keyof ConfigLists, optionId: string) => Promise<void>;
    addCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<void>;
    updateCalendarEvent: (event: CalendarEvent) => Promise<void>;
    deleteCalendarEvent: (eventId: string) => Promise<void>;
    addWbsTask: (task: Omit<WbsTask, 'id'>) => Promise<void>;
    updateWbsTask: (task: WbsTask) => Promise<void>;
    deleteWbsTask: (taskId: string) => Promise<void>;
    addResourceRequest: (request: Omit<ResourceRequest, 'id'>) => Promise<void>;
    updateResourceRequest: (request: ResourceRequest) => Promise<void>;
    deleteResourceRequest: (requestId: string) => Promise<void>;
    addInterview: (interview: Omit<Interview, 'id'>) => Promise<void>;
    updateInterview: (interview: Interview) => Promise<void>;
    deleteInterview: (interviewId: string) => Promise<void>;
    addSkill: (skill: Omit<Skill, 'id'>) => Promise<void>;
    updateSkill: (skill: Skill) => Promise<void>;
    deleteSkill: (skillId: string) => Promise<void>;
    addResourceSkill: (resourceSkill: ResourceSkill) => Promise<void>;
    deleteResourceSkill: (resourceId: string, skillId: string) => Promise<void>;
    addProjectSkill: (projectSkill: ProjectSkill) => Promise<void>;
    deleteProjectSkill: (projectId: string, skillId: string) => Promise<void>;
    updatePageVisibility: (path: string, restricted: boolean) => Promise<void>;
    updateSkillThresholds: (thresholds: SkillThresholds) => Promise<void>;
    getResourceComputedSkills: (resourceId: string) => ComputedSkill[];
    getRoleCost: (roleId: string, date: Date | string) => number;
    fetchData: () => Promise<void>;
}

export interface AllocationsContextType {
    allocations: Allocation;
    updateAllocation: (assignmentId: string, date: string, percentage: number) => Promise<void>;
    bulkUpdateAllocations: (assignmentId: string, startDate: string, endDate: string, percentage: number) => Promise<void>;
}

// --- Creazione Contesti ---

export const EntitiesContext = createContext<EntitiesContextType | undefined>(undefined);
export const AllocationsContext = createContext<AllocationsContextType | undefined>(undefined);

const apiFetch = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error || `API request failed: ${response.status}`);
    }
    if (response.status !== 204) {
        return response.json();
    }
};

/**
 * Provider unico che gestisce tutto lo stato ma lo espone tramite due contesti separati
 * per ottimizzare le performance dei re-render.
 */
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());
    const [clients, setClients] = useState<Client[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [roleCostHistory, setRoleCostHistory] = useState<RoleCostHistory[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [contractProjects, setContractProjects] = useState<{ contractId: string; projectId: string; }[]>([]);
    const [contractManagers, setContractManagers] = useState<{ contractId: string; resourceId: string; }[]>([]);
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
    const [skillThresholds, setSkillThresholds] = useState<SkillThresholds>(DEFAULT_SKILL_LEVEL_THRESHOLDS);

    const isActionLoading = useCallback((key: string) => actionLoading.has(key), [actionLoading]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Metadata (Fast Load)
            const metaData = await apiFetch('/api/data?scope=metadata');
            setClients(metaData.clients);
            setRoles(metaData.roles);
            setRoleCostHistory(metaData.roleCostHistory || []);
            setResources(metaData.resources);
            setProjects(metaData.projects);
            setHorizontals(metaData.horizontals);
            setSeniorityLevels(metaData.seniorityLevels);
            setProjectStatuses(metaData.projectStatuses);
            setClientSectors(metaData.clientSectors);
            setLocations(metaData.locations);
            setCompanyCalendar(metaData.companyCalendar);
            setSkills(metaData.skills || []);
            setResourceSkills(metaData.resourceSkills || []);
            setPageVisibility(metaData.pageVisibility || {});
            if (metaData.skillThresholds && Object.keys(metaData.skillThresholds).length > 0) {
                setSkillThresholds(prev => ({ ...prev, ...metaData.skillThresholds }));
            }

            // Allow UI to render shell while heavy data loads
            // We might want to keep loading true if we want to block interaction, 
            // but for perceived performance, we could set it false here and have a separate 'dataLoading' state.
            // For now, we follow the 'Load-All' safety but optimized.
            
            // 2. Planning Data (Heavy - with Date Filter)
            const today = new Date();
            // Load current year +/- reasonable buffer to reduce payload
            const start = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
            const end = new Date(today.getFullYear(), 11, 31).toISOString().split('T')[0];
            
            const planningData = await apiFetch(`/api/data?scope=planning&start=${start}&end=${end}`);
            
            setAssignments(planningData.assignments);
            setAllocations(planningData.allocations);
            setWbsTasks(planningData.wbsTasks || []);
            setResourceRequests(planningData.resourceRequests || []);
            setInterviews(planningData.interviews || []);
            setContracts(planningData.contracts || []);
            setContractProjects(planningData.contractProjects || []);
            setContractManagers(planningData.contractManagers || []);
            setProjectSkills(planningData.projectSkills || []);

        } catch (error) {
            console.error("Failed to fetch data:", error);
            addToast(`Caricamento dati fallito: ${(error as Error).message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ... [CRUD Operations] ...
    
    const addClient = useCallback(async (client: Omit<Client, 'id'>) => {
        const actionKey = 'addClient';
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const newClient = await apiFetch('/api/resources?entity=clients', { method: 'POST', body: JSON.stringify(client) });
            setClients(prev => [...prev, newClient]);
            addToast(`Cliente '${newClient.name}' aggiunto con successo.`, 'success');
        } catch (error) {
            addToast(`Errore aggiunta cliente: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);
    const updateClient = useCallback(async (client: Client) => {
        const actionKey = `updateClient-${client.id}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const updatedClient = await apiFetch(`/api/resources?entity=clients&id=${client.id}`, { method: 'PUT', body: JSON.stringify(client) });
            setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
            addToast(`Cliente '${updatedClient.name}' aggiornato.`, 'success');
        } catch (error) {
            addToast(`Errore modifica cliente: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);
    const deleteClient = useCallback(async (clientId: string) => {
        const clientName = clients.find(c => c.id === clientId)?.name || 'sconosciuto';
        const actionKey = `deleteClient-${clientId}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            await apiFetch(`/api/resources?entity=clients&id=${clientId}`, { method: 'DELETE' });
            setClients(prev => prev.filter(c => c.id !== clientId));
            addToast(`Cliente '${clientName}' eliminato.`, 'success');
        } catch (error) {
            addToast(`Errore eliminazione cliente: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast, clients]);

    const addRole = useCallback(async (role: Omit<Role, 'id'>) => {
        const actionKey = 'addRole';
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const newRole = await apiFetch('/api/resources?entity=roles', { method: 'POST', body: JSON.stringify(role) });
            setRoles(prev => [...prev, newRole]);
            // Refresh history since POST now creates a history record
            await fetchData(); 
            addToast(`Ruolo '${newRole.name}' aggiunto.`, 'success');
        } catch (error) {
            addToast(`Errore aggiunta ruolo: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast, fetchData]);
    const updateRole = useCallback(async (role: Role) => {
        const actionKey = `updateRole-${role.id}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const updatedRole = await apiFetch(`/api/resources?entity=roles&id=${role.id}`, { method: 'PUT', body: JSON.stringify(role) });
            setRoles(prev => prev.map(r => r.id === updatedRole.id ? updatedRole : r));
             // Refresh history since PUT might update history
            await fetchData();
            addToast(`Ruolo '${updatedRole.name}' aggiornato.`, 'success');
        } catch (error) {
            addToast(`Errore modifica ruolo: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast, fetchData]);
    const deleteRole = useCallback(async (roleId: string) => {
        const roleName = roles.find(r => r.id === roleId)?.name || 'sconosciuto';
        const actionKey = `deleteRole-${roleId}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            await apiFetch(`/api/resources?entity=roles&id=${roleId}`, { method: 'DELETE' });
            setRoles(prev => prev.filter(r => r.id !== roleId));
            setRoleCostHistory(prev => prev.filter(h => h.roleId !== roleId));
            addToast(`Ruolo '${roleName}' eliminato.`, 'success');
        } catch (error) {
            addToast(`Errore eliminazione ruolo: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast, roles]);

    const addResource = useCallback(async (resource: Omit<Resource, 'id'>) => {
        const actionKey = 'addResource';
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const newResource = await apiFetch('/api/resources?entity=resources', { method: 'POST', body: JSON.stringify(resource) });
            setResources(prev => [...prev, newResource]);
            addToast(`Risorsa '${newResource.name}' aggiunta.`, 'success');
            return newResource;
        } catch (error) {
            addToast(`Errore aggiunta risorsa: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);
    const updateResource = useCallback(async (resource: Resource) => {
        const actionKey = `updateResource-${resource.id}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const updatedResource = await apiFetch(`/api/resources?entity=resources&id=${resource.id}`, { method: 'PUT', body: JSON.stringify(resource) });
            setResources(prev => prev.map(r => r.id === updatedResource.id ? updatedResource : r));
            addToast(`Risorsa '${updatedResource.name}' aggiornata.`, 'success');
        } catch (error) {
            addToast(`Errore modifica risorsa: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);
    const deleteResource = useCallback(async (resourceId: string) => {
        const resourceName = resources.find(r => r.id === resourceId)?.name || 'sconosciuta';
        const actionKey = `deleteResource-${resourceId}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            await apiFetch(`/api/resources?entity=resources&id=${resourceId}`, { method: 'DELETE' });
            const assignmentIdsToRemove = new Set(assignments.filter(a => a.resourceId === resourceId).map(a => a.id));

            setResources(prev => prev.filter(r => r.id !== resourceId));
            setAssignments(prev => prev.filter(a => a.resourceId !== resourceId));
            setAllocations(prev => {
                const newAllocations = { ...prev };
                assignmentIdsToRemove.forEach(id => { if(id) delete newAllocations[id]; });
                return newAllocations;
            });
            addToast(`Risorsa '${resourceName}' eliminata.`, 'success');
        } catch (error) {
            addToast(`Errore eliminazione risorsa: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast, resources, assignments]);
    
    const addProject = useCallback(async (project: Omit<Project, 'id'>) => {
        const actionKey = 'addProject';
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const newProject = await apiFetch('/api/resources?entity=projects', { method: 'POST', body: JSON.stringify(project) });
            setProjects(prev => [...prev, newProject]);
            addToast(`Progetto '${newProject.name}' aggiunto.`, 'success');
            return newProject;
        } catch (error) {
            addToast(`Errore aggiunta progetto: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);
    const updateProject = useCallback(async (project: Project) => {
        const actionKey = `updateProject-${project.id}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const updatedProject = await apiFetch(`/api/resources?entity=projects&id=${project.id}`, { method: 'PUT', body: JSON.stringify(project) });
            setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
            addToast(`Progetto '${updatedProject.name}' aggiornato.`, 'success');
        } catch (error) {
            addToast(`Errore modifica progetto: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);
    const deleteProject = useCallback(async (projectId: string) => {
        const projectName = projects.find(p => p.id === projectId)?.name || 'sconosciuto';
        const actionKey = `deleteProject-${projectId}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            await apiFetch(`/api/resources?entity=projects&id=${projectId}`, { method: 'DELETE' });
            const assignmentIdsToRemove = new Set(assignments.filter(a => a.projectId === projectId).map(a => a.id));

            setProjects(prev => prev.filter(p => p.id !== projectId));
            setAssignments(prev => prev.filter(a => a.projectId !== projectId));
            setAllocations(prev => {
                const newAllocations = { ...prev };
                assignmentIdsToRemove.forEach(id => { if(id) delete newAllocations[id]; });
                return newAllocations;
            });
            addToast(`Progetto '${projectName}' eliminato.`, 'success');
        } catch (error) {
            addToast(`Errore eliminazione progetto: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast, projects, assignments]);

    const addContract = useCallback(async (contract: Omit<Contract, 'id'>, projectIds: string[], managerIds: string[]) => {
        const actionKey = 'addContract';
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const newContractData = await apiFetch('/api/resources?entity=contracts', { method: 'POST', body: JSON.stringify({ ...contract, projectIds, managerIds }) });
            setContracts(prev => [...prev, newContractData]);
            setContractProjects(prev => [...prev, ...projectIds.map(pid => ({ contractId: newContractData.id, projectId: pid }))]);
            setContractManagers(prev => [...prev, ...managerIds.map(mid => ({ contractId: newContractData.id, resourceId: mid }))]);
            addToast(`Contratto '${newContractData.name}' aggiunto.`, 'success');
        } catch (error) {
            addToast(`Errore aggiunta contratto: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);
    const updateContract = useCallback(async (contract: Contract, projectIds: string[], managerIds: string[]) => {
        const actionKey = `updateContract-${contract.id}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const updatedContractData = await apiFetch(`/api/resources?entity=contracts&id=${contract.id}`, { method: 'PUT', body: JSON.stringify({ ...contract, projectIds, managerIds }) });
            setContracts(prev => prev.map(c => c.id === updatedContractData.id ? updatedContractData : c));
            setContractProjects(prev => [...prev.filter(cp => cp.contractId !== contract.id), ...projectIds.map(pid => ({ contractId: contract.id!, projectId: pid }))]);
            setContractManagers(prev => [...prev.filter(cm => cm.contractId !== contract.id), ...managerIds.map(mid => ({ contractId: contract.id!, resourceId: mid }))]);
            addToast(`Contratto '${updatedContractData.name}' aggiornato.`, 'success');
        } catch (error) {
            addToast(`Errore modifica contratto: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);
    const deleteContract = useCallback(async (contractId: string) => {
        const contractName = contracts.find(c => c.id === contractId)?.name || 'sconosciuto';
        const actionKey = `deleteContract-${contractId}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            await apiFetch(`/api/resources?entity=contracts&id=${contractId}`, { method: 'DELETE' });
            setContracts(prev => prev.filter(c => c.id !== contractId));
            setContractProjects(prev => prev.filter(cp => cp.contractId !== contractId));
            setContractManagers(prev => prev.filter(cm => cm.contractId !== contractId));
            addToast(`Contratto '${contractName}' eliminato.`, 'success');
        } catch (error) {
            addToast(`Errore eliminazione contratto: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast, contracts]);

    const recalculateContractBacklog = useCallback(async (contractId: string) => {
        const actionKey = `recalculateBacklog-${contractId}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const updatedContract = await apiFetch(`/api/resources?entity=contracts&action=recalculate_backlog&id=${contractId}`, { method: 'POST' });
            setContracts(prev => prev.map(c => c.id === updatedContract.id ? updatedContract : c));
            addToast(`Backlog per il contratto '${updatedContract.name}' ricalcolato con successo.`, 'success');
        } catch (error) {
            addToast(`Errore durante il ricalcolo del backlog: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);

    const addAssignment = useCallback(async (assignment: Omit<Assignment, 'id'>) => {
        const actionKey = 'addAssignment';
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const newAssignment = await apiFetch('/api/resources?entity=assignments', { method: 'POST', body: JSON.stringify(assignment) });
            setAssignments(prev => {
                const existing = new Set(prev.map(a => a.id));
                return existing.has(newAssignment.id) ? prev : [...prev, newAssignment];
            });
            addToast('Assegnazione aggiunta.', 'success');
        } catch (error) {
            addToast(`Errore aggiunta assegnazione: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);
    const addMultipleAssignments = useCallback(async (assignmentsToAdd: Omit<Assignment, 'id'>[]) => {
        if (assignmentsToAdd.length === 0) return;
        const actionKey = 'addMultipleAssignments';
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const createdAssignments = await Promise.all(
                assignmentsToAdd.map(assignment => apiFetch('/api/resources?entity=assignments', { method: 'POST', body: JSON.stringify(assignment) }))
            );
            setAssignments(prev => {
                const existingIds = new Set(prev.map(a => a.id));
                const newUniqueAssignments = createdAssignments.filter(a => !existingIds.has(a.id));
                return [...prev, ...newUniqueAssignments];
            });
            addToast(`${assignmentsToAdd.length} assegnazioni aggiunte con successo.`, 'success');
        } catch (error) {
            addToast(`Errore durante l'aggiunta di assegnazioni multiple: ${(error as Error).message}`, 'error');
            await fetchData();
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast, fetchData]);
    const deleteAssignment = useCallback(async (assignmentId: string) => {
        const actionKey = `deleteAssignment-${assignmentId}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            await apiFetch(`/api/resources?entity=assignments&id=${assignmentId}`, { method: 'DELETE' });
            setAssignments(prev => prev.filter(a => a.id !== assignmentId));
            setAllocations(prev => {
                const newAllocations = { ...prev };
                delete newAllocations[assignmentId];
                return newAllocations;
            });
            addToast('Assegnazione rimossa.', 'success');
        } catch (error) {
            addToast(`Errore eliminazione assegnazione: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);
    
    const addConfigOption = useCallback(async (type: keyof ConfigLists, value: string) => {
        const actionKey = `addConfig-${type}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const newOption = await apiFetch(`/api/config?type=${type}`, { method: 'POST', body: JSON.stringify({ value }) });
            const setter = { horizontals: setHorizontals, seniorityLevels: setSeniorityLevels, projectStatuses: setProjectStatuses, clientSectors: setClientSectors, locations: setLocations }[type];
            setter(prev => [...prev, newOption]);
            addToast(`Opzione '${value}' aggiunta.`, 'success');
        } catch (error) {
            addToast(`Errore aggiunta opzione: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);
    const updateConfigOption = useCallback(async (type: keyof ConfigLists, option: ConfigOption) => {
        const actionKey = `updateConfig-${type}-${option.id}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const updatedOption = await apiFetch(`/api/config?type=${type}&id=${option.id}`, { method: 'PUT', body: JSON.stringify(option) });
            const setter = { horizontals: setHorizontals, seniorityLevels: setSeniorityLevels, projectStatuses: setProjectStatuses, clientSectors: setClientSectors, locations: setLocations }[type];
            setter(prev => prev.map(o => o.id === updatedOption.id ? updatedOption : o));
            addToast(`Opzione '${updatedOption.value}' aggiornata.`, 'success');
        } catch (error) {
            addToast(`Errore modifica opzione: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);
    const deleteConfigOption = useCallback(async (type: keyof ConfigLists, optionId: string) => {
        const actionKey = `deleteConfig-${type}-${optionId}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            await apiFetch(`/api/config?type=${type}&id=${optionId}`, { method: 'DELETE' });
            const setter = { horizontals: setHorizontals, seniorityLevels: setSeniorityLevels, projectStatuses: setProjectStatuses, clientSectors: setClientSectors, locations: setLocations }[type];
            setter(prev => prev.filter(o => o.id !== optionId));
            addToast(`Opzione eliminata.`, 'success');
        } catch (error) {
            addToast(`Errore eliminazione opzione: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);
    
    const addCalendarEvent = useCallback(async (event: Omit<CalendarEvent, 'id'>) => {
        const actionKey = 'addCalendarEvent';
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const newEvent = await apiFetch('/api/resources?entity=calendar', { method: 'POST', body: JSON.stringify(event) });
            setCompanyCalendar(prev => [...prev, newEvent]);
            addToast(`Evento '${newEvent.name}' aggiunto.`, 'success');
        } catch (error) {
            addToast(`Errore aggiunta evento: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);
    const updateCalendarEvent = useCallback(async (event: CalendarEvent) => {
        const actionKey = `updateCalendarEvent-${event.id}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const updatedEvent = await apiFetch(`/api/resources?entity=calendar&id=${event.id}`, { method: 'PUT', body: JSON.stringify(event) });
            setCompanyCalendar(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
            addToast(`Evento '${updatedEvent.name}' aggiornato.`, 'success');
        } catch (error) {
            addToast(`Errore modifica evento: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);
    const deleteCalendarEvent = useCallback(async (eventId: string) => {
        const eventName = companyCalendar.find(e => e.id === eventId)?.name || 'sconosciuto';
        const actionKey = `deleteCalendarEvent-${eventId}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            await apiFetch(`/api/resources?entity=calendar&id=${eventId}`, { method: 'DELETE' });
            setCompanyCalendar(prev => prev.filter(e => e.id !== eventId));
            addToast(`Evento '${eventName}' eliminato.`, 'success');
        } catch (error) {
            addToast(`Errore eliminazione evento: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast, companyCalendar]);
    
    const addWbsTask = useCallback(async (task: Omit<WbsTask, 'id'>) => {
        const actionKey = 'addWbsTask';
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const newTask = await apiFetch('/api/resources?entity=wbsTasks', { method: 'POST', body: JSON.stringify(task) });
            setWbsTasks(prev => [...prev, newTask]);
            addToast(`Incarico '${newTask.elementoWbs}' aggiunto.`, 'success');
        } catch (error) {
            addToast(`Errore aggiunta incarico WBS: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);
    const updateWbsTask = useCallback(async (task: WbsTask) => {
        const actionKey = `updateWbsTask-${task.id}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const updatedTask = await apiFetch(`/api/resources?entity=wbsTasks&id=${task.id}`, { method: 'PUT', body: JSON.stringify(task) });
            setWbsTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
            addToast(`Incarico '${updatedTask.elementoWbs}' aggiornato.`, 'success');
        } catch (error) {
            addToast(`Errore modifica incarico WBS: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);
    const deleteWbsTask = useCallback(async (taskId: string) => {
        const taskName = wbsTasks.find(t => t.id === taskId)?.elementoWbs || 'sconosciuto';
        const actionKey = `deleteWbsTask-${taskId}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            await apiFetch(`/api/resources?entity=wbsTasks&id=${taskId}`, { method: 'DELETE' });
            setWbsTasks(prev => prev.filter(t => t.id !== taskId));
            addToast(`Incarico '${taskName}' eliminato.`, 'success');
        } catch (error) {
            addToast(`Errore eliminazione incarico WBS: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast, wbsTasks]);
    
    const addResourceRequest = useCallback(async (request: Omit<ResourceRequest, 'id'>) => {
        const actionKey = 'addResourceRequest';
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const newRequest = await apiFetch('/api/resources?entity=resource-requests', { method: 'POST', body: JSON.stringify(request) });
            setResourceRequests(prev => [...prev, newRequest]);
            addToast(`Richiesta di risorsa creata con successo.`, 'success');
        } catch (error) {
            addToast(`Errore creazione richiesta: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);

    const updateResourceRequest = useCallback(async (request: ResourceRequest) => {
        const actionKey = `updateResourceRequest-${request.id}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const updatedRequest = await apiFetch(`/api/resources?entity=resource-requests&id=${request.id}`, { method: 'PUT', body: JSON.stringify(request) });
            setResourceRequests(prev => prev.map(r => r.id === updatedRequest.id ? updatedRequest : r));
            addToast(`Richiesta di risorsa aggiornata.`, 'success');
        } catch (error) {
            addToast(`Errore modifica richiesta: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);
    
    const deleteResourceRequest = useCallback(async (requestId: string) => {
        const actionKey = `deleteResourceRequest-${requestId}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            await apiFetch(`/api/resources?entity=resource-requests&id=${requestId}`, { method: 'DELETE' });
            setResourceRequests(prev => prev.filter(r => r.id !== requestId));
            addToast(`Richiesta di risorsa eliminata.`, 'success');
        } catch (error) {
            addToast(`Errore eliminazione richiesta: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);

    const addInterview = useCallback(async (interview: Omit<Interview, 'id'>) => {
        const actionKey = 'addInterview';
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const newInterview = await apiFetch('/api/resources?entity=interviews', { method: 'POST', body: JSON.stringify(interview) });
            setInterviews(prev => [...prev, newInterview]);
            addToast(`Colloquio per '${newInterview.candidateName} ${newInterview.candidateSurname}' aggiunto.`, 'success');
        } catch (error) {
            addToast(`Errore aggiunta colloquio: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);
    const updateInterview = useCallback(async (interview: Interview) => {
        const actionKey = `updateInterview-${interview.id}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const updatedInterview = await apiFetch(`/api/resources?entity=interviews&id=${interview.id}`, { method: 'PUT', body: JSON.stringify(interview) });
            setInterviews(prev => prev.map(i => i.id === updatedInterview.id ? updatedInterview : i));
            addToast(`Colloquio per '${updatedInterview.candidateName} ${updatedInterview.candidateSurname}' aggiornato.`, 'success');
        } catch (error) {
            addToast(`Errore modifica colloquio: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);
    const deleteInterview = useCallback(async (interviewId: string) => {
        const interviewName = interviews.find(i => i.id === interviewId)?.candidateName || 'sconosciuto';
        const actionKey = `deleteInterview-${interviewId}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            await apiFetch(`/api/resources?entity=interviews&id=${interviewId}`, { method: 'DELETE' });
            setInterviews(prev => prev.filter(i => i.id !== interviewId));
            addToast(`Colloquio per '${interviewName}' eliminato.`, 'success');
        } catch (error) {
            addToast(`Errore eliminazione colloquio: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast, interviews]);

    // --- Skill Management ---

    const addSkill = useCallback(async (skill: Omit<Skill, 'id'>) => {
        const actionKey = 'addSkill';
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const newSkill = await apiFetch('/api/resources?entity=skills', { method: 'POST', body: JSON.stringify(skill) });
            setSkills(prev => [...prev, newSkill]);
            addToast(`Competenza '${newSkill.name}' aggiunta.`, 'success');
        } catch (error) {
            addToast(`Errore aggiunta competenza: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);

    const updateSkill = useCallback(async (skill: Skill) => {
        const actionKey = `updateSkill-${skill.id}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const updatedSkill = await apiFetch(`/api/resources?entity=skills&id=${skill.id}`, { method: 'PUT', body: JSON.stringify(skill) });
            setSkills(prev => prev.map(s => s.id === updatedSkill.id ? updatedSkill : s));
            addToast(`Competenza '${updatedSkill.name}' aggiornata.`, 'success');
        } catch (error) {
            addToast(`Errore modifica competenza: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);

    const deleteSkill = useCallback(async (skillId: string) => {
        const skillName = skills.find(s => s.id === skillId)?.name || 'sconosciuta';
        const actionKey = `deleteSkill-${skillId}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            await apiFetch(`/api/resources?entity=skills&id=${skillId}`, { method: 'DELETE' });
            setSkills(prev => prev.filter(s => s.id !== skillId));
            setResourceSkills(prev => prev.filter(rs => rs.skillId !== skillId));
            setProjectSkills(prev => prev.filter(ps => ps.skillId !== skillId));
            addToast(`Competenza '${skillName}' eliminata.`, 'success');
        } catch (error) {
            addToast(`Errore eliminazione competenza: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast, skills]);

    const addResourceSkill = useCallback(async (resourceSkill: ResourceSkill) => {
        const actionKey = `addResourceSkill-${resourceSkill.resourceId}-${resourceSkill.skillId}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            await apiFetch('/api/resources?entity=resource-skills', { method: 'POST', body: JSON.stringify(resourceSkill) });
            setResourceSkills(prev => {
                const exists = prev.some(rs => rs.resourceId === resourceSkill.resourceId && rs.skillId === resourceSkill.skillId);
                if (exists) {
                    return prev.map(rs => (rs.resourceId === resourceSkill.resourceId && rs.skillId === resourceSkill.skillId) ? resourceSkill : rs);
                }
                return [...prev, resourceSkill];
            });
            addToast('Competenza associata alla risorsa.', 'success');
        } catch (error) {
            addToast(`Errore associazione competenza: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);

    const deleteResourceSkill = useCallback(async (resourceId: string, skillId: string) => {
        const actionKey = `deleteResourceSkill-${resourceId}-${skillId}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            await apiFetch(`/api/resources?entity=resource-skills&resourceId=${resourceId}&skillId=${skillId}`, { method: 'DELETE' });
            setResourceSkills(prev => prev.filter(rs => !(rs.resourceId === resourceId && rs.skillId === skillId)));
            addToast('Associazione competenza rimossa.', 'success');
        } catch (error) {
            addToast(`Errore rimozione competenza: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);

    const addProjectSkill = useCallback(async (projectSkill: ProjectSkill) => {
        const actionKey = `addProjectSkill-${projectSkill.projectId}-${projectSkill.skillId}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            await apiFetch('/api/resources?entity=project-skills', { method: 'POST', body: JSON.stringify(projectSkill) });
            setProjectSkills(prev => {
                const exists = prev.some(ps => ps.projectId === projectSkill.projectId && ps.skillId === projectSkill.skillId);
                if (exists) return prev;
                return [...prev, projectSkill];
            });
            addToast('Competenza associata al progetto.', 'success');
        } catch (error) {
            addToast(`Errore associazione competenza: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);

    const deleteProjectSkill = useCallback(async (projectId: string, skillId: string) => {
        const actionKey = `deleteProjectSkill-${projectId}-${skillId}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            await apiFetch(`/api/resources?entity=project-skills&projectId=${projectId}&skillId=${skillId}`, { method: 'DELETE' });
            setProjectSkills(prev => prev.filter(ps => !(ps.projectId === projectId && ps.skillId === skillId)));
            addToast('Associazione competenza rimossa.', 'success');
        } catch (error) {
            addToast(`Errore rimozione competenza: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);

    // --- Page Visibility Management ---
    
    const updatePageVisibility = useCallback(async (path: string, restricted: boolean) => {
        const actionKey = `updatePageVis-${path}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
             await apiFetch('/api/resources?entity=page-visibility', { 
                 method: 'POST', 
                 body: JSON.stringify({ path, restricted }) 
             });
             setPageVisibility(prev => ({ ...prev, [path]: restricted }));
             addToast(`Visibilità aggiornata per ${path}.`, 'success');
        } catch (error) {
            addToast(`Errore aggiornamento visibilità: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);

    // --- Skill Thresholds Management ---
    const updateSkillThresholds = useCallback(async (thresholds: SkillThresholds) => {
        const actionKey = 'updateSkillThresholds';
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            await apiFetch('/api/resources?entity=skill-thresholds', {
                method: 'POST',
                body: JSON.stringify({ thresholds })
            });
            setSkillThresholds(thresholds);
            addToast('Soglie competenze aggiornate.', 'success');
        } catch (error) {
            addToast(`Errore aggiornamento soglie: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);

    // --- Skill Matrix Algorithm ---
    const getResourceComputedSkills = useCallback((resourceId: string): ComputedSkill[] => {
        // 1. Get Manual Skills
        const manual = resourceSkills.filter(rs => rs.resourceId === resourceId);

        // 2. Get Assignments for this resource
        const userAssignments = assignments.filter(a => a.resourceId === resourceId);

        // 3. Calculate Inferred Skills
        const inferredMap = new Map<string, { days: number, projectCount: number }>(); // skillId -> { totalDays, projectCount }

        userAssignments.forEach(assignment => {
             // Get skills for this project
            const pSkills = projectSkills.filter(ps => ps.projectId === assignment.projectId);
            if (pSkills.length === 0) return;

            // Calculate days worked on this assignment (FTE)
            let days = 0;
            const allocs = allocations[assignment.id!];
            if (allocs) {
                Object.values(allocs).forEach(pct => days += pct / 100);
            }
            if (days === 0) return; // Ignore if no work done

            // Attribute days to each skill
            pSkills.forEach(ps => {
                const current = inferredMap.get(ps.skillId) || { days: 0, projectCount: 0 };
                inferredMap.set(ps.skillId, { 
                    days: current.days + days,
                    projectCount: current.projectCount + 1
                });
            });
        });

        // 4. Merge Manual and Inferred
        const mergedSkillsMap = new Map<string, ComputedSkill>();

        // Add inferred first
        inferredMap.forEach((data, skillId) => {
            const skill = skills.find(s => s.id === skillId);
            if (skill) {
                // Calculate Inferred Level using DYNAMIC THRESHOLDS
                let inferredLevel = 1; // Default Novice
                if (data.days >= skillThresholds.EXPERT) inferredLevel = 5;
                else if (data.days >= skillThresholds.SENIOR) inferredLevel = 4;
                else if (data.days >= skillThresholds.MIDDLE) inferredLevel = 3;
                else if (data.days >= skillThresholds.JUNIOR) inferredLevel = 2;

                mergedSkillsMap.set(skillId, {
                    skill,
                    inferredDays: data.days,
                    inferredLevel,
                    projectCount: data.projectCount
                });
            }
        });

        // Merge manual
        manual.forEach(ms => {
            const skill = skills.find(s => s.id === ms.skillId);
            if (skill) {
                const existing = mergedSkillsMap.get(ms.skillId);
                if (existing) {
                    existing.manualDetails = ms;
                } else {
                    mergedSkillsMap.set(ms.skillId, {
                        skill,
                        manualDetails: ms,
                        inferredDays: 0,
                        inferredLevel: 0,
                        projectCount: 0
                    });
                }
            }
        });

        // Convert map to array and sort
        // Priority: Manual > Inferred Days (Desc)
        return Array.from(mergedSkillsMap.values()).sort((a, b) => {
             if (a.manualDetails && !b.manualDetails) return -1;
             if (!a.manualDetails && b.manualDetails) return 1;
             return b.inferredDays - a.inferredDays;
        });

    }, [resourceSkills, assignments, projectSkills, allocations, skills, skillThresholds]);

    // --- Helper for Role Cost ---
    const getRoleCost = useCallback((roleId: string, date: Date | string) => {
        return getRoleCostForDate(roleId, date, roleCostHistory, roles);
    }, [roleCostHistory, roles]);
    
    // --- Allocations-specific functions ---

    const updateAllocation = useCallback(async (assignmentId: string, date: string, percentage: number) => {
        const previousAllocations = JSON.parse(JSON.stringify(allocations));
        setAllocations(prev => {
            const newAllocations = JSON.parse(JSON.stringify(prev));
            if (!newAllocations[assignmentId]) newAllocations[assignmentId] = {};
            if (percentage === 0) {
                delete newAllocations[assignmentId][date];
                if (Object.keys(newAllocations[assignmentId]).length === 0) {
                    delete newAllocations[assignmentId];
                }
            } else {
                newAllocations[assignmentId][date] = percentage;
            }
            return newAllocations;
        });

        try {
            await apiFetch('/api/resources?entity=allocations', { method: 'POST', body: JSON.stringify({ updates: [{ assignmentId, date, percentage }] }) });
        } catch (error) {
            addToast(`Errore modifica allocazione: ${(error as Error).message}`, 'error');
            setAllocations(previousAllocations);
        }
    }, [allocations, addToast]);

    const bulkUpdateAllocations = useCallback(async (assignmentId: string, startDate: string, endDate: string, percentage: number) => {
        const assignment = assignments.find(a => a.id === assignmentId);
        const resource = resources.find(r => r.id === assignment?.resourceId);
        const updates: { assignmentId: string; date: string; percentage: number }[] = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
            const dayOfWeek = d.getDay();
            const dateStr = d.toISOString().split('T')[0];
            if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday(d, resource?.location ?? null, companyCalendar)) {
                updates.push({ assignmentId, date: dateStr, percentage });
            }
        }
        
        if (updates.length === 0) return;

        const previousAllocations = JSON.parse(JSON.stringify(allocations));
        setAllocations(prev => {
            const newAllocations = JSON.parse(JSON.stringify(prev));
            updates.forEach(update => {
                if (!newAllocations[update.assignmentId]) newAllocations[update.assignmentId] = {};
                 if (update.percentage === 0) {
                    delete newAllocations[update.assignmentId][update.date];
                    if (Object.keys(newAllocations[update.assignmentId]).length === 0) {
                       delete newAllocations[update.assignmentId];
                    }
                } else {
                    newAllocations[update.assignmentId][update.date] = update.percentage;
                }
            });
            return newAllocations;
        });

        try {
            await apiFetch('/api/resources?entity=allocations', { method: 'POST', body: JSON.stringify({ updates }) });
            addToast(`Allocazioni aggiornate con successo.`, 'success');
        } catch (error) {
            addToast(`Errore aggiornamento massivo: ${(error as Error).message}`, 'error');
            setAllocations(previousAllocations);
            throw error;
        }
    }, [assignments, resources, companyCalendar, allocations, addToast]);

    // Memoize context values to prevent unnecessary re-renders of consumers
    const entitiesContextValue = useMemo<EntitiesContextType>(() => ({
        clients, roles, roleCostHistory, resources, projects, contracts, contractProjects, contractManagers, assignments, horizontals, seniorityLevels, projectStatuses, clientSectors, locations, companyCalendar, wbsTasks, resourceRequests, interviews, skills, resourceSkills, projectSkills, pageVisibility, skillThresholds, loading, isActionLoading,
        addClient, updateClient, deleteClient,
        addRole, updateRole, deleteRole,
        addResource, updateResource, deleteResource,
        addProject, updateProject, deleteProject,
        addContract, updateContract, deleteContract, recalculateContractBacklog,
        addAssignment, addMultipleAssignments, deleteAssignment,
        addConfigOption, updateConfigOption, deleteConfigOption,
        addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
        addWbsTask, updateWbsTask, deleteWbsTask,
        addResourceRequest, updateResourceRequest, deleteResourceRequest,
        addInterview, updateInterview, deleteInterview,
        addSkill, updateSkill, deleteSkill,
        addResourceSkill, deleteResourceSkill,
        addProjectSkill, deleteProjectSkill,
        updatePageVisibility,
        updateSkillThresholds,
        getResourceComputedSkills,
        getRoleCost,
        fetchData
    }), [clients, roles, roleCostHistory, resources, projects, contracts, contractProjects, contractManagers, assignments, horizontals, seniorityLevels, projectStatuses, clientSectors, locations, companyCalendar, wbsTasks, resourceRequests, interviews, skills, resourceSkills, projectSkills, pageVisibility, skillThresholds, loading, isActionLoading, addClient, updateClient, deleteClient, addRole, updateRole, deleteRole, addResource, updateResource, deleteResource, addProject, updateProject, deleteProject, addContract, updateContract, deleteContract, recalculateContractBacklog, addAssignment, addMultipleAssignments, deleteAssignment, addConfigOption, updateConfigOption, deleteConfigOption, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent, addWbsTask, updateWbsTask, deleteWbsTask, addResourceRequest, updateResourceRequest, deleteResourceRequest, addInterview, updateInterview, deleteInterview, addSkill, updateSkill, deleteSkill, addResourceSkill, deleteResourceSkill, addProjectSkill, deleteProjectSkill, updatePageVisibility, updateSkillThresholds, getResourceComputedSkills, getRoleCost, fetchData]);

    const allocationsContextValue = useMemo<AllocationsContextType>(() => ({
        allocations,
        updateAllocation,
        bulkUpdateAllocations
    }), [allocations, updateAllocation, bulkUpdateAllocations]);

    return (
        <EntitiesContext.Provider value={entitiesContextValue}>
            <AllocationsContext.Provider value={allocationsContextValue}>
                {children}
            </AllocationsContext.Provider>
        </EntitiesContext.Provider>
    );
};

// --- Hook Personalizzati ---

export const useEntitiesContext = () => {
    const context = useContext(EntitiesContext);
    if (!context) throw new Error('useEntitiesContext must be used within an AppProvider');
    return context;
};

export const useAllocationsContext = () => {
    const context = useContext(AllocationsContext);
    if (!context) throw new Error('useAllocationsContext must be used within an AppProvider');
    return context;
};
