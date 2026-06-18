
/**
 * @file HeaderActions.tsx
 * @description Cluster di azioni rapide nell'header: ricerca globale, notifiche e menu utente.
 * Migliora la scopribilità di funzioni prima raggiungibili solo dalla sidebar.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppState } from '../context/AppContext';
import { useUIConfigContext } from '../context/UIConfigContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const IconButton: React.FC<{
    icon: string;
    label: string;
    onClick?: () => void;
    badge?: number;
}> = ({ icon, label, onClick, badge }) => (
    <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        className="relative w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors"
    >
        <span className="material-symbols-outlined">{icon}</span>
        {typeof badge === 'number' && badge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-error text-on-error text-[10px] font-bold rounded-full">
                {badge > 99 ? '99+' : badge}
            </span>
        )}
    </button>
);

const HeaderActions: React.FC = () => {
    const { setSearchOpen } = useAppState();
    const { notifications } = useUIConfigContext();
    const { user, logout } = useAuth();
    const { mode, toggleMode } = useTheme();
    const navigate = useNavigate();

    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const unreadCount = useMemo(
        () => notifications.filter(n => !n.isRead).length,
        [notifications]
    );

    // Chiude il menu utente su click esterno o tasto Escape.
    useEffect(() => {
        if (!menuOpen) return;
        const handlePointer = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setMenuOpen(false);
        };
        document.addEventListener('mousedown', handlePointer);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handlePointer);
            document.removeEventListener('keydown', handleKey);
        };
    }, [menuOpen]);

    const handleLogout = () => {
        setMenuOpen(false);
        logout();
    };

    return (
        <div className="flex items-center gap-1 sm:gap-2">
            <IconButton
                icon="search"
                label="Ricerca rapida (Cmd+K)"
                onClick={() => setSearchOpen(true)}
            />

            <Link
                to="/notifications"
                aria-label={unreadCount > 0 ? `Notifiche, ${unreadCount} non lette` : 'Notifiche'}
                title="Notifiche"
                className="relative w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors"
            >
                <span className="material-symbols-outlined">notifications</span>
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-error text-on-error text-[10px] font-bold rounded-full">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </Link>

            <div className="relative" ref={menuRef}>
                <button
                    type="button"
                    onClick={() => setMenuOpen(prev => !prev)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-label="Menu utente"
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-primary/20 text-primary font-bold hover:bg-primary/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors"
                >
                    {user?.username?.charAt(0).toUpperCase() ?? '?'}
                </button>

                {menuOpen && (
                    <div
                        role="menu"
                        className="absolute right-0 mt-2 w-60 bg-surface-container-high rounded-2xl shadow-xl border border-outline-variant overflow-hidden z-50 animate-scale-in"
                    >
                        <div className="px-4 py-3 border-b border-outline-variant">
                            <p className="text-sm font-semibold text-on-surface truncate">{user?.username ?? 'Utente'}</p>
                            {user?.role && (
                                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider truncate">{user.role}</p>
                            )}
                        </div>

                        <div className="py-1">
                            <button
                                type="button"
                                role="menuitem"
                                onClick={toggleMode}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors text-left"
                            >
                                <span className="material-symbols-outlined text-xl text-on-surface-variant">
                                    {mode === 'dark' ? 'light_mode' : 'dark_mode'}
                                </span>
                                {mode === 'dark' ? 'Tema chiaro' : 'Tema scuro'}
                            </button>

                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => { setMenuOpen(false); navigate('/notification-settings'); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors text-left"
                            >
                                <span className="material-symbols-outlined text-xl text-on-surface-variant">tune</span>
                                Impostazioni notifiche
                            </button>
                        </div>

                        <div className="py-1 border-t border-outline-variant">
                            <button
                                type="button"
                                role="menuitem"
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error-container/40 transition-colors text-left"
                            >
                                <span className="material-symbols-outlined text-xl">logout</span>
                                Esci
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HeaderActions;
