/**
 * @file AuthContext.tsx
 * @description Provider di contesto React per la gestione dello stato di autenticazione.
 */

import React, { createContext, useState, useEffect, ReactNode, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './ToastContext';

// --- Tipi ---
interface AuthContextType {
    isAuthenticated: boolean;
    isAdmin: boolean;
    isLoginProtectionEnabled: boolean;
    isAuthLoading: boolean;
    login: (password: string) => Promise<void>;
    logout: () => void;
    toggleLoginProtection: (enable: boolean) => Promise<void>;
}

// --- Contesto ---
const AuthContext = createContext<AuthContextType | undefined>(undefined);

const apiFetch = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error || `API request failed: ${response.status}`);
    }
    return response.json();
};

/**
 * Provider per lo stato di autenticazione.
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoginProtectionEnabled, setIsLoginProtectionEnabled] = useState(true);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const { addToast } = useToast();

    // Controlla lo stato di autenticazione e la configurazione globale all'avvio
    useEffect(() => {
        const checkAuthState = async () => {
            try {
                // Controlla se la protezione è attiva a livello globale
                const config = await apiFetch('/api/auth-config');
                setIsLoginProtectionEnabled(config.isEnabled);

                // Controlla se l'utente ha una sessione attiva nel browser
                const sessionAuth = sessionStorage.getItem('isAuthenticated');
                const sessionAdmin = sessionStorage.getItem('isAdmin');

                if (sessionAuth === 'true') {
                    setIsAuthenticated(true);
                    if (sessionAdmin === 'true') {
                        setIsAdmin(true);
                    }
                }
            } catch (error) {
                console.error("Failed to check auth state:", error);
                // Default a uno stato sicuro in caso di errore
                setIsLoginProtectionEnabled(true);
            } finally {
                setIsAuthLoading(false);
            }
        };
        checkAuthState();
    }, []);

    const login = useCallback(async (password: string) => {
        try {
            const data = await apiFetch('/api/login', {
                method: 'POST',
                body: JSON.stringify({ password }),
            });

            if (data.success) {
                setIsAuthenticated(true);
                setIsAdmin(data.isAdmin);
                sessionStorage.setItem('isAuthenticated', 'true');
                sessionStorage.setItem('isAdmin', data.isAdmin ? 'true' : 'false');
                addToast('Accesso effettuato con successo.', 'success');
            }
        } catch (error) {
            addToast((error as Error).message, 'error');
            throw error;
        }
    }, [addToast]);

    const logout = useCallback(() => {
        setIsAuthenticated(false);
        setIsAdmin(false);
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('isAdmin');
        addToast('Logout effettuato.', 'success');
        // Il reindirizzamento verrà gestito dal componente ProtectedRoute
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

    const value = {
        isAuthenticated,
        isAdmin,
        isLoginProtectionEnabled,
        isAuthLoading,
        login,
        logout,
        toggleLoginProtection,
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