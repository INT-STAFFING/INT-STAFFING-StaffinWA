/**
 * @file Sidebar.tsx
 * @description Componente per la barra di navigazione laterale dell'applicazione.
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from './Icon';

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
    // MODIFICA: Stili dei link aggiornati per usare le nuove variabili CSS e un indicatore di stato attivo.
    const navLinkClasses = "flex items-center px-[var(--space-4)] py-[var(--space-2)] text-gray-400 rounded-md hover:bg-[var(--nav-bg-hover)] hover:text-[var(--nav-text-hover)] transition-colors duration-200 relative";
    const activeNavLinkClasses = "bg-[var(--nav-bg-active)] text-[var(--nav-text-active)] font-semibold before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-2/3 before:w-1 before:bg-[var(--nav-indicator-active)] before:rounded-r-full";

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
        fixed inset-y-0 left-0 z-30
        md:relative md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `;

    return (
        <aside className={sidebarClasses}>
            {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
            <div className="flex items-center justify-between h-[var(--space-20)] shadow-md px-[var(--space-4)]">
                {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                <h1 className="text-[var(--font-size-2xl)] font-bold tracking-wider">Staffing App</h1>
                 <button onClick={() => setIsOpen(false)} className="md:hidden text-gray-400 hover:text-white">
                    {/* MODIFICA: Sostituita emoji con icona vettoriale per coerenza. */}
                    <Icon name="X" size={24} />
                </button>
            </div>
            {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
            <nav className="flex-1 flex flex-col px-[var(--space-2)] py-[var(--space-4)] space-y-[var(--space-1)] overflow-y-auto">
                <div>
                    <NavLink to="/staffing" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <Icon name="CalendarDays" size={20} className="mr-3 flex-shrink-0" />
                        Staffing
                    </NavLink>
                    <NavLink to="/workload" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <Icon name="Users" size={20} className="mr-3 flex-shrink-0" />
                        Carico Risorse
                    </NavLink>
                    <NavLink to="/dashboard" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <Icon name="LayoutGrid" size={20} className="mr-3 flex-shrink-0" />
                        Dashboard
                    </NavLink>
                    <NavLink to="/resource-requests" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <Icon name="ClipboardList" size={20} className="mr-3 flex-shrink-0" />
                        Richiesta Risorse
                    </NavLink>
                    <NavLink to="/interviews" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <Icon name="MessageSquare" size={20} className="mr-3 flex-shrink-0" />
                        Gestione Colloqui
                    </NavLink>
                    <NavLink to="/manuale-utente" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <Icon name="Info" size={20} className="mr-3 flex-shrink-0" />
                        Manuale Utente
                    </NavLink>
                    {/* MODIFICA: Migliorata la visibilità delle sezioni. */}
                    <div className="px-4 pt-6 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                        Analisi
                    </div>
                    <NavLink to="/forecasting" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <Icon name="TrendingUp" size={20} className="mr-3 flex-shrink-0" />
                        Forecasting
                    </NavLink>
                    <NavLink to="/gantt" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <Icon name="GanttChartSquare" size={20} className="mr-3 flex-shrink-0" />
                        Gantt Progetti
                    </NavLink>
                    <NavLink to="/reports" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <Icon name="FileText" size={20} className="mr-3 flex-shrink-0" />
                        Report
                    </NavLink>
                    <NavLink to="/staffing-visualization" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <Icon name="Palette" size={20} className="mr-3 flex-shrink-0" />
                        Visualizzazione
                    </NavLink>
                    {/* MODIFICA: Migliorata la visibilità delle sezioni. */}
                    <div className="px-4 pt-6 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                         <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                        Gestione
                    </div>
                    
                    <NavLink to="/resources" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <Icon name="Users" size={20} className="mr-3 flex-shrink-0" />
                        Risorse
                    </NavLink>
                    <NavLink to="/projects" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <Icon name="Briefcase" size={20} className="mr-3 flex-shrink-0" />
                        Progetti
                    </NavLink>
                    <NavLink to="/contracts" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <Icon name="FileSignature" size={20} className="mr-3 flex-shrink-0" />
                        Contratti
                    </NavLink>
                    <NavLink to="/clients" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <Icon name="Building" size={20} className="mr-3 flex-shrink-0" />
                        Clienti
                    </NavLink>
                    <NavLink to="/roles" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <Icon name="Tags" size={20} className="mr-3 flex-shrink-0" />
                        Ruoli
                    </NavLink>
                     <NavLink to="/calendar" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <Icon name="Calendar" size={20} className="mr-3 flex-shrink-0" />
                        Calendario
                    </NavLink>
                     <NavLink to="/config" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <Icon name="Settings" size={20} className="mr-3 flex-shrink-0" />
                        Config
                    </NavLink>
                    {/* MODIFICA: Migliorata la visibilità delle sezioni. */}
                     <div className="px-4 pt-6 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                         <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                         Dati
                    </div>
                     <NavLink to="/export" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <Icon name="Download" size={20} className="mr-3 flex-shrink-0" />
                        Esporta Dati
                    </NavLink>
                    <NavLink to="/import" className={getNavLinkClass} onClick={handleNavLinkClick}>
                        <Icon name="Upload" size={20} className="mr-3 flex-shrink-0" />
                        Importa Dati
                    </NavLink>
                    
                    {isAdmin && (
                        <>
                            {/* MODIFICA: Migliorata la visibilità delle sezioni. */}
                            <div className="px-4 pt-6 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                                Amministrazione
                            </div>
                            <NavLink to="/admin-settings" className={getNavLinkClass} onClick={handleNavLinkClick}>
                                <Icon name="Settings" size={20} className="mr-3 flex-shrink-0" />
                                Impostazioni Admin
                            </NavLink>
                            <NavLink to="/db-inspector" className={getNavLinkClass} onClick={handleNavLinkClick}>
                                <Icon name="Search" size={20} className="mr-3 flex-shrink-0" />
                                Database Inspector
                            </NavLink>
                        </>
                    )}
                </div>
                {isAuthenticated && isLoginProtectionEnabled ? (
                    <div className="mt-auto">
                        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                        <div className="px-[var(--space-4)] py-[var(--space-2)] text-center text-[var(--font-size-xs)] text-gray-500">
                            Versione V600
                        </div>
                        <button
                            onClick={logout}
                            // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                            className="flex items-center w-full px-[var(--space-4)] py-[var(--space-3)] text-red-400 rounded-md hover:bg-red-700/50 hover:text-white transition-colors duration-200"
                        >
                            <Icon name="LogOut" size={20} className="mr-3 flex-shrink-0" />
                            Logout
                        </button>
                    </div>
                ) : (
                    // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                    <div className="mt-auto px-[var(--space-4)] py-[var(--space-4)] text-center text-[var(--font-size-xs)] text-gray-500">
                        Versione V600
                    </div>
                )}
            </nav>
        </aside>
    );
};

export default Sidebar;