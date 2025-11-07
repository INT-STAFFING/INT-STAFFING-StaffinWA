/**
 * @file Sidebar.tsx
 * @description Componente per la barra di navigazione laterale dell'applicazione.
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
    const navLinkClasses = "flex items-center px-4 py-2 text-gray-400 rounded-md hover:bg-gray-700 hover:text-white transition-colors duration-200";
    const activeNavLinkClasses = "bg-gray-700 text-white";

    /**
     * Determina le classi CSS per un NavLink in base al suo stato (attivo o non).
     * @param {{ isActive: boolean }} props - Oggetto fornito da NavLink che indica se il link è attivo.
     * @returns {string} La stringa di classi CSS.
     */
    const getNavLinkClass = ({ isActive }: { isActive: boolean }): string =>
        isActive ? `${navLinkClasses} ${activeNavLinkClasses}` : navLinkClasses;
    
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
        flex flex-col w-64 bg-gray-800 text-white transition-transform duration-300 ease-in-out
        fixed inset-y-0 left-0 z-40
        md:relative md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `;

    return (
        <aside className={sidebarClasses}>
            <div className="flex items-center justify-between h-20 shadow-md px-4">
                <h1 className="text-2xl font-bold tracking-wider">Staffing App</h1>
                 <button onClick={() => setIsOpen(false)} className="md:hidden text-gray-400 hover:text-white">
                    <span className="text-xl">❌</span>
                </button>
            </div>
            <nav className="flex-1 flex flex-col px-2 py-4 space-y-2 overflow-y-auto">
                <div>
                    <NavLink to="/staffing" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <span className="mr-3 text-xl w-6 text-center">🗓️</span>
                        Staffing
                    </NavLink>
                    <NavLink to="/workload" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <span className="mr-3 text-xl w-6 text-center">👥</span>
                        Carico Risorse
                    </NavLink>
                    <NavLink to="/dashboard" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <span className="mr-3 text-xl w-6 text-center">📊</span>
                        Dashboard
                    </NavLink>
                    <NavLink to="/resource-requests" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <span className="mr-3 text-xl w-6 text-center">📋</span>
                        Richiesta Risorse
                    </NavLink>
                    <NavLink to="/interviews" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <span className="mr-3 text-xl w-6 text-center">💬</span>
                        Gestione Colloqui
                    </NavLink>
                    <NavLink to="/manuale-utente" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <span className="mr-3 text-xl w-6 text-center">ℹ️</span>
                        Manuale Utente
                    </NavLink>

                    <div className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Analisi</div>
                    <NavLink to="/forecasting" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <span className="mr-3 text-xl w-6 text-center">📈</span>
                        Forecasting
                    </NavLink>
                    <NavLink to="/gantt" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <span className="mr-3 text-xl w-6 text-center">📏</span>
                        Gantt Progetti
                    </NavLink>
                    <NavLink to="/reports" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <span className="mr-3 text-xl w-6 text-center">📄</span>
                        Report
                    </NavLink>
                    <NavLink to="/staffing-visualization" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <span className="mr-3 text-xl w-6 text-center">🎨</span>
                        Visualizzazione
                    </NavLink>
                    
                    <div className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Gestione</div>
                    
                    <NavLink to="/resources" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <span className="mr-3 text-xl w-6 text-center">👥</span>
                        Risorse
                    </NavLink>
                    <NavLink to="/projects" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <span className="mr-3 text-xl w-6 text-center">💼</span>
                        Progetti
                    </NavLink>
                    <NavLink to="/contracts" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <span className="mr-3 text-xl w-6 text-center">📜</span>
                        Contratti
                    </NavLink>
                    <NavLink to="/clients" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <span className="mr-3 text-xl w-6 text-center">🏢</span>
                        Clienti
                    </NavLink>
                    <NavLink to="/roles" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <span className="mr-3 text-xl w-6 text-center">🏷️</span>
                        Ruoli
                    </NavLink>
                     <NavLink to="/calendar" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <span className="mr-3 text-xl w-6 text-center">📅</span>
                        Calendario
                    </NavLink>
                     <NavLink to="/config" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <span className="mr-3 text-xl w-6 text-center">⚙️</span>
                        Config
                    </NavLink>

                     <div className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Dati</div>
                     <NavLink to="/export" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <span className="mr-3 text-xl w-6 text-center">📥</span>
                        Esporta Dati
                    </NavLink>
                    <NavLink to="/import" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <span className="mr-3 text-xl w-6 text-center">📤</span>
                        Importa Dati
                    </NavLink>
                    
                    {isAdmin && (
                        <>
                            <div className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amministrazione</div>
                            <NavLink to="/admin-settings" className={getNavLinkClass} onClick={handleNavLinkClick}>
                                <span className="mr-3 text-xl w-6 text-center">⚙️</span>
                                Impostazioni Admin
                            </NavLink>
                            <NavLink to="/db-inspector" className={getNavLinkClass} onClick={handleNavLinkClick}>
                                <span className="mr-3 text-xl w-6 text-center">🔍</span>
                                Database Inspector
                            </NavLink>
                        </>
                    )}
                </div>
                {isAuthenticated && isLoginProtectionEnabled ? (
                    <div className="mt-auto">
                        <div className="px-4 py-2 text-center text-xs text-gray-500">
                            Versione V1004
                        </div>
                        <button
                            onClick={logout}
                            className="flex items-center w-full px-4 py-3 text-red-400 rounded-md hover:bg-red-700/50 hover:text-white transition-colors duration-200"
                        >
                            <span className="mr-3 text-xl w-6 text-center">🚪</span>
                            Logout
                        </button>
                    </div>
                ) : (
                    <div className="mt-auto px-4 py-4 text-center text-xs text-gray-500">
                        Versione V1004
                    </div>
                )}
            </nav>
        </aside>
    );
};

export default Sidebar;
