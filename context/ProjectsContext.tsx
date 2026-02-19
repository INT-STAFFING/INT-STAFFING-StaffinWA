/**
 * @file ProjectsContext.tsx
 * @description Contesto per la gestione di progetti, clienti, contratti, assegnazioni, rate card e dati finanziari.
 */

import React, { createContext, useState, useContext, useCallback, useMemo, ReactNode } from 'react';
import {
    Project, Client, Contract, ContractProject, ContractManager,
    Assignment, BillingMilestone, ProjectExpense, WbsTask,
    RateCard, RateCardEntry
} from '../types';
import { useToast } from './ToastContext';
import { apiFetch } from '../services/apiClient';

// --- Tipi del contesto ---

export interface ProjectsInitData {
    projects?: Project[];
    clients?: Client[];
    contracts?: Contract[];
    contractProjects?: ContractProject[];
    contractManagers?: ContractManager[];
    assignments?: Assignment[];
    billingMilestones?: BillingMilestone[];
    projectExpenses?: ProjectExpense[];
    wbsTasks?: WbsTask[];
    rateCards?: RateCard[];
    rateCardEntries?: RateCardEntry[];
}

export interface ProjectsContextValue {
    // Stato
    projects: Project[];
    clients: Client[];
    contracts: Contract[];
    contractProjects: ContractProject[];
    contractManagers: ContractManager[];
    assignments: Assignment[];
    billingMilestones: BillingMilestone[];
    projectExpenses: ProjectExpense[];
    wbsTasks: WbsTask[];
    rateCards: RateCard[];
    rateCardEntries: RateCardEntry[];
    // CRUD Progetti (deleteProject nel coordinator per cascade con SkillsContext)
    addProject: (project: Omit<Project, 'id'>) => Promise<Project | null>;
    updateProject: (project: Project) => Promise<void>;
    // CRUD Clienti
    addClient: (client: Omit<Client, 'id'>) => Promise<void>;
    updateClient: (client: Client) => Promise<void>;
    deleteClient: (id: string) => Promise<void>;
    // CRUD Contratti
    addContract: (contract: Omit<Contract, 'id'>, projectIds: string[], managerIds: string[]) => Promise<void>;
    updateContract: (contract: Contract, projectIds: string[], managerIds: string[]) => Promise<void>;
    deleteContract: (id: string) => Promise<void>;
    recalculateContractBacklog: (id: string) => Promise<void>;
    // Assegnazioni
    addMultipleAssignments: (newAssignments: { resourceId: string; projectId: string }[]) => Promise<void>;
    deleteAssignment: (id: string) => Promise<void>;
    // Billing Milestone CRUD
    addBillingMilestone: (milestone: Omit<BillingMilestone, 'id'>) => Promise<void>;
    updateBillingMilestone: (milestone: BillingMilestone) => Promise<void>;
    deleteBillingMilestone: (id: string) => Promise<void>;
    // Project Expense CRUD
    addProjectExpense: (expense: Omit<ProjectExpense, 'id'>) => Promise<void>;
    updateProjectExpense: (expense: ProjectExpense) => Promise<void>;
    deleteProjectExpense: (id: string) => Promise<void>;
    // Rate Card CRUD
    addRateCard: (rateCard: Omit<RateCard, 'id'>) => Promise<void>;
    updateRateCard: (rateCard: RateCard) => Promise<void>;
    deleteRateCard: (id: string) => Promise<void>;
    upsertRateCardEntries: (entries: RateCardEntry[]) => Promise<void>;
    // Utility
    getSellRate: (rateCardId: string | null | undefined, resourceId: string) => number;
    // Funzioni interne per il coordinator (cascade)
    initialize: (data: ProjectsInitData) => void;
    _removeProject: (id: string) => void;
    _removeAssignmentsByResource: (resourceId: string) => void;
    _removeAssignmentsByProject: (projectId: string) => void;
}

const ProjectsContext = createContext<ProjectsContextValue | undefined>(undefined);

