/**
 * @file Sidebar.tsx
 * @description Componente per la barra di navigazione laterale dell'applicazione.
 */

import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEntitiesContext } from '../context/AppContext';
import {
    CalendarIcon,
    UsersIcon,
    ChartPieIcon,
    ClipboardIcon,
    ChatBubbleIcon,
    BookOpenIcon,
    SparklesIcon,
    BuildingIcon,
    BriefcaseIcon,
    DocumentChartIcon,
    CogIcon,
    CloudArrowDownIcon,
    CloudArrowUpIcon,
    ShieldCheckIcon,
    BeakerIcon,
    ChartBarIcon,
    SparkLineIcon,
    MagnifierIcon,
    BellIcon,
    XMarkIcon,
} from './icons';

interface SidebarProps {
    /** Indica se la sidebar è aperta (visibile su mobile). */
    isOpen: boolean;
    /** Funzione per aggiornare lo stato di visibilità della sidebar. */
    setIsOpen: (isOpen: boolean) => void;
}

interface NavItem {
    to: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | null;
    badgeAriaLabel?: string;
    highlight?: boolean;
}

interface NavSection {
    title: string;
    items: NavItem[];
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
    const { logout, isAuthenticated, isLoginProtectionEnabled, isAdmin } = useAuth();
    const { resourceRequests, interviews } = useEntitiesContext();
    const location = useLocation();

    const activeRequestCount = resourceRequests.filter(req => req.status === 'ATTIVA').length;
    const urgentRequestCount = resourceRequests.filter(req => req.isUrgent && req.status === 'ATTIVA').length;
    const openInterviewsCount = interviews.filter(interview => interview.status === 'Aperto').length;

    const navSections: NavSection[] = [
        {
            title: 'Operatività',
            items: [
                { to: '/staffing', label: 'Staffing', icon: CalendarIcon },
                { to: '/workload', label: 'Carico Risorse', icon: UsersIcon },
                { to: '/dashboard', label: 'Dashboard', icon: ChartPieIcon },
                {
                    to: '/resource-requests',
                    label: 'Richiesta Risorse',
                    icon: ClipboardIcon,
                    badge: activeRequestCount || null,
                    badgeAriaLabel: `${activeRequestCount} richieste aperte`,
                    highlight: urgentRequestCount > 0,
                },
                {
                    to: '/interviews',
                    label: 'Gestione Colloqui',
                    icon: ChatBubbleIcon,
                    badge: openInterviewsCount || null,
                    badgeAriaLabel: `${openInterviewsCount} colloqui aperti`,
                },
                { to: '/manuale-utente', label: 'Manuale Utente', icon: BookOpenIcon },
            ],
        },
        {
            title: 'Analisi',
            items: [
                { to: '/forecasting', label: 'Forecasting', icon: SparklesIcon },
                { to: '/gantt', label: 'Gantt Progetti', icon: SparkLineIcon },
                { to: '/reports', label: 'Report', icon: DocumentChartIcon },
                { to: '/staffing-visualization', label: 'Visualizzazione', icon: ChartBarIcon },
            ],
        },
        {
            title: 'Gestione',
            items: [
                { to: '/resources', label: 'Risorse', icon: UsersIcon },
                { to: '/projects', label: 'Progetti', icon: BriefcaseIcon },
                { to: '/contracts', label: 'Contratti', icon: ShieldCheckIcon },
                { to: '/clients', label: 'Clienti', icon: BuildingIcon },
                { to: '/roles', label: 'Ruoli', icon: BeakerIcon },
                { to: '/calendar', label: 'Calendario', icon: CalendarIcon },
                { to: '/config', label: 'Config', icon: CogIcon },
            ],
        },
        {
            title: 'Dati',
            items: [
                { to: '/export', label: 'Esporta Dati', icon: CloudArrowDownIcon },
                { to: '/import', label: 'Importa Dati', icon: CloudArrowUpIcon },
            ],
        },
    ];

    if (isAdmin) {
        navSections.push({
            title: 'Amministrazione',
            items: [
                { to: '/admin-settings', label: 'Impostazioni Admin', icon: CogIcon },
                { to: '/db-inspector', label: 'Database Inspector', icon: MagnifierIcon },
            ],
        });
    }

    const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
        [
            'group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200',
            'text-sm font-medium',
            isActive
                ? 'bg-primary/10 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-dark-muted dark:hover:text-dark-foreground',
        ].join(' ');

    const sidebarClasses = `
        fixed inset-y-0 left-0 z-40 flex w-[var(--sidebar-width,16rem)] flex-col bg-sidebar/95 text-foreground/90
        backdrop-blur-lg border-r border-border/60 dark:border-dark-border/60 transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `;

    return (
        <aside className={sidebarClasses} aria-label="Principale">
            <div className="flex items-center justify-between h-20 px-5 border-b border-border/60 dark:border-dark-border/60">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-2xl bg-primary/20 text-primary">
                        <BellIcon className="w-6 h-6" aria-hidden />
                    </div>
                    <div>
                        <span className="block text-xs uppercase tracking-[0.3em] text-muted-foreground">Staffing Planner</span>
                        <h1 className="text-lg font-semibold">Control Center</h1>
                    </div>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="md:hidden inline-flex items-center justify-center rounded-xl p-2 text-muted-foreground hover:text-foreground hover:bg-muted"
                    aria-label="Chiudi menu"
                >
                    <XMarkIcon className="w-5 h-5" aria-hidden />
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
                {navSections.map(section => (
                    <div key={section.title}>
                        <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground/70">
                            {section.title}
                        </div>
                        <div className="space-y-1">
                            {section.items.map(item => {
                                const Icon = item.icon;
                                const isCurrent = location.pathname === item.to;
                                return (
                                    <NavLink key={item.to} to={item.to} className={navLinkClasses} onClick={() => isOpen && setIsOpen(false)}>
                                        <span
                                            className={`flex h-9 w-9 items-center justify-center rounded-xl border border-transparent transition-colors duration-200 ${
                                                isCurrent ? 'bg-primary text-white shadow-soft border-primary/40' : 'bg-muted/60 text-muted-foreground group-hover:text-foreground'
                                            }`}
                                        >
                                            <Icon className="w-5 h-5" aria-hidden />
                                        </span>
                                        <span className="flex-1 text-left">{item.label}</span>
                                        {typeof item.badge === 'number' && item.badge > 0 && (
                                            <span
                                                className={`ml-auto inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                    item.highlight
                                                        ? 'bg-destructive/15 text-destructive'
                                                        : 'bg-primary/10 text-primary'
                                                }`}
                                                aria-label={item.badgeAriaLabel}
                                            >
                                                {item.badge}
                                            </span>
                                        )}
                                        {item.highlight && !item.badge && (
                                            <span className="ml-auto h-2 w-2 rounded-full bg-destructive" aria-hidden />
                                        )}
                                    </NavLink>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            <div className="border-t border-border/60 dark:border-dark-border/60 px-4 py-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Versione V600</span>
                    <span className="inline-flex items-center gap-1 text-[11px]">
                        <MagnifierIcon className="w-4 h-4" aria-hidden />
                        Ultimo aggiornamento
                    </span>
                </div>
                {isAuthenticated && isLoginProtectionEnabled && (
                    <button
                        onClick={logout}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-destructive/15 px-4 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white"
                    >
                        <ShieldCheckIcon className="w-4 h-4" aria-hidden />
                        Logout sicuro
                    </button>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;
