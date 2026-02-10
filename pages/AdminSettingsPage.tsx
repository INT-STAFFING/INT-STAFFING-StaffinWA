
import React, { useState, useEffect, useMemo } from 'react';
import { useTheme, Theme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { SpinnerIcon } from '../components/icons';
import { useEntitiesContext } from '../context/AppContext';
import { useRoutesManifest } from '../context/RoutesContext';
import { DASHBOARD_CARDS_CONFIG } from '../config/dashboardLayout';
import { DashboardCategory, SidebarSectionColors, SidebarItem, QuickAction, Resource } from '../types';
import { v4 as uuidv4 } from 'uuid';
import SearchableSelect from '../components/SearchableSelect';
import { DataTable, ColumnDef } from '../components/DataTable';

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

const TalentConfigSection: React.FC = () => {
    const { resources, updateResource, isActionLoading } = useEntitiesContext();
    const { addToast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    
    const [editedResources, setEditedResources] = useState<Record<string, Partial<Resource>>>({});

    const handleFieldChange = (id: string, field: keyof Resource, value: any) => {
        setEditedResources(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: value }
        }));
    };

    const hasChanges = Object.keys(editedResources).length > 0;

    const handleBulkSave = async () => {
        try {
            const promises = Object.entries(editedResources).map(async ([id, changes]) => {
                const original = resources.find(r => r.id === id);
                if (original) {
                    return updateResource({ ...original, ...changes });
                }
            });
            
            await Promise.all(promises);
            setEditedResources({});
            addToast('Modifiche salvate con successo.', 'success');
        } catch (e) {
            addToast('Errore durante il salvataggio.', 'error');
        }
    };

    const filteredResources = useMemo(() => 
        resources.filter(r => !r.resigned && r.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [resources, searchTerm]);

    const columns: ColumnDef<Resource>[] = [
        { header: 'Risorsa', sortKey: 'name', cell: r => <span className="font-bold">{r.name}</span> },
        { 
            header: 'Talent Flag', 
            cell: r => {
                const currentVal = editedResources[r.id!]?.isTalent ?? r.isTalent;
                return (
                    <div className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            checked={!!currentVal} 
                            onChange={e => handleFieldChange(r.id!, 'isTalent', e.target.checked)}
                            className="form-checkbox h-5 w-5 text-tertiary rounded"
                        />
                        {currentVal && <span className="text-xs font-bold text-tertiary">TALENT</span>}
                    </div>
                );
            }
        },
        { 
            header: 'Seniority Code', 
            cell: r => (
                <input 
                    type="text" 
                    value={editedResources[r.id!]?.seniorityCode ?? r.seniorityCode ?? ''} 
                    onChange={e => handleFieldChange(r.id!, 'seniorityCode', e.target.value)}
                    className="form-input py-1 px-2 text-sm w-24"
                    placeholder="es. L4"
                />
            )
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-surface p-4 rounded-2xl border border-outline-variant shadow-sm">
                <div>
                    <h3 className="text-xl font-bold text-on-surface">Gestione Massiva Talent & Growth</h3>
                    <p className="text-sm text-on-surface-variant">Modifica rapidamente i flag talent e i codici di seniority per le risorse.</p>
                </div>
                {hasChanges && (
                    <button 
                        onClick={handleBulkSave} 
                        disabled={isActionLoading('updateResource')}
                        className="px-6 py-2 bg-primary text-on-primary rounded-full font-bold shadow-lg flex items-center gap-2"
                    >
                        {isActionLoading('updateResource') ? <SpinnerIcon className="w-4 h-4"/> : 'Salva Modifiche'}
                    </button>
                )}
            </div>

            <DataTable<Resource>
                title=""
                addNewButtonLabel=""
                data={filteredResources}
                columns={columns}
                filtersNode={
                    <input 
                        type="text" 
                        placeholder="Cerca risorsa..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="form-input w-64"
                    />
                }
                onAddNew={() => {}}
                renderRow={(r) => (
                    <tr key={r.id} className="hover:bg-surface-container-low transition-colors group">
                        {columns.map((col, i) => <td key={i} className="px-6 py-3 whitespace-nowrap bg-inherit">{col.cell(r)}</td>)}
                    </tr>
                )}
                renderMobileCard={() => <></>}
                initialSortKey="name"
                isLoading={false}
                tableLayout={{ dense: true, striped: true, headerSticky: true }}
            />
        </div>
    );
};

const SearchConfigSection: React.FC = () => {
    const { quickActions, updateQuickActions, isActionLoading } = useEntitiesContext();
    const { navigationRoutes } = useRoutesManifest();
    const { addToast } = useToast();
    
    const [localActions, setLocalActions] = useState<QuickAction[]>(quickActions || []);
    
    useEffect(() => {
        if (quickActions) setLocalActions(quickActions);
    }, [quickActions]);

    const handleSave = async () => {
        try {
            await updateQuickActions(localActions);
            addToast('Azioni rapide salvate su Database.', 'success');
        } catch (error) {
            addToast('Errore durante il salvataggio.', 'error');
        }
    };

    const handleAdd = () => {
        if (localActions.length >= 8) {
            addToast('Puoi configurare al massimo 8 azioni rapide.', 'warning');
            return;
        }
        const firstAvailable = navigationRoutes[0];
        const newAction: QuickAction = {
            label: firstAvailable.label,
            icon: firstAvailable.icon,
            link: firstAvailable.path,
            color: ''
        };
        setLocalActions([...localActions, newAction]);
    };

    const handleRemove = (index: number) => {
        setLocalActions(localActions.filter((_, i) => i !== index));
    };

    const handleUpdate = (index: number, updates: Partial<QuickAction>) => {
        const next = [...localActions];
        next[index] = { ...next[index], ...updates };
        setLocalActions(next);
    };

    const handleMove = (index: number, direction: -1 | 1) => {
        if ((direction === -1 && index === 0) || (direction === 1 && index === localActions.length - 1)) return;
        const next = [...localActions];
        const temp = next[index];
        next[index] = next[index + direction];
        next[index + direction] = temp;
        setLocalActions(next);
    };

    const hasChanges = JSON.stringify(quickActions) !== JSON.stringify(localActions);

    return (
        <div className="space-y-8">
            <div className="bg-surface rounded-3xl shadow-sm p-8 border border-outline-variant">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-on-surface">Configurazione Ricerca Rapida</h2>
                        <p className="text-sm text-on-surface-variant">Gestisci le "Quick Actions" che appaiono nel widget di ricerca Cmd+K.</p>
                    </div>
                    <div className="flex gap-3">
                         <button onClick={handleAdd} className="px-6 py-2 bg-secondary-container text-on-secondary-container rounded-full text-sm font-bold flex items-center gap-2 hover:opacity-90">
                            <span className="material-symbols-outlined text-sm">add</span> Aggiungi Azione
                        </button>
                        {hasChanges && (
                            <button 
                                onClick={handleSave} 
                                disabled={isActionLoading('updateQuickActions')}
                                className="px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-bold shadow-lg flex items-center gap-2"
                            >
                                {isActionLoading('updateQuickActions') ? <SpinnerIcon className="w-4 h-4" /> : 'Salva su DB'}
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {localActions.map((action, index) => (
                        <div key={index} className="p-6 bg-surface-container-low rounded-3xl border border-outline-variant flex items-center gap-4 group hover:bg-surface-container transition-colors">
                            <div className="flex flex-col gap-1">
                                <button onClick={() => handleMove(index, -1)} disabled={index === 0} className="p-1 hover:bg-surface-container rounded-full disabled:opacity-20"><span className="material-symbols-outlined text-sm">keyboard_arrow_up</span></button>
                                <button onClick={() => handleMove(index, 1)} disabled={index === localActions.length - 1} className="p-1 hover:bg-surface-container rounded-full disabled:opacity-20"><span className="material-symbols-outlined text-sm">keyboard_arrow_down</span></button>
                            </div>
                            
                            <div className="flex-grow grid grid-cols-1 md:grid-cols-12 gap-4">
                                <div className="md:col-span-4">
                                    <label className="text-[10px] font-black uppercase text-primary tracking-widest block mb-1">Pagina</label>
                                    <select 
                                        value={action.link} 
                                        onChange={e => {
                                            const route = navigationRoutes.find(r => r.path === e.target.value);
                                            if (route) handleUpdate(index, { link: route.path, label: route.label, icon: route.icon });
                                        }}
                                        className="w-full bg-transparent border-b border-outline-variant text-sm font-bold p-0 focus:ring-0"
                                    >
                                        {navigationRoutes.map(r => <option key={r.path} value={r.path}>{r.label}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-3">
                                    <label className="text-[10px] font-black uppercase text-on-surface-variant tracking-widest block mb-1">Etichetta Custom</label>
                                    <input 
                                        type="text" 
                                        value={action.label} 
                                        onChange={e => handleUpdate(index, { label: e.target.value })}
                                        className="w-full bg-transparent border-b border-outline-variant text-sm p-0 focus:ring-0"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-[10px] font-black uppercase text-on-surface-variant tracking-widest block mb-1">Icona</label>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg opacity-60">{action.icon}</span>
                                        <input 
                                            type="text" 
                                            value={action.icon} 
                                            onChange={e => handleUpdate(index, { icon: e.target.value })}
                                            className="w-full bg-transparent border-b border-outline-variant text-xs p-0 focus:ring-0"
                                        />
                                    </div>
                                </div>
                                <div className="md:col-span-2 flex items-center gap-2">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-on-surface-variant tracking-widest block mb-1">Colore</label>
                                        <input 
                                            type="color" 
                                            value={action.color && action.color.startsWith('#') ? action.color : '#006493'}
                                            onChange={e => handleUpdate(index, { color: e.target.value })}
                                            className="h-8 w-8 rounded cursor-pointer border-0 bg-transparent p-0"
                                        />
                                    </div>
                                    <button onClick={() => handleRemove(index)} className="p-2 text-error hover:bg-error-container/20 rounded-full mt-3">
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {localActions.length === 0 && (
                        <div className="col-span-full py-12 text-center text-on-surface-variant border-2 border-dashed border-outline-variant rounded-3xl opacity-60">
                             Nessuna azione rapida configurata. Usa il pulsante in alto per aggiungere.
                        </div>
                    )}
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

    const hasChanges = JSON.stringify(dashboardLayout) !== JSON.stringify(localLayout);

    return (
        <div className="space-y-8">
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
    const { addToast } = useToast();
    
    // Local States
    const [localTheme, setLocalTheme] = useState<Theme>(theme);
    const [localBottomPaths, setLocalBottomPaths] = useState<string[]>(bottomNavPaths || []);
    
    // Sidebar Structure Local State
    const [localSidebarSections, setLocalSidebarSections] = useState<string[]>(sidebarSections || []);
    const [localSidebarColors, setLocalSidebarColors] = useState<SidebarSectionColors>(sidebarSectionColors || {});
    const [localSidebarConfig, setLocalSidebarConfig] = useState<SidebarItem[]>(sidebarConfig || []);
    const [newSectionName, setNewSectionName] = useState('');
    const [saving, setSaving] = useState(false);

    // Sync Effects
    useEffect(() => { setLocalTheme(theme); }, [theme]);
    useEffect(() => { setLocalBottomPaths(bottomNavPaths || []); }, [bottomNavPaths]);
    useEffect(() => { setLocalSidebarSections(sidebarSections || []); }, [sidebarSections]);
    useEffect(() => { setLocalSidebarColors(sidebarSectionColors || {}); }, [sidebarSectionColors]);
    useEffect(() => { setLocalSidebarConfig(sidebarConfig || []); }, [sidebarConfig]);

    const handleToastConfigChange = (key: keyof Theme, value: string) => {
        setLocalTheme(prev => ({ ...prev, [key]: value as any }));
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

    const handleMoveSection = (index: number, direction: -1 | 1) => {
        if ((direction === -1 && index === 0) || (direction === 1 && index === localSidebarSections.length - 1)) return;
        const newSections = [...localSidebarSections];
        const temp = newSections[index];
        newSections[index] = newSections[index + direction];
        newSections[index + direction] = temp;
        setLocalSidebarSections(newSections);
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
    const handleResetItemColor = (path: string) => {
         const existingIdx = localSidebarConfig.findIndex(item => item.path === path);
         if (existingIdx >= 0) {
             const next = [...localSidebarConfig];
             const { color, ...rest } = next[existingIdx];
             next[existingIdx] = rest as SidebarItem;
             setLocalSidebarConfig(next);
         }
    };
    
    const handleSave = async () => {
        setSaving(true);
        try {
            await saveTheme(localTheme);
            if (JSON.stringify(localBottomPaths) !== JSON.stringify(bottomNavPaths)) await updateBottomNavPaths(localBottomPaths);
            if (JSON.stringify(localSidebarSections) !== JSON.stringify(sidebarSections)) await updateSidebarSections(localSidebarSections);
            if (JSON.stringify(localSidebarColors) !== JSON.stringify(sidebarSectionColors)) await updateSidebarSectionColors(localSidebarColors);
            if (JSON.stringify(localSidebarConfig) !== JSON.stringify(sidebarConfig)) await updateSidebarConfig(localSidebarConfig);
            
            addToast('Tema e configurazioni salvati.', 'success');
        } catch (e) {
            addToast('Errore durante il salvataggio.', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-surface rounded-3xl shadow-sm p-8 border border-outline-variant space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-on-surface">Tema e Navigazione</h2>
                    <p className="text-sm text-on-surface-variant">Personalizza l'aspetto e l'organizzazione del menu laterale.</p>
                </div>
                <button 
                    onClick={handleSave} 
                    disabled={saving}
                    className="px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-bold shadow-lg flex items-center gap-2"
                >
                    {saving ? <SpinnerIcon className="w-4 h-4" /> : 'Salva Tutto'}
                </button>
            </div>
            
            {/* Simple Theme Toggles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="font-bold mb-2">Modalità</h3>
                    <div className="flex gap-2">
                         <button onClick={toggleMode} className="px-4 py-2 bg-surface-container rounded-lg border border-outline-variant flex items-center gap-2">
                             <span className="material-symbols-outlined">{mode === 'dark' ? 'dark_mode' : 'light_mode'}</span>
                             {mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
                         </button>
                    </div>
                </div>
                <div>
                     <h3 className="font-bold mb-2">Posizione Toast</h3>
                     <select 
                        value={localTheme.toastPosition} 
                        onChange={(e) => handleToastConfigChange('toastPosition', e.target.value)}
                        className="form-select w-full"
                    >
                        <option value="top-center">Alto Centro</option>
                        <option value="top-right">Alto Destra</option>
                        <option value="bottom-right">Basso Destra</option>
                    </select>
                </div>
            </div>

            {/* Sidebar Sections Management */}
            <div>
                <h3 className="font-bold mb-4">Sezioni Sidebar</h3>
                <div className="flex gap-2 mb-4">
                    <input 
                        type="text" 
                        value={newSectionName} 
                        onChange={e => setNewSectionName(e.target.value)} 
                        placeholder="Nuova sezione..." 
                        className="form-input"
                    />
                    <button onClick={handleAddSection} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-lg font-bold">Aggiungi</button>
                </div>
                <div className="space-y-2">
                    {localSidebarSections.map((section, idx) => (
                        <div key={section} className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl border border-outline-variant">
                            <span className="font-medium">{section}</span>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="color" 
                                    value={localSidebarColors[section] || '#000000'} 
                                    onChange={e => handleSectionColorChange(section, e.target.value)}
                                    className="h-8 w-8 rounded cursor-pointer border-0 p-0"
                                    title="Colore Sezione"
                                />
                                {localSidebarColors[section] && (
                                    <button onClick={() => handleResetSectionColor(section)} className="text-xs text-on-surface-variant underline">Reset Colore</button>
                                )}
                                <div className="flex flex-col ml-2">
                                    <button onClick={() => handleMoveSection(idx, -1)} disabled={idx === 0}><span className="material-symbols-outlined text-sm">keyboard_arrow_up</span></button>
                                    <button onClick={() => handleMoveSection(idx, 1)} disabled={idx === localSidebarSections.length - 1}><span className="material-symbols-outlined text-sm">keyboard_arrow_down</span></button>
                                </div>
                                <button onClick={() => handleDeleteSection(section)} className="ml-2 text-error"><span className="material-symbols-outlined">delete</span></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
             {/* Bottom Nav Config */}
             <div>
                <h3 className="font-bold mb-4">Menu Mobile (Bottom Bar)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {navigationRoutes.map(route => (
                        <label key={route.path} className="flex items-center gap-2 p-2 bg-surface-container-low rounded-lg border border-outline-variant cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={localBottomPaths.includes(route.path)} 
                                onChange={() => toggleBottomPath(route.path)}
                                className="form-checkbox"
                            />
                            <span className="text-xs font-medium">{route.label}</span>
                        </label>
                    ))}
                </div>
            </div>
        </div>
    );
};

const AdminSettingsPage: React.FC = () => {
    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            <h1 className="text-3xl font-bold text-on-surface">Impostazioni Amministratore</h1>
            <DataLoadSection />
            <TalentConfigSection />
            <SearchConfigSection />
            <DashboardConfigSection />
            <ThemeSection />
        </div>
    );
};

export default AdminSettingsPage;
