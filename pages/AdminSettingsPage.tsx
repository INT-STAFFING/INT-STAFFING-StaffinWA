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
    shellPrimary: 'Shell Background (Light)',
    shellSecondary: 'Shell Accent (Light)',
    shellHover: 'Shell Hover (Light)',
    shellActive: 'Shell Active (Light)',
    shellForeground: 'Shell Text (Light)',
    shellMutedForeground: 'Shell Muted Text (Light)',
    background: 'Page Background (Light)',
    foreground: 'Text Color (Light)',
    card: 'Card/Component Background (Light)',
    border: 'Borders (Light)',
    muted: 'Muted Background (Light)',
    mutedForeground: 'Muted Text (Light)',
    darkShellPrimary: 'Shell Background (Dark)',
    darkShellSecondary: 'Shell Accent (Dark)',
    darkShellHover: 'Shell Hover (Dark)',
    darkShellActive: 'Shell Active (Dark)',
    darkShellForeground: 'Shell Text (Dark)',
    darkShellMutedForeground: 'Shell Muted Text (Dark)',
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
         <div className="bg-card dark:bg-dark-card rounded-lg shadow p-6 mt-8">
            <h2 className="text-xl font-semibold mb-6">Personalizzazione Tema</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(colorLabels).map(([key, label]) => (
                    <div key={key}>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">{label}</label>
                        <div className="flex items-center space-x-2">
                            <input
                                type="color"
                                value={editedTheme[key as keyof Theme]}
                                onChange={(e) => handleColorChange(key as keyof Theme, e.target.value)}
                                className="w-10 h-10 p-1 border border-border dark:border-dark-border rounded-md cursor-pointer"
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
            <div className="mt-8 flex justify-end space-x-3">
                <button 
                    onClick={handleReset} 
                    disabled={isThemeDefault}
                    className="px-4 py-2 border border-border dark:border-dark-border rounded-md hover:bg-muted dark:hover:bg-dark-muted disabled:opacity-50"
                >
                    Ripristina Tema Default
                </button>
                 <button 
                    onClick={handleSave}
                    disabled={!isThemeChanged}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-darker disabled:opacity-50"
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
            <h1 className="text-3xl font-bold text-foreground dark:text-dark-foreground mb-8">Impostazioni Amministratore</h1>
            <div className="bg-card dark:bg-dark-card rounded-lg shadow p-6 max-w-2xl">
                <h2 className="text-xl font-semibold mb-4">Sicurezza</h2>
                <div className="flex items-center justify-between p-4 border border-border dark:border-dark-border rounded-lg">
                    <div>
                        <h3 className="font-medium text-foreground dark:text-dark-foreground">Protezione con Password</h3>
                        <p className="text-sm text-muted-foreground">
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