
import React from 'react';
import type { SidebarFooterAction, SidebarItem } from '../../types';

export interface RenderableSidebarItem extends Omit<SidebarItem, 'section'> {
    section?: string;
    badge?: React.ReactNode;
    isActive?: boolean;
    onClick?: () => void;
    requiredPermission?: string;
}

export interface SidebarSectionGroup {
    name: string;
    color?: string;
    items: RenderableSidebarItem[];
    isExpanded: boolean;
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
    onToggleSection: (sectionName: string) => void;
}

const SidebarHeadless: React.FC<SidebarHeadlessProps> = ({
    isOpen,
    headerSlot,
    userSlot,
    sections,
    footerActions,
    renderItem,
    renderFooterAction,
    onCloseMobile,
    onToggleSection
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
                        
                        const colorValue = section.color 
                            ? (section.color.startsWith('#') ? section.color : `var(--color-${section.color})`)
                            : undefined;
                        
                        const sectionStyle = colorValue ? { color: colorValue } : undefined;

                        return (
                            <div key={section.name} className="mb-1">
                                <button
                                    onClick={() => onToggleSection(section.name)}
                                    className="w-full px-4 py-2 flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase tracking-wider hover:bg-surface-container-low transition-colors group"
                                >
                                    <span style={sectionStyle}>{section.name}</span>
                                    <span className={`material-symbols-outlined text-sm transition-transform duration-300 ${section.isExpanded ? 'rotate-180' : ''}`}>
                                        keyboard_arrow_down
                                    </span>
                                </button>
                                
                                <div className={`grid transition-all duration-300 ease-in-out ${section.isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
                                    <div className="overflow-hidden">
                                        {section.items.map(item => (
                                            <div key={item.path} onClick={() => handleItemClick(item)}>
                                                {renderItem(item)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
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
