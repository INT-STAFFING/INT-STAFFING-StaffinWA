import React from 'react';
import type { SidebarFooterAction, SidebarItem } from '../../types';

export interface RenderableSidebarItem extends SidebarItem {
    badge?: React.ReactNode;
    isActive?: boolean;
    onClick?: () => void;
}

export interface SidebarSectionGroup {
    name: string;
    color?: string;
    items: RenderableSidebarItem[];
}

interface SidebarHeadlessProps {
    isOpen: boolean;
    headerSlot?: React.ReactNode;
    userSlot?: React.ReactNode;
    sections: SidebarSectionGroup[];
    footerActions: SidebarFooterAction[];
    renderItem: (item: RenderableSidebarItem) => React.ReactNode;
    renderFooterAction: (action: SidebarFooterAction) => React.ReactNode;
    onCloseMobile: () => void;
}

const SidebarHeadless: React.FC<SidebarHeadlessProps> = ({
    isOpen,
    headerSlot,
    userSlot,
    sections,
    footerActions,
    renderItem,
    renderFooterAction,
    onCloseMobile
}) => {
    const sidebarClasses = `fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r border-outline-variant transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
    }`;

    const handleItemClick = (item: RenderableSidebarItem) => {
        item.onClick?.();
        if (window.innerWidth < 768) {
            onCloseMobile();
        }
    };

    return (
        <aside className={sidebarClasses} aria-label="Sidebar di navigazione">
            <div className="flex flex-col h-full">
                <div className="flex items-center justify-center h-20 border-b border-outline-variant flex-shrink-0">
                    {headerSlot}
                </div>

                <nav className="flex-1 overflow-y-auto py-4">
                    {sections.map(section => {
                        if (!section.items.length) return null;
                        const sectionStyle = section.color ? { color: `var(--color-${section.color})` } : undefined;
                        return (
                            <div key={section.name} className="pb-4">
                                <p
                                    className="px-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2"
                                    style={sectionStyle}
                                >
                                    {section.name}
                                </p>
                                {section.items.map(item => (
                                    <div key={item.path} onClick={() => handleItemClick(item)}>
                                        {renderItem(item)}
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-outline-variant flex-shrink-0 bg-surface space-y-3">
                    {userSlot}
                    <div className="space-y-2">
                        {footerActions.map(action => (
                            <div key={action.id}>{renderFooterAction(action)}</div>
                        ))}
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default SidebarHeadless;
