
import React, { useState, useEffect, useMemo } from 'react';
import { useTheme, Theme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { SpinnerIcon } from '../components/icons';
import { useEntitiesContext } from '../context/AppContext';
import { useRoutesManifest } from '../context/RoutesContext';
import { DASHBOARD_CARDS_CONFIG } from '../config/dashboardLayout';
import { DashboardCategory, SidebarSectionColors, SidebarItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

const DataLoadSection: React.FC = () => {
    const { planningSettings, updatePlanningSettings, isActionLoading } = useEntitiesContext();
    const [localSettings, setLocalSettings] = useState(planningSettings);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (planningSettings) setLocalSettings(planningSettings);
    }, [planningSettings]);

    const handleChange = (key: 'monthsBefore' | 'monthsAfter', value: string) => {
        const val = parseInt(value, 10);
        setLocalSettings(prev => ({ ...prev, [key]: isNaN(val) ? 0 : val }));
        setHasChanges(true);
    };

    const handleSave = () => {
        updatePlanningSettings(localSettings);
        setHasChanges(false);
    };

    return (
        <div className="bg-surface rounded-3xl shadow-sm p-8 border border-outline-variant">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-on-surface">Caricamento Dati & Performance</h2>
                    <p className="text-sm text-on-surface-variant">Configura l'orizzonte temporale del caricamento delle allocazioni (Salvataggio su Database Globale).</p>
                </div>
                {hasChanges && (
                    <button 
                        onClick={handleSave} 
                        disabled={isActionLoading('updatePlanningSettings')}
                        className="px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-bold flex items-center gap-2 shadow-lg transition-transform active:scale-95"
                    >
                        {isActionLoading('updatePlanningSettings') ? <SpinnerIcon className="w-4 h-4" /> : <><span className="material-symbols-outlined text-sm">save</span> Salva su DB & Ricarica</>}
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant">
                    <label className="block text-xs font-black text-primary uppercase tracking-widest mb-3">Range Storico (Mesi Precedenti)</label>
                    <input 
                        type="number" min="0" max="24"
                        value={localSettings.monthsBefore} 
                        onChange={(e) => handleChange('monthsBefore', e.target.value)}
                        className="form-input text-lg font-bold"
                    />
                    <p className="mt-3 text-[10px] text-on-surface-variant leading-relaxed">Aumentare questo valore rallenta il caricamento iniziale ma fornisce report storici più profondi.</p>
                </div>
                <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant">
                    <label className="block text-xs font-black text-primary uppercase tracking-widest mb-3">Range Futuro (Mesi Successivi)</label>
                    <input 
                        type="number" min="1" max="36"
                        value={localSettings.monthsAfter} 
                        onChange={(e) => handleChange('monthsAfter', e.target.value)}
                        className="form-input text-lg font-bold"
                    />
                    <p className="mt-3 text-[10px] text-on-surface-variant leading-relaxed">Definisce quanto lontano nel futuro si estende la griglia di staffing e il forecasting.</p>
                </div>
            </div>
        </div>
    );
};

const DashboardConfigSection: React.FC = () => {
    const { dashboardLayout, updateDashboardLayout, isActionLoading } = useEntitiesContext();
    const [localLayout, setLocalLayout] = useState<DashboardCategory[]>(dashboardLayout || []);
    const { addToast } = useToast();

    // Sync state if context updates
    useEffect(() => {
        if (dashboardLayout) setLocalLayout(dashboardLayout);
    }, [dashboardLayout]);

    const handleSave = async () => {
        try {
            await updateDashboardLayout(localLayout);
            addToast('Layout Dashboard salvato su Database.', 'success');
        } catch (error) {
            addToast('Errore durante il salvataggio.', 'error');
        }
    };

    const addTab = () => {
        const newTab: DashboardCategory = {
            id: `tab_${Date.now()}`,
            label: 'Nuovo Tab',
            cards: []
        };
        setLocalLayout([...localLayout, newTab]);
    };

    const removeTab = (id: string) => {
        if (confirm('Sei sicuro di voler eliminare questo tab?')) {
            setLocalLayout(localLayout.filter(t => t.id !== id));
        }
    };

    const updateTabLabel = (id: string, newLabel: string) => {
        setLocalLayout(localLayout.map(t => t.id === id ? { ...t, label: newLabel } : t));
    };

    const toggleCard = (tabId: string, cardId: string) => {
        setLocalLayout(prev => prev.map(tab => {
            if (tab.id !== tabId) return tab;
            const hasCard = tab.cards.includes(cardId);
            return {
                ...tab,
                cards: hasCard ? tab.cards.filter(c => c !== cardId) : [...tab.cards, cardId]
            };
        }));
    };

    // Calculate changes to show save button
    const hasChanges = JSON.stringify(dashboardLayout) !== JSON.stringify(localLayout);

    return (
        <div className="space-y-8">
            {/* Action Bar */}
            <div className="bg-surface rounded-3xl shadow-sm p-6 border border-outline-variant flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-on-surface">Configurazione Dashboard</h2>
                    <p className="text-sm text-on-surface-variant">Gestisci i tab e le card visibili nella dashboard principale. (Persistente su DB)</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={addTab} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-opacity">
                        <span className="material-symbols-outlined text-sm">add_tab</span> Aggiungi Tab
                    </button>
                    {hasChanges && (
                        <button 
                            onClick={handleSave} 
                            disabled={isActionLoading('updateDashboardLayout')}
                            className="px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-bold shadow-lg flex items-center gap-2"
                        >
                            {isActionLoading('updateDashboardLayout') ? <SpinnerIcon className="w-4 h-4" /> : 'Salva su DB'}
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-6">
                {localLayout.map((tab, index) => (
                    <div key={tab.id} className="bg-surface rounded-3xl shadow-sm p-6 border border-outline-variant">
                        <div className="flex items-center gap-4 mb-6 border-b border-outline-variant pb-4">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                {index + 1}
                            </div>
                            <div className="flex-grow">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block mb-1">Nome Tab</label>
                                <input 
                                    type="text" 
                                    value={tab.label} 
                                    onChange={(e) => updateTabLabel(tab.id, e.target.value)} 
                                    className="w-full bg-transparent text-lg font-bold text-on-surface border-none focus:ring-0 p-0 placeholder:text-on-surface-variant/30"
                                    placeholder="Nome del tab..."
                                />
                            </div>
                            <button onClick={() => removeTab(tab.id)} className="p-2 text-error hover:bg-error-container/20 rounded-full transition-colors" title="Elimina Tab">
                                <span className="material-symbols-outlined">delete</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {DASHBOARD_CARDS_CONFIG.map(card => {
                                const isSelected = tab.cards.includes(card.id);
                                return (
                                    <div 
                                        key={card.id} 
                                        onClick={() => toggleCard(tab.id, card.id)}
                                        className={`
                                            cursor-pointer p-4 rounded-xl border transition-all duration-200 relative overflow-hidden group
                                            ${isSelected 
                                                ? 'bg-primary-container/30 border-primary shadow-sm' 
                                                : 'bg-surface-container-low border-transparent opacity-60 hover:opacity-100 hover:bg-surface-container'
                                            }
                                        `}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-2xl">{card.icon}</span>
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-outline'}`}>
                                                {isSelected && <span className="material-symbols-outlined text-[12px] text-on-primary">check</span>}
                                            </div>
                                        </div>
                                        <h4 className={`font-bold text-sm mb-1 ${isSelected ? 'text-primary' : 'text-on-surface'}`}>{card.label}</h4>
                                        <p className="text-xs text-on-surface-variant leading-tight">{card.description}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ThemeSection: React.FC = () => {
    const { theme, saveTheme, resetTheme, mode, toggleMode } = useTheme();
    const { 
        bottomNavPaths, updateBottomNavPaths, isActionLoading,
        sidebarSections, updateSidebarSections,
        sidebarSectionColors, updateSidebarSectionColors,
        sidebarConfig, updateSidebarConfig 
    } = useEntitiesContext();
    const { navigationRoutes } = useRoutesManifest();
    
    // Local States
    const [localTheme, setLocalTheme] = useState<Theme>(theme);
    const [localBottomPaths, setLocalBottomPaths] = useState<string[]>(bottomNavPaths || []);
    
    // Sidebar Structure Local State
    const [localSidebarSections, setLocalSidebarSections] = useState<string[]>(sidebarSections || []);
    const [localSidebarColors, setLocalSidebarColors] = useState<SidebarSectionColors>(sidebarSectionColors || {});
    const [localSidebarConfig, setLocalSidebarConfig] = useState<SidebarItem[]>(sidebarConfig || []);
    const [newSectionName, setNewSectionName] = useState('');

    const { addToast } = useToast();
    const [saving, setSaving] = useState(false);

    // Sync Effects
    useEffect(() => { setLocalTheme(theme); }, [theme]);
    useEffect(() => { setLocalBottomPaths(bottomNavPaths || []); }, [bottomNavPaths]);
    useEffect(() => { setLocalSidebarSections(sidebarSections || []); }, [sidebarSections]);
    useEffect(() => { setLocalSidebarColors(sidebarSectionColors || {}); }, [sidebarSectionColors]);
    useEffect(() => { setLocalSidebarConfig(sidebarConfig || []); }, [sidebarConfig]);

    const handleColorChange = (modeKey: 'light' | 'dark', key: string, value: string) => {
        setLocalTheme(prev => ({
            ...prev,
            [modeKey]: { ...prev[modeKey], [key]: value }
        }));
    };

    const handleToastConfigChange = (key: keyof Theme, value: string) => {
        setLocalTheme(prev => ({ ...prev, [key]: value as any }));
    };

    const handleVizChange = (chart: 'sankey' | 'network', prop: string, value: number) => {
        setLocalTheme(prev => ({
            ...prev,
            visualizationSettings: {
                ...prev.visualizationSettings,
                [chart]: {
                    ...prev.visualizationSettings[chart],
                    [prop]: value
                }
            }
        }));
    };

    const toggleBottomPath = (path: string) => {
        setLocalBottomPaths(prev => {
            if (prev.includes(path)) return prev.filter(p => p !== path);
            return [...prev, path];
        });
    };
    
    // --- Sidebar Sections Handlers ---
    const handleAddSection = () => {
        if (!newSectionName.trim()) return;
        if (localSidebarSections.includes(newSectionName.trim())) {
            addToast('Questa sezione esiste già.', 'warning');
            return;
        }
        setLocalSidebarSections(prev => [...prev, newSectionName.trim()]);
        setNewSectionName('');
    };

    const handleDeleteSection = (section: string) => {
        if (!confirm(`Sei sicuro di voler rimuovere la sezione "${section}"? Le pagine associate rimarranno ma potrebbero spostarsi.`)) return;
        setLocalSidebarSections(prev => prev.filter(s => s !== section));
        const newColors = { ...localSidebarColors };
        delete newColors[section];
        setLocalSidebarColors(newColors);
    };

    const handleSectionColorChange = (section: string, color: string) => {
        setLocalSidebarColors(prev => ({ ...prev, [section]: color }));
    };
    
    const handleResetSectionColor = (section: string) => {
        const next = { ...localSidebarColors };
        delete next[section];
        setLocalSidebarColors(next);
    };

    // --- Sidebar Items Handlers ---
    const handleItemColorChange = (path: string, color: string) => {
        // Need to update localSidebarConfig. If the item doesn't exist there (it might be implicit), we add it.
        // We iterate navigationRoutes which merges config + defaults.
        const existingIdx = localSidebarConfig.findIndex(item => item.path === path);
        if (existingIdx >= 0) {
            const next = [...localSidebarConfig];
            next[existingIdx] = { ...next[existingIdx], color };
            setLocalSidebarConfig(next);
        } else {
            // Find base properties from manifest if not in config
            const base = navigationRoutes.find(r => r.path === path);
            if (base) {
                setLocalSidebarConfig(prev => [...prev, {
                    path: base.path,
                    label: base.label,
                    icon: base.icon,
                    section: base.section || 'Altro',
                    color
                }]);
            }
        }
    };

    const handleResetItemColor = (path: string) => {
         const existingIdx = localSidebarConfig.findIndex(item => item.path === path);
         if (existingIdx >= 0) {
             const next = [...localSidebarConfig];
             delete next[existingIdx].color; // Remove color override
             setLocalSidebarConfig(next);
         }
    };

    // --- Save Handlers ---
    const handleSaveTheme = async () => {
        setSaving(true);
        try {
            await saveTheme(localTheme);
            addToast('Personalizzazione tema salvata.', 'success');
        } catch (e) {
            addToast('Errore salvataggio tema.', 'error');
        } finally { setSaving(false); }
    };
    
    const handleSaveSidebarSections = async () => {
        try {
            // Save both sections list and colors
            await updateSidebarSections(localSidebarSections);
            await updateSidebarSectionColors(localSidebarColors);
            addToast('Struttura sezioni e colori aggiornati.', 'success');
        } catch (e) { addToast('Errore salvataggio sezioni.', 'error'); }
    };

    const handleSaveSidebarItems = async () => {
        try {
            await updateSidebarConfig(localSidebarConfig);
            addToast('Colori pagine aggiornati.', 'success');
        } catch (e) { addToast('Errore salvataggio pagine.', 'error'); }
    };

    const handleSaveBottomNav = async () => {
        try {
            await updateBottomNavPaths(localBottomPaths);
            addToast('Configurazione mobile salvata.', 'success');
        } catch (e) { addToast('Errore salvataggio navigazione.', 'error'); }
    };

    const handleReset = async () => {
        if (!confirm('Ripristinare i colori originali?')) return;
        setSaving(true);
        try { await resetTheme(); addToast('Ripristino completato.', 'success'); } 
        catch (e) { addToast('Errore ripristino.', 'error'); } 
        finally { setSaving(false); }
    };

    const sidebarSectionsChanged = 
        JSON.stringify(localSidebarSections) !== JSON.stringify(sidebarSections || []) ||
        JSON.stringify(localSidebarColors) !== JSON.stringify(sidebarSectionColors || {});

    const sidebarItemsChanged = JSON.stringify(localSidebarConfig) !== JSON.stringify(sidebarConfig || []);
    const bottomNavChanges = JSON.stringify(localBottomPaths) !== JSON.stringify(bottomNavPaths || []);

    return (
        <div className="space-y-8">
            {/* Action Bar */}
            <div className="bg-surface rounded-3xl shadow-sm p-6 border border-outline-variant flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-on-surface">Look & Feel</h2>
                    <p className="text-sm text-on-surface-variant">Personalizza palette, navigazione e parametri grafici (Salvati su DB per tutti).</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={toggleMode} className="p-3 rounded-2xl bg-surface-container-high text-on-surface hover:bg-primary hover:text-on-primary transition-all shadow-sm">
                        <span className="material-symbols-outlined">{mode === 'light' ? 'dark_mode' : 'light_mode'}</span>
                    </button>
                    <button onClick={handleReset} className="text-error font-bold text-sm hover:underline px-4" disabled={saving}>Reset</button>
                    <button onClick={handleSaveTheme} disabled={saving} className="px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-bold shadow-lg flex items-center gap-2">
                        {saving ? <SpinnerIcon className="w-4 h-4" /> : 'Salva su DB'}
                    </button>
                </div>
            </div>

            {/* Colors Grid */}
            <div className="bg-surface rounded-3xl shadow-sm p-8 border border-outline-variant">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-4">
                        <h3 className="text-sm font-black text-primary uppercase tracking-widest border-b border-outline-variant pb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg">light_mode</span> Light Palette
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {Object.entries(localTheme.light).map(([key, val]) => (
                                <div key={key} className="flex items-center justify-between p-3 bg-surface-container-lowest rounded-xl border border-outline-variant group">
                                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter truncate max-w-[120px]">{key}</span>
                                    <input type="color" value={val as string} onChange={(e) => handleColorChange('light', key, e.target.value)} className="h-8 w-8 rounded-lg cursor-pointer border-none p-0"/>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-sm font-black text-primary uppercase tracking-widest border-b border-outline-variant pb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg">dark_mode</span> Dark Palette
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {Object.entries(localTheme.dark).map(([key, val]) => (
                                <div key={key} className="flex items-center justify-between p-3 bg-surface-container-lowest rounded-xl border border-outline-variant group">
                                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter truncate max-w-[120px]">{key}</span>
                                    <input type="color" value={val as string} onChange={(e) => handleColorChange('dark', key, e.target.value)} className="h-8 w-8 rounded-lg cursor-pointer border-none p-0"/>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Sidebar Sections Manager */}
            <div className="bg-surface rounded-3xl shadow-sm p-8 border border-outline-variant">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-on-surface flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">view_sidebar</span> Gestione Sezioni Sidebar
                        </h3>
                        <p className="text-sm text-on-surface-variant">Aggiungi, rimuovi e colora le sezioni del menu laterale.</p>
                    </div>
                    {sidebarSectionsChanged && (
                        <button onClick={handleSaveSidebarSections} className="px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-bold shadow-lg">
                            Salva Sezioni
                        </button>
                    )}
                </div>
                
                {/* Add New Section */}
                <div className="flex gap-2 mb-6">
                    <input 
                        type="text" 
                        value={newSectionName} 
                        onChange={e => setNewSectionName(e.target.value)} 
                        placeholder="Nuova sezione (es. Extra)..." 
                        className="form-input max-w-xs"
                    />
                    <button onClick={handleAddSection} disabled={!newSectionName} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-lg font-bold disabled:opacity-50">
                        Aggiungi
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {localSidebarSections.map(section => {
                        const currentColor = localSidebarColors[section] || '#72787d';
                        const isSet = !!localSidebarColors[section];
                        
                        return (
                            <div key={section} className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant relative group">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs font-bold uppercase tracking-wider truncate" style={{ color: currentColor }}>
                                        {section}
                                    </span>
                                    <button onClick={() => handleDeleteSection(section)} className="text-on-surface-variant hover:text-error p-1 rounded hover:bg-surface-container">
                                        <span className="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="color" 
                                        value={currentColor.startsWith('#') ? currentColor : '#000000'}
                                        onChange={(e) => handleSectionColorChange(section, e.target.value)}
                                        className="h-8 w-8 rounded cursor-pointer border-0 bg-transparent p-0"
                                    />
                                    {isSet && (
                                         <button onClick={() => handleResetSectionColor(section)} className="text-[10px] text-on-surface-variant hover:text-primary underline">
                                            Reset Colore
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Sidebar Pages Colors Manager */}
            <div className="bg-surface rounded-3xl shadow-sm p-8 border border-outline-variant">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-on-surface flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">format_paint</span> Personalizzazione Voci Menu
                        </h3>
                        <p className="text-sm text-on-surface-variant">Cambia il colore delle singole pagine nella sidebar.</p>
                    </div>
                    {sidebarItemsChanged && (
                        <button onClick={handleSaveSidebarItems} className="px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-bold shadow-lg">
                            Salva Colori Pagine
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {localSidebarSections.map(section => {
                        const items = navigationRoutes.filter(r => (r.section || 'Altro') === section);
                        if (items.length === 0) return null;

                        return (
                            <div key={section} className="bg-surface-container-low rounded-2xl border border-outline-variant overflow-hidden">
                                <div className="px-4 py-2 bg-surface-container font-bold text-xs uppercase text-on-surface-variant tracking-wider">
                                    {section}
                                </div>
                                <div className="divide-y divide-outline-variant">
                                    {items.map(item => {
                                        // Find config for this item to get current color
                                        const configItem = localSidebarConfig.find(c => c.path === item.path);
                                        const currentColor = configItem?.color || ''; // empty means default
                                        
                                        return (
                                            <div key={item.path} className="p-3 flex items-center justify-between hover:bg-surface-container transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <span className="material-symbols-outlined text-on-surface-variant">{item.icon}</span>
                                                    <span className="text-sm font-medium" style={{ color: currentColor || undefined }}>{item.label}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                     <input 
                                                        type="color" 
                                                        value={currentColor && currentColor.startsWith('#') ? currentColor : '#000000'}
                                                        onChange={(e) => handleItemColorChange(item.path, e.target.value)}
                                                        className="h-6 w-6 rounded cursor-pointer border-0 bg-transparent p-0 opacity-50 hover:opacity-100"
                                                        title="Cambia colore"
                                                    />
                                                    {currentColor && (
                                                        <button onClick={() => handleResetItemColor(item.path)} className="text-on-surface-variant hover:text-error" title="Rimuovi colore">
                                                            <span className="material-symbols-outlined text-sm">format_color_reset</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Navigation Section */}
            <div className="bg-surface rounded-3xl shadow-sm p-8 border border-outline-variant">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-on-surface flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">smartphone</span> Configurazione Navigazione Mobile
                        </h3>
                        <p className="text-sm text-on-surface-variant">Seleziona le pagine da visualizzare nella barra rapida in basso (max 5 consigliate).</p>
                    </div>
                    {bottomNavChanges && (
                        <button 
                            onClick={handleSaveBottomNav} 
                            disabled={isActionLoading('updateBottomNavPaths')}
                            className="px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-bold flex items-center gap-2 shadow-lg"
                        >
                            {isActionLoading('updateBottomNavPaths') ? <SpinnerIcon className="w-4 h-4" /> : 'Salva su DB'}
                        </button>
                    )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {navigationRoutes.map(route => {
                        const isSelected = localBottomPaths.includes(route.path);
                        return (
                            <button
                                key={route.path}
                                onClick={() => toggleBottomPath(route.path)}
                                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                                    isSelected 
                                        ? 'bg-primary-container border-primary text-on-primary-container ring-2 ring-primary/20' 
                                        : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                                }`}
                            >
                                <span className="material-symbols-outlined text-xl">{route.icon}</span>
                                <span className="text-sm font-bold truncate">{route.label}</span>
                                {isSelected && (
                                    <span className="material-symbols-outlined text-sm ml-auto">check_circle</span>
                                )}
                            </button>
                        );
                    })}
                </div>
                {localBottomPaths.length > 5 && (
                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl text-xs text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">warning</span>
                        Hai selezionato {localBottomPaths.length} elementi. Per un'esperienza mobile ottimale, si consiglia di non superare i 5 elementi.
                    </div>
                )}
            </div>

            {/* Charts Config */}
            <div className="bg-surface rounded-3xl shadow-sm p-8 border border-outline-variant">
                <h3 className="text-xl font-bold text-on-surface mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">query_stats</span> Parametri Grafici
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-6 bg-surface-container-low p-6 rounded-2xl border border-outline-variant">
                        <h4 className="text-sm font-black text-primary uppercase tracking-widest">Diagramma Sankey</h4>
                        <div className="space-y-4">
                            <div><label className="text-xs font-bold block mb-1">Larghezza Nodo: {localTheme.visualizationSettings.sankey.nodeWidth}px</label><input type="range" min="5" max="100" value={localTheme.visualizationSettings.sankey.nodeWidth} onChange={(e) => handleVizChange('sankey', 'nodeWidth', Number(e.target.value))} className="w-full accent-primary"/></div>
                            <div><label className="text-xs font-bold block mb-1">Opacità Link: {Math.round(localTheme.visualizationSettings.sankey.linkOpacity * 100)}%</label><input type="range" min="0.1" max="1" step="0.05" value={localTheme.visualizationSettings.sankey.linkOpacity} onChange={(e) => handleVizChange('sankey', 'linkOpacity', Number(e.target.value))} className="w-full accent-primary"/></div>
                        </div>
                    </div>
                    <div className="space-y-6 bg-surface-container-low p-6 rounded-2xl border border-outline-variant">
                        <h4 className="text-sm font-black text-primary uppercase tracking-widest">Mappa Network</h4>
                        <div className="space-y-4">
                            <div><label className="text-xs font-bold block mb-1">Repulsione (Charge): {localTheme.visualizationSettings.network.chargeStrength}</label><input type="range" min="-1000" max="-50" step="10" value={localTheme.visualizationSettings.network.chargeStrength} onChange={(e) => handleVizChange('network', 'chargeStrength', Number(e.target.value))} className="w-full accent-primary"/></div>
                            <div><label className="text-xs font-bold block mb-1">Raggio Nodi: {localTheme.visualizationSettings.network.nodeRadius}px</label><input type="range" min="5" max="40" value={localTheme.visualizationSettings.network.nodeRadius} onChange={(e) => handleVizChange('network', 'nodeRadius', Number(e.target.value))} className="w-full accent-primary"/></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-surface rounded-3xl shadow-sm p-8 border border-outline-variant">
                <h3 className="text-xl font-bold text-on-surface mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">notifications_active</span> Configurazione Toast
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-4">
                        <label className="block text-xs font-black text-primary uppercase tracking-widest">Posizione</label>
                        <select value={localTheme.toastPosition} onChange={(e) => handleToastConfigChange('toastPosition', e.target.value)} className="form-select">
                            <option value="top-center">Top Center</option>
                            <option value="top-right">Top Right</option>
                            <option value="bottom-center">Bottom Center</option>
                        </select>
                    </div>
                    <div className="p-4 bg-tertiary-container/10 rounded-2xl border border-tertiary/20 space-y-4">
                        <label className="block text-xs font-black text-tertiary uppercase tracking-widest">Colori Successo</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div><span className="text-[10px] block mb-1">BG</span><input type="color" value={localTheme.toastSuccessBackground} onChange={(e) => handleToastConfigChange('toastSuccessBackground', e.target.value)} className="h-10 w-full rounded-lg cursor-pointer"/></div>
                            <div><span className="text-[10px] block mb-1">Text</span><input type="color" value={localTheme.toastSuccessForeground} onChange={(e) => handleToastConfigChange('toastSuccessForeground', e.target.value)} className="h-10 w-full rounded-lg cursor-pointer"/></div>
                        </div>
                    </div>
                    <div className="p-4 bg-error-container/10 rounded-2xl border border-error/20 space-y-4">
                        <label className="block text-xs font-black text-error uppercase tracking-widest">Colori Errore</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div><span className="text-[10px] block mb-1">BG</span><input type="color" value={localTheme.toastErrorBackground} onChange={(e) => handleToastConfigChange('toastErrorBackground', e.target.value)} className="h-10 w-full rounded-lg cursor-pointer"/></div>
                            <div><span className="text-[10px] block mb-1">Text</span><input type="color" value={localTheme.toastErrorForeground} onChange={(e) => handleToastConfigChange('toastErrorForeground', e.target.value)} className="h-10 w-full rounded-lg cursor-pointer"/></div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-outline-variant); border-radius: 10px; }`}</style>
        </div>
    );
};

const AdminSettingsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState('general');

    const tabs = [
        { id: 'general', label: 'Dati & Performance', icon: 'speed' },
        { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        { id: 'ui', label: 'Look & Feel', icon: 'palette' },
    ];

    return (
        <div className="space-y-8 max-w-6xl mx-auto py-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-4xl font-black text-on-surface tracking-tighter">Impostazioni <span className="text-primary">Admin</span></h1>
                <div className="flex bg-surface-container p-1 rounded-2xl shadow-inner border border-outline-variant">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center px-6 py-2 font-bold text-sm rounded-xl transition-all ${
                                activeTab === tab.id ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                            }`}
                        >
                            <span className="material-symbols-outlined mr-2 text-lg">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="animate-fade-in">
                {activeTab === 'general' && <DataLoadSection />}
                {activeTab === 'dashboard' && <DashboardConfigSection />}
                {activeTab === 'ui' && <ThemeSection />}
            </div>

            <div className="bg-primary/5 p-6 rounded-[2.5rem] border border-primary/10 flex items-center gap-4">
                <div className="p-3 bg-primary text-on-primary rounded-2xl shadow-md">
                    <span className="material-symbols-outlined text-2xl">security</span>
                </div>
                <div className="flex-grow">
                    <p className="font-bold text-on-surface">Sicurezza e Accessi?</p>
                    <p className="text-xs text-on-surface-variant">Le impostazioni relative a utenti, ruoli e permessi sono gestite nel <strong>Security Center</strong>.</p>
                </div>
                <button 
                    onClick={() => window.location.hash = '#/security-center'}
                    className="px-6 py-2 bg-surface text-primary border border-primary font-bold rounded-full hover:bg-primary hover:text-on-primary transition-all active:scale-95"
                >
                    Vai al Security Center
                </button>
            </div>
        </div>
    );
};

export default AdminSettingsPage;
