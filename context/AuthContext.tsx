
/**
 * @file AuthContext.tsx
 * @description Provider di contesto React per la gestione dello stato di autenticazione e permessi (RBAC).
 */

import React, { createContext, useState, useEffect, ReactNode, useContext, useCallback } from 'react';
import { useToast } from './ToastContext';
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
    changePassword: (newPassword: string) => Promise<void>;
}

type AuthConfigResponse = { isEnabled: boolean };
type LoginResponse = {
    success: boolean;
    token?: string;
    user: { id: string; username: string; role: string; resourceId?: string; permissions?: string[]; mustChangePassword?: boolean };
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

    useEffect(() => {
        const checkAuthState = async () => {
            try {
                try {
                    const config = await apiFetch<AuthConfigResponse>('/api/auth-config');
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
            const data = await apiFetch<LoginResponse>('/api/login', {
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
            await apiFetch('/api/auth-config', {
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
            addToast('Password modificata con successo.', 'success');
        } catch (error) {
            addToast(`Errore cambio password: ${(error as Error).message}`, 'error');
            throw error;
        }
    }, [user, addToast]);

    const hasPermission = useCallback((path: string): boolean => {
        if (!user) return false;
        // CRITICAL: Admin always has permission to everything
        // Fix: Removed invalid 'ADMINISTRATOR' role comparison to align with UserRole type
        if (user.role === 'ADMIN') return true;
        
        const cleanPath = path.split('?')[0].replace(/\/$/, '') || '/';
        return user.permissions.includes(cleanPath);
    }, [user]);

    const value = {
        user,
        isAuthenticated: !!user,
        // Fix: Removed invalid 'ADMINISTRATOR' role comparison to align with UserRole type
        isAdmin: user?.role === 'ADMIN',
        isLoginProtectionEnabled,
        isAuthLoading,
        login,
        logout,
        toggleLoginProtection,
        hasPermission,
        changePassword
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
