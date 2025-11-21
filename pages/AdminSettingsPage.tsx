
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { SpinnerIcon } from '../components/icons';
import Modal from '../components/Modal';
import { AppUser, RolePermission, SidebarItem } from '../types';

const AdminSettingsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState('general');

    const tabs = [
        { id: 'general', label: 'Generale', icon: 'settings' },
        { id: 'users', label: 'Utenti & Sicurezza', icon: 'security' },
        { id: 'menu', label: 'Menu & Navigazione', icon: 'menu_open' }, // NEW TAB
        { id: 'business', label: 'Logiche di Business', icon: 'domain' },
        { id: 'ui', label: 'Interfaccia & Tema', icon: 'palette' },
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-on-surface">Impostazioni Admin</h1>
            
            {/* Tabs Navigation */}
            <div className="flex border-b border-outline-variant overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors ${
                            activeTab === tab.id 
                                ? 'border-b-2 border-primary text-primary' 
                                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                        }`}
                    >
                        <span className="material-symbols-outlined mr-2 text-lg">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="py-4 animate-fade-in">
                {activeTab === 'general' && (
                    <div className="space-y-6">
                        <SecuritySection />
                    </div>
                )}
                
                {activeTab === 'users' && (
                    <div className="space-y-8">
                        <UserManagementSection />
                        <PermissionMatrixSection />
                    </div>
                )}

                {activeTab === 'menu' && (
                    <div className="space-y-6">
                        <MenuConfigurationEditor />
                    </div>
                )}

                {activeTab === 'business' && (
                    <div className="space-y-6">
                        <SkillThresholdsEditor />
                        <LeaveConfigurationEditor />
                    </div>
                )}

                {activeTab === 'ui' && (
                    <div className="space-y-6">
                        <ThemeSection />
                    </div>
                )}
            </div>
        </div>
    );
};

const SecuritySection: React.FC = () => {
    const { isLoginProtectionEnabled, toggleLoginProtection } = useAuth();
    const [loading, setLoading] = useState(false);

    const handleToggle = async () => {
        setLoading(true);
        try {
            await toggleLoginProtection(!isLoginProtectionEnabled);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-surface rounded-2xl shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-on-surface">Sicurezza Applicativa</h2>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-on-surface">Protezione Login Globale</p>
                    <p className="text-xs text-on-surface-variant mt-1">
                        Se disabilitato, l'applicazione sarà accessibile a tutti senza login (utile per debug o uso interno).
                        <br />
                        <strong>Nota:</strong> Le aree Admin rimarranno comunque protette.
                    </p>
                </div>
                <button
                    onClick={handleToggle}
                    disabled={loading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${isLoginProtectionEnabled ? 'bg-primary' : 'bg-surface-variant'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isLoginProtectionEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>
        </div>
    );
};

const MenuConfigurationEditor: React.FC = () => {
    const { sidebarConfig, updateSidebarConfig, isActionLoading } = require('../context/AppContext').useEntitiesContext();
    const { addToast } = useToast();
    const [config, setConfig] = useState<SidebarItem[]>(sidebarConfig);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => { setConfig(sidebarConfig); }, [sidebarConfig]);

    const handleChange = (index: number, field: keyof SidebarItem, value: string) => {
        const newConfig = [...config];
        newConfig[index] = { ...newConfig[index], [field]: value };
        setConfig(newConfig);
        setHasChanges(true);
    };

    const moveItem = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === config.length - 1) return;
        
        const newConfig = [...config];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newConfig[index], newConfig[targetIndex]] = [newConfig[targetIndex], newConfig[index]];
        setConfig(newConfig);
        setHasChanges(true);
    };

    const handleSave = async () => {
        try {
            await updateSidebarConfig(config);
            addToast('Configurazione menu salvata.', 'success');
            setHasChanges(false);
        } catch (error) {
            addToast('Errore salvataggio menu.', 'error');
        }
    };

    return (
        <div className="bg-surface rounded-2xl shadow p-6">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-xl font-semibold text-on-surface">Configurazione Menu Sidebar</h2>
                    <p className="text-xs text-on-surface-variant">Personalizza nomi, icone e ordine delle voci del menu.</p>
                </div>
                {hasChanges && (
                    <button onClick={handleSave} disabled={isActionLoading('updateSidebarConfig')} className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium flex items-center gap-2">
                        {isActionLoading('updateSidebarConfig') ? <SpinnerIcon className="w-4 h-4" /> : <><span className="material-symbols-outlined text-sm">save</span> Salva Modifiche</>}
                    </button>
                )}
            </div>

            <div className="border border-outline-variant rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-4 bg-surface-container-low p-3 font-bold text-xs text-on-surface-variant uppercase border-b border-outline-variant">
                    <div className="col-span-1 text-center">Ordine</div>
                    <div className="col-span-3">Etichetta</div>
                    <div className="col-span-3">Icona (Material Symbol)</div>
                    <div className="col-span-3">Sezione</div>
                    <div className="col-span-2 text-right">Path (Info)</div>
                </div>
                <div className="max-h-[600px] overflow-y-auto divide-y divide-outline-variant bg-surface">
                    {config.map((item, index) => (
                        <div key={item.path} className="grid grid-cols-12 gap-4 p-2 items-center hover:bg-surface-container-low transition-colors">
                            <div className="col-span-1 flex justify-center gap-1">
                                <button 
                                    onClick={() => moveItem(index, 'up')} 
                                    disabled={index === 0}
                                    className="p-1 rounded hover:bg-surface-container disabled:opacity-30 text-on-surface-variant"
                                >
                                    <span className="material-symbols-outlined text-lg">arrow_upward</span>
                                </button>
                                <button 
                                    onClick={() => moveItem(index, 'down')} 
                                    disabled={index === config.length - 1}
                                    className="p-1 rounded hover:bg-surface-container disabled:opacity-30 text-on-surface-variant"
                                >
                                    <span className="material-symbols-outlined text-lg">arrow_downward</span>
                                </button>
                            </div>
                            <div className="col-span-3">
                                <input 
                                    type="text" 
                                    value={item.label} 
                                    onChange={(e) => handleChange(index, 'label', e.target.value)}
                                    className="w-full bg-transparent border-b border-transparent hover:border-outline focus:border-primary text-sm text-on-surface outline-none px-1"
                                />
                            </div>
                            <div className="col-span-3 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">{item.icon}</span>
                                <input 
                                    type="text" 
                                    value={item.icon} 
                                    onChange={(e) => handleChange(index, 'icon', e.target.value)}
                                    className="w-full bg-transparent border-b border-transparent hover:border-outline focus:border-primary text-sm text-on-surface-variant outline-none px-1 font-mono"
                                />
                            </div>
                            <div className="col-span-3">
                                <select 
                                    value={item.section}
                                    onChange={(e) => handleChange(index, 'section', e.target.value)}
                                    className="w-full bg-transparent border-b border-transparent hover:border-outline focus:border-primary text-sm text-on-surface outline-none py-1"
                                >
                                    <option value="Principale">Principale</option>
                                    <option value="Progetti">Progetti</option>
                                    <option value="Risorse">Risorse</option>
                                    <option value="Operatività">Operatività</option>
                                    <option value="Supporto">Supporto</option>
                                    <option value="Configurazione">Configurazione</option>
                                    <option value="Dati">Dati</option>
                                </select>
                            </div>
                            <div className="col-span-2 text-right text-xs text-on-surface-variant font-mono truncate" title={item.path}>
                                {item.path}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const SkillThresholdsEditor: React.FC = () => {
    const { skillThresholds, updateSkillThresholds, isActionLoading } = require('../context/AppContext').useEntitiesContext();
    const [localThresholds, setLocalThresholds] = useState(skillThresholds);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => { setLocalThresholds(skillThresholds); }, [skillThresholds]);

    const handleChange = (key: string, val: string) => {
        setLocalThresholds((prev: any) => ({ ...prev, [key]: parseInt(val, 10) || 0 }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        await updateSkillThresholds(localThresholds);
        setHasChanges(false);
    };

    const levels = [
        { key: 'NOVICE', label: 'Novice' },
        { key: 'JUNIOR', label: 'Junior' },
        { key: 'MIDDLE', label: 'Middle' },
        { key: 'SENIOR', label: 'Senior' },
        { key: 'EXPERT', label: 'Expert' },
    ];

    return (
        <div className="bg-surface rounded-2xl shadow p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-on-surface">Soglie Livelli Competenza (FTE Totali)</h2>
                {hasChanges && (
                    <button onClick={handleSave} disabled={isActionLoading('updateSkillThresholds')} className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium">
                        {isActionLoading('updateSkillThresholds') ? <SpinnerIcon className="w-4 h-4" /> : 'Salva Soglie'}
                    </button>
                )}
            </div>
            <p className="text-sm text-on-surface-variant mb-4">Definisci il numero minimo di giorni/uomo (FTE) cumulativi necessari per raggiungere automaticamente un livello di competenza.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                {levels.map((lvl) => (
                    <div key={lvl.key} className="bg-surface-container p-3 rounded-lg">
                        <label className="block text-xs font-bold text-primary mb-1 uppercase">{lvl.label}</label>
                        <div className="flex items-center">
                            <span className="text-on-surface-variant text-sm mr-1">≥</span>
                            <input 
                                type="number" 
                                value={localThresholds[lvl.key]} 
                                onChange={(e) => handleChange(lvl.key, e.target.value)}
                                className="w-full bg-transparent border-b border-outline-variant focus:border-primary text-on-surface font-mono text-lg outline-none text-center"
                            />
                        </div>
                        <span className="text-[10px] text-on-surface-variant">giorni</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const LeaveConfigurationEditor: React.FC = () => {
    const { leaveTypes, addLeaveType, updateLeaveType, deleteLeaveType, isActionLoading } = require('../context/AppContext').useEntitiesContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingType, setEditingType] = useState<any>(null);

    const emptyType = { name: '', color: '#FFCC00', requiresApproval: true, affectsCapacity: true };

    const handleOpenModal = (type?: any) => {
        setEditingType(type || emptyType);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingType(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingType) return;
        try {
            if ('id' in editingType) await updateLeaveType(editingType);
            else await addLeaveType(editingType);
            handleCloseModal();
        } catch (error) {}
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setEditingType((prev: any) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    return (
        <div className="bg-surface rounded-2xl shadow p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-on-surface">Tipologie Assenza</h2>
                <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-primary text-on-primary text-sm font-semibold rounded-full shadow-sm">
                    Aggiungi
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-surface-container-low">
                        <tr>
                            <th className="px-4 py-2 text-left">Nome</th>
                            <th className="px-4 py-2 text-center">Colore</th>
                            <th className="px-4 py-2 text-center">Workflow</th>
                            <th className="px-4 py-2 text-center">Impatto Capacità</th>
                            <th className="px-4 py-2 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                        {leaveTypes.map((type: any) => (
                            <tr key={type.id}>
                                <td className="px-4 py-2 font-medium text-on-surface">{type.name}</td>
                                <td className="px-4 py-2 text-center">
                                    <div className="w-6 h-6 rounded-full mx-auto border border-outline-variant" style={{ backgroundColor: type.color }}></div>
                                </td>
                                <td className="px-4 py-2 text-center text-xs">
                                    {type.requiresApproval ? <span className="px-2 py-1 bg-yellow-container text-on-yellow-container rounded-full">Approvazione</span> : <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">Auto</span>}
                                </td>
                                <td className="px-4 py-2 text-center text-xs">
                                    {type.affectsCapacity ? <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full font-bold">-1 G/U</span> : <span className="px-2 py-1 bg-surface-variant text-on-surface-variant rounded-full">Neutro</span>}
                                </td>
                                <td className="px-4 py-2 text-right">
                                    <button onClick={() => handleOpenModal(type)} className="text-primary hover:underline mr-3">Modifica</button>
                                    <button onClick={() => deleteLeaveType(type.id)} disabled={isActionLoading(`deleteLeaveType-${type.id}`)} className="text-error hover:underline">
                                        {isActionLoading(`deleteLeaveType-${type.id}`) ? '...' : 'Elimina'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editingType && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingType.id ? 'Modifica Tipologia' : 'Nuova Tipologia'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Nome *</label>
                            <input type="text" name="name" value={editingType.name} onChange={handleChange} required className="form-input" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Colore *</label>
                            <div className="flex gap-2">
                                <input type="color" name="color" value={editingType.color} onChange={handleChange} className="h-10 w-10 p-0 border-0 rounded" />
                                <input type="text" name="color" value={editingType.color} onChange={handleChange} className="form-input flex-grow" />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" name="requiresApproval" checked={editingType.requiresApproval} onChange={handleChange} className="form-checkbox" />
                            <label className="text-sm">Richiede Approvazione Manager</label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" name="affectsCapacity" checked={editingType.affectsCapacity} onChange={handleChange} className="form-checkbox" />
                            <label className="text-sm">Riduce la disponibilità (Capacità)</label>
                        </div>
                        <div className="flex justify-end space-x-2 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 border rounded text-primary">Annulla</button>
                            <button type="submit" className="px-4 py-2 bg-primary text-on-primary rounded">Salva</button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

const ThemeSection: React.FC = () => {
    const { theme, saveTheme, resetTheme, isDbThemeEnabled, mode, toggleMode } = useTheme();
    const [localTheme, setLocalTheme] = useState(theme);
    const { addToast } = useToast();
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setLocalTheme(theme);
    }, [theme]);

    const handleColorChange = (modeKey: 'light' | 'dark', key: string, value: string) => {
        setLocalTheme(prev => ({
            ...prev,
            [modeKey]: {
                ...prev[modeKey],
                [key]: value
            }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveTheme(localTheme);
            addToast('Tema salvato con successo.', 'success');
        } catch (e) {
            addToast('Errore nel salvataggio del tema.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (window.confirm('Sei sicuro di voler ripristinare il tema di default?')) {
            setSaving(true);
            try {
                await resetTheme();
                addToast('Tema ripristinato.', 'success');
            } catch (e) {
                addToast('Errore nel ripristino.', 'error');
            } finally {
                setSaving(false);
            }
        }
    };

    return (
        <div className="bg-surface rounded-2xl shadow p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-on-surface">Personalizzazione Tema</h2>
                <div className="flex items-center gap-3">
                    <button onClick={toggleMode} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant">
                        <span className="material-symbols-outlined">{mode === 'light' ? 'dark_mode' : 'light_mode'}</span>
                    </button>
                    <button onClick={handleReset} className="text-error text-sm hover:underline" disabled={saving}>Ripristina Default</button>
                    <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium disabled:opacity-50">
                        {saving ? <SpinnerIcon className="w-4 h-4" /> : 'Salva Modifiche'}
                    </button>
                </div>
            </div>
            
            {!isDbThemeEnabled && (
                <div className="mb-4 p-3 bg-yellow-container text-on-yellow-container rounded text-sm">
                    La persistenza del tema su DB è disabilitata. Le modifiche saranno perse al riavvio.
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="font-medium text-on-surface mb-3">Colori Chiari (Light Mode)</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(localTheme.light).slice(0, 8).map(([key, val]) => (
                            <div key={key} className="flex items-center gap-2">
                                <input type="color" value={val as string} onChange={(e) => handleColorChange('light', key, e.target.value)} className="h-8 w-8 rounded cursor-pointer border-0 p-0"/>
                                <span className="text-xs text-on-surface-variant truncate">{key}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <h3 className="font-medium text-on-surface mb-3">Colori Scuri (Dark Mode)</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(localTheme.dark).slice(0, 8).map(([key, val]) => (
                            <div key={key} className="flex items-center gap-2">
                                <input type="color" value={val as string} onChange={(e) => handleColorChange('dark', key, e.target.value)} className="h-8 w-8 rounded cursor-pointer border-0 p-0"/>
                                <span className="text-xs text-on-surface-variant truncate">{key}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const PermissionMatrixSection: React.FC = () => {
    const { addToast } = useToast();
    const [permissions, setPermissions] = useState<RolePermission[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // List of ALL known pages that can be controlled
    const pages = [
        '/staffing', '/workload', '/dashboard', '/leaves', '/resource-requests', '/interviews', 
        '/skills-map', '/manuale-utente', '/simple-user-manual', '/forecasting', '/gantt', '/skill-analysis', 
        '/reports', '/staffing-visualization', '/resources', '/skills', '/projects', 
        '/contracts', '/clients', '/roles', '/calendar', '/config', '/export', '/import', '/test-staffing'
    ];

    const fetchPermissions = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch('/api/resources?entity=role-permissions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setPermissions(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPermissions();
    }, [fetchPermissions]);

    const handleToggle = (role: 'SIMPLE' | 'MANAGER', pagePath: string) => {
        setPermissions(prev => {
            const existing = prev.find(p => p.role === role && p.pagePath === pagePath);
            if (existing) {
                // Toggle existing
                return prev.map(p => p.role === role && p.pagePath === pagePath ? { ...p, allowed: !p.allowed } : p);
            } else {
                // Add new entry if it didn't exist in local state
                return [...prev, { role, pagePath, allowed: true }];
            }
        });
    };

    const savePermissions = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('authToken');
            // Prepare payload: We send the full state for known pages to ensure consistency
            const payload = [];
            for (const page of pages) {
                // SIMPLE
                const simpleAllowed = isAllowed('SIMPLE', page);
                payload.push({ role: 'SIMPLE', pagePath: page, allowed: simpleAllowed });
                // MANAGER
                const managerAllowed = isAllowed('MANAGER', page);
                payload.push({ role: 'MANAGER', pagePath: page, allowed: managerAllowed });
            }

            const res = await fetch('/api/resources?entity=role-permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ permissions: payload })
            });

            if (!res.ok) throw new Error();
            
            const responseData = await res.json();
            
            // UPDATE STATE WITH REAL SERVER DATA FOR VERIFICATION
            if (responseData.permissions) {
                setPermissions(responseData.permissions);
            }

            addToast('Permessi aggiornati e verificati.', 'success');
        } catch (e) {
            addToast('Errore salvataggio permessi.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const isAllowed = (role: 'SIMPLE' | 'MANAGER', pagePath: string) => {
        const perm = permissions.find(p => p.role === role && p.pagePath === pagePath);
        // If not found in DB state, default to FALSE for safety
        return perm ? perm.allowed : false;
    };

    if (loading) return <div className="p-4"><SpinnerIcon className="w-6 h-6 text-primary" /></div>;

    return (
        <div className="bg-surface rounded-2xl shadow p-6">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-xl font-semibold text-on-surface">Matrice Permessi (RBAC)</h2>
                    <p className="text-xs text-on-surface-variant mt-1">I permessi salvati vengono verificati automaticamente dal server.</p>
                </div>
                <button onClick={savePermissions} disabled={saving} className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                    {saving ? <SpinnerIcon className="w-4 h-4" /> : <span className="material-symbols-outlined text-lg">save</span>}
                    Salva & Verifica
                </button>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-outline-variant rounded-lg">
                <table className="min-w-full text-sm">
                    <thead className="bg-surface-container sticky top-0 z-10">
                        <tr className="border-b border-outline-variant">
                            <th className="text-left py-3 px-4 font-medium text-on-surface-variant">Pagina</th>
                            <th className="text-center py-3 px-4 font-medium text-on-surface-variant w-32">Simple User</th>
                            <th className="text-center py-3 px-4 font-medium text-on-surface-variant w-32">Manager</th>
                            <th className="text-center py-3 px-4 font-medium text-on-surface-variant w-32 opacity-50">Admin (Full)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant bg-surface">
                        {pages.map(page => (
                            <tr key={page} className="hover:bg-surface-container-low transition-colors">
                                <td className="py-2 px-4 text-on-surface font-mono text-xs">{page}</td>
                                <td className="text-center py-2">
                                    <input 
                                        type="checkbox" 
                                        checked={isAllowed('SIMPLE', page)} 
                                        onChange={() => handleToggle('SIMPLE', page)} 
                                        className="form-checkbox text-primary rounded cursor-pointer w-5 h-5" 
                                    />
                                </td>
                                <td className="text-center py-2">
                                    <input 
                                        type="checkbox" 
                                        checked={isAllowed('MANAGER', page)} 
                                        onChange={() => handleToggle('MANAGER', page)} 
                                        className="form-checkbox text-primary rounded cursor-pointer w-5 h-5" 
                                    />
                                </td>
                                <td className="text-center py-2">
                                    <input type="checkbox" checked disabled className="form-checkbox text-gray-400 rounded opacity-30 w-5 h-5" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const UserManagementSection: React.FC = () => {
    const { addToast } = useToast();
    const [users, setUsers] = useState<AppUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Editing State
    const [formData, setFormData] = useState({
        id: '',
        username: '',
        password: '',
        role: 'SIMPLE' as 'SIMPLE' | 'MANAGER' | 'ADMIN',
        isActive: true,
        resourceId: ''
    });

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch('/api/resources?entity=app-users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('authToken');
            const method = formData.id ? 'PUT' : 'POST';
            const url = formData.id 
                ? `/api/resources?entity=app-users&id=${formData.id}`
                : '/api/resources?entity=app-users';
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(formData)
            });

            if (!res.ok) throw new Error();
            addToast('Utente salvato.', 'success');
            setIsModalOpen(false);
            fetchUsers();
        } catch {
            addToast('Errore salvataggio utente.', 'error');
        }
    };

    const handleDeleteUser = async (id: string) => {
        if(!window.confirm('Eliminare utente?')) return;
        try {
            const token = localStorage.getItem('authToken');
            await fetch(`/api/resources?entity=app-users&id=${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            addToast('Utente eliminato.', 'success');
            fetchUsers();
        } catch {
            addToast('Errore eliminazione.', 'error');
        }
    };

    const openNew = () => {
        setFormData({ id: '', username: '', password: '', role: 'SIMPLE', isActive: true, resourceId: '' });
        setIsModalOpen(true);
    };

    const openEdit = (user: AppUser) => {
        setFormData({
            id: user.id,
            username: user.username,
            password: '', // Leave blank to not change
            role: user.role,
            isActive: user.isActive,
            resourceId: user.resourceId || ''
        });
        setIsModalOpen(true);
    };

    return (
        <div className="bg-surface rounded-2xl shadow p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-on-surface">Gestione Utenti</h2>
                <button onClick={openNew} className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium">Nuovo Utente</button>
            </div>
            
            {loading ? <SpinnerIcon className="w-6 h-6 text-primary mx-auto" /> : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="border-b border-outline-variant">
                                <th className="text-left py-2 px-4 font-medium text-on-surface-variant">Username</th>
                                <th className="text-left py-2 px-4 font-medium text-on-surface-variant">Ruolo</th>
                                <th className="text-center py-2 px-4 font-medium text-on-surface-variant">Attivo</th>
                                <th className="text-right py-2 px-4 font-medium text-on-surface-variant">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant">
                            {users.map(u => (
                                <tr key={u.id}>
                                    <td className="py-2 px-4 text-on-surface">{u.username}</td>
                                    <td className="py-2 px-4 text-on-surface-variant">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${u.role === 'ADMIN' ? 'bg-error-container text-on-error-container' : u.role === 'MANAGER' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-on-surface'}`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="py-2 px-4 text-center">
                                        {u.isActive ? <span className="text-green-600 material-symbols-outlined text-sm">check_circle</span> : <span className="text-gray-400 material-symbols-outlined text-sm">cancel</span>}
                                    </td>
                                    <td className="py-2 px-4 text-right space-x-2">
                                        <button onClick={() => openEdit(u)} className="text-primary hover:underline">Modifica</button>
                                        {u.username !== 'admin' && <button onClick={() => handleDeleteUser(u.id)} className="text-error hover:underline">Elimina</button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={formData.id ? 'Modifica Utente' : 'Nuovo Utente'}>
                    <form onSubmit={handleSaveUser} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Username</label>
                            <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="form-input" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Password {formData.id && '(Lascia vuoto per non cambiare)'}</label>
                            <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="form-input" required={!formData.id} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Ruolo</label>
                            <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})} className="form-select">
                                <option value="SIMPLE">Simple User</option>
                                <option value="MANAGER">Manager</option>
                                <option value="ADMIN">Admin</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Collega a Risorsa (Opzionale)</label>
                            <input type="text" value={formData.resourceId} onChange={e => setFormData({...formData, resourceId: e.target.value})} className="form-input" placeholder="UUID Risorsa (per My Requests)" />
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="form-checkbox" />
                            <label className="text-sm text-on-surface">Utente Attivo</label>
                        </div>
                        <div className="flex justify-end space-x-2 pt-4">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-outline rounded-full text-primary">Annulla</button>
                            <button type="submit" className="px-4 py-2 bg-primary text-on-primary rounded-full">Salva</button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default AdminSettingsPage;
