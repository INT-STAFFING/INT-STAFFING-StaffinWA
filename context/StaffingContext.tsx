import React, { createContext, useState, useEffect, ReactNode, useContext, useCallback } from 'react';
import { Client, Role, Resource, Project, Assignment, Allocation, ConfigOption } from '../types';

interface StaffingContextType {
    clients: Client[];
    roles: Role[];
    resources: Resource[];
    projects: Project[];
    assignments: Assignment[];
    allocations: Allocation;
    horizontals: ConfigOption[];
    seniorityLevels: ConfigOption[];
    projectStatuses: ConfigOption[];
    clientSectors: ConfigOption[];
    loading: boolean;
    addClient: (client: Omit<Client, 'id'>) => Promise<void>;
    updateClient: (client: Client) => Promise<void>;
    deleteClient: (clientId: string) => Promise<void>;
    addRole: (role: Omit<Role, 'id'>) => Promise<void>;
    updateRole: (role: Role) => Promise<void>;
    deleteRole: (roleId: string) => Promise<void>;
    addResource: (resource: Omit<Resource, 'id'>) => Promise<void>;
    updateResource: (resource: Resource) => Promise<void>;
    deleteResource: (resourceId: string) => Promise<void>;
    addProject: (project: Omit<Project, 'id'>) => Promise<void>;
    updateProject: (project: Project) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    addAssignment: (assignment: Omit<Assignment, 'id'>) => Promise<void>;
    deleteAssignment: (assignmentId: string) => Promise<void>;
    updateAllocation: (assignmentId: string, date: string, percentage: number) => Promise<void>;
    bulkUpdateAllocations: (assignmentId: string, startDate: string, endDate: string, percentage: number) => Promise<void>;
    addConfigOption: (type: keyof ConfigLists, value: string) => Promise<void>;
    updateConfigOption: (type: keyof ConfigLists, option: ConfigOption) => Promise<void>;
    deleteConfigOption: (type: keyof ConfigLists, optionId: string) => Promise<void>;
}

type ConfigLists = {
    horizontals: ConfigOption[],
    seniorityLevels: ConfigOption[],
    projectStatuses: ConfigOption[],
    clientSectors: ConfigOption[]
};

export const StaffingContext = createContext<StaffingContextType | undefined>(undefined);

