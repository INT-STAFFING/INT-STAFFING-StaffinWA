/**
 * @file Sidebar.tsx
 * @description Componente per la barra di navigazione laterale dell'applicazione.
 */

import React, { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useEntitiesContext } from '../context/AppContext';
import Modal from './Modal';
import { SpinnerIcon } from './icons';

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

const NavItem: React.FC<{ to: string; icon: string; label: string; onClick: () => void; badgeCount?: number }> = ({ to, icon, label, onClick, badgeCount }) => {
    const baseClasses = "flex items-center text-sm font-medium text-on-surface-variant transition-colors duration-200 h-14";
    const activeClasses = "text-on-secondary-container";
    const { hasPermission, isLoginProtectionEnabled } = useAuth();

    // Check RBAC permission
    if (isLoginProtectionEnabled && !hasPermission(to)) {
        return null;
    }

    return (
        <NavLink to={to} onClick={onClick}>
            {({ isActive }) => (
                 <div className={`${baseClasses} ${isActive ? activeClasses : 'hover:bg-surface-container-low'}`}>
                    <div className={`w-full mx-4 flex items-center justify-between py-2 px-3 rounded-full ${isActive ? 'bg-secondary-container' : ''}`}>
                       <div className="flex items-center gap-3">
                           <span className="material-symbols-outlined w-6 text-center">{icon}</span>
                           <span>{label}</span>
                       </div>
                       {badgeCount !== undefined && badgeCount > 0 && (
                           <span className="bg-error text-on-error text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[1.5rem] text-center">
                               {badgeCount > 99 ? '99+' : badgeCount}
                           </span>
                       )}
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
    const { logout, isAuthenticated, isLoginProtectionEnabled, isAdmin, user, changePassword } = useAuth();
    const { mode, toggleMode } = useTheme();
    const { leaveRequests } = useEntitiesContext();
    const [isChangePwdOpen, setIsChangePwdOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [isLoadingPwd, setIsLoadingPwd] = useState(false);
    
    const handleNavLinkClick = () => {
        if (isOpen) {
            setIsOpen(false);
        }
    }

    const pendingLeavesCount = useMemo(() => {
        if (!isAdmin) return 0;
        return leaveRequests.filter(l => l.status === 'PENDING').length;
    }, [leaveRequests, isAdmin]);

    const sidebarClasses = `
        flex flex-col w-72 bg-surface text-on-surface transition-transform duration-300 ease-in-out
        border-r border-outline-variant
        fixed inset-y-0 left-0 z-40
        md:relative md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `;

    const handleChangePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoadingPwd(true);
        try {
            await changePassword(newPassword);
            setIsChangePwdOpen(false);
            setNewPassword('');
        } finally {
            setIsLoadingPwd(false);
        }
    };

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
                    <NavItem to="/leaves" icon="event_busy" label="Gestione Assenze" onClick={handleNavLinkClick} badgeCount={pendingLeavesCount} />
                    <NavItem to="/resource-requests" icon="assignment_add" label="Richiesta Risorse" onClick={handleNavLinkClick} />
                    <NavItem to="/interviews" icon="chat" label="Gestione Colloqui" onClick={handleNavLinkClick} />
                    <NavItem to="/skills-map" icon="school" label="Mappa Competenze" onClick={handleNavLinkClick} />
                    <NavItem to="/manuale-utente" icon="help_center" label="Manuale Utente" onClick={handleNavLinkClick} />

                    <NavHeader>Analisi</NavHeader>
                    <NavItem to="/forecasting" icon="trending_up" label="Forecasting" onClick={handleNavLinkClick} />
                    <NavItem to="/gantt" icon="align_horizontal_left" label="Gantt Progetti" onClick={handleNavLinkClick} />
                    <NavItem to="/skill-analysis" icon="hub" label="Analisi Competenze" onClick={handleNavLinkClick} />
                    <NavItem to="/reports" icon="summarize" label="Report" onClick={handleNavLinkClick} />
                    <NavItem to="/staffing-visualization" icon="schema" label="Visualizzazione" onClick={handleNavLinkClick} />
                    
                    <NavHeader>Gestione</NavHeader>
                    <NavItem to="/resources" icon="person" label="Risorse" onClick={handleNavLinkClick} />
                    <NavItem to="/skills" icon="psychology" label="Competenze" onClick={handleNavLinkClick} />
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
                            <NavItem to="/test-staffing" icon="science" label="Test Staffing" onClick={handleNavLinkClick} />
                        </>
                    )}
                </div>
                <div className="p-4 bg-surface-container-low border-t border-outline-variant">
                    {isAuthenticated && isLoginProtectionEnabled ? (
                        <div className="space-y-3">
                             <div className="flex items-center gap-3 px-2">
                                <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold">
                                    {user?.username.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-sm font-semibold text-on-surface truncate">{user?.username}</span>
                                    <span className="text-xs text-on-surface-variant truncate uppercase">{user?.role}</span>
                                </div>
                             </div>
                             <div className="flex gap-2">
                                <button
                                    onClick={() => setIsChangePwdOpen(true)}
                                    className="flex-1 flex items-center justify-center px-2 py-2 text-xs font-medium text-on-surface-variant bg-surface border border-outline-variant rounded-full hover:bg-surface-container transition-colors"
                                    title="Cambia Password"
                                >
                                    <span className="material-symbols-outlined text-sm">key</span>
                                </button>
                                <button
                                    onClick={logout}
                                    className="flex-[3] flex items-center justify-center px-4 py-2 text-xs font-medium text-error border border-error rounded-full hover:bg-error-container hover:text-on-error-container transition-colors duration-200"
                                >
                                    <span className="material-symbols-outlined mr-2 text-sm">logout</span>
                                    Logout
                                </button>
                             </div>
                        </div>
                    ) : (
                        <div className="px-4 py-2 text-center text-xs text-on-surface-variant">
                            Versione V1014
                        </div>
                    )}
                </div>
            </nav>

            {isChangePwdOpen && (
                <Modal isOpen={isChangePwdOpen} onClose={() => setIsChangePwdOpen(false)} title="Cambia Password">
                    <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                        <p className="text-sm text-on-surface-variant">Inserisci la nuova password per il tuo account.</p>
                        <div>
                            <label className="block text-sm font-medium text-on-surface mb-1">Nuova Password</label>
                            <input 
                                type="password" 
                                value={newPassword} 
                                onChange={(e) => setNewPassword(e.target.value)} 
                                required 
                                className="form-input"
                                minLength={6}
                            />
                        </div>
                        <div className="flex justify-end space-x-2">
                            <button type="button" onClick={() => setIsChangePwdOpen(false)} className="px-4 py-2 border border-outline rounded-full text-primary hover:bg-surface-container-low">Annulla</button>
                            <button type="submit" disabled={isLoadingPwd} className="flex items-center px-4 py-2 bg-primary text-on-primary rounded-full disabled:opacity-50">
                                {isLoadingPwd ? <SpinnerIcon className="w-4 h-4"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </aside>
    );
};

export default Sidebar;