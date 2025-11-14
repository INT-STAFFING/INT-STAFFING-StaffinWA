/**
 * @file LoginPage.tsx
 * @description Pagina di login per l'applicazione.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
// FIX: Using namespace import for react-router-dom to address potential module resolution errors.
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate } = ReactRouterDOM;
import { SpinnerIcon } from '../components/icons';

const LoginPage: React.FC = () => {
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState(''); // Campo puramente estetico
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const { login, isAuthenticated, isLoginProtectionEnabled } = useAuth();
    const navigate = useNavigate();

    // Reindirizza se l'utente è già loggato e la protezione è attiva
    useEffect(() => {
        if (isAuthenticated && isLoginProtectionEnabled) {
            navigate('/', { replace: true });
        }
    }, [isAuthenticated, isLoginProtectionEnabled, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            await login(password);
            // Il reindirizzamento avverrà automaticamente tramite il ProtectedRoute
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="w-full max-w-md p-8 space-y-8 bg-surface rounded-2xl shadow-lg">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-wider text-on-surface">Staffing App</h1>
                    <p className="mt-2 text-sm text-on-surface-variant">Inserisci la password per accedere</p>
                </div>
                
                {!isLoginProtectionEnabled && !isAuthenticated && (
                     <div className="p-4 text-center bg-yellow-container text-on-yellow-container border border-yellow-container/50 rounded-lg">
                        <p className="text-sm font-medium">
                            La protezione tramite password è attualmente disattivata.
                            <br />
                            Accedi come admin per attivarla.
                        </p>
                    </div>
                )}

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md -space-y-px">
                        <div>
                            <label htmlFor="username" className="sr-only">Utente</label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-outline placeholder-on-surface-variant text-on-surface bg-surface-container rounded-t-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                                placeholder="Utente"
                            />
                        </div>
                        <div>
                            <label htmlFor="password-input" className="sr-only">Password</label>
                            <input
                                id="password-input"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-outline placeholder-on-surface-variant text-on-surface bg-surface-container rounded-b-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                                placeholder="Password"
                            />
                        </div>
                    </div>
                    
                    {error && <p className="text-sm text-error text-center">{error}</p>}

                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-full text-on-primary bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                        >
                            {isLoading ? <SpinnerIcon className="w-5 h-5" /> : 'Accedi'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;