/**
 * @file AppContext.tsx
 * @description Provider di contesto React per la gestione centralizzata dello stato.
 * Suddivide lo stato in due contesti per ottimizzare i re-render:
 * - EntitiesContext: Dati "statici" (clienti, progetti, etc.) e le loro funzioni CRUD.
 * - AllocationsContext: Dati delle allocazioni che cambiano frequentemente.
 */

import React, { createContext, useState, useEffect, ReactNode, useContext, useCallback, useMemo } from 'react';
import { Client, Role, Resource, Project, Assignment, Allocation, ConfigOption, CalendarEvent } from '../types';
import { isHoliday } from '../utils/dateUtils';
import { useToast } from './ToastContext';

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
    resources: Resource[];
    projects: Project[];
    assignments: Assignment[];
    horizontals: ConfigOption[];
    seniorityLevels: ConfigOption[];
    projectStatuses: ConfigOption[];
    clientSectors: ConfigOption[];
    locations: ConfigOption[];
    companyCalendar: CalendarEvent[];
    loading: boolean;
    isActionLoading: (key: string) => boolean;
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
    addMultipleAssignments: (assignments: Omit<Assignment, 'id'>[]) => Promise<void>;
    deleteAssignment: (assignmentId: string) => Promise<void>;
    addConfigOption: (type: keyof ConfigLists, value: string) => Promise<void>;
    updateConfigOption: (type: keyof ConfigLists, option: ConfigOption) => Promise<void>;
    deleteConfigOption: (type: keyof ConfigLists, optionId: string) => Promise<void>;
    addCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<void>;
    updateCalendarEvent: (event: CalendarEvent) => Promise<void>;
    deleteCalendarEvent: (eventId: string) => Promise<void>;
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
    const [resources, setResources] = useState<Resource[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [allocations, setAllocations] = useState<Allocation>({});
    const [horizontals, setHorizontals] = useState<ConfigOption[]>([]);
    const [seniorityLevels, setSeniorityLevels] = useState<ConfigOption[]>([]);
    const [projectStatuses, setProjectStatuses] = useState<ConfigOption[]>([]);
    const [clientSectors, setClientSectors] = useState<ConfigOption[]>([]);
    const [locations, setLocations] = useState<ConfigOption[]>([]);
    const [companyCalendar, setCompanyCalendar] = useState<CalendarEvent[]>([]);

    const isActionLoading = useCallback((key: string) => actionLoading.has(key), [actionLoading]);

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
            setLocations(data.locations);
            setCompanyCalendar(data.companyCalendar);
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

    // --- CRUD Operations with Local State Updates ---

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
            addToast(`Ruolo '${newRole.name}' aggiunto.`, 'success');
        } catch (error) {
            addToast(`Errore aggiunta ruolo: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);
    const updateRole = useCallback(async (role: Role) => {
        const actionKey = `updateRole-${role.id}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const updatedRole = await apiFetch(`/api/resources?entity=roles&id=${role.id}`, { method: 'PUT', body: JSON.stringify(role) });
            setRoles(prev => prev.map(r => r.id === updatedRole.id ? updatedRole : r));
            addToast(`Ruolo '${updatedRole.name}' aggiornato.`, 'success');
        } catch (error) {
            addToast(`Errore modifica ruolo: ${(error as Error).message}`, 'error');
            throw error;
        } finally {
            setActionLoading(prev => { const newSet = new Set(prev); newSet.delete(actionKey); return newSet; });
        }
    }, [addToast]);
    const deleteRole = useCallback(async (roleId: string) => {
        const roleName = roles.find(r => r.id === roleId)?.name || 'sconosciuto';
        const actionKey = `deleteRole-${roleId}`;
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            await apiFetch(`/api/resources?entity=roles&id=${roleId}`, { method: 'DELETE' });
            setRoles(prev => prev.filter(r => r.id !== roleId));
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
            const assignmentsToRemove = assignments.filter(a => a.resourceId === resourceId);
            const assignmentIdsToRemove = new Set(assignmentsToRemove.map(a => a.id));

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
            const assignmentsToRemove = assignments.filter(a => a.projectId === projectId);
            const assignmentIdsToRemove = new Set(assignmentsToRemove.map(a => a.id));

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

    const addAssignment = useCallback(async (assignment: Omit<Assignment, 'id'>) => {
        const actionKey = 'addAssignment';
        setActionLoading(prev => new Set(prev).add(actionKey));
        try {
            const newAssignment = await apiFetch('/api/assignments', { method: 'POST', body: JSON.stringify(assignment) });
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
                assignmentsToAdd.map(assignment => apiFetch('/api/assignments', { method: 'POST', body: JSON.stringify(assignment) }))
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
            await apiFetch(`/api/assignments?id=${assignmentId}`, { method: 'DELETE' });
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
            await apiFetch('/api/allocations', { method: 'POST', body: JSON.stringify({ updates: [{ assignmentId, date, percentage }] }) });
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
            await apiFetch('/api/allocations', { method: 'POST', body: JSON.stringify({ updates }) });
            addToast(`Allocazioni aggiornate con successo.`, 'success');
        } catch (error) {
            addToast(`Errore aggiornamento massivo: ${(error as Error).message}`, 'error');
            setAllocations(previousAllocations);
            throw error;
        }
    }, [assignments, resources, companyCalendar, allocations, addToast]);

    // Memoize context values to prevent unnecessary re-renders of consumers
    const entitiesContextValue = useMemo<EntitiesContextType>(() => ({
        clients, roles, resources, projects, assignments, horizontals, seniorityLevels, projectStatuses, clientSectors, locations, companyCalendar, loading, isActionLoading,
        addClient, updateClient, deleteClient,
        addRole, updateRole, deleteRole,
        addResource, updateResource, deleteResource,
        addProject, updateProject, deleteProject,
        addAssignment, addMultipleAssignments, deleteAssignment,
        addConfigOption, updateConfigOption, deleteConfigOption,
        addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
        fetchData
    }), [clients, roles, resources, projects, assignments, horizontals, seniorityLevels, projectStatuses, clientSectors, locations, companyCalendar, loading, isActionLoading, addClient, updateClient, deleteClient, addRole, updateRole, deleteRole, addResource, updateResource, deleteResource, addProject, updateProject, deleteProject, addAssignment, addMultipleAssignments, deleteAssignment, addConfigOption, updateConfigOption, deleteConfigOption, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchData]);

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