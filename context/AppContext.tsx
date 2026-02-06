/**
 * @file AppContext.tsx
 * @description ADAPTER CONTEXT.
 * Questo file mantiene la retrocompatibilità con l'intera applicazione.
 * Unisce lo stato di `CatalogContext` e `PlanningContext` in un unico oggetto `EntitiesContextType`.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { CatalogProvider, useCatalog } from './CatalogContext';
import { PlanningProvider, usePlanning } from './PlanningContext';
import { AllocationsContextType } from '../types';
import { apiFetch } from '../services/apiClient';

// Re-export types from types.ts to ensure compatibility
export type { EntitiesContextType, EntitiesState, EntitiesActions } from '../types';

export const AllocationsContext = createContext<AllocationsContextType | undefined>(undefined);
const AppStateContext = createContext<{ loading: boolean; fetchError: string | null } | undefined>(undefined);

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <CatalogProvider>
            <PlanningProvider>
                <AllocationsProviderWrapper>
                    {children}
                </AllocationsProviderWrapper>
            </PlanningProvider>
        </CatalogProvider>
    );
};

const AllocationsProviderWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { allocations, fetchPlanningData } = usePlanning();

    const updateAllocation = React.useCallback(async (assignmentId: string, date: string, percentage: number) => {
        try {
            await apiFetch('/api/allocations', { 
                method: 'POST', 
                body: JSON.stringify({ updates: [{ assignmentId, date, percentage }] }) 
            });
            fetchPlanningData(); 
        } catch (error) {
            console.error("Failed to update allocation", error);
        }
    }, [fetchPlanningData]);

    const bulkUpdateAllocations = React.useCallback(async (assignmentId: string, startDate: string, endDate: string, percentage: number) => {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const updates = [];
            while (start <= end) {
                const day = start.getDay();
                if (day !== 0 && day !== 6) {
                    updates.push({ assignmentId, date: start.toISOString().split('T')[0], percentage });
                }
                start.setDate(start.getDate() + 1);
            }
            await apiFetch('/api/allocations', { method: 'POST', body: JSON.stringify({ updates }) });
            fetchPlanningData();
        } catch (error) {
            console.error("Failed to bulk update", error);
        }
    }, [fetchPlanningData]);

    const value = useMemo(() => ({
        allocations,
        updateAllocation,
        bulkUpdateAllocations
    }), [allocations, updateAllocation, bulkUpdateAllocations]);

    return <AllocationsContext.Provider value={value}>{children}</AllocationsContext.Provider>;
};

export const useEntitiesContext = () => {
    const catalog = useCatalog();
    const planning = usePlanning();
    const loading = catalog.isCatalogLoading || planning.isPlanningLoading;

    return useMemo(() => {
        return {
            ...catalog,
            ...planning,
            loading,
            fetchData: async () => {
                await Promise.all([catalog.fetchCatalog(), planning.fetchPlanningData()]);
            },
            isActionLoading: (action: string) => {
                return !!catalog.actionLoadingMap[action] || !!planning.actionLoadingMap[action];
            }
        };
    }, [catalog, planning, loading]);
};

export const useAllocationsContext = () => {
    const context = useContext(AllocationsContext);
    if (!context) throw new Error("useAllocationsContext must be used within AppProviders");
    return context;
};

export const useAppState = () => {
    const catalog = useCatalog();
    const planning = usePlanning();
    return {
        loading: catalog.isCatalogLoading || planning.isPlanningLoading,
        fetchError: catalog.catalogError || planning.planningError
    };
};

export const useCatalogsContext = () => useCatalog();
export const usePlanningContextAdapter = () => usePlanning();
export const useConfigContext = () => useCatalog();
export const useNotificationsContext = () => usePlanning();
export const usePlanningContext = () => usePlanning();
