import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEntitiesContext } from '../context/AppContext';
import { useRoutesManifest } from '../context/RoutesContext';
import type { AppRoute } from '../src/routes';
import Modal from './Modal';
import { SpinnerIcon } from './icons';

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

interface NavItemProps {
    to: string;
    icon: string;
    label: string;
    color?: string;
    badgeCount?: number;
    onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, color, badgeCount, onClick }) => {
    const location = useLocation();
    const isActive = location.pathname === to;

    // Helper to get dynamic style based on theme color key if present
    const getColorStyle = (active: boolean) => {
        if (active) return {}; // Active overrides color to primary usually
        if (color) return { color: `var(--color-${color})` };
        return {};
    };

    return (
    <Link
        to={to}
        onClick={onClick}
        className={
            `flex items-center px-4 py-3 text-sm font-medium transition-colors duration-200 justify-between ${
                isActive
                    ? 'text-primary bg-secondary-container border-r-4 border-primary'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`
        }
        style={getColorStyle(isActive)}
    >
        <div className="flex items-center">
            <span className="material-symbols-outlined mr-3">{icon}</span>
            {label}
        </div>
        {badgeCount !== undefined && badgeCount > 0 && (
            <span className="bg-error text-on-error text-xs font-bold px-2 py-0.5 rounded-full">
                {badgeCount}
            </span>
        )}
    </Link>
)};

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
    const { logout, user, changePassword } = useAuth();
    const { sidebarSections, sidebarSectionColors, notifications } = useEntitiesContext();
    const { navigationRoutes } = useRoutesManifest();
    
    // State per la modale cambio password
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [isSavingPassword, setIsSavingPassword] = useState(false);

    // Layout fix: Mobile is fixed (overlay/slide), Desktop is relative (flex item taking space)
    const sidebarClasses = `fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r border-outline-variant transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
    }`;

    // Calcolo notifiche non lette
    const unreadNotifications = useMemo(() => {
        return notifications.filter(n => !n.isRead).length;
    }, [notifications]);

    // Raggruppa le voci per sezione
    const groupedItems = useMemo(() => {
        const groups: Record<string, AppRoute[]> = {};

        navigationRoutes.forEach(item => {
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
    }, [navigationRoutes, sidebarSections]);

    // Chiude la sidebar quando si clicca su un link (utile per mobile)
    const handleLinkClick = () => {
        // Close sidebar on mobile when a link is clicked
        if (window.innerWidth < 768) {
            setIsOpen(false);
        }
    };

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

    return (
        <>
            <aside className={sidebarClasses}>
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-center h-20 border-b border-outline-variant flex-shrink-0">
                        <h1 className="text-2xl font-bold text-primary tracking-widest">PLANNER</h1>
                    </div>

                    <nav className="flex-1 overflow-y-auto py-4">
                        {groupedItems.map(([sectionName, items]) => {
                            if (items.length === 0) return null;

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
                                    {items.map(item => (
                                        <NavItem
                                            key={item.path}
                                            to={item.path}
                                            icon={item.icon}
                                            label={item.label}
                                            color={item.color}
                                            badgeCount={item.path === '/notifications' ? unreadNotifications : undefined}
                                            onClick={handleLinkClick}
                                        />
                                    ))}
                                </div>
                            );
                        })}
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
                        
                        <div className="space-y-2">
                            <button
                                onClick={() => setIsPasswordModalOpen(true)}
                                className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-primary bg-primary-container/50 rounded-full hover:bg-primary-container transition-colors"
                            >
                                <span className="material-symbols-outlined mr-2 text-lg">lock_reset</span>
                                Cambia Password
                            </button>
                            <button
                                onClick={logout}
                                className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-on-error-container bg-error-container rounded-full hover:opacity-90 transition-opacity"
                            >
                                <span className="material-symbols-outlined mr-2 text-lg">logout</span>
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

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