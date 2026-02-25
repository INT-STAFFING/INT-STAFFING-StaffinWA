/**
 * @file ResourcesContext.tsx
 * @description Contesto per la gestione delle risorse umane, dei ruoli e delle valutazioni.
 * Gestisce: resources, roles, roleCostHistory, managerResourceIds, evaluations.
 */

import React, { createContext, useState, useContext, useCallback, useMemo, ReactNode } from 'react';
import {
    Resource, Role, RoleCostHistory, ResourceEvaluation
} from '../types';
import { useToast } from './ToastContext';
import { apiFetch } from '../services/apiClient';

// --- Tipi del contesto ---

export interface ResourcesInitData {
    resources?: Resource[];
    roles?: Role[];
    roleCostHistory?: RoleCostHistory[];
    managerResourceIds?: string[];
}

export interface ResourcesContextValue {
    // Stato
    resources: Resource[];
    roles: Role[];
    roleCostHistory: RoleCostHistory[];
    managerResourceIds: string[];
    evaluations: ResourceEvaluation[];
    // CRUD Risorse (deleteResource è nel coordinator per cascade)
    addResource: (resource: Omit<Resource, 'id'>) => Promise<Resource>;
    updateResource: (resource: Resource) => Promise<void>;
    // CRUD Ruoli
    addRole: (role: Omit<Role, 'id'>) => Promise<void>;
    updateRole: (role: Role) => Promise<void>;
    deleteRole: (id: string) => Promise<void>;
    // Utility
    getRoleCost: (roleId: string, date: Date, resourceId?: string) => number;
    // Valutazioni
    fetchEvaluations: (resourceId?: string) => Promise<void>;
    addEvaluation: (evaluation: Omit<ResourceEvaluation, 'id'>) => Promise<void>;
    updateEvaluation: (evaluation: ResourceEvaluation) => Promise<void>;
    deleteEvaluation: (id: string) => Promise<void>;
    // Funzioni interne per il coordinator (cascade)
    initialize: (data: ResourcesInitData) => void;
    _removeResource: (id: string) => void;
    _setActionLoading?: (action: string, loading: boolean) => void;
}

const ResourcesContext = createContext<ResourcesContextValue | undefined>(undefined);

