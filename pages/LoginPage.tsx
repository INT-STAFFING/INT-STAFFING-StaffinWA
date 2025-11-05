/**
 * @file LoginPage.tsx
 * @description Pagina di login per l'applicazione.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
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
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <div className="w-full max-w-md p-[var(--space-8)] space-y-[var(--space-8)] bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                <div className="text-center">
                    <h1 className="text-[var(--font-size-3xl)] font-bold tracking-wider text-gray-800 dark:text-white">Staffing App</h1>
                    <p className="mt-[var(--space-2)] text-[var(--font-size-sm)] text-gray-500 dark:text-gray-400">Inserisci la password per accedere</p>
                </div>
                
                {!isLoginProtectionEnabled && !isAuthenticated && (
                     <div className="p-[var(--space-4)] text-center bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-md">
                        <p className="text-[var(--font-size-sm)] font-medium text-yellow-800 dark:text-yellow-200">
                            La protezione tramite password è attualmente disattivata.
                            <br />
                            Accedi come admin per attivarla.
                        </p>
                    </div>
                )}

                <form className="mt-[var(--space-8)] space-y-[var(--space-6)]" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div>
                            <label htmlFor="username" className="sr-only">Utente</label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="appearance-none rounded-none relative block w-full px-[var(--space-3)] py-[var(--space-2)] border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-700 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-[var(--font-size-sm)]"
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
                                className="appearance-none rounded-none relative block w-full px-[var(--space-3)] py-[var(--space-2)] border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-700 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-[var(--font-size-sm)]"
                                placeholder="Password"
                            />
                        </div>
                    </div>
                    
                    {error && <p className="text-[var(--font-size-sm)] text-red-500 text-center">{error}</p>}

                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative w-full flex justify-center py-[var(--space-2)] px-[var(--space-4)] border border-transparent text-[var(--font-size-sm)] font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400"
                        >
                            {isLoading ? <SpinnerIcon className="w-[var(--space-5)] h-[var(--space-5)]" /> : 'Accedi'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;