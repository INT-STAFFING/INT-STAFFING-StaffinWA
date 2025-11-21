
import React, { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEntitiesContext } from '../context/AppContext';
import { SidebarItem } from '../types';

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

interface NavItemProps {
    to: string;
    icon: string;
    label: string;
    color?: string;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, color }) => {
    // Helper to get dynamic style based on theme color key if present
    const getColorStyle = (isActive: boolean) => {
        if (isActive) return {}; // Active overrides color to primary usually
        if (color) return { color: `var(--color-${color})` };
        return {};
    };

    return (
    <NavLink
        to={to}
        className={({ isActive }) =>
            `flex items-center px-4 py-3 text-sm font-medium transition-colors duration-200 ${
                isActive
                    ? 'text-primary bg-secondary-container border-r-4 border-primary'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`
        }
        style={({ isActive }) => getColorStyle(isActive)}
    >
        <span className="material-symbols-outlined mr-3">{icon}</span>
        {label}
    </NavLink>
)};

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
    const { logout, user, isAdmin, hasPermission } = useAuth();
    const { sidebarConfig, sidebarSections, sidebarSectionColors } = useEntitiesContext();
    const location = useLocation();

    // Layout fix: Mobile is fixed (overlay/slide), Desktop is relative (flex item taking space)
    const sidebarClasses = `fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r border-outline-variant transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
    }`;

    // Raggruppa le voci per sezione
    const groupedItems = useMemo(() => {
        const groups: Record<string, SidebarItem[]> = {};
        
        sidebarConfig.forEach(item => {
            if (!groups[item.section]) {
                groups[item.section] = [];
            }
            groups[item.section].push(item);
        });
        
        const sortedGroups = Object.entries(groups).sort((a, b) => {
            const idxA = sidebarSections.indexOf(a[0]);
            const idxB = sidebarSections.indexOf(b[0]);
            // If both found in config, sort by index
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            // If one not found, push to end
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            // If neither found, sort alphabetically
            return a[0].localeCompare(b[0]);
        });

        return sortedGroups;
    }, [sidebarConfig, sidebarSections]);

    return (
        <aside className={sidebarClasses}>
            <div className="flex flex-col h-full">
                <div className="flex items-center justify-center h-20 border-b border-outline-variant flex-shrink-0">
                    <h1 className="text-2xl font-bold text-primary tracking-widest">PLANNER</h1>
                </div>

                <nav className="flex-1 overflow-y-auto py-4">
                    {groupedItems.map(([sectionName, items]) => {
                        // Filter items based on permissions
                        const visibleItems = items.filter(item => hasPermission(item.path));
                        
                        if (visibleItems.length === 0) return null;
                        
                        const sectionColor = sidebarSectionColors[sectionName];
                        const sectionStyle = sectionColor ? { color: `var(--color-${sectionColor})` } : {};

                        return (
                            <div key={sectionName} className="pb-4">
                                <p 
                                    className="px-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2"
                                    style={sectionStyle}
                                >
                                    {sectionName}
                                </p>
                                {visibleItems.map(item => (
                                    <NavItem key={item.path} to={item.path} icon={item.icon} label={item.label} color={item.color} />
                                ))}
                            </div>
                        );
                    })}

                    {/* Admin Section (Hardcoded for safety/separation) */}
                    {isAdmin && (
                        <div className="pb-4">
                            <p className="px-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Amministrazione</p>
                            <NavItem to="/admin-settings" icon="admin_panel_settings" label="Impostazioni Admin" />
                            <NavItem to="/db-inspector" icon="database" label="Database Inspector" />
                        </div>
                    )}
                </nav>

                <div className="p-4 border-t border-outline-variant flex-shrink-0 bg-surface">
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
        </aside>
    );
};

export default Sidebar;
