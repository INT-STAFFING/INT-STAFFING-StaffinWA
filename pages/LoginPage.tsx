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
    const { login, isAuthenticated, isAdmin, isLoginProtectionEnabled, toggleLoginProtection } = useAuth();
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
    
    const handleToggleProtection = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            await toggleLoginProtection(e.target.checked);
        } catch {
            // L'errore è già gestito nel contesto
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-wider text-gray-800 dark:text-white">Staffing App</h1>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Inserisci la password per accedere</p>
                </div>
                
                {!isLoginProtectionEnabled && !isAuthenticated && (
                     <div className="p-4 text-center bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-md">
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                            La protezione tramite password è attualmente disattivata.
                            <br />
                            Accedi come admin per attivarla.
                        </p>
                    </div>
                )}

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div>
                            <label htmlFor="username" className="sr-only">Utente</label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-700 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Utente (estetico)"
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
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-700 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Password"
                            />
                        </div>
                    </div>
                    
                    {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400"
                        >
                            {isLoading ? <SpinnerIcon className="w-5 h-5" /> : 'Accedi'}
                        </button>
                    </div>
                </form>

                {isAdmin && (
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-medium text-center text-gray-900 dark:text-white">Pannello Admin</h3>
                         <div className="flex items-center justify-center mt-4">
                            <label htmlFor="protection-toggle" className="flex items-center cursor-pointer">
                                <div className="relative">
                                    <input 
                                        type="checkbox" 
                                        id="protection-toggle" 
                                        className="sr-only"
                                        checked={isLoginProtectionEnabled}
                                        onChange={handleToggleProtection}
                                    />
                                    <div className="block bg-gray-600 w-14 h-8 rounded-full"></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition ${isLoginProtectionEnabled ? 'transform translate-x-6 bg-blue-400' : ''}`}></div>
                                </div>
                                <div className="ml-3 text-gray-700 dark:text-gray-300 font-medium">
                                    Attiva Protezione Login
                                </div>
                            </label>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LoginPage;