export const ProjectsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { addToast } = useToast();

    const [projects, setProjects] = useState<Project[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [contractProjects, setContractProjects] = useState<ContractProject[]>([]);
    const [contractManagers, setContractManagers] = useState<ContractManager[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [billingMilestones, setBillingMilestones] = useState<BillingMilestone[]>([]);
    const [projectExpenses, setProjectExpenses] = useState<ProjectExpense[]>([]);
    const [wbsTasks, setWbsTasks] = useState<WbsTask[]>([]);
    const [rateCards, setRateCards] = useState<RateCard[]>([]);
    const [rateCardEntries, setRateCardEntries] = useState<RateCardEntry[]>([]);

    const initialize = useCallback((data: ProjectsInitData) => {
        if (data.projects !== undefined) setProjects(data.projects);
        if (data.clients !== undefined) setClients(data.clients);
        if (data.contracts !== undefined) setContracts(data.contracts);
        if (data.contractProjects !== undefined) setContractProjects(data.contractProjects);
        if (data.contractManagers !== undefined) setContractManagers(data.contractManagers);
        if (data.assignments !== undefined) setAssignments(data.assignments);
        if (data.billingMilestones !== undefined) setBillingMilestones(data.billingMilestones);
        if (data.projectExpenses !== undefined) setProjectExpenses(data.projectExpenses);
        if (data.wbsTasks !== undefined) setWbsTasks(data.wbsTasks);
        if (data.rateCards !== undefined) setRateCards(data.rateCards);
        if (data.rateCardEntries !== undefined) setRateCardEntries(data.rateCardEntries);
    }, []);

    const _removeProject = useCallback((id: string) => {
        setProjects(prev => prev.filter(p => p.id !== id));
        setAssignments(prev => prev.filter(a => a.projectId !== id));
    }, []);

    const _removeAssignmentsByResource = useCallback((resourceId: string) => {
        setAssignments(prev => prev.filter(a => a.resourceId !== resourceId));
    }, []);

    const _removeAssignmentsByProject = useCallback((projectId: string) => {
        setAssignments(prev => prev.filter(a => a.projectId !== projectId));
    }, []);

    // --- CRUD Progetti ---
    const addProject = useCallback(async (project: Omit<Project, 'id'>): Promise<Project | null> => {
        const newProject = await apiFetch<Project | null>('/api/resources?entity=projects', {
            method: 'POST',
            body: JSON.stringify(project)
        });
        setProjects(prev => [...prev, newProject!]);
        return newProject;
    }, []);

    const updateProject = useCallback(async (project: Project): Promise<void> => {
        try {
            const updated = await apiFetch<Project>(`/api/resources?entity=projects&id=${project.id}`, {
                method: 'PUT',
                body: JSON.stringify(project)
            });
            setProjects(prev => prev.map(p => p.id === project.id ? updated : p));
            addToast('Progetto aggiornato', 'success');
        } catch (e: any) {
            addToast(e.message, 'error');
        }
    }, [addToast]);

    // --- CRUD Clienti ---
    const addClient = useCallback(async (client: Omit<Client, 'id'>): Promise<void> => {
        try {
            const newClient = await apiFetch<Client>('/api/resources?entity=clients', {
                method: 'POST',
                body: JSON.stringify(client)
            });
            setClients(prev => [...prev, newClient]);
        } catch (e) {
            addToast('Errore durante l\'aggiunta del cliente.', 'error');
        }
    }, [addToast]);

    const updateClient = useCallback(async (client: Client): Promise<void> => {
        try {
            const updated = await apiFetch<Client>(`/api/resources?entity=clients&id=${client.id}`, {
                method: 'PUT',
                body: JSON.stringify(client)
            });
            setClients(prev => prev.map(c => c.id === client.id ? updated : c));
            addToast('Cliente aggiornato', 'success');
        } catch (e: any) {
            addToast(e.message, 'error');
        }
    }, [addToast]);

    const deleteClient = useCallback(async (id: string): Promise<void> => {
        try {
            await apiFetch(`/api/resources?entity=clients&id=${id}`, { method: 'DELETE' });
            setClients(prev => prev.filter(c => c.id !== id));
        } catch (e) {
            addToast('Errore durante l\'eliminazione del cliente.', 'error');
        }
    }, [addToast]);

    // --- CRUD Contratti ---
    const addContract = useCallback(async (
        contract: Omit<Contract, 'id'>,
        projectIds: string[],
        managerIds: string[]
    ): Promise<void> => {
        const newContract = await apiFetch<Contract>('/api/resources?entity=contracts', {
            method: 'POST',
            body: JSON.stringify(contract)
        });
        await Promise.all([
            ...projectIds.map(pid => apiFetch('/api/resources?entity=contract_projects', {
                method: 'POST',
                body: JSON.stringify({ contractId: newContract.id, projectId: pid })
            })),
            ...managerIds.map(mid => apiFetch('/api/resources?entity=contract_managers', {
                method: 'POST',
                body: JSON.stringify({ contractId: newContract.id, resourceId: mid })
            }))
        ]);
        setContracts(prev => [...prev, newContract]);
        setContractProjects(prev => [...prev, ...projectIds.map(pid => ({ contractId: newContract.id!, projectId: pid }))]);
        setContractManagers(prev => [...prev, ...managerIds.map(mid => ({ contractId: newContract.id!, resourceId: mid }))]);
    }, []);

    const updateContract = useCallback(async (
        contract: Contract,
        projectIds: string[],
        managerIds: string[]
    ): Promise<void> => {
        const updated = await apiFetch<Contract>(`/api/resources?entity=contracts&id=${contract.id}`, {
            method: 'PUT',
            body: JSON.stringify(contract)
        });
        setContracts(prev => prev.map(c => c.id === contract.id ? updated : c));
    }, []);

    const deleteContract = useCallback(async (id: string): Promise<void> => {
        await apiFetch(`/api/resources?entity=contracts&id=${id}`, { method: 'DELETE' });
        setContracts(prev => prev.filter(c => c.id !== id));
        setContractProjects(prev => prev.filter(cp => cp.contractId !== id));
        setContractManagers(prev => prev.filter(cm => cm.contractId !== id));
    }, []);

    const recalculateContractBacklog = useCallback(async (id: string): Promise<void> => {
        const contract = contracts.find(c => c.id === id);
        if (!contract) return;
        const linkedProjects = contractProjects.filter(cp => cp.contractId === id).map(cp => cp.projectId);
        const usedBudget = projects.filter(p => linkedProjects.includes(p.id!)).reduce((sum, p) => sum + Number(p.budget || 0), 0);
        const newBacklog = Number(contract.capienza) - usedBudget;
        await updateContract({ ...contract, backlog: newBacklog }, linkedProjects, []);
    }, [contracts, contractProjects, projects, updateContract]);

    // --- Assegnazioni ---
    const addMultipleAssignments = useCallback(async (
        newAssignments: { resourceId: string; projectId: string }[]
    ): Promise<void> => {
        try {
            const created = await Promise.all(
                newAssignments.map(a => apiFetch<Assignment | { message: string }>('/api/assignments', {
                    method: 'POST',
                    body: JSON.stringify(a)
                }))
            );
            setAssignments(prev => [...prev, ...created.filter((a): a is Assignment => !('message' in a))]);
        } catch (e) {
            addToast('Errore durante la creazione delle assegnazioni.', 'error');
        }
    }, [addToast]);

    const deleteAssignment = useCallback(async (id: string): Promise<void> => {
        try {
            await apiFetch(`/api/assignments?id=${id}`, { method: 'DELETE' });
            setAssignments(prev => prev.filter(a => a.id !== id));
        } catch (e) {
            addToast('Errore durante l\'eliminazione dell\'assegnazione.', 'error');
        }
    }, [addToast]);

    // --- CRUD Billing Milestones ---
    const addBillingMilestone = useCallback(async (milestone: Omit<BillingMilestone, 'id'>): Promise<void> => {
        try {
            const created = await apiFetch<BillingMilestone>('/api/resources?entity=billing_milestones', {
                method: 'POST', body: JSON.stringify(milestone)
            });
            setBillingMilestones(prev => [...prev, created]);
        } catch (e) { addToast('Errore durante l\'aggiunta della milestone.', 'error'); }
    }, [addToast]);

    const updateBillingMilestone = useCallback(async (milestone: BillingMilestone): Promise<void> => {
        try {
            const updated = await apiFetch<BillingMilestone>(
                `/api/resources?entity=billing_milestones&id=${milestone.id}`,
                { method: 'PUT', body: JSON.stringify(milestone) }
            );
            setBillingMilestones(prev => prev.map(m => m.id === milestone.id ? updated : m));
        } catch (e) { addToast('Errore durante l\'aggiornamento della milestone.', 'error'); }
    }, [addToast]);

    const deleteBillingMilestone = useCallback(async (id: string): Promise<void> => {
        try {
            await apiFetch(`/api/resources?entity=billing_milestones&id=${id}`, { method: 'DELETE' });
            setBillingMilestones(prev => prev.filter(m => m.id !== id));
        } catch (e) { addToast('Errore durante l\'eliminazione della milestone.', 'error'); }
    }, [addToast]);

    // --- CRUD Project Expenses ---
    const addProjectExpense = useCallback(async (expense: Omit<ProjectExpense, 'id'>): Promise<void> => {
        try {
            const created = await apiFetch<ProjectExpense>('/api/resources?entity=project_expenses', {
                method: 'POST', body: JSON.stringify(expense)
            });
            setProjectExpenses(prev => [...prev, created]);
        } catch (e) { addToast('Errore durante l\'aggiunta della spesa.', 'error'); }
    }, [addToast]);

    const updateProjectExpense = useCallback(async (expense: ProjectExpense): Promise<void> => {
        try {
            const updated = await apiFetch<ProjectExpense>(
                `/api/resources?entity=project_expenses&id=${expense.id}`,
                { method: 'PUT', body: JSON.stringify(expense) }
            );
            setProjectExpenses(prev => prev.map(e => e.id === expense.id ? updated : e));
        } catch (e) { addToast('Errore durante l\'aggiornamento della spesa.', 'error'); }
    }, [addToast]);

    const deleteProjectExpense = useCallback(async (id: string): Promise<void> => {
        try {
            await apiFetch(`/api/resources?entity=project_expenses&id=${id}`, { method: 'DELETE' });
            setProjectExpenses(prev => prev.filter(e => e.id !== id));
        } catch (e) { addToast('Errore durante l\'eliminazione della spesa.', 'error'); }
    }, [addToast]);

    // --- CRUD Rate Cards ---
    const addRateCard = useCallback(async (rateCard: Omit<RateCard, 'id'>): Promise<void> => {
        try {
            const created = await apiFetch<RateCard>('/api/resources?entity=rate_cards', {
                method: 'POST', body: JSON.stringify(rateCard)
            });
            setRateCards(prev => [...prev, created]);
        } catch (e) { addToast('Errore durante l\'aggiunta della rate card.', 'error'); }
    }, [addToast]);

    const updateRateCard = useCallback(async (rateCard: RateCard): Promise<void> => {
        try {
            const updated = await apiFetch<RateCard>(
                `/api/resources?entity=rate_cards&id=${rateCard.id}`,
                { method: 'PUT', body: JSON.stringify(rateCard) }
            );
            setRateCards(prev => prev.map(r => r.id === rateCard.id ? updated : r));
        } catch (e) { addToast('Errore durante l\'aggiornamento della rate card.', 'error'); }
    }, [addToast]);

    const deleteRateCard = useCallback(async (id: string): Promise<void> => {
        try {
            await apiFetch(`/api/resources?entity=rate_cards&id=${id}`, { method: 'DELETE' });
            setRateCards(prev => prev.filter(r => r.id !== id));
        } catch (e) { addToast('Errore durante l\'eliminazione della rate card.', 'error'); }
    }, [addToast]);

    const upsertRateCardEntries = useCallback(async (entries: RateCardEntry[]): Promise<void> => {
        if (entries.length === 0) return;
        try {
            await apiFetch('/api/resources?entity=rate_card_entries', {
                method: 'POST', body: JSON.stringify({ entries })
            });
            const entriesRes = await apiFetch<RateCardEntry[]>('/api/resources?entity=rate_card_entries');
            setRateCardEntries(entriesRes || []);
        } catch (e) { addToast('Errore durante l\'aggiornamento delle tariffe.', 'error'); }
    }, [addToast]);

    // --- Utility ---
    const getSellRate = useCallback((rateCardId: string | null | undefined, resourceId: string): number => {
        if (!rateCardId) return 0;
        const entry = rateCardEntries.find(e => e.rateCardId === rateCardId && e.resourceId === resourceId);
        return entry ? Number(entry.dailyRate) : 0;
    }, [rateCardEntries]);

    const value = useMemo<ProjectsContextValue>(() => ({
        projects, clients, contracts, contractProjects, contractManagers,
        assignments, billingMilestones, projectExpenses, wbsTasks, rateCards, rateCardEntries,
        addProject, updateProject,
        addClient, updateClient, deleteClient,
        addContract, updateContract, deleteContract, recalculateContractBacklog,
        addMultipleAssignments, deleteAssignment,
        addBillingMilestone, updateBillingMilestone, deleteBillingMilestone,
        addProjectExpense, updateProjectExpense, deleteProjectExpense,
        addRateCard, updateRateCard, deleteRateCard, upsertRateCardEntries,
        getSellRate,
        initialize, _removeProject, _removeAssignmentsByResource, _removeAssignmentsByProject,
    }), [
        projects, clients, contracts, contractProjects, contractManagers,
        assignments, billingMilestones, projectExpenses, wbsTasks, rateCards, rateCardEntries,
        addProject, updateProject,
        addClient, updateClient, deleteClient,
        addContract, updateContract, deleteContract, recalculateContractBacklog,
        addMultipleAssignments, deleteAssignment,
        addBillingMilestone, updateBillingMilestone, deleteBillingMilestone,
        addProjectExpense, updateProjectExpense, deleteProjectExpense,
        addRateCard, updateRateCard, deleteRateCard, upsertRateCardEntries,
        getSellRate,
        initialize, _removeProject, _removeAssignmentsByResource, _removeAssignmentsByProject,
    ]);

    return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
};

export const useProjectsContext = (): ProjectsContextValue => {
    const ctx = useContext(ProjectsContext);
    if (!ctx) throw new Error('useProjectsContext must be used within ProjectsProvider');
    return ctx;
};
