
/**
 * @file AdminSettingsPage.tsx
 * @description Pagina per la gestione delle impostazioni riservate agli amministratori.
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme, Theme, defaultTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import {
  DashboardCardId,
  DASHBOARD_CARDS_CONFIG,
  DEFAULT_DASHBOARD_CARD_ORDER,
  DASHBOARD_CARD_ORDER_STORAGE_KEY,
} from '../config/dashboardLayout';

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
    toastPosition: 'Posizione Notifiche',
    toastSuccessBackground: 'Sfondo Successo',
    toastSuccessForeground: 'Testo Successo',
    toastErrorBackground: 'Sfondo Errore',
    toastErrorForeground: 'Testo Errore',
    visualizationSettings: 'Impostazioni Visualizzazione',
};

const ThemeEditor: React.FC = () => {
    const { theme, setTheme, resetTheme } = useTheme();
    const [editedTheme, setEditedTheme] = useState<Theme>(theme);

    useEffect(() => {
        setEditedTheme(theme);
    }, [theme]);

    const handleColorChange = (key: keyof Omit<Theme, 'visualizationSettings'>, value: string) => {
        setEditedTheme(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        setTheme(editedTheme);
    };

    const handleReset = () => {
        resetTheme();
    };
    
    // FIX: Narrow the type of `themeKeysToEdit` to correctly reflect the filtered keys.
    const themeKeysToEdit = Object.keys(defaultTheme).filter(key => !key.startsWith('toast') && key !== 'visualizationSettings') as Exclude<keyof Theme, 'toastPosition' | 'toastSuccessBackground' | 'toastSuccessForeground' | 'toastErrorBackground' | 'toastErrorForeground' | 'visualizationSettings'>[];


    const isThemeChanged = JSON.stringify(theme) !== JSON.stringify(editedTheme);
    const isThemeDefault = JSON.stringify(theme) === JSON.stringify(defaultTheme);

    return (
         <div className="bg-card dark:bg-dark-card rounded-lg shadow p-6 mt-8">
            <h2 className="text-xl font-semibold mb-6">Personalizzazione Tema Globale</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {themeKeysToEdit.map((key) => (
                    <div key={key}>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">{colorLabels[key]}</label>
                        <div className="flex items-center space-x-2">
                            <input
                                type="color"
                                value={editedTheme[key] as string}
                                onChange={(e) => handleColorChange(key, e.target.value)}
                                className="w-10 h-10 p-1 border border-border dark:border-dark-border rounded-md cursor-pointer"
                                style={{ backgroundColor: editedTheme[key] as string }}
                            />
                            <input
                                type="text"
                                value={editedTheme[key] as string}
                                onChange={(e) => handleColorChange(key, e.target.value)}
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

const ToastEditor: React.FC = () => {
    const { theme, setTheme, resetTheme } = useTheme();
    const [editedTheme, setEditedTheme] = useState<Theme>(theme);

    useEffect(() => {
        setEditedTheme(theme);
    }, [theme]);

    const handleSettingChange = (key: keyof Theme, value: string) => {
        setEditedTheme(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        setTheme(editedTheme);
    };
    
    const handleReset = () => {
        // Reset only toast settings to default
        const newTheme = { ...theme };
        Object.keys(theme).forEach(key => {
            if (key.startsWith('toast')) {
                (newTheme as any)[key] = (defaultTheme as any)[key];
            }
        });
        setTheme(newTheme);
    };
    
    const isToastSettingsChanged = 
        theme.toastPosition !== editedTheme.toastPosition ||
        theme.toastSuccessBackground !== editedTheme.toastSuccessBackground ||
        theme.toastSuccessForeground !== editedTheme.toastSuccessForeground ||
        theme.toastErrorBackground !== editedTheme.toastErrorBackground ||
        theme.toastErrorForeground !== editedTheme.toastErrorForeground;

    const toastPositionOptions = [
        { label: 'In Alto al Centro', value: 'top-center' },
        { label: 'In Alto a Destra', value: 'top-right' },
        { label: 'In Alto a Sinistra', value: 'top-left' },
        { label: 'In Basso al Centro', value: 'bottom-center' },
        { label: 'In Basso a Destra', value: 'bottom-right' },
        { label: 'In Basso a Sinistra', value: 'bottom-left' },
    ];

    return (
        <div className="bg-card dark:bg-dark-card rounded-lg shadow p-6 mt-8">
            <h2 className="text-xl font-semibold mb-6">Personalizzazione Notifiche Toast</h2>
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">{colorLabels.toastPosition}</label>
                    <select
                        value={editedTheme.toastPosition}
                        onChange={(e) => handleSettingChange('toastPosition', e.target.value)}
                        className="form-select max-w-xs"
                    >
                        {toastPositionOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 pt-4 border-t border-border dark:border-dark-border">
                    <h3 className="col-span-full font-medium text-lg">Stile Successo</h3>
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">{colorLabels.toastSuccessBackground}</label>
                        <div className="flex items-center space-x-2">
                             <input type="color" value={editedTheme.toastSuccessBackground} onChange={e => handleSettingChange('toastSuccessBackground', e.target.value)} className="w-10 h-10 p-1 border rounded-md" />
                             <input type="text" value={editedTheme.toastSuccessBackground} onChange={e => handleSettingChange('toastSuccessBackground', e.target.value)} className="form-input w-full" />
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">{colorLabels.toastSuccessForeground}</label>
                        <div className="flex items-center space-x-2">
                             <input type="color" value={editedTheme.toastSuccessForeground} onChange={e => handleSettingChange('toastSuccessForeground', e.target.value)} className="w-10 h-10 p-1 border rounded-md" />
                             <input type="text" value={editedTheme.toastSuccessForeground} onChange={e => handleSettingChange('toastSuccessForeground', e.target.value)} className="form-input w-full" />
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 pt-4 border-t border-border dark:border-dark-border">
                    <h3 className="col-span-full font-medium text-lg">Stile Errore</h3>
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">{colorLabels.toastErrorBackground}</label>
                        <div className="flex items-center space-x-2">
                             <input type="color" value={editedTheme.toastErrorBackground} onChange={e => handleSettingChange('toastErrorBackground', e.target.value)} className="w-10 h-10 p-1 border rounded-md" />
                             <input type="text" value={editedTheme.toastErrorBackground} onChange={e => handleSettingChange('toastErrorBackground', e.target.value)} className="form-input w-full" />
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">{colorLabels.toastErrorForeground}</label>
                        <div className="flex items-center space-x-2">
                             <input type="color" value={editedTheme.toastErrorForeground} onChange={e => handleSettingChange('toastErrorForeground', e.target.value)} className="w-10 h-10 p-1 border rounded-md" />
                             <input type="text" value={editedTheme.toastErrorForeground} onChange={e => handleSettingChange('toastErrorForeground', e.target.value)} className="form-input w-full" />
                        </div>
                    </div>
                </div>
            </div>
             <div className="mt-8 flex justify-end space-x-3">
                <button 
                    onClick={handleReset} 
                    className="px-4 py-2 border border-border dark:border-dark-border rounded-md hover:bg-muted dark:hover:bg-dark-muted"
                >
                    Ripristina Default Toast
                </button>
                 <button 
                    onClick={handleSave}
                    disabled={!isToastSettingsChanged}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-darker disabled:opacity-50"
                >
                    Salva Modifiche Toast
                </button>
            </div>
        </div>
    );
};

const VisualizationEditor: React.FC = () => {
    const { theme, setTheme } = useTheme();
    const [settings, setSettings] = useState(theme.visualizationSettings);

    useEffect(() => {
        setSettings(theme.visualizationSettings);
    }, [theme]);

    const handleChange = (graph: 'sankey' | 'network', key: string, value: string) => {
        setSettings(prev => ({
            ...prev,
            [graph]: {
                ...prev[graph],
                [key]: Number(value)
            }
        }));
    };

    const handleSave = () => {
        setTheme({ ...theme, visualizationSettings: settings });
    };

    const handleReset = () => {
        setSettings(defaultTheme.visualizationSettings);
        setTheme({ ...theme, visualizationSettings: defaultTheme.visualizationSettings });
    };

    const isChanged = JSON.stringify(theme.visualizationSettings) !== JSON.stringify(settings);

    // Reusable slider component
    const SettingsSlider: React.FC<{
        graph: 'sankey' | 'network';
        param: string;
        label: string;
        min: number;
        max: number;
        step: number;
    }> = ({ graph, param, label, min, max, step }) => (
        <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">{label} ({settings[graph][param as keyof typeof settings[typeof graph]]})</label>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={settings[graph][param as keyof typeof settings[typeof graph]]}
                onChange={(e) => handleChange(graph, param, e.target.value)}
                className="w-full"
            />
        </div>
    );

    return (
        <div className="bg-card dark:bg-dark-card rounded-lg shadow p-6 mt-8">
            <h2 className="text-xl font-semibold mb-6">Personalizzazione Visualizzazioni Grafiche</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Sankey Settings */}
                <div className="space-y-4 p-4 border border-border dark:border-dark-border rounded-lg">
                    <h3 className="font-medium text-lg">Diagramma di Flusso (Sankey)</h3>
                    <SettingsSlider graph="sankey" param="nodeWidth" label="Larghezza Nodi" min={5} max={50} step={1} />
                    <SettingsSlider graph="sankey" param="nodePadding" label="Spaziatura Nodi" min={2} max={40} step={1} />
                    <SettingsSlider graph="sankey" param="linkOpacity" label="Opacità Flussi" min={0.1} max={1} step={0.1} />
                </div>
                
                {/* Network Settings */}
                <div className="space-y-4 p-4 border border-border dark:border-dark-border rounded-lg">
                    <h3 className="font-medium text-lg">Mappa delle Connessioni (Network)</h3>
                    <SettingsSlider graph="network" param="chargeStrength" label="Forza Repulsione" min={-2000} max={-50} step={50} />
                    <SettingsSlider graph="network" param="linkDistance" label="Distanza Link" min={30} max={500} step={10} />
                    <SettingsSlider graph="network" param="nodeRadius" label="Raggio Nodi" min={3} max={30} step={1} />
                    <SettingsSlider graph="network" param="centerStrength" label="Forza di Attrazione Centrale" min={0.01} max={0.2} step={0.01} />
                </div>
            </div>

            <div className="mt-8 flex justify-end space-x-3">
                <button 
                    onClick={handleReset} 
                    className="px-4 py-2 border border-border dark:border-dark-border rounded-md hover:bg-muted dark:hover:bg-dark-muted"
                >
                    Ripristina Default
                </button>
                 <button 
                    onClick={handleSave}
                    disabled={!isChanged}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-darker disabled:opacity-50"
                >
                    Salva Modifiche
                </button>
            </div>
        </div>
    );
};

