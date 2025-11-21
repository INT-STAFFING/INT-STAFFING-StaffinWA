/**
 * @file AdminSettingsPage.tsx
 * @description Pagina per la gestione delle impostazioni riservate agli amministratori.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme, Theme, defaultTheme, M3Palette } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useEntitiesContext } from '../context/AppContext';
import { SpinnerIcon } from '../components/icons';
import {
  DashboardCardId,
  DASHBOARD_CARDS_CONFIG,
  DEFAULT_DASHBOARD_CARD_ORDER,
  DASHBOARD_CARD_ORDER_STORAGE_KEY,
} from '../config/dashboardLayout';
import { SkillThresholds, AppUser, UserRole, RolePermission } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import ConfirmationModal from '../components/ConfirmationModal';

// --- UTILS ---
const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('authToken');
    const headers = { 
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
    const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
    if(!res.ok) throw new Error((await res.json()).error || 'Request failed');
    return res.json();
}

// --- Components for Theme Editor (unchanged parts omitted for brevity, kept logic structure) ---
const ColorInput: React.FC<{
    label: string;
    colorKey: keyof M3Palette;
    value: string;
    onChange: (key: keyof M3Palette, value: string) => void;
}> = ({ label, colorKey, value, onChange }) => {
    const [isValid, setIsValid] = useState(true);
    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        onChange(colorKey, newValue);
        setIsValid(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(newValue));
    };

    return (
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
                    onChange={handleTextChange}
                    className={`w-full text-sm bg-surface-container-highest border rounded-lg focus:outline-none focus:ring-2 px-3 py-2 ${isValid ? 'border-outline focus:ring-primary' : 'border-error focus:ring-error'}`}
                    pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                    title="Enter a valid hex color code (e.g., #RRGGBB)"
                />
            </div>
        </div>
    );
};

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
    const { theme, saveTheme, resetTheme, isDbThemeEnabled } = useTheme();
    const { addToast } = useToast();
    const [editedTheme, setEditedTheme] = useState<Theme>(theme);
    const [activeMode, setActiveMode] = useState<'light' | 'dark'>('light');
    const [isSaving, setIsSaving] = useState(false);

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

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveTheme(editedTheme);
            addToast('Tema salvato con successo!', 'success');
        } catch (error) {
            addToast('Salvataggio del tema fallito.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = async () => {
        setIsSaving(true);
        try {
            await resetTheme();
            addToast('Tema ripristinato ai valori di default.', 'success');
        } catch (error) {
            addToast('Ripristino del tema fallito.', 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    if (!isDbThemeEnabled) {
        return (
             <div className="bg-surface-container rounded-2xl shadow p-6 mt-8">
                <h2 className="text-xl font-semibold mb-4">Personalizzazione Tema Material 3</h2>
                <div className="p-4 bg-yellow-container text-on-yellow-container rounded-lg">
                    <p>La personalizzazione del tema dal database è disattivata. Per abilitarla, imposta la chiave `theme.db.enabled` a `true` nella tabella `app_config` del database.</p>
                </div>
            </div>
        )
    }

    const isThemeChanged = JSON.stringify(theme) !== JSON.stringify(editedTheme);
    const isThemeDefault = JSON.stringify(theme.light) === JSON.stringify(defaultTheme.light) && JSON.stringify(theme.dark) === JSON.stringify(defaultTheme.dark);

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
                    disabled={isThemeDefault || isSaving}
                    className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low disabled:opacity-50 text-primary"
                >
                    {isSaving ? <SpinnerIcon className="w-5 h-5"/> : 'Ripristina Default'}
                </button>
                 <button 
                    onClick={handleSave}
                    disabled={!isThemeChanged || isSaving}
                    className="flex items-center justify-center px-6 py-2 bg-primary text-on-primary rounded-full disabled:opacity-50"
                >
                    {isSaving ? <SpinnerIcon className="w-5 h-5"/> : 'Salva Modifiche'}
                </button>
            </div>
        </div>
    );
};

const ToastEditor: React.FC = () => {
    return null;
};

const VisualizationEditor: React.FC = () => {
    const { theme, saveTheme: setTheme } = useTheme();
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
                <div className="space-y-4 p-4 border border-outline-variant rounded-2xl">
                    <h3 className="font-medium text-lg">Diagramma di Flusso (Sankey)</h3>
                    <SettingsSlider graph="sankey" param="nodeWidth" label="Larghezza Nodi" min={5} max={50} step={1} />
                    <SettingsSlider graph="sankey" param="nodePadding" label="Spaziatura Nodi" min={2} max={40} step={1} />
                    <SettingsSlider graph="sankey" param="linkOpacity" label="Opacità Flussi" min={0.1} max={1} step={0.1} />
                </div>
                
                <div className="space-y-4 p-4 border border-outline-variant rounded-2xl">
                    <h3 className="font-medium text-lg">Mappa delle Connessioni (Network)</h3>
                    <SettingsSlider graph="network" param="chargeStrength" label="Forza Repulsione" min={-2000} max={-50} step={50} />
                    <SettingsSlider graph="network" param="linkDistance" label="Distanza Link" min={30} max={500} step={10} />
                    <SettingsSlider graph="network" param="nodeRadius" label="Raggio Nodi" min={3} max={30} step={1} />
                    <SettingsSlider graph="network" param="centerStrength" label="Forza di Attrazione Centrale" min={0.01} max={0.2} step={0.01} />
                </div>
            </div>

            <div className="mt-8 flex justify-end space-x-3">
                <button onClick={handleReset} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary">Ripristina Default</button>
                 <button onClick={handleSave} disabled={!isChanged} className="px-6 py-2 bg-primary text-on-primary rounded-full disabled:opacity-50">Salva Modifiche</button>
            </div>
        </div>
    );
};

const DashboardLayoutEditor: React.FC = () => {
    const { addToast } = useToast();
    const [cardOrder, setCardOrder] = useState<DashboardCardId[]>([]);
    const [hasChanges, setHasChanges] = useState(false);
    const dragItem = React.useRef<number | null>(null);
    const dragOverItem = React.useRef<number | null>(null);

    useEffect(() => {
        try {
            const savedOrderJSON = localStorage.getItem(DASHBOARD_CARD_ORDER_STORAGE_KEY);
            const savedOrder: DashboardCardId[] = savedOrderJSON ? JSON.parse(savedOrderJSON) : DEFAULT_DASHBOARD_CARD_ORDER;
            const allKnownIds = new Set(DASHBOARD_CARDS_CONFIG.map(c => c.id));
            const validOrder = savedOrder.filter(id => allKnownIds.has(id));
            allKnownIds.forEach(id => { if (!new Set(savedOrder).has(id)) validOrder.push(id); });
            setCardOrder(validOrder);
        } catch (error) {
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
        dragItem.current = null; dragOverItem.current = null;
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
                        <div key={cardId} className="flex items-center p-4 border border-outline-variant rounded-xl bg-surface cursor-grab active:cursor-grabbing transition-shadow" draggable onDragStart={(e) => handleDragStart(e, index)} onDragEnter={(e) => handleDragEnter(e, index)} onDragEnd={handleDragEnd} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
                            <span className="material-symbols-outlined text-on-surface-variant mr-4">drag_indicator</span>
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
                <button onClick={handleSave} disabled={!hasChanges} className="px-6 py-2 bg-primary text-on-primary rounded-full disabled:opacity-50">Salva Ordine</button>
            </div>
        </div>
    );
};

// --- NEW COMPONENTS ---

const UserManagementSection: React.FC = () => {
    const { resources } = useEntitiesContext();
    const { addToast } = useToast();
    const [users, setUsers] = useState<(AppUser & { resourceName?: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPwdModalOpen, setIsPwdModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Partial<AppUser>>({});
    const [newPassword, setNewPassword] = useState('');
    
    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const data = await authFetch('/api/resources?entity=app-users');
            setUsers(data);
        } catch (error) {
            addToast('Errore caricamento utenti', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingUser.id) {
                // Update
                await authFetch(`/api/resources?entity=app-users&id=${editingUser.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(editingUser)
                });
                addToast('Utente aggiornato.', 'success');
            } else {
                // Create
                if (!newPassword) return addToast('Password richiesta per nuovi utenti', 'error');
                await authFetch('/api/resources?entity=app-users', {
                    method: 'POST',
                    body: JSON.stringify({ ...editingUser, password: newPassword })
                });
                addToast('Utente creato.', 'success');
            }
            setIsModalOpen(false);
            fetchUsers();
        } catch (error) {
            addToast(`Errore: ${(error as Error).message}`, 'error');
        }
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser.id || !newPassword) return;
        try {
            await authFetch(`/api/resources?entity=app-users&action=change_password&id=${editingUser.id}`, {
                method: 'PUT',
                body: JSON.stringify({ newPassword })
            });
            addToast('Password aggiornata.', 'success');
            setIsPwdModalOpen(false);
            setNewPassword('');
        } catch (error) {
            addToast('Errore cambio password.', 'error');
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (!window.confirm('Sei sicuro di voler eliminare questo utente?')) return;
        try {
            await authFetch(`/api/resources?entity=app-users&id=${id}`, { method: 'DELETE' });
            addToast('Utente eliminato.', 'success');
            fetchUsers();
        } catch (error) {
            addToast('Errore eliminazione.', 'error');
        }
    };

    const resourceOptions = resources.filter(r => !r.resigned).map(r => ({ value: r.id!, label: r.name }));

    return (
        <div className="bg-surface-container rounded-2xl shadow p-6 mt-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Gestione Utenti e Whitelist</h2>
                <button onClick={() => { setEditingUser({ role: 'SIMPLE', isActive: true }); setNewPassword(''); setIsModalOpen(true); }} className="px-4 py-2 bg-primary text-on-primary rounded-full shadow-sm text-sm font-semibold">Aggiungi Utente</button>
            </div>
            
            {loading ? <div className="p-4 text-center"><SpinnerIcon className="w-6 h-6 mx-auto text-primary"/></div> : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-surface-container-high border-b border-outline-variant">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-on-surface-variant">Username</th>
                                <th className="px-4 py-3 text-left font-medium text-on-surface-variant">Ruolo</th>
                                <th className="px-4 py-3 text-left font-medium text-on-surface-variant">Risorsa Collegata</th>
                                <th className="px-4 py-3 text-center font-medium text-on-surface-variant">Stato</th>
                                <th className="px-4 py-3 text-right font-medium text-on-surface-variant">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant">
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-surface-container">
                                    <td className="px-4 py-3 font-medium">{u.username}</td>
                                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-bold ${u.role === 'ADMIN' ? 'bg-error-container text-on-error-container' : u.role === 'MANAGER' ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-surface-variant text-on-surface-variant'}`}>{u.role}</span></td>
                                    <td className="px-4 py-3 text-on-surface-variant">{u.resourceName || '-'}</td>
                                    <td className="px-4 py-3 text-center">
                                        {u.isActive ? 
                                            <span className="text-green-600 font-bold text-xs">ATTIVO</span> : 
                                            <span className="text-error font-bold text-xs">BLOCCATO</span>
                                        }
                                    </td>
                                    <td className="px-4 py-3 text-right flex justify-end gap-2">
                                        <button onClick={() => { setEditingUser(u); setNewPassword(''); setIsPwdModalOpen(true); }} className="p-1 text-on-surface-variant hover:text-primary" title="Cambia Password"><span className="material-symbols-outlined text-lg">key</span></button>
                                        <button onClick={() => { setEditingUser(u); setNewPassword(''); setIsModalOpen(true); }} className="p-1 text-on-surface-variant hover:text-primary" title="Modifica"><span className="material-symbols-outlined text-lg">edit</span></button>
                                        {u.username !== 'admin' && (
                                            <button onClick={() => handleDeleteUser(u.id)} className="p-1 text-on-surface-variant hover:text-error" title="Elimina"><span className="material-symbols-outlined text-lg">delete</span></button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit/Create Modal */}
            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser.id ? 'Modifica Utente' : 'Nuovo Utente'}>
                    <form onSubmit={handleSaveUser} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-on-surface-variant">Username</label>
                            <input type="text" value={editingUser.username || ''} onChange={e => setEditingUser({...editingUser, username: e.target.value})} disabled={!!editingUser.id} className="form-input" required />
                        </div>
                        {!editingUser.id && (
                            <div>
                                <label className="block text-sm font-medium mb-1 text-on-surface-variant">Password</label>
                                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="form-input" required />
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium mb-1 text-on-surface-variant">Ruolo</label>
                            <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})} className="form-select">
                                <option value="SIMPLE">Simple User</option>
                                <option value="MANAGER">Manager</option>
                                <option value="ADMIN">Admin</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-on-surface-variant">Collega a Risorsa (Opzionale)</label>
                            <SearchableSelect name="resourceId" value={editingUser.resourceId || ''} onChange={(_, v) => setEditingUser({...editingUser, resourceId: v})} options={resourceOptions} placeholder="Nessuna" />
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={editingUser.isActive} onChange={e => setEditingUser({...editingUser, isActive: e.target.checked})} className="form-checkbox" />
                            <label className="text-sm text-on-surface">Utente Attivo (Whitelist)</label>
                        </div>
                        <div className="flex justify-end pt-4 space-x-2">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-outline rounded-full">Annulla</button>
                            <button type="submit" className="px-4 py-2 bg-primary text-on-primary rounded-full">Salva</button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Password Modal */}
            {isPwdModalOpen && (
                <Modal isOpen={isPwdModalOpen} onClose={() => setIsPwdModalOpen(false)} title={`Cambia Password per ${editingUser.username}`}>
                    <form onSubmit={handlePasswordReset} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-on-surface-variant">Nuova Password</label>
                            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="form-input" required minLength={6} />
                        </div>
                        <div className="flex justify-end pt-4 space-x-2">
                            <button type="button" onClick={() => setIsPwdModalOpen(false)} className="px-4 py-2 border border-outline rounded-full">Annulla</button>
                            <button type="submit" className="px-4 py-2 bg-primary text-on-primary rounded-full">Salva Password</button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

const PermissionMatrixSection: React.FC = () => {
    const { addToast } = useToast();
    const [permissions, setPermissions] = useState<RolePermission[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const pages = [
        '/staffing', '/workload', '/dashboard', '/leaves', '/resource-requests', '/interviews', 
        '/skills-map', '/manuale-utente', '/forecasting', '/gantt', '/skill-analysis', 
        '/reports', '/staffing-visualization', '/resources', '/skills', '/projects', 
        '/contracts', '/clients', '/roles', '/calendar', '/config', '/export', '/import'
    ];

    const fetchPermissions = useCallback(async () => {
        setLoading(true);
        try {
            const data = await authFetch('/api/resources?entity=role-permissions');
            setPermissions(data);
        } catch (error) {
            addToast('Errore caricamento permessi', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchPermissions();
    }, [fetchPermissions]);

    const isAllowed = (role: UserRole, path: string) => {
        return permissions.some(p => p.role === role && p.pagePath === path && p.allowed);
    };

    const handleToggle = (role: UserRole, path: string) => {
        setPermissions(prev => {
            const exists = prev.find(p => p.role === role && p.pagePath === path);
            if (exists) {
                return prev.map(p => p === exists ? { ...p, allowed: !p.allowed } : p);
            }
            return [...prev, { role, pagePath: path, allowed: true }];
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await authFetch('/api/resources?entity=role-permissions', {
                method: 'POST',
                body: JSON.stringify({ permissions })
            });
            addToast('Permessi salvati.', 'success');
        } catch (error) {
            addToast('Errore salvataggio permessi', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-surface-container rounded-2xl shadow p-6 mt-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Configurazione Permessi Ruoli</h2>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary text-on-primary rounded-full shadow-sm text-sm font-semibold flex items-center">
                    {saving && <SpinnerIcon className="w-4 h-4 mr-2"/>} Salva Matrice
                </button>
            </div>
            
            {loading ? <SpinnerIcon className="w-8 h-8 mx-auto"/> : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border-collapse">
                        <thead>
                            <tr>
                                <th className="text-left py-2 px-4 font-medium text-on-surface-variant">Pagina</th>
                                <th className="text-center py-2 px-4 font-medium text-on-surface-variant w-32">Simple User</th>
                                <th className="text-center py-2 px-4 font-medium text-on-surface-variant w-32">Manager</th>
                                <th className="text-center py-2 px-4 font-medium text-on-surface-variant w-32 opacity-50">Admin (Full)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant">
                            {pages.map(page => (
                                <tr key={page} className="hover:bg-surface-container">
                                    <td className="py-2 px-4 font-mono text-xs">{page}</td>
                                    <td className="py-2 px-4 text-center">
                                        <input type="checkbox" checked={isAllowed('SIMPLE', page)} onChange={() => handleToggle('SIMPLE', page)} className="form-checkbox"/>
                                    </td>
                                    <td className="py-2 px-4 text-center">
                                        <input type="checkbox" checked={isAllowed('MANAGER', page)} onChange={() => handleToggle('MANAGER', page)} className="form-checkbox"/>
                                    </td>
                                    <td className="py-2 px-4 text-center opacity-50">
                                        <input type="checkbox" checked readOnly className="form-checkbox cursor-not-allowed"/>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

const SkillThresholdsEditor: React.FC = () => {
    const { skillThresholds, updateSkillThresholds, isActionLoading } = useEntitiesContext();
    const [localThresholds, setLocalThresholds] = useState<SkillThresholds>(skillThresholds);
    
    useEffect(() => {
        setLocalThresholds(skillThresholds);
    }, [skillThresholds]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setLocalThresholds(prev => ({
            ...prev,
            [name]: parseInt(value, 10) || 0
        }));
    };

    const handleSave = () => {
        updateSkillThresholds(localThresholds);
    };

    const isLoading = isActionLoading('updateSkillThresholds');
    const isChanged = JSON.stringify(skillThresholds) !== JSON.stringify(localThresholds);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-6 mt-8">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h2 className="text-xl font-semibold">Soglie Livelli Competenze (FTE)</h2>
                    <p className="text-sm text-on-surface-variant mt-1">
                        Definisci il numero minimo di giorni lavorati (FTE totali) necessari per raggiungere automaticamente ogni livello di competenza inferita.
                    </p>
                </div>
                 <button 
                    onClick={handleSave}
                    disabled={!isChanged || isLoading}
                    className="px-4 py-2 bg-primary text-on-primary rounded-full disabled:opacity-50 flex items-center"
                >
                    {isLoading ? <SpinnerIcon className="w-4 h-4 mr-2"/> : null}
                    Salva
                </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                 <div className="p-3 border border-outline-variant rounded-xl bg-surface">
                    <label className="block text-sm font-medium text-on-surface mb-1">Novice (Liv. 1)</label>
                    <input 
                        type="number" 
                        name="NOVICE" 
                        value={localThresholds.NOVICE} 
                        onChange={handleChange}
                        className="w-full form-input"
                        min="0"
                    />
                </div>
                <div className="p-3 border border-outline-variant rounded-xl bg-surface">
                    <label className="block text-sm font-medium text-on-surface mb-1">Junior (Liv. 2)</label>
                    <input 
                        type="number" 
                        name="JUNIOR" 
                        value={localThresholds.JUNIOR} 
                        onChange={handleChange}
                        className="w-full form-input"
                        min="0"
                    />
                </div>
                <div className="p-3 border border-outline-variant rounded-xl bg-surface">
                    <label className="block text-sm font-medium text-on-surface mb-1">Middle (Liv. 3)</label>
                    <input 
                        type="number" 
                        name="MIDDLE" 
                        value={localThresholds.MIDDLE} 
                        onChange={handleChange}
                        className="w-full form-input"
                        min="0"
                    />
                </div>
                <div className="p-3 border border-outline-variant rounded-xl bg-surface">
                    <label className="block text-sm font-medium text-on-surface mb-1">Senior (Liv. 4)</label>
                    <input 
                        type="number" 
                        name="SENIOR" 
                        value={localThresholds.SENIOR} 
                        onChange={handleChange}
                        className="w-full form-input"
                        min="0"
                    />
                </div>
                <div className="p-3 border border-outline-variant rounded-xl bg-surface">
                    <label className="block text-sm font-medium text-on-surface mb-1">Expert (Liv. 5)</label>
                    <input 
                        type="number" 
                        name="EXPERT" 
                        value={localThresholds.EXPERT} 
                        onChange={handleChange}
                        className="w-full form-input"
                        min="0"
                    />
                </div>
            </div>
            <p className="text-xs text-on-surface-variant mt-3 italic">
                Nota: I livelli sono calcolati in ordine crescente. Assicurati che Novice &lt; Junior &lt; Middle &lt; Senior &lt; Expert.
            </p>
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
                <h2 className="text-xl font-semibold mb-4">Sicurezza Globale</h2>
                <div className="flex items-center justify-between p-4 border border-outline-variant rounded-xl">
                    <div>
                        <h3 className="font-medium text-on-surface">Protezione con Login</h3>
                        <p className="text-sm text-on-surface-variant">
                            Se attivata, l'accesso richiede autenticazione. Se disattivata, l'app è aperta a tutti (modalità dev).
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
            
            <UserManagementSection />
            <PermissionMatrixSection />
            <SkillThresholdsEditor />
            <DashboardLayoutEditor />
            <VisualizationEditor />
            <ThemeEditor />
        </div>
    );
};

export default AdminSettingsPage;