/**
 * @file Sidebar.tsx
 * @description Componente per la barra di navigazione laterale dell'applicazione.
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    IconProps,
    CalendarIcon,
    UsersIcon,
    LayoutDashboardIcon,
    ClipboardListIcon,
    MessageSquareIcon,
    BookOpenIcon,
    TrendingUpIcon,
    KanbanIcon,
    BarChartIcon,
    PieChartIcon,
    UserCogIcon,
    BriefcaseIcon,
    FileSignatureIcon,
    BuildingIcon,
    BadgeCheckIcon,
    CalendarDaysIcon,
    SettingsIcon,
    DownloadIcon,
    UploadIcon,
    ShieldIcon,
    DatabaseIcon,
    LogOutIcon,
    CloseIcon,
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
type NavItem = {
    to: string;
    label: string;
    icon: React.ComponentType<IconProps>;
};

const primarySection: NavItem[] = [
    { to: '/staffing', label: 'Staffing', icon: CalendarIcon },
    { to: '/workload', label: 'Carico Risorse', icon: UsersIcon },
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon },
    { to: '/resource-requests', label: 'Richiesta Risorse', icon: ClipboardListIcon },
    { to: '/interviews', label: 'Gestione Colloqui', icon: MessageSquareIcon },
    { to: '/manuale-utente', label: 'Manuale Utente', icon: BookOpenIcon },
];

const analysisSection: NavItem[] = [
    { to: '/forecasting', label: 'Forecasting', icon: TrendingUpIcon },
    { to: '/gantt', label: 'Gantt Progetti', icon: KanbanIcon },
    { to: '/reports', label: 'Report', icon: BarChartIcon },
    { to: '/staffing-visualization', label: 'Visualizzazione', icon: PieChartIcon },
];

const managementSection: NavItem[] = [
    { to: '/resources', label: 'Risorse', icon: UserCogIcon },
    { to: '/projects', label: 'Progetti', icon: BriefcaseIcon },
    { to: '/contracts', label: 'Contratti', icon: FileSignatureIcon },
    { to: '/clients', label: 'Clienti', icon: BuildingIcon },
    { to: '/roles', label: 'Ruoli', icon: BadgeCheckIcon },
    { to: '/calendar', label: 'Calendario', icon: CalendarDaysIcon },
    { to: '/config', label: 'Config', icon: SettingsIcon },
];

const dataSection: NavItem[] = [
    { to: '/export', label: 'Esporta Dati', icon: DownloadIcon },
    { to: '/import', label: 'Importa Dati', icon: UploadIcon },
];

const adminSection: NavItem[] = [
    { to: '/admin-settings', label: 'Impostazioni Admin', icon: ShieldIcon },
    { to: '/db-inspector', label: 'Database Inspector', icon: DatabaseIcon },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
    const { logout, isAuthenticated, isLoginProtectionEnabled, isAdmin } = useAuth();

    const navLinkBaseClasses = [
        'flex items-center gap-3 px-4 py-2 rounded-md border-l-4 border-transparent transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-shell-secondary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-shell-primary)]',
        'dark:focus-visible:ring-[var(--color-dark-shell-secondary)] dark:focus-visible:ring-offset-[var(--color-dark-shell-primary)]',
        'text-sm font-medium',
    ].join(' ');

    const getNavLinkClass = ({ isActive }: { isActive: boolean }): string => {
        if (isActive) {
            return [
                navLinkBaseClasses,
                'bg-[var(--color-shell-active)] text-[var(--color-shell-foreground)] border-l-[var(--color-shell-secondary)] shadow-sm',
                'dark:bg-[var(--color-dark-shell-active)] dark:text-[var(--color-dark-shell-foreground)] dark:border-l-[var(--color-dark-shell-secondary)]',
            ].join(' ');
        }

        return [
            navLinkBaseClasses,
            'text-[var(--color-shell-muted-foreground)] hover:bg-[var(--color-shell-hover)] hover:text-[var(--color-shell-foreground)]',
            'dark:text-[var(--color-dark-shell-muted-foreground)] dark:hover:bg-[var(--color-dark-shell-hover)] dark:hover:text-[var(--color-dark-shell-foreground)]',
        ].join(' ');
    };
    
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
        flex flex-col w-64 bg-[var(--color-shell-primary)] dark:bg-[var(--color-dark-shell-primary)] text-[var(--color-shell-foreground)] dark:text-[var(--color-dark-shell-foreground)] transition-transform duration-300 ease-in-out
        fixed inset-y-0 left-0 z-30 shadow-xl
        md:relative md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `;

    const renderNavItem = (item: NavItem) => {
        const Icon = item.icon;
        return (
            <NavLink key={item.to} to={item.to} className={getNavLinkClass} onClick={handleNavLinkClick}>
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
            </NavLink>
        );
    };

    return (
        <aside className={sidebarClasses}>
            <div className="flex items-center justify-between h-20 px-4 border-b border-[var(--color-shell-secondary)] dark:border-[var(--color-dark-shell-secondary)]">
                <h1 className="text-2xl font-bold tracking-wider text-[var(--color-shell-foreground)] dark:text-[var(--color-dark-shell-foreground)]">Staffing App</h1>
                <button
                    onClick={() => setIsOpen(false)}
                    className="md:hidden inline-flex items-center justify-center rounded-md text-[var(--color-shell-foreground)] hover:text-[var(--color-shell-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-shell-secondary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-shell-primary)] dark:text-[var(--color-dark-shell-foreground)] dark:hover:text-[var(--color-dark-shell-secondary)] dark:focus-visible:ring-[var(--color-dark-shell-secondary)] dark:focus-visible:ring-offset-[var(--color-dark-shell-primary)]"
                    aria-label="Chiudi menu di navigazione"
                    type="button"
                >
                    <CloseIcon className="h-5 w-5" />
                </button>
            </div>
            <nav className="flex-1 flex flex-col px-2 py-4 space-y-2 overflow-y-auto">
                <div className="space-y-1">
                    {primarySection.map(renderNavItem)}
                </div>

                <div>
                    <div className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-shell-muted-foreground)] dark:text-[var(--color-dark-shell-muted-foreground)]">
                        Analisi
                    </div>
                    <div className="space-y-1">
                        {analysisSection.map(renderNavItem)}
                    </div>
                </div>

                <div>
                    <div className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-shell-muted-foreground)] dark:text-[var(--color-dark-shell-muted-foreground)]">
                        Gestione
                    </div>
                    <div className="space-y-1">
                        {managementSection.map(renderNavItem)}
                    </div>
                </div>

                <div>
                    <div className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-shell-muted-foreground)] dark:text-[var(--color-dark-shell-muted-foreground)]">
                        Dati
                    </div>
                    <div className="space-y-1">
                        {dataSection.map(renderNavItem)}
                    </div>
                </div>

                {isAdmin && (
                    <div>
                        <div className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-shell-muted-foreground)] dark:text-[var(--color-dark-shell-muted-foreground)]">
                            Amministrazione
                        </div>
                        <div className="space-y-1">
                            {adminSection.map(renderNavItem)}
                        </div>
                    </div>
                )}
                {isAuthenticated && isLoginProtectionEnabled ? (
                    <div className="mt-auto">
                        <div className="px-4 py-2 text-center text-xs text-[var(--color-shell-muted-foreground)] dark:text-[var(--color-dark-shell-muted-foreground)]">
                            Versione V600
                        </div>
                        <button
                            onClick={logout}
                            className="flex items-center gap-3 w-full px-4 py-3 rounded-md text-[var(--color-destructive)] hover:bg-[var(--color-shell-hover)] hover:text-[var(--color-shell-foreground)] dark:text-[var(--color-destructive)] dark:hover:bg-[var(--color-dark-shell-hover)] dark:hover:text-[var(--color-dark-shell-foreground)] transition-colors duration-200"
                        >
                            <LogOutIcon className="h-5 w-5" />
                            <span>Logout</span>
                        </button>
                    </div>
                ) : (
                    <div className="mt-auto px-4 py-4 text-center text-xs text-[var(--color-shell-muted-foreground)] dark:text-[var(--color-dark-shell-muted-foreground)]">
                        Versione V600
                    </div>
                )}
            </nav>
        </aside>
    );
};

export default Sidebar;