/**
 * @file UIConfigContext.tsx
 * @description Contesto per la configurazione dell'interfaccia: sidebar, notifiche, layout dashboard e visibilità pagine.
 * Gestisce: sidebarConfig, quickActions, sidebarSections, notifications, notificationConfigs/Rules, pageVisibility, analyticsCache.
 */

import React, { createContext, useState, useContext, useCallback, useMemo, ReactNode } from 'react';
import {
    SidebarItem, SidebarSectionColors, SidebarFooterAction,
    DashboardCategory, QuickAction, Notification,
    NotificationConfig, NotificationRule, PageVisibility
} from '../types';
import { useToast } from './ToastContext';
import { apiFetch } from '../services/apiClient';

// --- Costanti di default ---
const DEFAULT_SIDEBAR_CONFIG: SidebarItem[] = [];
const DEFAULT_SIDEBAR_SECTIONS = ['Principale', 'Progetti', 'Risorse', 'Operatività', 'Supporto', 'Configurazione', 'Dati'];
const DEFAULT_SIDEBAR_FOOTER_ACTIONS: SidebarFooterAction[] = [
    { id: 'changePassword', label: 'Cambia Password', icon: 'lock_reset' },
    { id: 'logout', label: 'Logout', icon: 'logout' }
];
const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
    { label: 'Vai allo Staffing', icon: 'calendar_month', link: '/staffing' },
    { label: 'Apri Dashboard', icon: 'dashboard', link: '/dashboard' },
    { label: 'Mappa Competenze', icon: 'school', link: '/skills-map' },
    { label: 'Carico Risorse', icon: 'groups', link: '/workload' },
];
const DEFAULT_DASHBOARD_LAYOUT: DashboardCategory[] = [
    { id: 'generale', label: 'Generale', cards: ['kpiHeader', 'attentionCards', 'leavesOverview', 'unallocatedFte'] },
    { id: 'staffing', label: 'Staffing', cards: ['averageAllocation', 'underutilizedResources', 'saturationTrend'] },
    { id: 'progetti', label: 'Progetti', cards: ['ftePerProject', 'budgetAnalysis', 'temporalBudgetAnalysis', 'averageDailyRate'] },
    { id: 'contratti', label: 'Economico', cards: ['monthlyClientCost', 'effortByFunction', 'effortByIndustry', 'locationAnalysis', 'costForecast'] }
];
const DEFAULT_ROLE_HOME_PAGES: Record<string, string> = {
    'SIMPLE': '/staffing',
    'MANAGER': '/dashboard',
    'ADMIN': '/dashboard'
};

// --- Tipi del contesto ---

export interface UIConfigInitData {
    sidebarConfig?: SidebarItem[];
    quickActions?: QuickAction[];
    sidebarSections?: string[];
    sidebarSectionColors?: SidebarSectionColors;
    sidebarFooterActions?: SidebarFooterAction[];
    dashboardLayout?: DashboardCategory[];
    roleHomePages?: Record<string, string>;
    bottomNavPaths?: string[];
    pageVisibility?: PageVisibility;
    notificationConfigs?: NotificationConfig[];
    notificationRules?: NotificationRule[];
    analyticsCache?: Record<string, unknown>;
}

