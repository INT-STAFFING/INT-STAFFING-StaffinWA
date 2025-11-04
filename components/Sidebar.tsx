/**
 * @file Sidebar.tsx
 * @description Componente per la barra di navigazione laterale dell'applicazione.
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { IconComponent } from './IconLibrary';
import {
    Activity,
    BarChart3,
    BookOpen,
    Building2,
    CalendarClock,
    CalendarDays,
    ClipboardList,
    Database,
    Download,
    FileText,
    Briefcase,
    IdBadge,
    Kanban,
    LayoutDashboard,
    LineChart,
    LogOut,
    MessageSquare,
    Palette,
    Settings,
    Shield,
    Upload,
    Users,
    X,
} from './IconLibrary';

/**
 * @interface SidebarProps
 * @description Prop per il componente Sidebar.
 */
interface SidebarProps {
    /** @property {boolean} isOpen - Indica se la sidebar è aperta (visibile su mobile). */
    isOpen: boolean;
    /** @property {(isOpen: boolean) => void} setIsOpen - Funzione per aggiornare lo stato di visibilità della sidebar. */
    setIsOpen: (isOpen: boolean) => void;
}

/**
 * La barra di navigazione laterale.
 * Contiene i link alle diverse sezioni dell'applicazione.
 * Su mobile, si comporta come un menu a scomparsa.
 * @param {SidebarProps} props - Le prop del componente.
 * @returns {React.ReactElement} Il componente Sidebar.
 */
const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
    const { logout, isAuthenticated, isLoginProtectionEnabled, isAdmin } = useAuth();

    type NavItem = {
        to: string;
        label: string;
        icon: IconComponent;
    };

    const sections: { label: string; items: NavItem[] }[] = [
        {
            label: 'Pianificazione',
            items: [
                { to: '/staffing', label: 'Staffing', icon: CalendarClock },
                { to: '/workload', label: 'Carico Risorse', icon: Activity },
                { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { to: '/resource-requests', label: 'Richiesta Risorse', icon: ClipboardList },
                { to: '/interviews', label: 'Gestione Colloqui', icon: MessageSquare },
                { to: '/manuale-utente', label: 'Manuale Utente', icon: BookOpen },
            ],
        },
        {
            label: 'Analisi',
            items: [
                { to: '/forecasting', label: 'Forecasting', icon: LineChart },
                { to: '/gantt', label: 'Gantt Progetti', icon: Kanban },
                { to: '/reports', label: 'Report', icon: BarChart3 },
                { to: '/staffing-visualization', label: 'Visualizzazione', icon: Palette },
            ],
        },
        {
            label: 'Gestione',
            items: [
                { to: '/resources', label: 'Risorse', icon: Users },
                { to: '/projects', label: 'Progetti', icon: Briefcase },
                { to: '/contracts', label: 'Contratti', icon: FileText },
                { to: '/clients', label: 'Clienti', icon: Building2 },
                { to: '/roles', label: 'Ruoli', icon: IdBadge },
                { to: '/calendar', label: 'Calendario', icon: CalendarDays },
                { to: '/config', label: 'Config', icon: Settings },
            ],
        },
        {
            label: 'Dati',
            items: [
                { to: '/export', label: 'Esporta Dati', icon: Download },
                { to: '/import', label: 'Importa Dati', icon: Upload },
            ],
        },
    ];

    if (isAdmin) {
        sections.push({
            label: 'Amministrazione',
            items: [
                { to: '/admin-settings', label: 'Impostazioni Admin', icon: Shield },
                { to: '/db-inspector', label: 'Database Inspector', icon: Database },
            ],
        });
    }
    
    /**
     * Gestisce il click su un link di navigazione.
     * Chiude la sidebar se è aperta (comportamento desiderato su mobile).
     */
    const handleNavLinkClick = () => {
        if (isOpen) {
            setIsOpen(false);
        }
    }

    // Classi condizionali per mostrare/nascondere la sidebar con una transizione.
    const sidebarClasses = `
        group flex w-72 flex-col bg-sidebar-background text-sidebar-foreground shadow-xl transition-transform duration-300 ease-in-out
        fixed inset-y-0 left-0 z-30 border-r border-sidebar-border dark:bg-dark-sidebar-background dark:text-dark-sidebar-foreground dark:border-dark-sidebar-border
        md:relative md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `;

    return (
        <aside className={sidebarClasses}>
            <div className="flex items-center justify-between border-b border-sidebar-border px-6 py-6 text-base font-semibold uppercase tracking-[0.3em] dark:border-dark-sidebar-border">
                <span className="text-sm font-semibold tracking-[0.4em] text-sidebar-foreground/80 dark:text-dark-sidebar-foreground/80">StaffinWA</span>
                <button
                    onClick={() => setIsOpen(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-sidebar-border/40 text-sidebar-foreground transition-colors hover:bg-sidebar-active hover:text-sidebar-active-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-active md:hidden dark:border-dark-sidebar-border/50 dark:text-dark-sidebar-foreground dark:hover:bg-dark-sidebar-active dark:hover:text-dark-sidebar-active-foreground"
                    aria-label="Chiudi menu di navigazione"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-4 py-6">
                <div className="space-y-8">
                    {sections.map((section) => (
                        <div key={section.label}>
                            <p className="px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-muted/70 dark:text-dark-sidebar-muted/70">
                                {section.label}
                            </p>
                            <div className="mt-3 space-y-1">
                                {section.items.map(({ to, label, icon: Icon }) => (
                                    <NavLink
                                        key={to}
                                        to={to}
                                        onClick={handleNavLinkClick}
                                        className={({ isActive }) =>
                                            `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                                                isActive
                                                    ? 'bg-sidebar-active text-sidebar-active-foreground shadow-lg ring-1 ring-sidebar-active/40 dark:bg-dark-sidebar-active dark:text-dark-sidebar-active-foreground'
                                                    : 'text-sidebar-foreground/90 hover:bg-sidebar-muted/50 hover:text-sidebar-active-foreground dark:text-dark-sidebar-foreground/90 dark:hover:bg-dark-sidebar-muted/60 dark:hover:text-dark-sidebar-active-foreground'
                                            }`
                                        }
                                    >
                                        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-sidebar-border/40 bg-sidebar-background/40 text-sidebar-active-foreground/80 transition group-hover:border-transparent group-hover:bg-sidebar-active group-hover:text-sidebar-active-foreground dark:border-dark-sidebar-border/50 dark:bg-dark-sidebar-background/30 dark:text-dark-sidebar-active-foreground/80 dark:group-hover:bg-dark-sidebar-active">
                                            <Icon className="h-4 w-4" />
                                        </span>
                                        <span className="truncate">{label}</span>
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </nav>
            <div className="border-t border-sidebar-border px-6 py-5 text-xs uppercase tracking-[0.4em] text-sidebar-muted/70 dark:border-dark-sidebar-border dark:text-dark-sidebar-muted/70">
                Versione V600
            </div>
            {isAuthenticated && isLoginProtectionEnabled && (
                <div className="px-6 pb-6">
                    <button
                        onClick={logout}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-sidebar-border bg-transparent px-4 py-2 text-sm font-semibold text-sidebar-foreground transition hover:bg-sidebar-active hover:text-sidebar-active-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-active dark:border-dark-sidebar-border dark:text-dark-sidebar-foreground dark:hover:bg-dark-sidebar-active dark:hover:text-dark-sidebar-active-foreground"
                    >
                        <LogOut className="h-4 w-4" />
                        Logout
                    </button>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;