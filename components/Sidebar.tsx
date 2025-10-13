/**
 * @file Sidebar.tsx
 * @description Componente per la barra di navigazione laterale dell'applicazione.
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import { ChartBarIcon, CalendarDaysIcon, UsersIcon, BriefcaseIcon, BuildingOfficeIcon, TagIcon, ArrowDownOnSquareIcon, Cog6ToothIcon, ArrowUpOnSquareIcon, XMarkIcon, PresentationChartLineIcon, Bars4Icon, CalendarIcon, UserGroupIcon, InformationCircleIcon } from './icons';

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
        fixed inset-y-0 left-0 z-30
        md:relative md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `;

    return (
        <div className={sidebarClasses}>
            <div className="flex items-center justify-between h-20 shadow-md px-4">
                <h1 className="text-2xl font-bold tracking-wider">Staffing App</h1>
                 <button onClick={() => setIsOpen(false)} className="md:hidden text-gray-400 hover:text-white">
                    <XMarkIcon className="w-6 h-6" />
                </button>
            </div>
            <nav className="flex-1 px-2 py-4 space-y-2">
                <NavLink to="/staffing" className={getNavLinkClass} onClick={handleNavLinkClick}>
                    <CalendarDaysIcon className="w-6 h-6 mr-3" />
                    Staffing
                </NavLink>
                <NavLink to="/workload" className={getNavLinkClass} onClick={handleNavLinkClick}>
                    <UserGroupIcon className="w-6 h-6 mr-3" />
                    Carico Risorse
                </NavLink>
                <NavLink to="/dashboard" className={getNavLinkClass} onClick={handleNavLinkClick}>
                    <ChartBarIcon className="w-6 h-6 mr-3" />
                    Dashboard
                </NavLink>

                <div className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Analisi</div>
                <NavLink to="/forecasting" className={getNavLinkClass} onClick={handleNavLinkClick}>
                    <PresentationChartLineIcon className="w-6 h-6 mr-3" />
                    Forecasting
                </NavLink>
                <NavLink to="/gantt" className={getNavLinkClass} onClick={handleNavLinkClick}>
                    <Bars4Icon className="w-6 h-6 mr-3" />
                    Gantt Progetti
                </NavLink>
                
                <div className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Gestione</div>
                <NavLink to="/resources" className={getNavLinkClass} onClick={handleNavLinkClick}>
                    <UsersIcon className="w-6 h-6 mr-3" />
                    Risorse
                </NavLink>
                <NavLink to="/projects" className={getNavLinkClass} onClick={handleNavLinkClick}>
                    <BriefcaseIcon className="w-6 h-6 mr-3" />
                    Progetti
                </NavLink>
                <NavLink to="/clients" className={getNavLinkClass} onClick={handleNavLinkClick}>
                    <BuildingOfficeIcon className="w-6 h-6 mr-3" />
                    Clienti
                </NavLink>
                <NavLink to="/roles" className={getNavLinkClass} onClick={handleNavLinkClick}>
                    <TagIcon className="w-6 h-6 mr-3" />
                    Ruoli
                </NavLink>
                 <NavLink to="/calendar" className={getNavLinkClass} onClick={handleNavLinkClick}>
                    <CalendarIcon className="w-6 h-6 mr-3" />
                    Calendario
                </NavLink>
                 <NavLink to="/config" className={getNavLinkClass} onClick={handleNavLinkClick}>
                    <Cog6ToothIcon className="w-6 h-6 mr-3" />
                    Config
                </NavLink>

                 <div className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Dati</div>
                 <NavLink to="/export" className={getNavLinkClass} onClick={handleNavLinkClick}>
                    <ArrowDownOnSquareIcon className="w-6 h-6 mr-3" />
                    Esporta Excel
                </NavLink>
                <NavLink to="/import" className={getNavLinkClass} onClick={handleNavLinkClick}>
                    <ArrowUpOnSquareIcon className="w-6 h-6 mr-3" />
                    Importa Dati
                </NavLink>
            </nav>
        </div>
    );
};

export default Sidebar;