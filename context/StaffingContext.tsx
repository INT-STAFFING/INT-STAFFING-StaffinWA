/**
 * @file StaffingContext.tsx
 * @description Provider di contesto React per la gestione centralizzata dello stato dell'applicazione (dati, caricamento, operazioni CRUD).
 */

import React, { createContext, useState, useEffect, ReactNode, useContext, useCallback } from 'react';
// Fix: Import WbsTask type
import { Client, Role, Resource, Project, Assignment, Allocation, ConfigOption, CalendarEvent, WbsTask } from '../types';
import { isHoliday } from '../utils/dateUtils';

/**
 * @interface StaffingContextType
 * @description Definisce la struttura del contesto, includendo gli array di dati, lo stato di caricamento e le funzioni per manipolare i dati.
 */
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
    locations: ConfigOption[];
    companyCalendar: CalendarEvent[];
    // Fix: Add wbsTasks state and CRUD functions
    wbsTasks: WbsTask[];
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
    addCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<void>;
    updateCalendarEvent: (event: CalendarEvent) => Promise<void>;
    deleteCalendarEvent: (eventId: string) => Promise<void>;
    addWbsTask: (task: Omit<WbsTask, 'id'>) => Promise<void>;
    updateWbsTask: (task: WbsTask) => Promise<void>;
    deleteWbsTask: (taskId: string) => Promise<void>;
    fetchData: () => Promise<void>;
}

/**
 * @type ConfigLists
 * @description Raggruppa le liste di opzioni di configurazione per una gestione più semplice.
 */
type ConfigLists = {
    horizontals: ConfigOption[],
    seniorityLevels: ConfigOption[],
    projectStatuses: ConfigOption[],
    clientSectors: ConfigOption[],
    locations: ConfigOption[],
};

/**
 * @const StaffingContext
 * @description Istanza del contesto React.
 */
export const StaffingContext = createContext<StaffingContextType | undefined>(undefined);

/**
 * Funzione helper per effettuare chiamate API.
 * Imposta gli header di default, gestisce la serializzazione JSON e lancia un errore in caso di risposta non-OK.
 * @param {string} url - L'URL dell'endpoint API.
 * @param {RequestInit} [options={}] - Opzioni aggiuntive per la richiesta fetch.
 * @returns {Promise<any>} La risposta JSON parsata dall'API.
 */
const apiFetch = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    });
    if (!response.ok) {
        // Estrae il messaggio di errore dal server per mostrarlo all'utente.
        const errorBody = await response.json();
        throw new Error(errorBody.error || `API request failed: ${response.status}`);
    }
    if (response.status !== 204) { // No Content
        return response.json();
    }
};