const apiFetch = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${errorText}`);
    }
    if (response.status !== 204) { // No Content
        return response.json();
    }
};

export const StaffingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [loading, setLoading] = useState(true);
    const [clients, setClients] = useState<Client[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [allocations, setAllocations] = useState<Allocation>({});
    const [horizontals, setHorizontals] = useState<ConfigOption[]>([]);
    const [seniorityLevels, setSeniorityLevels] = useState<ConfigOption[]>([]);
    const [projectStatuses, setProjectStatuses] = useState<ConfigOption[]>([]);
    const [clientSectors, setClientSectors] = useState<ConfigOption[]>([]);

    const fetchData = useCallback(async () => {
        try {
            const data = await apiFetch('/api/data');
            setClients(data.clients);
            setRoles(data.roles);
            setResources(data.resources);
            setProjects(data.projects);
            setAssignments(data.assignments);
            setAllocations(data.allocations);
            setHorizontals(data.horizontals);
            setSeniorityLevels(data.seniorityLevels);
            setProjectStatuses(data.projectStatuses);
            setClientSectors(data.clientSectors);
        } catch (error) {
            console.error("Failed to fetch initial data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- CRUD Functions ---
    const addClient = async (client: Omit<Client, 'id'>) => { await apiFetch('/api/clients', { method: 'POST', body: JSON.stringify(client) }); await fetchData(); };
    const updateClient = async (client: Client) => { await apiFetch(`/api/clients?id=${client.id}`, { method: 'PUT', body: JSON.stringify(client) }); await fetchData(); };
    const deleteClient = async (clientId: string) => { await apiFetch(`/api/clients?id=${clientId}`, { method: 'DELETE' }); await fetchData(); };

    const addRole = async (role: Omit<Role, 'id'>) => { await apiFetch('/api/roles', { method: 'POST', body: JSON.stringify(role) }); await fetchData(); };
    const updateRole = async (role: Role) => { await apiFetch(`/api/roles?id=${role.id}`, { method: 'PUT', body: JSON.stringify(role) }); await fetchData(); };
    const deleteRole = async (roleId: string) => { await apiFetch(`/api/roles?id=${roleId}`, { method: 'DELETE' }); await fetchData(); };
    
    const addResource = async (resource: Omit<Resource, 'id'>) => { await apiFetch('/api/resources', { method: 'POST', body: JSON.stringify(resource) }); await fetchData(); };
    const updateResource = async (resource: Resource) => { await apiFetch(`/api/resources?id=${resource.id}`, { method: 'PUT', body: JSON.stringify(resource) }); await fetchData(); };
    const deleteResource = async (resourceId: string) => { await apiFetch(`/api/resources?id=${resourceId}`, { method: 'DELETE' }); await fetchData(); };
    
    const addProject = async (project: Omit<Project, 'id'>) => { await apiFetch('/api/projects', { method: 'POST', body: JSON.stringify(project) }); await fetchData(); };
    const updateProject = async (project: Project) => { await apiFetch(`/api/projects?id=${project.id}`, { method: 'PUT', body: JSON.stringify(project) }); await fetchData(); };
    const deleteProject = async (projectId: string) => { await apiFetch(`/api/projects?id=${projectId}`, { method: 'DELETE' }); await fetchData(); };

    const addAssignment = async (assignment: Omit<Assignment, 'id'>) => { await apiFetch('/api/assignments', { method: 'POST', body: JSON.stringify(assignment) }); await fetchData(); };
    const deleteAssignment = async (assignmentId: string) => { await apiFetch(`/api/assignments?id=${assignmentId}`, { method: 'DELETE' }); await fetchData(); };
    
    const updateAllocation = async (assignmentId: string, date: string, percentage: number) => {
        await apiFetch('/api/allocations', { method: 'POST', body: JSON.stringify({ updates: [{ assignmentId, date, percentage }] }) });
        // Optimistic update for better UX
        setAllocations(prev => {
            const newAllocations = { ...prev };
            if (!newAllocations[assignmentId]) {
                newAllocations[assignmentId] = {};
            }
            if (percentage === 0) {
                delete newAllocations[assignmentId][date];
            } else {
                newAllocations[assignmentId][date] = percentage;
            }
            return newAllocations;
        });
    };

    const bulkUpdateAllocations = async (assignmentId: string, startDate: string, endDate: string, percentage: number) => {
        const updates = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
            const dayOfWeek = d.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
                const dateStr = d.toISOString().split('T')[0];
                updates.push({ assignmentId, date: dateStr, percentage });
            }
        }
        await apiFetch('/api/allocations', { method: 'POST', body: JSON.stringify({ updates }) });
        await fetchData(); // Refetch for bulk updates
    };

    const addConfigOption = async (type: keyof ConfigLists, value: string) => { await apiFetch(`/api/config?type=${type}`, { method: 'POST', body: JSON.stringify({ value }) }); await fetchData(); };
    const updateConfigOption = async (type: keyof ConfigLists, option: ConfigOption) => { await apiFetch(`/api/config?type=${type}&id=${option.id}`, { method: 'PUT', body: JSON.stringify(option) }); await fetchData(); };
    const deleteConfigOption = async (type: keyof ConfigLists, optionId: string) => { await apiFetch(`/api/config?type=${type}&id=${optionId}`, { method: 'DELETE' }); await fetchData(); };

    const contextValue: StaffingContextType = {
        clients, roles, resources, projects, assignments, allocations,
        horizontals, seniorityLevels, projectStatuses, clientSectors, loading,
        addClient, updateClient, deleteClient,
        addRole, updateRole, deleteRole,
        addResource, updateResource, deleteResource,
        addProject, updateProject, deleteProject,
        addAssignment, deleteAssignment,
        updateAllocation, bulkUpdateAllocations,
        addConfigOption, updateConfigOption, deleteConfigOption
    };

    return (
        <StaffingContext.Provider value={contextValue}>
            {children}
        </StaffingContext.Provider>
    );
};

export const useStaffingContext = () => {
    const context = useContext(StaffingContext);
    if (!context) {
        throw new Error('useStaffingContext must be used within a StaffingProvider');
    }
    return context;
};
