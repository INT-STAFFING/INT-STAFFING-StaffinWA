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
    fetchData: () => Promise<void>;
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
        // COMMENTO: Estrae il messaggio di errore dal server per mostrarlo all'utente.
        const errorBody = await response.json();
        throw new Error(errorBody.error || `API request failed: ${response.status}`);
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
        setLoading(true);
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

    // --- MODIFICA: Aggiunta gestione errori con alert a tutte le funzioni CRUD ---

    const handleApiCall = async (apiCall: () => Promise<any>, errorMessage: string) => {
        try {
            await apiCall();
            await fetchData();
        } catch (error) {
            alert(`${errorMessage}: ${(error as Error).message}`);
            throw error; // Rilancia l'errore se il componente chiamante ha bisogno di gestirlo
        }
    };

    const addClient = (client: Omit<Client, 'id'>) => handleApiCall(() => apiFetch('/api/clients', { method: 'POST', body: JSON.stringify(client) }), 'Errore aggiunta cliente');
    const updateClient = (client: Client) => handleApiCall(() => apiFetch(`/api/clients?id=${client.id}`, { method: 'PUT', body: JSON.stringify(client) }), 'Errore modifica cliente');
    const deleteClient = (clientId: string) => handleApiCall(() => apiFetch(`/api/clients?id=${clientId}`, { method: 'DELETE' }), 'Errore eliminazione cliente');

    const addRole = (role: Omit<Role, 'id'>) => handleApiCall(() => apiFetch('/api/roles', { method: 'POST', body: JSON.stringify(role) }), 'Errore aggiunta ruolo');
    const updateRole = (role: Role) => handleApiCall(() => apiFetch(`/api/roles?id=${role.id}`, { method: 'PUT', body: JSON.stringify(role) }), 'Errore modifica ruolo');
    const deleteRole = (roleId: string) => handleApiCall(() => apiFetch(`/api/roles?id=${roleId}`, { method: 'DELETE' }), 'Errore eliminazione ruolo');
    
    const addResource = (resource: Omit<Resource, 'id'>) => handleApiCall(() => apiFetch('/api/resources', { method: 'POST', body: JSON.stringify(resource) }), 'Errore aggiunta risorsa');
    const updateResource = (resource: Resource) => handleApiCall(() => apiFetch(`/api/resources?id=${resource.id}`, { method: 'PUT', body: JSON.stringify(resource) }), 'Errore modifica risorsa');
    const deleteResource = (resourceId: string) => handleApiCall(() => apiFetch(`/api/resources?id=${resourceId}`, { method: 'DELETE' }), 'Errore eliminazione risorsa');
    
    const addProject = (project: Omit<Project, 'id'>) => handleApiCall(() => apiFetch('/api/projects', { method: 'POST', body: JSON.stringify(project) }), 'Errore aggiunta progetto');
    const updateProject = (project: Project) => handleApiCall(() => apiFetch(`/api/projects?id=${project.id}`, { method: 'PUT', body: JSON.stringify(project) }), 'Errore modifica progetto');
    const deleteProject = (projectId: string) => handleApiCall(() => apiFetch(`/api/projects?id=${projectId}`, { method: 'DELETE' }), 'Errore eliminazione progetto');

    const addAssignment = (assignment: Omit<Assignment, 'id'>) => handleApiCall(() => apiFetch('/api/assignments', { method: 'POST', body: JSON.stringify(assignment) }), 'Errore aggiunta assegnazione');
    const deleteAssignment = (assignmentId: string) => handleApiCall(() => apiFetch(`/api/assignments?id=${assignmentId}`, { method: 'DELETE' }), 'Errore eliminazione assegnazione');
    
    const updateAllocation = async (assignmentId: string, date: string, percentage: number) => {
        // COMMENTO: Implementata logica di "aggiornamento ottimistico" con rollback in caso di errore.
        const previousAllocations = JSON.parse(JSON.stringify(allocations)); // Deep copy per il rollback
        
        setAllocations(prev => {
            const newAllocations = JSON.parse(JSON.stringify(prev));
            if (!newAllocations[assignmentId]) newAllocations[assignmentId] = {};
            if (percentage === 0) delete newAllocations[assignmentId][date];
            else newAllocations[assignmentId][date] = percentage;
            return newAllocations;
        });

        try {
            await apiFetch('/api/allocations', { method: 'POST', body: JSON.stringify({ updates: [{ assignmentId, date, percentage }] }) });
        } catch (error) {
            alert(`Errore modifica allocazione: ${(error as Error).message}`);
            setAllocations(previousAllocations); // Ripristina lo stato precedente in caso di errore
        }
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
        await handleApiCall(() => apiFetch('/api/allocations', { method: 'POST', body: JSON.stringify({ updates }) }), 'Errore aggiornamento massivo');
    };

    const addConfigOption = (type: keyof ConfigLists, value: string) => handleApiCall(() => apiFetch(`/api/config?type=${type}`, { method: 'POST', body: JSON.stringify({ value }) }), 'Errore aggiunta opzione');
    const updateConfigOption = (type: keyof ConfigLists, option: ConfigOption) => handleApiCall(() => apiFetch(`/api/config?type=${type}&id=${option.id}`, { method: 'PUT', body: JSON.stringify(option) }), 'Errore modifica opzione');
    const deleteConfigOption = (type: keyof ConfigLists, optionId: string) => handleApiCall(() => apiFetch(`/api/config?type=${type}&id=${optionId}`, { method: 'DELETE' }), 'Errore eliminazione opzione');

    const contextValue: StaffingContextType = {
        clients, roles, resources, projects, assignments, allocations,
        horizontals, seniorityLevels, projectStatuses, clientSectors, loading,
        addClient, updateClient, deleteClient,
        addRole, updateRole, deleteRole,
        addResource, updateResource, deleteResource,
        addProject, updateProject, deleteProject,
        addAssignment, deleteAssignment,
        updateAllocation, bulkUpdateAllocations,
        addConfigOption, updateConfigOption, deleteConfigOption,
        fetchData
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