const DashboardLayoutEditor: React.FC = () => {
    const { addToast } = useToast();
    const [cardOrder, setCardOrder] = useState<DashboardCardId[]>([]);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        try {
            const savedOrderJSON = localStorage.getItem(DASHBOARD_CARD_ORDER_STORAGE_KEY);
            const savedOrder = savedOrderJSON ? JSON.parse(savedOrderJSON) : DEFAULT_DASHBOARD_CARD_ORDER;
            setCardOrder(savedOrder);
        } catch (error) {
            setCardOrder(DEFAULT_DASHBOARD_CARD_ORDER);
        }
    }, []);

    const moveCard = (index: number, direction: 'up' | 'down') => {
        const newOrder = [...cardOrder];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
        setCardOrder(newOrder);
        setHasChanges(true);
    };

    const handleSave = () => {
        localStorage.setItem(DASHBOARD_CARD_ORDER_STORAGE_KEY, JSON.stringify(cardOrder));
        setHasChanges(false);
        addToast('Ordine della dashboard salvato.', 'success');
    };

    const handleReset = () => {
        setCardOrder(DEFAULT_DASHBOARD_CARD_ORDER);
        setHasChanges(true);
    };
    
    const cardLabels = new Map(DASHBOARD_CARDS_CONFIG.map(c => [c.id, c.label]));

    return (
        <div className="bg-card dark:bg-dark-card rounded-lg shadow p-6 mt-8">
            <h2 className="text-xl font-semibold mb-6">Ordinamento Card Dashboard</h2>
            <div className="space-y-2 max-w-2xl mx-auto">
                {cardOrder.map((cardId, index) => (
                    <div key={cardId} className="flex items-center justify-between p-3 border border-border dark:border-dark-border rounded-md bg-muted/50 dark:bg-dark-muted/50">
                        <span className="font-medium text-foreground dark:text-dark-foreground">{cardLabels.get(cardId) || cardId}</span>
                        <div className="space-x-2">
                            <button onClick={() => moveCard(index, 'up')} disabled={index === 0} className="px-2 py-1 rounded-md hover:bg-border dark:hover:bg-dark-border disabled:opacity-30">↑</button>
                            <button onClick={() => moveCard(index, 'down')} disabled={index === cardOrder.length - 1} className="px-2 py-1 rounded-md hover:bg-border dark:hover:bg-dark-border disabled:opacity-30">↓</button>
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-8 flex justify-end space-x-3">
                <button onClick={handleReset} className="px-4 py-2 border border-border dark:border-dark-border rounded-md hover:bg-muted dark:hover:bg-dark-muted">Ripristina Ordine Default</button>
                <button onClick={handleSave} disabled={!hasChanges} className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-darker disabled:opacity-50">Salva Ordine</button>
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
            
            <DashboardLayoutEditor />
            <ToastEditor />
            <VisualizationEditor />
            <ThemeEditor />
            <style>{`.form-input, .form-select { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid var(--color-border); background-color: var(--color-card); padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; color: var(--color-foreground); } .dark .form-input, .dark .form-select { border-color: var(--color-dark-border); background-color: var(--color-dark-card); color: var(--color-dark-foreground); }`}</style>
        </div>
    );
};

export default AdminSettingsPage;
