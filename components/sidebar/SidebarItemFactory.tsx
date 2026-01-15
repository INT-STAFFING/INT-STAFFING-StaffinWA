import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { RenderableSidebarItem } from './SidebarHeadless';

interface SidebarItemFactoryProps {
    item: RenderableSidebarItem;
}

const SidebarItemFactory: React.FC<SidebarItemFactoryProps> = ({ item }) => {
    const location = useLocation();
    const isActive = item.isActive ?? location.pathname === item.path;

    const getColorStyle = (active: boolean) => {
        if (active) return {};
        if (item.color) return { color: `var(--color-${item.color})` };
        return {};
    };

    return (
        <Link
            to={item.path}
            onClick={item.onClick}
            className={`flex items-center px-4 py-3 text-sm font-medium transition-colors duration-200 justify-between ${
                isActive
                    ? 'text-primary bg-secondary-container border-r-4 border-primary'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
            style={getColorStyle(isActive)}
        >
            <div className="flex items-center">
                <span className="material-symbols-outlined mr-3">{item.icon}</span>
                {item.label}
            </div>
            {item.badge}
        </Link>
    );
};

export default SidebarItemFactory;