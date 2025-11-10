/**
 * @file AdminSettingsPage.tsx
 * @description Pagina per la gestione delle impostazioni riservate agli amministratori.
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme, Theme, defaultTheme, M3Palette } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import {
  DashboardCardId,
  DASHBOARD_CARDS_CONFIG,
  DEFAULT_DASHBOARD_CARD_ORDER,
  DASHBOARD_CARD_ORDER_STORAGE_KEY,
} from '../config/dashboardLayout';

const ColorInput: React.FC<{
    label: string;
    colorKey: keyof M3Palette;
    value: string;
    onChange: (key: keyof M3Palette, value: string) => void;
}> = ({ label, colorKey, value, onChange }) => (
    <div>
        <label className="block text-sm font-medium text-on-surface-variant mb-1 capitalize">{label.replace(/([A-Z])/g, ' $1')}</label>
        <div className="flex items-center space-x-2">
            <input
                type="color"
                value={value}
                onChange={(e) => onChange(colorKey, e.target.value)}
                className="w-10 h-10 p-0 border-none rounded-md cursor-pointer bg-surface"
            />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(colorKey, e.target.value)}
                className="w-full text-sm bg-surface-container-highest border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary px-3 py-2"
                pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                title="Enter a valid hex color code (e.g., #RRGGBB)"
            />
        </div>
    </div>
);

const PaletteGroup: React.FC<{
    title: string;
    palette: M3Palette;
    keys: (keyof M3Palette)[];
    onChange: (key: keyof M3Palette, value: string) => void;
}> = ({ title, palette, keys, onChange }) => (
    <div className="p-4 border border-outline-variant rounded-2xl">
        <h3 className="text-lg font-medium text-on-surface mb-4">{title}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {keys.map(key => (
                <ColorInput
                    key={key}
                    label={key}
                    colorKey={key}
                    value={palette[key]}
                    onChange={onChange}
                />
            ))}
        </div>
    </div>
);


const ThemeEditor: React.FC = () => {
    const { theme, setTheme, resetTheme } = useTheme();
    const [editedTheme, setEditedTheme] = useState<Theme>(theme);
    const [activeMode, setActiveMode] = useState<'light' | 'dark'>('light');

    useEffect(() => {
        setEditedTheme(theme);
    }, [theme]);

    const handleColorChange = (key: keyof M3Palette, value: string) => {
        setEditedTheme(prev => ({
            ...prev,
            [activeMode]: {
                ...prev[activeMode],
                [key]: value
            }
        }));
    };

    const handleSave = () => {
        setTheme(editedTheme);
    };

    const handleReset = () => {
        resetTheme();
    };
    
    const isThemeChanged = JSON.stringify(theme) !== JSON.stringify(editedTheme);
    const isThemeDefault = JSON.stringify(theme) === JSON.stringify(defaultTheme);

    const keyGroups = {
        primary: ['primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer'] as (keyof M3Palette)[],
        secondary: ['secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer'] as (keyof M3Palette)[],
        tertiary: ['tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer'] as (keyof M3Palette)[],
        error: ['error', 'onError', 'errorContainer', 'onErrorContainer'] as (keyof M3Palette)[],
        surfaces: ['background', 'onBackground', 'surface', 'onSurface', 'surfaceVariant', 'onSurfaceVariant', 'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer', 'surfaceContainerHigh', 'surfaceContainerHighest'] as (keyof M3Palette)[],
        other: ['outline', 'outlineVariant', 'shadow', 'scrim', 'inverseSurface', 'inverseOnSurface', 'inversePrimary'] as (keyof M3Palette)[],
    };

    return (
         <div className="bg-surface-container rounded-2xl shadow p-6 mt-8">
            <h2 className="text-xl font-semibold mb-6">Personalizzazione Tema Material 3</h2>
            
            <div className="border-b border-outline-variant mb-6">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick={() => setActiveMode('light')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeMode === 'light' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'}`}>
                        Tema Chiaro
                    </button>
                    <button onClick={() => setActiveMode('dark')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeMode === 'dark' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'}`}>
                        Tema Scuro
                    </button>
                </nav>
            </div>
            
            <div className="space-y-6">
                <PaletteGroup title="Colori Primari" palette={editedTheme[activeMode]} keys={keyGroups.primary} onChange={handleColorChange} />
                <PaletteGroup title="Colori Secondari" palette={editedTheme[activeMode]} keys={keyGroups.secondary} onChange={handleColorChange} />
                <PaletteGroup title="Colori Terziari" palette={editedTheme[activeMode]} keys={keyGroups.tertiary} onChange={handleColorChange} />
                <PaletteGroup title="Colori di Errore" palette={editedTheme[activeMode]} keys={keyGroups.error} onChange={handleColorChange} />
                <PaletteGroup title="Superfici e Sfondi" palette={editedTheme[activeMode]} keys={keyGroups.surfaces} onChange={handleColorChange} />
                <PaletteGroup title="Altri Colori" palette={editedTheme[activeMode]} keys={keyGroups.other} onChange={handleColorChange} />
            </div>

            <div className="mt-8 flex justify-end space-x-3">
                <button 
                    onClick={handleReset} 
                    disabled={isThemeDefault}
                    className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low disabled:opacity-50 text-primary"
                >
                    Ripristina Default
                </button>
                 <button 
                    onClick={handleSave}
                    disabled={!isThemeChanged}
                    className="px-6 py-2 bg-primary text-on-primary rounded-full hover:opacity-90 disabled:opacity-50"
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
        <div className="bg-surface-container rounded-2xl shadow p-6 mt-8">
            <h2 className="text-xl font-semibold mb-6">Personalizzazione Notifiche Toast</h2>
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Posizione Notifiche</label>
                    <select
                        value={editedTheme.toastPosition}
                        onChange={(e) => handleSettingChange('toastPosition', e.target.value)}
                        className="w-full max-w-xs text-sm bg-surface-container-highest border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary px-3 py-2"
                    >
                        {toastPositionOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
            </div>
             <div className="mt-8 flex justify-end space-x-3">
                <button 
                    onClick={handleReset} 
                    className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary"
                >
                    Ripristina Default Toast
                </button>
                 <button 
                    onClick={handleSave}
                    disabled={!isToastSettingsChanged}
                    className="px-6 py-2 bg-primary text-on-primary rounded-full hover:opacity-90 disabled:opacity-50"
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
            <label className="block text-sm font-medium text-on-surface-variant mb-1">{label} ({settings[graph][param as keyof typeof settings[typeof graph]]})</label>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={settings[graph][param as keyof typeof settings[typeof graph]]}
                onChange={(e) => handleChange(graph, param, e.target.value)}
                className="w-full accent-primary"
            />
        </div>
    );

    return (
        <div className="bg-surface-container rounded-2xl shadow p-6 mt-8">
            <h2 className="text-xl font-semibold mb-6">Personalizzazione Visualizzazioni Grafiche</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Sankey Settings */}
                <div className="space-y-4 p-4 border border-outline-variant rounded-2xl">
                    <h3 className="font-medium text-lg">Diagramma di Flusso (Sankey)</h3>
                    <SettingsSlider graph="sankey" param="nodeWidth" label="Larghezza Nodi" min={5} max={50} step={1} />
                    <SettingsSlider graph="sankey" param="nodePadding" label="Spaziatura Nodi" min={2} max={40} step={1} />
                    <SettingsSlider graph="sankey" param="linkOpacity" label="Opacità Flussi" min={0.1} max={1} step={0.1} />
                </div>
                
                {/* Network Settings */}
                <div className="space-y-4 p-4 border border-outline-variant rounded-2xl">
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
                    className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary"
                >
                    Ripristina Default
                </button>
                 <button 
                    onClick={handleSave}
                    disabled={!isChanged}
                    className="px-6 py-2 bg-primary text-on-primary rounded-full hover:opacity-90 disabled:opacity-50"
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

    // For Drag & Drop
    const dragItem = React.useRef<number | null>(null);
    const dragOverItem = React.useRef<number | null>(null);

    useEffect(() => {
        try {
            const savedOrderJSON = localStorage.getItem(DASHBOARD_CARD_ORDER_STORAGE_KEY);
            const savedOrder: DashboardCardId[] = savedOrderJSON ? JSON.parse(savedOrderJSON) : DEFAULT_DASHBOARD_CARD_ORDER;

            const allKnownIds = new Set(DASHBOARD_CARDS_CONFIG.map(c => c.id));
            const savedIds = new Set(savedOrder);

            // Filter out any stale IDs from the saved order that are no longer in the config
            const validOrder = savedOrder.filter(id => allKnownIds.has(id));
            
            // Add any new cards from the config that aren't in the saved order yet
            allKnownIds.forEach(id => {
                if (!savedIds.has(id)) {
                    validOrder.push(id);
                }
            });

            setCardOrder(validOrder);
        } catch (error) {
            console.error("Failed to load or parse dashboard card order from localStorage:", error);
            setCardOrder(DEFAULT_DASHBOARD_CARD_ORDER);
        }
    }, []);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, position: number) => {
        dragItem.current = position;
        e.currentTarget.classList.add('dragging');
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, position: number) => {
        dragOverItem.current = position;
    };

    const handleDrop = () => {
        if (dragItem.current === null || dragOverItem.current === null) return;

        const newCardOrder = [...cardOrder];
        const dragItemContent = newCardOrder[dragItem.current];
        newCardOrder.splice(dragItem.current, 1);
        newCardOrder.splice(dragOverItem.current, 0, dragItemContent);
        
        dragItem.current = null;
        dragOverItem.current = null;
        
        setCardOrder(newCardOrder);
        setHasChanges(true);
    };

    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('dragging');
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
    
    const cardConfigMap = new Map(DASHBOARD_CARDS_CONFIG.map(c => [c.id, c]));

    return (
        <div className="bg-surface-container rounded-2xl shadow p-6 mt-8">
            <h2 className="text-xl font-semibold mb-2">Ordinamento Card Dashboard</h2>
            <p className="text-sm text-on-surface-variant mb-6 max-w-2xl mx-auto">Trascina le card per riordinarle come verranno visualizzate nella Dashboard.</p>
            <div className="space-y-3 max-w-2xl mx-auto">
                {cardOrder.map((cardId, index) => {
                    const cardConfig = cardConfigMap.get(cardId);
                    if (!cardConfig) return null;

                    return (
                        <div 
                            key={cardId} 
                            className="flex items-center p-4 border border-outline-variant rounded-xl bg-surface cursor-grab active:cursor-grabbing transition-shadow"
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragEnter={(e) => handleDragEnter(e, index)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                        >
                            <span className="material-symbols-outlined text-on-surface-variant mr-4 cursor-grab" title="Trascina per riordinare">drag_indicator</span>
                            <span className="text-2xl mr-4">{cardConfig.icon}</span>
                            <div className="flex-grow">
                                <p className="font-semibold text-on-surface">{cardConfig.label}</p>
                                <p className="text-sm text-on-surface-variant">{cardConfig.description}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
             <style>{`.dragging { opacity: 0.5; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1); }`}</style>
            <div className="mt-8 flex justify-end space-x-3">
                <button onClick={handleReset} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary">Ripristina Ordine Default</button>
                <button onClick={handleSave} disabled={!hasChanges} className="px-6 py-2 bg-primary text-on-primary rounded-full hover:opacity-90 disabled:opacity-50">Salva Ordine</button>
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
            <h1 className="text-3xl font-bold text-on-background mb-8">Impostazioni Amministratore</h1>
            <div className="bg-surface-container rounded-2xl shadow p-6 max-w-2xl">
                <h2 className="text-xl font-semibold mb-4">Sicurezza</h2>
                <div className="flex items-center justify-between p-4 border border-outline-variant rounded-xl">
                    <div>
                        <h3 className="font-medium text-on-surface">Protezione con Password</h3>
                        <p className="text-sm text-on-surface-variant">
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
                            <div className="block bg-surface-variant w-14 h-8 rounded-full"></div>
                            <div className={`dot absolute left-1 top-1 bg-outline w-6 h-6 rounded-full transition-transform duration-300 ease-in-out ${isLoginProtectionEnabled ? 'transform translate-x-6 !bg-primary' : ''}`}></div>
                        </div>
                    </label>
                </div>
            </div>
            
            <DashboardLayoutEditor />
            <ToastEditor />
            <VisualizationEditor />
            <ThemeEditor />
        </div>
    );
};

export default AdminSettingsPage;