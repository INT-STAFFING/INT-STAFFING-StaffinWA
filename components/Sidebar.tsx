import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

interface NavItemProps {
    to: string;
    icon: string;
    label: string;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label }) => (
    <NavLink
        to={to}
        className={({ isActive }) =>
            `flex items-center px-4 py-3 text-sm font-medium transition-colors duration-200 ${
                isActive
                    ? 'text-primary bg-secondary-container border-r-4 border-primary'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`
        }
    >
        <span className="material-symbols-outlined mr-3">{icon}</span>
        {label}
    </NavLink>
);

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
    const { logout, user, isAdmin } = useAuth();
    const location = useLocation();

    const sidebarClasses = `fixed inset-y-0 left-0 z-40 w-64 bg-surface border-r border-outline-variant transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
    }`;

    return (
        <div className={sidebarClasses}>
            <div className="flex flex-col h-full">
                <div className="flex items-center justify-center h-20 border-b border-outline-variant">
                    <h1 className="text-2xl font-bold text-primary tracking-widest">PLANNER</h1>
                </div>

                <div className="flex-1 overflow-y-auto py-4">
                    <div className="pb-4">
                        <p className="px-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Principale</p>
                        <NavItem to="/dashboard" icon="dashboard" label="Dashboard" />
                        <NavItem to="/staffing" icon="calendar_month" label="Staffing" />
                        <NavItem to="/workload" icon="groups" label="Carico Risorse" />
                    </div>

                    <div className="pb-4">
                        <p className="px-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Progetti</p>
                        <NavItem to="/gantt" icon="align_horizontal_left" label="Gantt" />
                        <NavItem to="/projects" icon="folder" label="Progetti" />
                        <NavItem to="/contracts" icon="description" label="Contratti" />
                        <NavItem to="/clients" icon="domain" label="Clienti" />
                        <NavItem to="/forecasting" icon="trending_up" label="Forecasting" />
                    </div>

                    <div className="pb-4">
                        <p className="px-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Risorse</p>
                        <NavItem to="/resources" icon="person" label="Risorse" />
                        <NavItem to="/skills" icon="school" label="Competenze" />
                        <NavItem to="/skill-analysis" icon="insights" label="Analisi Competenze" />
                        <NavItem to="/roles" icon="badge" label="Ruoli" />
                        <NavItem to="/leaves" icon="event_busy" label="Assenze" />
                    </div>

                    <div className="pb-4">
                        <p className="px-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Operatività</p>
                        <NavItem to="/resource-requests" icon="assignment" label="Richieste Risorse" />
                        <NavItem to="/interviews" icon="groups" label="Colloqui" />
                        <NavItem to="/skills-map" icon="school" label="Mappa Competenze" />
                        <NavItem to="/staffing-visualization" icon="hub" label="Visualizzazione Staffing" />
                    </div>

                    <div className="pb-4">
                        <p className="px-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Supporto</p>
                        <NavItem to="/manuale-utente" icon="menu_book" label="Manuale Utente" />
                        <NavItem to="/simple-user-manual" icon="help_center" label="Guida Assenze" />
                        <NavItem to="/reports" icon="bar_chart" label="Report" />
                    </div>

                    <div className="pb-4">
                        <p className="px-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Configurazione</p>
                        <NavItem to="/calendar" icon="event" label="Calendario Aziendale" />
                        <NavItem to="/config" icon="settings" label="Opzioni" />
                        <NavItem to="/import" icon="upload" label="Importa Dati" />
                        <NavItem to="/export" icon="download" label="Esporta Dati" />
                        {isAdmin && (
                            <>
                                <NavItem to="/admin-settings" icon="admin_panel_settings" label="Admin" />
                                <NavItem to="/db-inspector" icon="database" label="DB Inspector" />
                            </>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-outline-variant">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                            {user?.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-on-surface truncate">{user?.username}</p>
                            <p className="text-xs text-on-surface-variant truncate">{user?.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-on-error-container bg-error-container rounded-full hover:opacity-90 transition-opacity"
                    >
                        <span className="material-symbols-outlined mr-2 text-lg">logout</span>
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;