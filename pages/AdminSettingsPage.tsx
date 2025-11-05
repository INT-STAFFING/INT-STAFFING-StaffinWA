/**
 * @file AdminSettingsPage.tsx
 * @description Pagina per la gestione delle impostazioni riservate agli amministratori.
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme, Theme, defaultTheme } from '../context/ThemeContext';

const colorLabels: { [key in keyof Theme]: string } = {
    primary: 'Primary Action',
    primaryDarker: 'Primary Action (Hover)',
    destructive: 'Destructive Action',
    success: 'Success State',
    warning: 'Warning State',
    background: 'Page Background (Light)',
    foreground: 'Text Color (Light)',
    card: 'Card/Component Background (Light)',
    border: 'Borders (Light)',
    muted: 'Muted Background (Light)',
    mutedForeground: 'Muted Text (Light)',
    darkBackground: 'Page Background (Dark)',
    darkForeground: 'Text Color (Dark)',
    darkCard: 'Card/Component Background (Dark)',
    darkBorder: 'Borders (Dark)',
    darkMuted: 'Muted Background (Dark)',
    darkMutedForeground: 'Muted Text (Dark)',
};

const ThemeEditor: React.FC = () => {
    const { theme, setTheme, resetTheme } = useTheme();
    const [editedTheme, setEditedTheme] = useState<Theme>(theme);

    useEffect(() => {
        setEditedTheme(theme);
    }, [theme]);

    const handleColorChange = (key: keyof Theme, value: string) => {
        setEditedTheme(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        setTheme(editedTheme);
    };

    const handleReset = () => {
        resetTheme();
    };
    
    const isThemeChanged = JSON.stringify(theme) !== JSON.stringify(editedTheme);
    const isThemeDefault = JSON.stringify(theme) === JSON.stringify(defaultTheme);

    return (
         // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
         <div className="bg-card dark:bg-dark-card rounded-lg shadow p-[var(--space-6)] mt-[var(--space-8)]">
            {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
            <h2 className="text-[var(--font-size-xl)] font-semibold mb-[var(--space-6)]">Personalizzazione Tema</h2>
            {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--space-6)]">
                {Object.entries(colorLabels).map(([key, label]) => (
                    <div key={key}>
                        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                        <label className="block text-[var(--font-size-sm)] font-medium text-muted-foreground mb-[var(--space-1)]">{label}</label>
                        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                        <div className="flex items-center space-x-[var(--space-2)]">
                            <input
                                type="color"
                                value={editedTheme[key as keyof Theme]}
                                onChange={(e) => handleColorChange(key as keyof Theme, e.target.value)}
                                // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                                className="w-[var(--space-10)] h-[var(--space-10)] p-[var(--space-1)] border border-border dark:border-dark-border rounded-md cursor-pointer"
                                style={{ backgroundColor: editedTheme[key as keyof Theme] }}
                            />
                            <input
                                type="text"
                                value={editedTheme[key as keyof Theme]}
                                onChange={(e) => handleColorChange(key as keyof Theme, e.target.value)}
                                className="form-input w-full"
                                pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                                title="Enter a valid hex color code (e.g., #RRGGBB)"
                            />
                        </div>
                    </div>
                ))}
            </div>
            {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
            <div className="mt-[var(--space-8)] flex justify-end space-x-[var(--space-3)]">
                <button 
                    onClick={handleReset} 
                    disabled={isThemeDefault}
                    // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                    className="px-[var(--space-4)] py-[var(--space-2)] border border-border dark:border-dark-border rounded-md hover:bg-muted dark:hover:bg-dark-muted disabled:opacity-50"
                >
                    Ripristina Tema Default
                </button>
                 <button 
                    onClick={handleSave}
                    disabled={!isThemeChanged}
                    // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                    className="px-[var(--space-4)] py-[var(--space-2)] bg-primary text-white rounded-md hover:bg-primary-darker disabled:opacity-50"
                >
                    Salva Modifiche
                </button>
            </div>
        </div>
    );
};


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
            {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
            <h1 className="text-[var(--font-size-3xl)] font-bold text-foreground dark:text-dark-foreground mb-[var(--space-8)]">Impostazioni Amministratore</h1>
            {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
            <div className="bg-card dark:bg-dark-card rounded-lg shadow p-[var(--space-6)] max-w-2xl">
                {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                <h2 className="text-[var(--font-size-xl)] font-semibold mb-[var(--space-4)]">Sicurezza</h2>
                {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                <div className="flex items-center justify-between p-[var(--space-4)] border border-border dark:border-dark-border rounded-lg">
                    <div>
                        <h3 className="font-medium text-foreground dark:text-dark-foreground">Protezione con Password</h3>
                        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                        <p className="text-[var(--font-size-sm)] text-muted-foreground">
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
                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 ease-in-out ${isLoginProtectionEnabled ? 'transform translate-x-6 bg-primary' : 'bg-gray-400'}`}></div>
                        </div>
                    </label>
                </div>
            </div>

            <ThemeEditor />
            <style>{`.form-input { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid var(--color-border); background-color: var(--color-card); padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; color: var(--color-foreground); } .dark .form-input { border-color: var(--color-dark-border); background-color: var(--color-dark-card); color: var(--color-dark-foreground); }`}</style>
        </div>
    );
};

export default AdminSettingsPage;