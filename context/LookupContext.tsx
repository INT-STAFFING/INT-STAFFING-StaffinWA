/**
 * @file LookupContext.tsx
 * @description Contesto per i dati di configurazione/lookup: opzioni di configurazione, calendario aziendale e impostazioni di pianificazione.
 * Gestisce: functions, industries, seniorityLevels, projectStatuses, clientSectors, locations, companyCalendar, planningSettings.
 */

import React, { createContext, useState, useContext, useCallback, useMemo, ReactNode } from 'react';
import { ConfigOption, CalendarEvent } from '../types';
import { useToast } from './ToastContext';
import { apiFetch } from '../services/apiClient';

// --- Tipi del contesto ---

export interface LookupInitData {
    functions?: ConfigOption[];
    industries?: ConfigOption[];
    seniorityLevels?: ConfigOption[];
    projectStatuses?: ConfigOption[];
    clientSectors?: ConfigOption[];
    locations?: ConfigOption[];
    companyCalendar?: CalendarEvent[];
    planningSettings?: { monthsBefore: number; monthsAfter: number };
}

export interface LookupContextValue {
    // Stato
    functions: ConfigOption[];
    industries: ConfigOption[];
    seniorityLevels: ConfigOption[];
    projectStatuses: ConfigOption[];
    clientSectors: ConfigOption[];
    locations: ConfigOption[];
    companyCalendar: CalendarEvent[];
    planningSettings: { monthsBefore: number; monthsAfter: number };
    // CRUD opzioni di configurazione (polimorfiche per tipo)
    addConfigOption: (type: string, value: string) => Promise<void>;
    updateConfigOption: (type: string, option: ConfigOption) => Promise<void>;
    deleteConfigOption: (type: string, id: string) => Promise<void>;
    // CRUD Calendario Aziendale
    addCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<void>;
    updateCalendarEvent: (event: CalendarEvent) => Promise<void>;
    deleteCalendarEvent: (id: string) => Promise<void>;
    // Funzioni interne per il coordinator
    initialize: (data: LookupInitData) => void;
    _setPlanningSettings: (settings: { monthsBefore: number; monthsAfter: number }) => void;
}

const LookupContext = createContext<LookupContextValue | undefined>(undefined);

const getConfigSetter = (
    type: string,
    setters: Record<string, React.Dispatch<React.SetStateAction<ConfigOption[]>>>
): React.Dispatch<React.SetStateAction<ConfigOption[]>> => {
    return setters[type] || setters['locations'];
};