export interface UIConfigContextValue {
    // Stato
    sidebarConfig: SidebarItem[];
    quickActions: QuickAction[];
    sidebarSections: string[];
    sidebarSectionColors: SidebarSectionColors;
    sidebarFooterActions: SidebarFooterAction[];
    dashboardLayout: DashboardCategory[];
    roleHomePages: Record<string, string>;
    bottomNavPaths: string[];
    pageVisibility: PageVisibility;
    notifications: Notification[];
    notificationConfigs: NotificationConfig[];
    notificationRules: NotificationRule[];
    analyticsCache: Record<string, unknown>;
    // Aggiornamenti configurazione
    updateSidebarConfig: (config: SidebarItem[]) => Promise<void>;
    updateQuickActions: (actions: QuickAction[]) => Promise<void>;
    updateSidebarSections: (sections: string[]) => Promise<void>;
    updateSidebarSectionColors: (colors: SidebarSectionColors) => Promise<void>;
    updateSidebarFooterActions: (actions: SidebarFooterAction[]) => Promise<void>;
    updateDashboardLayout: (layout: DashboardCategory[]) => Promise<void>;
    updateRoleHomePages: (pages: Record<string, string>) => Promise<void>;
    updateBottomNavPaths: (paths: string[]) => Promise<void>;
    updatePageVisibility: (visibility: PageVisibility) => Promise<void>;
    // Notifiche
    fetchNotifications: () => Promise<void>;
    markNotificationAsRead: (id?: string) => Promise<void>;
    // CRUD NotificationConfig
    addNotificationConfig: (config: Omit<NotificationConfig, 'id'>) => Promise<void>;
    updateNotificationConfig: (config: NotificationConfig) => Promise<void>;
    deleteNotificationConfig: (id: string) => Promise<void>;
    // CRUD NotificationRule (errori propagati al chiamante)
    addNotificationRule: (rule: Omit<NotificationRule, 'id'>) => Promise<void>;
    updateNotificationRule: (rule: NotificationRule) => Promise<void>;
    deleteNotificationRule: (id: string) => Promise<void>;
    // Analytics
    forceRecalculateAnalytics: () => Promise<void>;
    // Funzioni interne per il coordinator
    initialize: (data: UIConfigInitData) => void;
}

const UIConfigContext = createContext<UIConfigContextValue | undefined>(undefined);

// Helper per aggiornamenti di configurazione batch
const makeConfigUpdate = <T,>(
    key: string,
    setter: React.Dispatch<React.SetStateAction<T>>,
    addToast: (msg: string, type: 'error' | 'success') => void
) => {
    return async (value: T): Promise<void> => {
        try {
            await apiFetch('/api/resources?entity=app-config-batch', {
                method: 'POST',
                body: JSON.stringify({ updates: [{ key, value: JSON.stringify(value) }] })
            });
            setter(value);
        } catch (e) { addToast('Errore durante l\'aggiornamento della configurazione.', 'error'); }
    };
};

