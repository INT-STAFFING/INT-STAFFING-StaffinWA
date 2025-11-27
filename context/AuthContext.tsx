
/**
 * @file AuthContext.tsx
 * @description Provider di contesto React per la gestione dello stato di autenticazione e permessi (RBAC).
 */

import React, { createContext, useState, useEffect, ReactNode, useContext, useCallback } from 'react';
import { useToast } from './ToastContext';
import { AppUser } from '../types';

// --- Tipi ---
interface AuthContextType {
    user: AppUser | null;
    isAuthenticated: boolean;
    isAdmin: boolean;
    isLoginProtectionEnabled: boolean;
    isAuthLoading: boolean;
    login: (password: string, username?: string) => Promise<void>; // Updated signature
    logout: () => void;
    toggleLoginProtection: (enable: boolean) => Promise<void>;
    hasPermission: (path: string) => boolean;
    changePassword: (newPassword: string) => Promise<void>;
}

// --- Contesto ---
const AuthContext = createContext<AuthContextType | undefined>(undefined);

const apiFetch = async (url: string, options: RequestInit = {}) => {
    // Add JWT header if token exists
    const token = localStorage.getItem('authToken');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        headers: { ...headers, ...options.headers },
        ...options,
    });
    if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error || `API request failed: ${response.status}`);
    }
    return response.json();
};

/**
 * Helper per verificare se un token JWT è scaduto senza librerie esterne.
 */
const isTokenExpired = (token: string): boolean => {
    try {
        const payloadBase64 = token.split('.')[1];
        if (!payloadBase64) return true;
        
        const decodedJson = atob(payloadBase64);
        const decoded = JSON.parse(decodedJson);
        const exp = decoded.exp;
        
        // Confronta con il tempo attuale (in secondi)
        if (exp && Date.now() >= exp * 1000) {
            return true;
        }
        return false;
    } catch (e) {
        return true; // Se il parsing fallisce, assumiamo scaduto/invalido
    }
};

/**
 * Provider per lo stato di autenticazione.
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [isLoginProtectionEnabled, setIsLoginProtectionEnabled] = useState(true);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const { addToast } = useToast();

    // Load initial state
    useEffect(() => {
        const checkAuthState = async () => {
            try {
                // 1. Check Global Protection Config
                try {
                    const config = await apiFetch('/api/auth-config');
                    setIsLoginProtectionEnabled(config.isEnabled);
                } catch (e) {
                    // Fallback secure default
                    setIsLoginProtectionEnabled(true);
                }

                // 2. Restore Session from LocalStorage
                const storedToken = localStorage.getItem('authToken');
                const storedUser = localStorage.getItem('authUser');

                if (storedToken && storedUser) {
                    // Check Token Expiration
                    if (isTokenExpired(storedToken)) {
                        console.warn("Session expired. Logging out.");
                        localStorage.removeItem('authToken');
                        localStorage.removeItem('authUser');
                        setUser(null);
                    } else {
                        setUser(JSON.parse(storedUser));
                    }
                }
            } catch (error) {
                console.error("Failed to restore auth state:", error);
                localStorage.removeItem('authToken');
                localStorage.removeItem('authUser');
            } finally {
                setIsAuthLoading(false);
            }
        };
        checkAuthState();
    }, []);

    const login = useCallback(async (password: string, username: string = 'admin') => {
        // Default username to 'admin' for backward compatibility if UI only asks for password
        // But the new UI should ask for username.
        try {
            const data = await apiFetch('/api/login', {
                method: 'POST',
                body: JSON.stringify({ username, password }),
            });

            if (data.success && data.token) {
                const userObj: AppUser = {
                    id: data.user.id,
                    username: data.user.username,
                    role: data.user.role,
                    resourceId: data.user.resourceId,
                    isActive: true,
                    permissions: data.user.permissions || []
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
        if (user.role === 'ADMIN') return true; // Admins see everything
        
        // Normalize path (remove trailing slash, query params)
        const cleanPath = path.split('?')[0].replace(/\/$/, '') || '/';
        
        // Check direct permission
        return user.permissions.includes(cleanPath);
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
        changePassword
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook per accedere al contesto di autenticazione.
 */
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
