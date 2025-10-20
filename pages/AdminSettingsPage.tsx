/**
 * @file AdminSettingsPage.tsx
 * @description Pagina per la gestione delle impostazioni riservate agli amministratori.
 */
import React from 'react';
import { useAuth } from '../context/AuthContext';

const AdminSettingsPage: React.FC = () => {
    const { isLoginProtectionEnabled, toggleLoginProtection } = useAuth();

    const handleToggleProtection = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            await toggleLoginProtection(e.target.checked);
        } catch {
            // L'errore è già gestito nel contesto e mostrato tramite toast.
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-8">Impostazioni Amministratore</h1>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 max-w-2xl">
                <h2 className="text-xl font-semibold mb-4">Sicurezza</h2>
                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">Protezione con Password</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Se attivata, tutti gli utenti dovranno inserire una password per accedere all'applicazione.
                        </p>
                    </div>
                    <label htmlFor="protection-toggle" className="flex items-center cursor-pointer">
                        <div className="relative">
                            <input
                                type="checkbox"
                                id="protection-toggle"
                                className="sr-only"
                                checked={isLoginProtectionEnabled}
                                onChange={handleToggleProtection}
                            />
                            <div className="block bg-gray-200 dark:bg-gray-600 w-14 h-8 rounded-full"></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 ease-in-out ${isLoginProtectionEnabled ? 'transform translate-x-6 bg-blue-500' : 'bg-gray-400'}`}></div>
                        </div>
                    </label>
                </div>
            </div>
        </div>
    );
};

export default AdminSettingsPage;
