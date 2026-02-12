
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
            [id]: { ...(prev[id] || {}), [field]: value }
        }));
    };

    const hasChanges = Object.keys(editedResources).length > 0;

    const handleBulkSave = async () => {
        try {
            const promises = Object.entries(editedResources).map(async ([id, changes]) => {
                const original = resources.find(r => r.id === id);
                if (original) {
                    const merged: Resource = { ...original, ...(changes as Partial<Resource>) } as Resource;
                    return updateResource(merged);
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
    const { quickActions, updateQuickActions, isActionLoading, sidebarSections } = useEntitiesContext();
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
                                <button onClick={() => handleMove(index, -1)} disabled={index === 0} className="p-1 hover:bg-surface-container rounded-full disabled:opacity-20 text-on-surface-variant">
                                    <span className="material-symbols-outlined text-sm">keyboard_arrow_up</span>
                                </button>
                                <button onClick={() => handleMove(index, 1)} disabled={index === localActions.length - 1} className="p-1 hover:bg-surface-container rounded-full disabled:opacity-20 text-on-surface-variant">
                                    <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
                                </button>
                            </div>

                            <div className="flex-grow space-y-3">
                                <div className="flex gap-3">
                                    <input 
                                        type="text" 
                                        value={action.label} 
                                        onChange={e => handleUpdate(index, { label: e.target.value })} 
                                        className="w-full bg-transparent border-b border-outline-variant focus:border-primary px-1 font-bold text-sm"
                                        placeholder="Etichetta"
                                    />
                                    <input 
                                        type="text" 
                                        value={action.icon} 
                                        onChange={e => handleUpdate(index, { icon: e.target.value })} 
                                        className="w-20 bg-transparent border-b border-outline-variant focus:border-primary px-1 font-mono text-xs text-center"
                                        placeholder="icon_name"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <input 
                                        type="text" 
                                        value={action.link} 
                                        onChange={e => handleUpdate(index, { link: e.target.value })} 
                                        className="w-full bg-transparent border-b border-outline-variant focus:border-primary px-1 font-mono text-xs text-on-surface-variant"
                                        placeholder="/path"
                                    />
                                     <input 
                                        type="text" 
                                        value={action.color || ''} 
                                        onChange={e => handleUpdate(index, { color: e.target.value })} 
                                        className="w-24 bg-transparent border-b border-outline-variant focus:border-primary px-1 text-xs"
                                        placeholder="Color/Hex"
                                    />
                                </div>
                            </div>

                            <button onClick={() => handleRemove(index)} className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container rounded-full transition-colors">
                                <span className="material-symbols-outlined">delete</span>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const AdminSettingsPage: React.FC = () => {
    return (
        <div className="space-y-12 pb-20">
            <h1 className="text-3xl font-bold text-on-surface">Pannello di Amministrazione</h1>
            <DataLoadSection />
            <TalentConfigSection />
            <SearchConfigSection />
        </div>
    );
};

export default AdminSettingsPage;