export const LookupProvider: React.FC<{
    children: ReactNode;
    initialPlanningSettings?: { monthsBefore: number; monthsAfter: number };
}> = ({ children, initialPlanningSettings }) => {
    const { addToast } = useToast();

    const [functions, setFunctions] = useState<ConfigOption[]>([]);
    const [industries, setIndustries] = useState<ConfigOption[]>([]);
    const [seniorityLevels, setSeniorityLevels] = useState<ConfigOption[]>([]);
    const [projectStatuses, setProjectStatuses] = useState<ConfigOption[]>([]);
    const [clientSectors, setClientSectors] = useState<ConfigOption[]>([]);
    const [locations, setLocations] = useState<ConfigOption[]>([]);
    const [companyCalendar, setCompanyCalendar] = useState<CalendarEvent[]>([]);
    const [planningSettings, setPlanningSettings] = useState<{ monthsBefore: number; monthsAfter: number }>(
        initialPlanningSettings || { monthsBefore: 6, monthsAfter: 18 }
    );

    const setterMap = useMemo(() => ({
        functions: setFunctions,
        industries: setIndustries,
        seniorityLevels: setSeniorityLevels,
        projectStatuses: setProjectStatuses,
        clientSectors: setClientSectors,
        locations: setLocations,
    }), []);

    const initialize = useCallback((data: LookupInitData) => {
        if (data.functions !== undefined) setFunctions(data.functions);
        if (data.industries !== undefined) setIndustries(data.industries);
        if (data.seniorityLevels !== undefined) setSeniorityLevels(data.seniorityLevels);
        if (data.projectStatuses !== undefined) setProjectStatuses(data.projectStatuses);
        if (data.clientSectors !== undefined) setClientSectors(data.clientSectors);
        if (data.locations !== undefined) setLocations(data.locations);
        if (data.companyCalendar !== undefined) setCompanyCalendar(data.companyCalendar);
        if (data.planningSettings !== undefined) setPlanningSettings(data.planningSettings);
    }, []);

    const _setPlanningSettings = useCallback((settings: { monthsBefore: number; monthsAfter: number }) => {
        setPlanningSettings(settings);
    }, []);

    // --- CRUD Opzioni di Configurazione ---
    const addConfigOption = useCallback(async (type: string, value: string): Promise<void> => {
        try {
            const newOpt = await apiFetch<ConfigOption>(`/api/config?type=${type}`, {
                method: 'POST', body: JSON.stringify({ value })
            });
            const setter = getConfigSetter(type, setterMap);
            setter(prev => [...prev, newOpt]);
        } catch (e) { addToast('Errore durante l\'aggiunta dell\'opzione.', 'error'); }
    }, [addToast, setterMap]);

    const updateConfigOption = useCallback(async (type: string, option: ConfigOption): Promise<void> => {
        try {
            await apiFetch(`/api/config?type=${type}&id=${option.id}`, {
                method: 'PUT', body: JSON.stringify({ value: option.value })
            });
            const setter = getConfigSetter(type, setterMap);
            setter(prev => prev.map(o => o.id === option.id ? option : o));
        } catch (e) { addToast('Errore durante l\'aggiornamento dell\'opzione.', 'error'); }
    }, [addToast, setterMap]);

    const deleteConfigOption = useCallback(async (type: string, id: string): Promise<void> => {
        try {
            await apiFetch(`/api/config?type=${type}&id=${id}`, { method: 'DELETE' });
            const setter = getConfigSetter(type, setterMap);
            setter(prev => prev.filter(o => o.id !== id));
            addToast('Opzione eliminata con successo', 'success');
        } catch (e) { addToast('Errore durante l\'eliminazione dell\'opzione.', 'error'); }
    }, [addToast, setterMap]);

    // --- CRUD Calendario Aziendale ---
    const addCalendarEvent = useCallback(async (event: Omit<CalendarEvent, 'id'>): Promise<void> => {
        try {
            const created = await apiFetch<CalendarEvent>('/api/resources?entity=company_calendar', {
                method: 'POST', body: JSON.stringify(event)
            });
            setCompanyCalendar(prev => [...prev, created]);
        } catch (e) { addToast('Errore durante l\'aggiunta dell\'evento.', 'error'); }
    }, [addToast]);

    const updateCalendarEvent = useCallback(async (event: CalendarEvent): Promise<void> => {
        try {
            const updated = await apiFetch<CalendarEvent>(
                `/api/resources?entity=company_calendar&id=${event.id}`,
                { method: 'PUT', body: JSON.stringify(event) }
            );
            setCompanyCalendar(prev => prev.map(e => e.id === event.id ? updated : e));
        } catch (e) { addToast('Errore durante l\'aggiornamento dell\'evento.', 'error'); }
    }, [addToast]);

    const deleteCalendarEvent = useCallback(async (id: string): Promise<void> => {
        try {
            await apiFetch(`/api/resources?entity=company_calendar&id=${id}`, { method: 'DELETE' });
            setCompanyCalendar(prev => prev.filter(e => e.id !== id));
        } catch (e) { addToast('Errore durante l\'eliminazione dell\'evento.', 'error'); }
    }, [addToast]);

    const value = useMemo<LookupContextValue>(() => ({
        functions, industries, seniorityLevels, projectStatuses, clientSectors, locations,
        companyCalendar, planningSettings,
        addConfigOption, updateConfigOption, deleteConfigOption,
        addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
        initialize, _setPlanningSettings,
    }), [
        functions, industries, seniorityLevels, projectStatuses, clientSectors, locations,
        companyCalendar, planningSettings,
        addConfigOption, updateConfigOption, deleteConfigOption,
        addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
        initialize, _setPlanningSettings,
    ]);

    return <LookupContext.Provider value={value}>{children}</LookupContext.Provider>;
};

export const useLookupContext = (): LookupContextValue => {
    const ctx = useContext(LookupContext);
    if (!ctx) throw new Error('useLookupContext must be used within LookupProvider');
    return ctx;
};
