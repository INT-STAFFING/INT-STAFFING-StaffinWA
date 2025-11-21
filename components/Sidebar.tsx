
import React, { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEntitiesContext } from '../context/AppContext';

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

const NavItem = ({ to, icon, label, pendingCount }: { to: string; icon: string; label: string; pendingCount?: number }) => {
    const location = useLocation();
    const isActive = location.pathname === to;

    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-full transition-colors duration-200 font-medium ${
                    isActive
                        ? 'bg-secondary-container text-on-secondary-container'
                        : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`
            }
        >
            <span className="material-symbols-outlined text-2xl">{icon}</span>
            <span className="flex-1">{label}</span>
            {pendingCount !== undefined && pendingCount > 0 && (
                <span className="bg-error text-on-error text-xs font-bold px-2 py-0.5 rounded-full">
                    {pendingCount}
                </span>
            )}
        </NavLink>
    );
};

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
    const { logout, isAuthenticated, isLoginProtectionEnabled, isAdmin, user } = useAuth();
    const { leaveRequests } = useEntitiesContext();

    const pendingLeavesCount = useMemo(() => {
        if (!isAuthenticated) return 0;
        return leaveRequests.filter(l => {
            if (l.status !== 'PENDING') return false;
            if (isAdmin) return true;
            // Manager sees requests where they are listed as approver
            if (user?.resourceId && l.approverIds?.includes(user.resourceId)) {
                return true;
            }
            return false;
        }).length;
    }, [leaveRequests, isAdmin, user, isAuthenticated]);

    // Simple Auth Check for Display
    const showAdminLinks = !isLoginProtectionEnabled || isAdmin;

    return (
        <aside
            className={`fixed inset-y-0 left-0 z-40 w-72 bg-surface-container-low shadow-xl transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:shadow-none border-r border-outline-variant ${
                isOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
        >
            <div className="flex items-center justify-between p-6 border-b border-outline-variant h-20">
                <h1 className="text-2xl font-bold text-primary tracking-tight">Staffing App</h1>
                <button onClick={() => setIsOpen(false)} className="md:hidden text-on-surface-variant hover:text-on-surface">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
                <div className="pb-4">
                    <p className="px-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Pianificazione</p>
                    <NavItem to="/staffing" icon="calendar_month" label="Staffing" />
                    <NavItem to="/workload" icon="groups" label="Carico Risorse" />
                    <NavItem to="/dashboard" icon="dashboard" label="Dashboard" />
                    <NavItem to="/leaves" icon="event_busy" label="Assenze" pendingCount={pendingLeavesCount} />
                </div>

                <div className="pb-4">
                    <p className="px-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Operatività</p>
                    <NavItem to="/resource-requests" icon="assignment" label="Richieste Risorse" />
                    <NavItem to="/interviews" icon="groups" label="Colloqui" />
                    <NavItem to="/skills-map" icon="school" label="Mappa Competenze" />
                    <NavItem to="/manuale-utente" icon="menu_book" label="Manuale Utente" />
                </div>

                <div className="pb-4">
                    <p className="px-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Analisi</p>
                    <NavItem to="/forecasting" icon="trending_up" label="Forecasting" />
                    <NavItem to="/gantt" icon="align_horizontal_left" label="Gantt" />
                    <NavItem to="/skill-analysis" icon="hub" label="Analisi Skills" />
                    <NavItem to="/reports" icon="analytics" label="Report" />
                    <NavItem to="/staffing-visualization" icon="account_tree" label="Visualizzazione" />
                </div>

                <div className="pb-4">
                    <p className="px-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Dati</p>
                    <NavItem to="/resources" icon="person" label="Risorse" />
                    <NavItem to="/skills" icon="psychology" label="Competenze" />
                    <NavItem to="/projects" icon="work" label="Progetti" />
                    <NavItem to="/contracts" icon="description" label="Contratti" />
                    <NavItem to="/clients" icon="business" label="Clienti" />
                    <NavItem to="/roles" icon="badge" label="Ruoli" />
                    <NavItem to="/calendar" icon="event" label="Calendario" />
                </div>

                <div className="pb-4">
                    <p className="px-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Sistema</p>
                    <NavItem to="/config" icon="settings" label="Configurazioni" />
                    <NavItem to="/export" icon="download" label="Export Dati" />
                    <NavItem to="/import" icon="upload" label="Import Dati" />
                    {showAdminLinks && (
                        <>
                            <NavItem to="/admin-settings" icon="admin_panel_settings" label="Admin" />
                            <NavItem to="/db-inspector" icon="database" label="DB Inspector" />
                        </>
                    )}
                </div>
            </nav>

            {isLoginProtectionEnabled && isAuthenticated && (
                <div className="p-4 border-t border-outline-variant bg-surface-container">
                    <div className="flex items-center gap-3 mb-3 px-2">
                        <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-sm font-bold">
                            {user?.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-on-surface truncate">{user?.username}</p>
                            <p className="text-xs text-on-surface-variant truncate">{user?.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-surface border border-outline rounded-full hover:bg-error-container hover:text-on-error-container hover:border-error transition-colors text-sm font-medium text-on-surface"
                    >
                        <span className="material-symbols-outlined text-lg">logout</span>
                        <span>Esci</span>
                    </button>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;
