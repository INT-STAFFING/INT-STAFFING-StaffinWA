
import React from 'react';
import { NavLink } from 'react-router-dom';
import { ChartBarIcon, CalendarDaysIcon, UsersIcon, BriefcaseIcon, BuildingOfficeIcon, TagIcon, ArrowDownOnSquareIcon, Cog6ToothIcon, ArrowUpOnSquareIcon } from './icons';

const Sidebar: React.FC = () => {
    const navLinkClasses = "flex items-center px-4 py-2 text-gray-400 rounded-md hover:bg-gray-700 hover:text-white transition-colors duration-200";
    const activeNavLinkClasses = "bg-gray-700 text-white";

    const getNavLinkClass = ({ isActive }: { isActive: boolean }) =>
        isActive ? `${navLinkClasses} ${activeNavLinkClasses}` : navLinkClasses;

    return (
        <div className="flex flex-col w-64 bg-gray-800 text-white">
            <div className="flex items-center justify-center h-20 shadow-md">
                <h1 className="text-2xl font-bold tracking-wider">Staffing App</h1>
            </div>
            <nav className="flex-1 px-2 py-4 space-y-2">
                <NavLink to="/staffing" className={getNavLinkClass}>
                    <CalendarDaysIcon className="w-6 h-6 mr-3" />
                    Staffing
                </NavLink>
                <NavLink to="/dashboard" className={getNavLinkClass}>
                    <ChartBarIcon className="w-6 h-6 mr-3" />
                    Dashboard
                </NavLink>
                <div className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Gestione</div>
                <NavLink to="/resources" className={getNavLinkClass}>
                    <UsersIcon className="w-6 h-6 mr-3" />
                    Risorse
                </NavLink>
                <NavLink to="/projects" className={getNavLinkClass}>
                    <BriefcaseIcon className="w-6 h-6 mr-3" />
                    Progetti
                </NavLink>
                <NavLink to="/clients" className={getNavLinkClass}>
                    <BuildingOfficeIcon className="w-6 h-6 mr-3" />
                    Clienti
                </NavLink>
                <NavLink to="/roles" className={getNavLinkClass}>
                    <TagIcon className="w-6 h-6 mr-3" />
                    Ruoli
                </NavLink>
                 <NavLink to="/config" className={getNavLinkClass}>
                    <Cog6ToothIcon className="w-6 h-6 mr-3" />
                    Config
                </NavLink>

                 <div className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Dati</div>
                 <NavLink to="/export" className={getNavLinkClass}>
                    <ArrowDownOnSquareIcon className="w-6 h-6 mr-3" />
                    Esporta Excel
                </NavLink>
                <NavLink to="/import" className={getNavLinkClass}>
                    <ArrowUpOnSquareIcon className="w-6 h-6 mr-3" />
                    Importa Dati
                </NavLink>
            </nav>
        </div>
    );
};

export default Sidebar;