export const ResourcesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { addToast } = useToast();

    const [resources, setResources] = useState<Resource[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [roleCostHistory, setRoleCostHistory] = useState<RoleCostHistory[]>([]);
    const [managerResourceIds, setManagerResourceIds] = useState<string[]>([]);
    const [evaluations, setEvaluations] = useState<ResourceEvaluation[]>([]);

    const initialize = useCallback((data: ResourcesInitData) => {
        if (data.resources !== undefined) setResources(data.resources);
        if (data.roles !== undefined) setRoles(data.roles);
        if (data.roleCostHistory !== undefined) setRoleCostHistory(data.roleCostHistory);
        if (data.managerResourceIds !== undefined) setManagerResourceIds(data.managerResourceIds);
    }, []);

    const _removeResource = useCallback((id: string) => {
        setResources(prev => prev.filter(r => r.id !== id));
    }, []);

    // --- CRUD Risorse ---
    const addResource = useCallback(async (resource: Omit<Resource, 'id'>): Promise<Resource> => {
        try {
            const newResource = await apiFetch<Resource>('/api/resources?entity=resources', {
                method: 'POST',
                body: JSON.stringify(resource)
            });
            setResources(prev => [...prev, newResource]);
            addToast('Risorsa aggiunta con successo', 'success');
            return newResource;
        } catch (e: any) {
            addToast(e.message || 'Errore durante l\'aggiunta della risorsa.', 'error');
            throw e;
        }
    }, [addToast]);

    const updateResource = useCallback(async (resource: Resource): Promise<void> => {
        try {
            const updated = await apiFetch<Resource>(`/api/resources?entity=resources&id=${resource.id}`, {
                method: 'PUT',
                body: JSON.stringify(resource)
            });
            setResources(prev => prev.map(r => r.id === resource.id ? updated : r));
            addToast('Risorsa aggiornata', 'success');
        } catch (e: any) {
            addToast(e.message || 'Errore durante l\'aggiornamento della risorsa.', 'error');
            throw e;
        }
    }, [addToast]);

    // --- CRUD Ruoli ---
    const addRole = useCallback(async (role: Omit<Role, 'id'>): Promise<void> => {
        try {
            const newRole = await apiFetch<Role>('/api/resources?entity=roles', {
                method: 'POST',
                body: JSON.stringify(role)
            });
            setRoles(prev => [...prev, newRole]);
            addToast('Ruolo aggiunto con successo', 'success');
        } catch (e: any) {
            addToast(e.message || 'Errore durante l\'aggiunta del ruolo.', 'error');
            throw e;
        }
    }, [addToast]);

    const updateRole = useCallback(async (role: Role): Promise<void> => {
        try {
            const updated = await apiFetch<Role>(`/api/resources?entity=roles&id=${role.id}`, {
                method: 'PUT',
                body: JSON.stringify(role)
            });
            setRoles(prev => prev.map(r => r.id === role.id ? updated : r));
            const historyRes = await apiFetch<RoleCostHistory[]>('/api/resources?entity=role_cost_history');
            setRoleCostHistory(historyRes);
            addToast('Ruolo aggiornato', 'success');
        } catch (e: any) {
            addToast(e.message || 'Errore durante l\'aggiornamento del ruolo.', 'error');
            throw e;
        }
    }, [addToast]);

    const deleteRole = useCallback(async (id: string): Promise<void> => {
        try {
            await apiFetch(`/api/resources?entity=roles&id=${id}`, { method: 'DELETE' });
            setRoles(prev => prev.filter(r => r.id !== id));
        } catch (e: any) {
            addToast(e.message || 'Errore durante l\'eliminazione del ruolo.', 'error');
            throw e;
        }
    }, [addToast]);

    // --- Utility ---
    const getRoleCost = useCallback((roleId: string, date: Date, resourceId?: string): number => {
        if (resourceId) {
            const resource = resources.find(r => r.id === resourceId);
            if (resource && resource.dailyCost && Number(resource.dailyCost) > 0) {
                return Number(resource.dailyCost);
            }
        }
        const dateStr = date.toISOString().split('T')[0];
        const historicRecord = roleCostHistory.find(h => {
            if (h.roleId !== roleId) return false;
            return dateStr >= h.startDate && (!h.endDate || dateStr <= h.endDate);
        });
        if (historicRecord) return Number(historicRecord.dailyCost);
        const role = roles.find(r => r.id === roleId);
        return role ? Number(role.dailyCost) : 0;
    }, [resources, roles, roleCostHistory]);

    // --- Valutazioni ---
    const fetchEvaluations = useCallback(async (resourceId?: string): Promise<void> => {
        try {
            const url = resourceId
                ? `/api/resources?entity=resource_evaluations&resourceId=${resourceId}`
                : `/api/resources?entity=resource_evaluations`;
            const data = await apiFetch<ResourceEvaluation[]>(url);
            setEvaluations(data);
        } catch (e) {
            addToast('Errore durante il caricamento delle valutazioni.', 'error');
        }
    }, [addToast]);

    const addEvaluation = useCallback(async (evaluation: Omit<ResourceEvaluation, 'id'>): Promise<void> => {
        try {
            const created = await apiFetch<ResourceEvaluation>('/api/resources?entity=resource_evaluations', {
                method: 'POST',
                body: JSON.stringify(evaluation)
            });
            setEvaluations(prev => [...prev, created]);
        } catch (e) {
            addToast('Errore durante l\'aggiunta della valutazione.', 'error');
        }
    }, [addToast]);

    const updateEvaluation = useCallback(async (evaluation: ResourceEvaluation): Promise<void> => {
        try {
            const updated = await apiFetch<ResourceEvaluation>(
                `/api/resources?entity=resource_evaluations&id=${evaluation.id}`,
                { method: 'PUT', body: JSON.stringify(evaluation) }
            );
            setEvaluations(prev => prev.map(e => e.id === evaluation.id ? updated : e));
        } catch (e) {
            addToast('Errore durante l\'aggiornamento della valutazione.', 'error');
        }
    }, [addToast]);

    const deleteEvaluation = useCallback(async (id: string): Promise<void> => {
        try {
            await apiFetch(`/api/resources?entity=resource_evaluations&id=${id}`, { method: 'DELETE' });
            setEvaluations(prev => prev.filter(e => e.id !== id));
        } catch (e) {
            addToast('Errore durante l\'eliminazione della valutazione.', 'error');
        }
    }, [addToast]);

    const value = useMemo<ResourcesContextValue>(() => ({
        resources,
        roles,
        roleCostHistory,
        managerResourceIds,
        evaluations,
        addResource,
        updateResource,
        addRole,
        updateRole,
        deleteRole,
        getRoleCost,
        fetchEvaluations,
        addEvaluation,
        updateEvaluation,
        deleteEvaluation,
        initialize,
        _removeResource,
    }), [
        resources, roles, roleCostHistory, managerResourceIds, evaluations,
        addResource, updateResource, addRole, updateRole, deleteRole,
        getRoleCost, fetchEvaluations, addEvaluation, updateEvaluation, deleteEvaluation,
        initialize, _removeResource,
    ]);

    return <ResourcesContext.Provider value={value}>{children}</ResourcesContext.Provider>;
};

export const useResourcesContext = (): ResourcesContextValue => {
    const ctx = useContext(ResourcesContext);
    if (!ctx) throw new Error('useResourcesContext must be used within ResourcesProvider');
    return ctx;
};