export const UIConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { addToast } = useToast();

    const [sidebarConfig, setSidebarConfig] = useState<SidebarItem[]>(DEFAULT_SIDEBAR_CONFIG);
    const [quickActions, setQuickActions] = useState<QuickAction[]>(DEFAULT_QUICK_ACTIONS);
    const [sidebarSections, setSidebarSections] = useState<string[]>(DEFAULT_SIDEBAR_SECTIONS);
    const [sidebarSectionColors, setSidebarSectionColors] = useState<SidebarSectionColors>({});
    const [sidebarFooterActions, setSidebarFooterActions] = useState<SidebarFooterAction[]>(DEFAULT_SIDEBAR_FOOTER_ACTIONS);
    const [dashboardLayout, setDashboardLayout] = useState<DashboardCategory[]>(DEFAULT_DASHBOARD_LAYOUT);
    const [roleHomePages, setRoleHomePages] = useState<Record<string, string>>(DEFAULT_ROLE_HOME_PAGES);
    const [bottomNavPaths, setBottomNavPaths] = useState<string[]>([]);
    const [pageVisibility, setPageVisibility] = useState<PageVisibility>({});
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [notificationConfigs, setNotificationConfigs] = useState<NotificationConfig[]>([]);
    const [notificationRules, setNotificationRules] = useState<NotificationRule[]>([]);
    const [analyticsCache, setAnalyticsCache] = useState<Record<string, unknown>>({});

    const initialize = useCallback((data: UIConfigInitData) => {
        if (data.sidebarConfig !== undefined) setSidebarConfig(data.sidebarConfig);
        if (data.quickActions !== undefined) setQuickActions(data.quickActions);
        if (data.sidebarSections !== undefined) setSidebarSections(data.sidebarSections);
        if (data.sidebarSectionColors !== undefined) setSidebarSectionColors(data.sidebarSectionColors);
        if (data.sidebarFooterActions !== undefined) setSidebarFooterActions(data.sidebarFooterActions);
        if (data.dashboardLayout !== undefined) setDashboardLayout(data.dashboardLayout);
        if (data.roleHomePages !== undefined) setRoleHomePages(data.roleHomePages);
        if (data.bottomNavPaths !== undefined) setBottomNavPaths(data.bottomNavPaths);
        if (data.pageVisibility !== undefined) setPageVisibility(data.pageVisibility);
        if (data.notificationConfigs !== undefined) setNotificationConfigs(data.notificationConfigs);
        if (data.notificationRules !== undefined) setNotificationRules(data.notificationRules);
        if (data.analyticsCache !== undefined) setAnalyticsCache(data.analyticsCache);
    }, []);

    // --- Aggiornamenti configurazione ---
    const updateSidebarConfig = useMemo(() => makeConfigUpdate<SidebarItem[]>('sidebar_layout_v1', setSidebarConfig, addToast), [addToast]);
    const updateQuickActions = useMemo(() => makeConfigUpdate<QuickAction[]>('quick_actions_v1', setQuickActions, addToast), [addToast]);
    const updateSidebarSections = useMemo(() => makeConfigUpdate<string[]>('sidebar_sections_v1', setSidebarSections, addToast), [addToast]);
    const updateSidebarSectionColors = useMemo(() => makeConfigUpdate<SidebarSectionColors>('sidebar_section_colors', setSidebarSectionColors, addToast), [addToast]);
    const updateSidebarFooterActions = useMemo(() => makeConfigUpdate<SidebarFooterAction[]>('sidebar_footer_actions_v1', setSidebarFooterActions, addToast), [addToast]);
    const updateDashboardLayout = useMemo(() => makeConfigUpdate<DashboardCategory[]>('dashboard_layout_v2', setDashboardLayout, addToast), [addToast]);
    const updateRoleHomePages = useMemo(() => makeConfigUpdate<Record<string, string>>('role_home_pages_v1', setRoleHomePages, addToast), [addToast]);
    const updateBottomNavPaths = useMemo(() => makeConfigUpdate<string[]>('bottom_nav_paths_v1', setBottomNavPaths, addToast), [addToast]);

    const updatePageVisibility = useCallback(async (visibility: PageVisibility): Promise<void> => {
        try {
            const updates = Object.entries(visibility).map(([path, onlyAdmin]) => ({
                key: `page_vis.${path}`, value: String(onlyAdmin)
            }));
            await apiFetch('/api/resources?entity=app-config-batch', {
                method: 'POST', body: JSON.stringify({ updates })
            });
            setPageVisibility(visibility);
        } catch (e) { addToast('Errore durante l\'aggiornamento della visibilità pagine.', 'error'); }
    }, [addToast]);

    // --- Notifiche ---
    const fetchNotifications = useCallback(async (): Promise<void> => {
        try {
            const notifs = await apiFetch<Notification[]>('/api/resources?entity=notifications');
            setNotifications(notifs);
        } catch (e) { /* Non critico */ }
    }, []);

    const markNotificationAsRead = useCallback(async (id?: string): Promise<void> => {
        try {
            const url = id
                ? `/api/resources?entity=notifications&action=mark_read&id=${id}`
                : `/api/resources?entity=notifications&action=mark_read`;
            await apiFetch(url, { method: 'PUT', body: JSON.stringify({ version: 1 }) });
            setNotifications(prev => prev.map(n =>
                id ? (n.id === id ? { ...n, isRead: true } : n) : { ...n, isRead: true }
            ));
        } catch (e) { console.error('Errore durante la lettura della notifica', e); }
    }, []);

    // --- CRUD NotificationConfig ---
    const addNotificationConfig = useCallback(async (config: Omit<NotificationConfig, 'id'>): Promise<void> => {
        try {
            const created = await apiFetch<NotificationConfig>('/api/resources?entity=notification_configs', {
                method: 'POST', body: JSON.stringify(config)
            });
            setNotificationConfigs(prev => [...prev, created]);
        } catch (e) { addToast('Errore durante l\'aggiunta della configurazione notifica.', 'error'); }
    }, [addToast]);

    const updateNotificationConfig = useCallback(async (config: NotificationConfig): Promise<void> => {
        try {
            const updated = await apiFetch<NotificationConfig>(
                `/api/resources?entity=notification_configs&id=${config.id}`,
                { method: 'PUT', body: JSON.stringify(config) }
            );
            setNotificationConfigs(prev => prev.map(c => c.id === config.id ? updated : c));
        } catch (e) { addToast('Errore durante l\'aggiornamento della configurazione notifica.', 'error'); }
    }, [addToast]);

    const deleteNotificationConfig = useCallback(async (id: string): Promise<void> => {
        try {
            await apiFetch(`/api/resources?entity=notification_configs&id=${id}`, { method: 'DELETE' });
            setNotificationConfigs(prev => prev.filter(c => c.id !== id));
        } catch (e) { addToast('Errore durante l\'eliminazione della configurazione notifica.', 'error'); }
    }, [addToast]);

    // --- CRUD NotificationRule (errori propagati al chiamante, no toast) ---
    const addNotificationRule = useCallback(async (rule: Omit<NotificationRule, 'id'>): Promise<void> => {
        const created = await apiFetch<NotificationRule>('/api/resources?entity=notification_rules', {
            method: 'POST', body: JSON.stringify(rule)
        });
        setNotificationRules(prev => [...prev, created]);
    }, []);

    const updateNotificationRule = useCallback(async (rule: NotificationRule): Promise<void> => {
        const updated = await apiFetch<NotificationRule>(
            `/api/resources?entity=notification_rules&id=${rule.id}`,
            { method: 'PUT', body: JSON.stringify(rule) }
        );
        setNotificationRules(prev => prev.map(r => r.id === rule.id ? updated : r));
    }, []);

    const deleteNotificationRule = useCallback(async (id: string): Promise<void> => {
        await apiFetch(`/api/resources?entity=notification_rules&id=${id}`, { method: 'DELETE' });
        setNotificationRules(prev => prev.filter(r => r.id !== id));
    }, []);

    // --- Analytics ---
    const forceRecalculateAnalytics = useCallback(async (): Promise<void> => {
        try {
            const res = await apiFetch<{ data: Record<string, unknown> }>(
                '/api/resources?entity=analytics_cache&action=recalc_all',
                { method: 'POST' }
            );
            setAnalyticsCache(res.data);
        } catch (e) { addToast('Errore durante il ricalcolo delle analytics.', 'error'); }
    }, [addToast]);

    const value = useMemo<UIConfigContextValue>(() => ({
        sidebarConfig, quickActions, sidebarSections, sidebarSectionColors, sidebarFooterActions,
        dashboardLayout, roleHomePages, bottomNavPaths, pageVisibility,
        notifications, notificationConfigs, notificationRules, analyticsCache,
        updateSidebarConfig, updateQuickActions, updateSidebarSections, updateSidebarSectionColors,
        updateSidebarFooterActions, updateDashboardLayout, updateRoleHomePages, updateBottomNavPaths,
        updatePageVisibility, fetchNotifications, markNotificationAsRead,
        addNotificationConfig, updateNotificationConfig, deleteNotificationConfig,
        addNotificationRule, updateNotificationRule, deleteNotificationRule,
        forceRecalculateAnalytics,
        initialize,
    }), [
        sidebarConfig, quickActions, sidebarSections, sidebarSectionColors, sidebarFooterActions,
        dashboardLayout, roleHomePages, bottomNavPaths, pageVisibility,
        notifications, notificationConfigs, notificationRules, analyticsCache,
        updateSidebarConfig, updateQuickActions, updateSidebarSections, updateSidebarSectionColors,
        updateSidebarFooterActions, updateDashboardLayout, updateRoleHomePages, updateBottomNavPaths,
        updatePageVisibility, fetchNotifications, markNotificationAsRead,
        addNotificationConfig, updateNotificationConfig, deleteNotificationConfig,
        addNotificationRule, updateNotificationRule, deleteNotificationRule,
        forceRecalculateAnalytics,
        initialize,
    ]);

    return <UIConfigContext.Provider value={value}>{children}</UIConfigContext.Provider>;
};

export const useUIConfigContext = (): UIConfigContextValue => {
    const ctx = useContext(UIConfigContext);
    if (!ctx) throw new Error('useUIConfigContext must be used within UIConfigProvider');
    return ctx;
};
