import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEntitiesContext } from '../context/AppContext';
import { useRoutesManifest } from '../context/RoutesContext';
import type { AppRoute } from '../src/routes';
import type { SidebarFooterAction } from '../types';
import Modal from './Modal';
import { SpinnerIcon } from './icons';
import SidebarHeadless, { type RenderableSidebarItem, type SidebarSectionGroup } from './sidebar/SidebarHeadless';
import SidebarItemFactory from './sidebar/SidebarItemFactory';

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
    const location = useLocation();
    const { logout, user, changePassword, hasPermission } = useAuth();
    const { sidebarSections, sidebarSectionColors, notifications, sidebarFooterActions } = useEntitiesContext();
    const { navigationRoutes } = useRoutesManifest();

    // State per la modale cambio password
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [isSavingPassword, setIsSavingPassword] = useState(false);

    // Calcolo notifiche non lette
    const unreadNotifications = useMemo(() => {
        return notifications.filter(n => !n.isRead).length;
    }, [notifications]);

    // Raggruppa le voci per sezione e applica permessi opzionali
    const groupedItems = useMemo(() => {
        const groups: Record<string, AppRoute[]> = {};

        navigationRoutes.forEach(item => {
            if (item.requiredPermission && !hasPermission(item.requiredPermission)) return;
            const sectionName = item.section || 'Altro';
            if (!groups[sectionName]) {
                groups[sectionName] = [];
            }
            groups[sectionName].push(item);
        });

        const sortedGroups = Object.entries(groups).sort((a, b) => {
            const idxA = sidebarSections.indexOf(a[0]);
            const idxB = sidebarSections.indexOf(b[0]);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a[0].localeCompare(b[0]);
        });

        return sortedGroups;
    }, [hasPermission, navigationRoutes, sidebarSections]);

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        
        if (newPassword.length < 8) {
            setPasswordError('La password deve essere di almeno 8 caratteri.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('Le password non coincidono.');
            return;
        }

        setIsSavingPassword(true);
        try {
            await changePassword(newPassword);
            setIsPasswordModalOpen(false);
            setNewPassword('');
            setConfirmPassword('');
        } catch (e) {
            setPasswordError('Errore durante il cambio password.');
        } finally {
            setIsSavingPassword(false);
        }
    };

    const sections: SidebarSectionGroup[] = useMemo(() => {
        return groupedItems.map(([sectionName, items]) => {
            const sectionColor = sidebarSectionColors[sectionName];
            const renderableItems: RenderableSidebarItem[] = items.map(item => ({
                ...item,
                badge:
                    item.path === '/notifications' && unreadNotifications > 0 ? (
                        <span className="bg-error text-on-error text-xs font-bold px-2 py-0.5 rounded-full">
                            {unreadNotifications}
                        </span>
                    ) : null,
                isActive: location.pathname === item.path,
                onClick: () => {
                    if (window.innerWidth < 768) {
                        setIsOpen(false);
                    }
                }
            }));

            return {
                name: sectionName,
                color: sectionColor,
                items: renderableItems
            };
        });
    }, [groupedItems, location.pathname, setIsOpen, sidebarSectionColors, unreadNotifications]);

    const footerActions: SidebarFooterAction[] = useMemo(() => {
        return sidebarFooterActions
            .filter(action => !action.requiredPermission || hasPermission(action.requiredPermission))
            .map(action => ({
                ...action
            }));
    }, [hasPermission, sidebarFooterActions]);

    const handleFooterAction = (actionId: SidebarFooterAction['id']) => {
        if (actionId === 'changePassword') {
            setIsPasswordModalOpen(true);
        } else if (actionId === 'logout') {
            logout();
        }
    };

    const renderFooterAction = (action: SidebarFooterAction) => {
        const colorClass =
            action.id === 'logout'
                ? 'text-on-error-container bg-error-container'
                : 'text-primary bg-primary-container/50 hover:bg-primary-container';
        const style = action.color ? { color: `var(--color-${action.color})` } : undefined;
        return (
            <button
                onClick={() => handleFooterAction(action.id)}
                className={`flex items-center justify-center w-full px-4 py-2 text-sm font-medium rounded-full transition-colors ${colorClass}`}
                style={style}
            >
                <span className="material-symbols-outlined mr-2 text-lg">{action.icon}</span>
                {action.label}
            </button>
        );
    };

    return (
        <>
            <SidebarHeadless
                isOpen={isOpen}
                onCloseMobile={() => setIsOpen(false)}
                headerSlot={<h1 className="text-2xl font-bold text-primary tracking-widest">PLANNER</h1>}
                userSlot={
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                            {user?.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-on-surface truncate">{user?.username}</p>
                            <p className="text-xs text-on-surface-variant truncate">{user?.role}</p>
                        </div>
                    </div>
                }
                sections={sections}
                footerActions={footerActions}
                renderItem={(item) => <SidebarItemFactory item={item} />}
                renderFooterAction={renderFooterAction}
            />

            {/* Change Password Modal */}
            {isPasswordModalOpen && (
                <Modal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} title="Cambia Password">
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Nuova Password</label>
                            <input 
                                type="password" 
                                required 
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="form-input w-full"
                                placeholder="Minimo 8 caratteri"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Conferma Password</label>
                            <input 
                                type="password" 
                                required 
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="form-input w-full"
                                placeholder="Ripeti password"
                            />
                        </div>

                        {passwordError && <div className="text-error text-sm font-medium">{passwordError}</div>}

                        <div className="flex justify-end gap-2 pt-4">
                            <button 
                                type="button" 
                                onClick={() => setIsPasswordModalOpen(false)} 
                                className="px-4 py-2 border border-outline rounded-full text-primary hover:bg-surface-container"
                            >
                                Annulla
                            </button>
                            <button 
                                type="submit" 
                                disabled={isSavingPassword}
                                className="flex items-center justify-center px-4 py-2 bg-primary text-on-primary rounded-full hover:opacity-90 disabled:opacity-50"
                            >
                                {isSavingPassword ? <SpinnerIcon className="w-5 h-5" /> : 'Salva Nuova Password'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </>
    );
};

export default Sidebar;
