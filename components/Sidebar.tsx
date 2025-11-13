/**
 * @file Sidebar.tsx
 * @description Componente per la barra di navigazione laterale dell'applicazione.
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

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

const NavItem: React.FC<{ to: string; icon: string; label: string; onClick: () => void }> = ({ to, icon, label, onClick }) => {
    const baseClasses = "flex items-center text-sm font-medium text-on-surface-variant transition-colors duration-200 h-14";
    const activeClasses = "text-on-secondary-container";

    return (
        <NavLink to={to} onClick={onClick}>
            {({ isActive }) => (
                 <div className={`${baseClasses} ${isActive ? activeClasses : 'hover:bg-surface-container-low'}`}>
                    <div className={`w-full mx-4 flex items-center gap-3 py-2 px-3 rounded-full ${isActive ? 'bg-secondary-container' : ''}`}>
                       <span className="material-symbols-outlined w-6 text-center">{icon}</span>
                       <span>{label}</span>
                    </div>
                </div>
            )}
        </NavLink>
    );
};

const NavHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="px-7 pt-6 pb-2 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
        {children}
    </div>
);

/**
 * La barra di navigazione laterale.
 * Contiene i link alle diverse sezioni dell'applicazione.
 * Su mobile, si comporta come un menu a scomparsa.
 * @param {SidebarProps} props - Le prop del componente.
 * @returns {React.ReactElement} Il componente Sidebar.
 */
const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
    const { logout, isAuthenticated, isLoginProtectionEnabled, isAdmin } = useAuth();
    const { mode, toggleMode } = useTheme();
    
    const handleNavLinkClick = () => {
        if (isOpen) {
            setIsOpen(false);
        }
    }

    const sidebarClasses = `
        flex flex-col w-72 bg-surface text-on-surface transition-transform duration-300 ease-in-out
        border-r border-outline-variant
        fixed inset-y-0 left-0 z-40
        md:relative md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `;

    return (
        <aside className={sidebarClasses}>
            <div className="flex items-center justify-between h-20 px-4">
                <h1 className="text-2xl font-bold tracking-wider text-primary">Staffing App</h1>
                 <div className="flex items-center gap-2">
                    <button
                        onClick={toggleMode}
                        className="text-on-surface-variant p-2 rounded-full hover:bg-surface-container-low"
                        aria-label={mode === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
                    >
                        <span className="material-symbols-outlined">
                            {mode === 'dark' ? 'light_mode' : 'dark_mode'}
                        </span>
                    </button>
                    <button onClick={() => setIsOpen(false)} className="md:hidden text-on-surface-variant p-2 rounded-full hover:bg-surface-container-low">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                 </div>
            </div>
            <nav className="flex-1 flex flex-col overflow-y-auto">
                <div className="flex-grow">
                    <NavItem to="/staffing" icon="calendar_month" label="Staffing" onClick={handleNavLinkClick} />
                    <NavItem to="/workload" icon="groups" label="Carico Risorse" onClick={handleNavLinkClick} />
                    <NavItem to="/dashboard" icon="dashboard" label="Dashboard" onClick={handleNavLinkClick} />
                    <NavItem to="/resource-requests" icon="assignment_add" label="Richiesta Risorse" onClick={handleNavLinkClick} />
                    <NavItem to="/interviews" icon="chat" label="Gestione Colloqui" onClick={handleNavLinkClick} />
                    <NavItem to="/manuale-utente" icon="help_center" label="Manuale Utente" onClick={handleNavLinkClick} />

                    <NavHeader>Analisi</NavHeader>
                    <NavItem to="/forecasting" icon="trending_up" label="Forecasting" onClick={handleNavLinkClick} />
                    <NavItem to="/gantt" icon="align_horizontal_left" label="Gantt Progetti" onClick={handleNavLinkClick} />
                    <NavItem to="/reports" icon="summarize" label="Report" onClick={handleNavLinkClick} />
                    <NavItem to="/staffing-visualization" icon="schema" label="Visualizzazione" onClick={handleNavLinkClick} />
                    
                    <NavHeader>Gestione</NavHeader>
                    <NavItem to="/resources" icon="person" label="Risorse" onClick={handleNavLinkClick} />
                    <NavItem to="/projects" icon="business_center" label="Progetti" onClick={handleNavLinkClick} />
                    <NavItem to="/contracts" icon="request_quote" label="Contratti" onClick={handleNavLinkClick} />
                    <NavItem to="/clients" icon="apartment" label="Clienti" onClick={handleNavLinkClick} />
                    <NavItem to="/roles" icon="badge" label="Ruoli" onClick={handleNavLinkClick} />
                    <NavItem to="/calendar" icon="event" label="Calendario" onClick={handleNavLinkClick} />
                    <NavItem to="/config" icon="settings" label="Config" onClick={handleNavLinkClick} />

                    <NavHeader>Dati</NavHeader>
                    <NavItem to="/export" icon="download" label="Esporta Dati" onClick={handleNavLinkClick} />
                    <NavItem to="/import" icon="upload" label="Importa Dati" onClick={handleNavLinkClick} />
                    
                    {isAdmin && (
                        <>
                            <NavHeader>Amministrazione</NavHeader>
                            <NavItem to="/admin-settings" icon="admin_panel_settings" label="Impostazioni Admin" onClick={handleNavLinkClick} />
                            <NavItem to="/db-inspector" icon="database" label="Database Inspector" onClick={handleNavLinkClick} />
                        </>
                    )}
                </div>
                <div className="p-4">
                    {isAuthenticated && isLoginProtectionEnabled ? (
                        <div className="space-y-2">
                             <div className="px-4 py-2 text-center text-xs text-on-surface-variant">
                                Versione V1011
                            </div>
                            <button
                                onClick={logout}
                                className="flex items-center w-full px-4 py-2 text-error rounded-full hover:bg-error-container hover:text-on-error-container transition-colors duration-200"
                            >
                                <span className="material-symbols-outlined mr-3">logout</span>
                                Logout
                            </button>
                        </div>
                    ) : (
                        <div className="px-4 py-4 text-center text-xs text-on-surface-variant">
                            Versione V1011
                        </div>
                    )}
                </div>
            </nav>
        </aside>
    );
};

export default Sidebar;