/**
 * Componente Provider che incapsula la logica di gestione dello stato.
 * Fornisce i dati e le funzioni di modifica a tutti i componenti figli.
 * @param {{ children: ReactNode }} props - Prop che include i componenti figli.
 * @returns {React.ReactElement} Il provider del contesto con i figli.
 */
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
    const [locations, setLocations] = useState<ConfigOption[]>([]);
    const [companyCalendar, setCompanyCalendar] = useState<CalendarEvent[]>([]);
    // Fix: Add state for WBS tasks
    const [wbsTasks, setWbsTasks] = useState<WbsTask[]>([]);

    /**
     * Carica tutti i dati iniziali dall'API.
     * Viene eseguito al montaggio del componente e può essere richiamato per aggiornare i dati.
     */
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
            // Fix: Set WBS tasks from fetched data
            setWbsTasks(data.wbsTasks || []);
        } catch (error) {
            console.error("Failed to fetch initial data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    /**
     * Wrapper generico per le chiamate API che gestisce la logica di ricaricamento dei dati e la visualizzazione degli errori.
     * @param {() => Promise<any>} apiCall - La funzione che esegue la chiamata API.
     * @param {string} errorMessage - Il messaggio di errore da mostrare in caso di fallimento.
     */
    const handleApiCall = async (apiCall: () => Promise<any>, errorMessage: string) => {
        try {
            await apiCall();
            await fetchData(); // Ricarica tutti i dati dopo un'operazione andata a buon fine.
        } catch (error) {
            alert(`${errorMessage}: ${(error as Error).message}`);
            throw error; // Rilancia l'errore se il componente chiamante ha bisogno di gestirlo
        }
    };

    // --- Funzioni CRUD per le varie entità ---

    const addClient = (client: Omit<Client, 'id'>) => handleApiCall(() => apiFetch('/api/resources?entity=clients', { method: 'POST', body: JSON.stringify(client) }), 'Errore aggiunta cliente');
    const updateClient = (client: Client) => handleApiCall(() => apiFetch(`/api/resources?entity=clients&id=${client.id}`, { method: 'PUT', body: JSON.stringify(client) }), 'Errore modifica cliente');
    const deleteClient = (clientId: string) => handleApiCall(() => apiFetch(`/api/resources?entity=clients&id=${clientId}`, { method: 'DELETE' }), 'Errore eliminazione cliente');

    const addRole = (role: Omit<Role, 'id'>) => handleApiCall(() => apiFetch('/api/resources?entity=roles', { method: 'POST', body: JSON.stringify(role) }), 'Errore aggiunta ruolo');
    const updateRole = (role: Role) => handleApiCall(() => apiFetch(`/api/resources?entity=roles&id=${role.id}`, { method: 'PUT', body: JSON.stringify(role) }), 'Errore modifica ruolo');
    const deleteRole = (roleId: string) => handleApiCall(() => apiFetch(`/api/resources?entity=roles&id=${roleId}`, { method: 'DELETE' }), 'Errore eliminazione ruolo');
    
    const addResource = (resource: Omit<Resource, 'id'>) => handleApiCall(() => apiFetch('/api/resources?entity=resources', { method: 'POST', body: JSON.stringify(resource) }), 'Errore aggiunta risorsa');
    const updateResource = (resource: Resource) => handleApiCall(() => apiFetch(`/api/resources?entity=resources&id=${resource.id}`, { method: 'PUT', body: JSON.stringify(resource) }), 'Errore modifica risorsa');
    const deleteResource = (resourceId: string) => handleApiCall(() => apiFetch(`/api/resources?entity=resources&id=${resourceId}`, { method: 'DELETE' }), 'Errore eliminazione risorsa');
    
    const addProject = (project: Omit<Project, 'id'>) => handleApiCall(() => apiFetch('/api/resources?entity=projects', { method: 'POST', body: JSON.stringify(project) }), 'Errore aggiunta progetto');
    const updateProject = (project: Project) => handleApiCall(() => apiFetch(`/api/resources?entity=projects&id=${project.id}`, { method: 'PUT', body: JSON.stringify(project) }), 'Errore modifica progetto');
    const deleteProject = (projectId: string) => handleApiCall(() => apiFetch(`/api/resources?entity=projects&id=${projectId}`, { method: 'DELETE' }), 'Errore eliminazione progetto');

    const addAssignment = (assignment: Omit<Assignment, 'id'>) => handleApiCall(() => apiFetch('/api/assignments', { method: 'POST', body: JSON.stringify(assignment) }), 'Errore aggiunta assegnazione');
    const deleteAssignment = (assignmentId: string) => handleApiCall(() => apiFetch(`/api/assignments?id=${assignmentId}`, { method: 'DELETE' }), 'Errore eliminazione assegnazione');
    
    /**
     * Aggiorna una singola allocazione giornaliera.
     * Utilizza una logica di "aggiornamento ottimistico": l'UI viene aggiornata immediatamente
     * e, in caso di errore della chiamata API, lo stato viene ripristinato.
     * @param {string} assignmentId - L'ID dell'assegnazione da modificare.
     * @param {string} date - La data (YYYY-MM-DD) dell'allocazione.
     * @param {number} percentage - La nuova percentuale di allocazione.
     */
    const updateAllocation = async (assignmentId: string, date: string, percentage: number) => {
        const previousAllocations = JSON.parse(JSON.stringify(allocations)); // Deep copy per il rollback
        
        // Aggiornamento ottimistico dello stato locale
        setAllocations(prev => {
            const newAllocations = JSON.parse(JSON.stringify(prev));
            if (!newAllocations[assignmentId]) newAllocations[assignmentId] = {};
            if (percentage === 0) {
                delete newAllocations[assignmentId][date];
            } else {
                newAllocations[assignmentId][date] = percentage;
            }
            return newAllocations;
        });

        try {
            await apiFetch('/api/allocations', { method: 'POST', body: JSON.stringify({ updates: [{ assignmentId, date, percentage }] }) });
        } catch (error) {
            alert(`Errore modifica allocazione: ${(error as Error).message}`);
            setAllocations(previousAllocations); // Rollback in caso di errore
        }
    };
    
    /**
     * Esegue un aggiornamento massivo delle allocazioni per un dato intervallo di date.
     * @param {string} assignmentId - L'ID dell'assegnazione.
     * @param {string} startDate - La data di inizio (YYYY-MM-DD).
     * @param {string} endDate - La data di fine (YYYY-MM-DD).
     * @param {number} percentage - La percentuale da applicare a tutti i giorni lavorativi nell'intervallo.
     */
    const bulkUpdateAllocations = async (assignmentId: string, startDate: string, endDate: string, percentage: number) => {
        const assignment = assignments.find(a => a.id === assignmentId);
        const resource = resources.find(r => r.id === assignment?.resourceId);

        const updates = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
            const dayOfWeek = d.getDay();
            const dateStr = d.toISOString().split('T')[0];
            const isNonWorkingDay = dayOfWeek === 0 || dayOfWeek === 6 || isHoliday(d, resource?.location ?? null, companyCalendar);
            
            if (!isNonWorkingDay) {
                updates.push({ assignmentId, date: dateStr, percentage });
            }
        }
        await handleApiCall(() => apiFetch('/api/allocations', { method: 'POST', body: JSON.stringify({ updates }) }), 'Errore aggiornamento massivo');
    };

    // --- Funzioni CRUD per le opzioni di configurazione ---

    const addConfigOption = (type: keyof ConfigLists, value: string) => handleApiCall(() => apiFetch(`/api/config?type=${type}`, { method: 'POST', body: JSON.stringify({ value }) }), 'Errore aggiunta opzione');
    const updateConfigOption = (type: keyof ConfigLists, option: ConfigOption) => handleApiCall(() => apiFetch(`/api/config?type=${type}&id=${option.id}`, { method: 'PUT', body: JSON.stringify(option) }), 'Errore modifica opzione');
    const deleteConfigOption = (type: keyof ConfigLists, optionId: string) => handleApiCall(() => apiFetch(`/api/config?type=${type}&id=${optionId}`, { method: 'DELETE' }), 'Errore eliminazione opzione');

    // --- Funzioni CRUD per il Calendario Aziendale ---

    const addCalendarEvent = (event: Omit<CalendarEvent, 'id'>) => handleApiCall(() => apiFetch('/api/resources?entity=calendar', { method: 'POST', body: JSON.stringify(event) }), 'Errore aggiunta evento');
    const updateCalendarEvent = (event: CalendarEvent) => handleApiCall(() => apiFetch(`/api/resources?entity=calendar&id=${event.id}`, { method: 'PUT', body: JSON.stringify(event) }), 'Errore modifica evento');
    const deleteCalendarEvent = (eventId: string) => handleApiCall(() => apiFetch(`/api/resources?entity=calendar&id=${eventId}`, { method: 'DELETE' }), 'Errore eliminazione evento');
    
    // Fix: Add CRUD functions for WBS tasks
    const addWbsTask = (task: Omit<WbsTask, 'id'>) => handleApiCall(() => apiFetch('/api/resources?entity=wbsTasks', { method: 'POST', body: JSON.stringify(task) }), 'Errore aggiunta incarico WBS');
    const updateWbsTask = (task: WbsTask) => handleApiCall(() => apiFetch(`/api/resources?entity=wbsTasks&id=${task.id}`, { method: 'PUT', body: JSON.stringify(task) }), 'Errore modifica incarico WBS');
    const deleteWbsTask = (taskId: string) => handleApiCall(() => apiFetch(`/api/resources?entity=wbsTasks&id=${taskId}`, { method: 'DELETE' }), 'Errore eliminazione incarico WBS');


    const contextValue: StaffingContextType = {
        clients, roles, resources, projects, assignments, allocations,
        horizontals, seniorityLevels, projectStatuses, clientSectors, locations, companyCalendar, wbsTasks, loading,
        addClient, updateClient, deleteClient,
        addRole, updateRole, deleteRole,
        addResource, updateResource, deleteResource,
        addProject, updateProject, deleteProject,
        addAssignment, deleteAssignment,
        updateAllocation, bulkUpdateAllocations,
        addConfigOption, updateConfigOption, deleteConfigOption,
        addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
        addWbsTask, updateWbsTask, deleteWbsTask,
        fetchData
    };

    return (
        <StaffingContext.Provider value={contextValue}>
            {children}
        </StaffingContext.Provider>
    );
};

/**
 * Hook personalizzato per accedere facilmente al contesto di staffing.
 * @returns {StaffingContextType} Il valore del contesto.
 * @throws {Error} Se usato al di fuori di un `StaffingProvider`.
 */
export const useStaffingContext = () => {
    const context = useContext(StaffingContext);
    if (!context) {
        throw new Error('useStaffingContext must be used within a StaffingProvider');
    }
    return context;
};