
/**
 * @file AuthContext.tsx
 * @description Provider di contesto React per la gestione dello stato di autenticazione e permessi (RBAC).
 */

import React, { createContext, useState, useEffect, ReactNode, useContext, useCallback } from 'react';
import { useToast } from './ToastContext';
import { useEntitiesContext } from './AppContext';
import { AppUser, UserRole } from '../types';
import { apiFetch } from '../services/apiClient';

// --- Tipi ---
interface AuthContextType {
    user: AppUser | null;
    isAuthenticated: boolean;
    isAdmin: boolean;
    isLoginProtectionEnabled: boolean;
    isAuthLoading: boolean;
    login: (password: string, username?: string) => Promise<void>;
    logout: () => void;
    toggleLoginProtection: (enable: boolean) => Promise<void>;
    hasPermission: (path: string) => boolean;
    hasEntityVisibility: (entity: string) => boolean;
    changePassword: (newPassword: string) => Promise<void>;
    impersonate: (userId: string) => Promise<void>;
}

type AuthConfigResponse = { isEnabled: boolean };
type LoginResponse = {
    success: boolean;
    token?: string;
    user: { id: string; username: string; role: string; resourceId?: string; permissions?: string[]; entityVisibility?: string[]; mustChangePassword?: boolean };
};

// --- Contesto ---
const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isTokenExpired = (token: string): boolean => {
    try {
        const payloadBase64 = token.split('.')[1];
        if (!payloadBase64) return true;
        const decodedJson = atob(payloadBase64);
        const decoded = JSON.parse(decodedJson);
        const exp = decoded.exp;
        if (exp && Date.now() >= exp * 1000) return true;
        return false;
    } catch (e) { return true; }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [isLoginProtectionEnabled, setIsLoginProtectionEnabled] = useState(true);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const { addToast } = useToast();
    const { fetchData } = useEntitiesContext();

    useEffect(() => {
        const checkAuthState = async () => {
            try {
                try {
                    const config = await apiFetch<AuthConfigResponse>('/api/auth?action=config');
                    setIsLoginProtectionEnabled(config.isEnabled);
                } catch (e) { setIsLoginProtectionEnabled(true); }

                const storedToken = localStorage.getItem('authToken');
                const storedUser = localStorage.getItem('authUser');

                if (storedToken && storedUser) {
                    if (isTokenExpired(storedToken)) {
                        localStorage.removeItem('authToken');
                        localStorage.removeItem('authUser');
                        setUser(null);
                    } else {
                        setUser(JSON.parse(storedUser));
                    }
                }
            } catch (error) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('authUser');
            } finally {
                setIsAuthLoading(false);
            }
        };
        checkAuthState();
    }, []);

    const login = useCallback(async (password: string, username: string = 'admin') => {
        try {
            const data = await apiFetch<LoginResponse>('/api/auth', {
                method: 'POST',
                body: JSON.stringify({ username, password }),
            });

            if (data.success && data.token) {
                const userObj: AppUser = {
                    id: data.user.id,
                    username: data.user.username,
                    role: data.user.role as UserRole,
                    resourceId: data.user.resourceId || null,
                    isActive: true,
                    permissions: data.user.permissions || [],
                    entityVisibility: data.user.entityVisibility ?? [],
                    mustChangePassword: !!data.user.mustChangePassword
                };

                localStorage.setItem('authToken', data.token);
                localStorage.setItem('authUser', JSON.stringify(userObj));
                setUser(userObj);
                addToast(`Benvenuto, ${userObj.username}!`, 'success');
            }
        } catch (error) {
            addToast((error as Error).message, 'error');
            throw error;
        }
    }, [addToast]);

    const logout = useCallback(() => {
        setUser(null);
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        addToast('Logout effettuato.', 'success');
    }, [addToast]);
    
    const toggleLoginProtection = useCallback(async (enable: boolean) => {
        try {
            await apiFetch('/api/auth?action=config', {
                method: 'POST',
                body: JSON.stringify({ isEnabled: enable }),
            });
            setIsLoginProtectionEnabled(enable);
            addToast(`Protezione tramite login ${enable ? 'attivata' : 'disattivata'}.`, 'success');
        } catch (error) {
             addToast(`Errore: ${(error as Error).message}`, 'error');
             throw error;
        }
    }, [addToast]);

    const changePassword = useCallback(async (newPassword: string) => {
        if (!user) return;
        try {
            await apiFetch(`/api/resources?entity=app-users&action=change_password&id=${user.id}`, {
                method: 'PUT',
                body: JSON.stringify({ newPassword }),
            });
            const updatedUser = { ...user, mustChangePassword: false };
            setUser(updatedUser);
            localStorage.setItem('authUser', JSON.stringify(updatedUser));
            addToast('Password modificata con successo.', 'success');
        } catch (error) {
            addToast(`Errore cambio password: ${(error as Error).message}`, 'error');
            throw error;
        }
    }, [user, addToast]);
    
    const impersonate = useCallback(async (userId: string) => {
        try {
            const data = await apiFetch<LoginResponse>(`/api/resources?entity=app-users&action=impersonate&id=${userId}`, {
                method: 'POST'
            });

            if (data.success && data.token) {
                const userObj: AppUser = {
                    id: data.user.id,
                    username: data.user.username,
                    role: data.user.role as UserRole,
                    resourceId: data.user.resourceId || null,
                    isActive: true,
                    permissions: data.user.permissions || [],
                    entityVisibility: data.user.entityVisibility ?? [],
                    mustChangePassword: false // Skip pw change check during impersonation
                };

                localStorage.setItem('authToken', data.token);
                localStorage.setItem('authUser', JSON.stringify(userObj));
                setUser(userObj);
                addToast(`Impersonificazione avviata: ${userObj.username}`, 'success');

                // Re-fetch all data with the new user's token
                await fetchData();
            }
        } catch (error) {
            addToast(`Errore impersonificazione: ${(error as Error).message}`, 'error');
        }
    }, [addToast, fetchData]);

    const hasPermission = useCallback((path: string): boolean => {
        if (!user) return false;
        // CRITICAL: Admin always has permission to everything
        if (user.role === 'ADMIN') return true;

        const cleanPath = path.split('?')[0].replace(/\/$/, '') || '/';
        return user.permissions.includes(cleanPath);
    }, [user]);

    const hasEntityVisibility = useCallback((entity: string): boolean => {
        if (!user) return false;
        // ADMIN vede sempre tutte le entità
        if (user.role === 'ADMIN') return true;
        // Se entityVisibility è vuoto (vecchia sessione senza il campo), default visibile per retro-compatibilità
        if (!user.entityVisibility || user.entityVisibility.length === 0) return true;
        return user.entityVisibility.includes(entity);
    }, [user]);

    const value = {
        user,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'ADMIN',
        isLoginProtectionEnabled,
        isAuthLoading,
        login,
        logout,
        toggleLoginProtection,
        hasPermission,
        hasEntityVisibility,
        changePassword,
        impersonate
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
