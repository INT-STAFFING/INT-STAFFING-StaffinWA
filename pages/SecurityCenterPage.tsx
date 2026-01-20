
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEntitiesContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { SpinnerIcon } from '../components/icons';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { AppUser, RolePermission, UserRole, AuditLogEntry } from '../types';
import { authorizedJsonFetch } from '../utils/api';
import { routesManifest } from '../routes';
import { useAuthorizedResource, createAuthorizedFetcher } from '../hooks/useAuthorizedResource';

// --- PILASTRO 1: GESTIONE IDENTITÀ ---
const IdentityPillar: React.FC = () => {
    const { data: users, loading, updateCache } = useAuthorizedResource<AppUser[]>(
        'security-users',
        createAuthorizedFetcher<AppUser[]>('/api/resources?entity=app-users')
    );
    const { resources } = useEntitiesContext();
    const { addToast } = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Partial<AppUser>>({});

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const isNew = !editingUser.id;
        try {
            const url = `/api/resources?entity=app-users${isNew ? '' : `&id=${editingUser.id}`}`;
            const saved = await authorizedJsonFetch<AppUser>(url, {
                method: isNew ? 'POST' : 'PUT',
                body: JSON.stringify(editingUser)
            });
            updateCache(prev => isNew ? [...(prev || []), saved as any] : (prev || []).map(u => u.id === saved.id ? saved as any : u));
            addToast('Utente salvato con successo', 'success');
            setIsModalOpen(false);
        } catch (e) { addToast('Errore durante il salvataggio utente', 'error'); }
    };

    const resourceOptions = useMemo(() => resources.map(r => ({ value: r.id!, label: r.name })), [resources]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-bold text-on-surface">Gestione Identità</h3>
                    <p className="text-sm text-on-surface-variant">Anagrafica accessi e whitelist utenti.</p>
                </div>
                <button onClick={() => { setEditingUser({ role: 'SIMPLE', isActive: true }); setIsModalOpen(true); }} className="px-5 py-2 bg-primary text-on-primary rounded-full text-sm font-bold flex items-center gap-2 shadow-lg">
                    <span className="material-symbols-outlined">person_add</span> Nuovo Utente
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? <div className="col-span-full flex justify-center py-12"><SpinnerIcon className="w-10 h-10 text-primary" /></div> : users?.map(u => (
                    <div key={u.id} className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant shadow-sm hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                                    {u.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-bold text-on-surface text-lg">{u.username}</p>
                                    <p className="text-xs text-primary font-bold uppercase tracking-widest">{u.role}</p>
                                </div>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-tighter ${u.isActive ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-error-container text-on-error-container'}`}>
                                {u.isActive ? 'ATTIVO' : 'DISABILITATO'}
                            </span>
                        </div>
                        <div className="pt-4 border-t border-outline-variant flex justify-between items-center">
                             <button className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">visibility</span> Impersonifica
                             </button>
                             <button onClick={() => { setEditingUser(u); setIsModalOpen(true); }} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant">
                                <span className="material-symbols-outlined">edit</span>
                             </button>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Profilo Utente">
                    <form onSubmit={handleSave} className="space-y-5">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold mb-1 text-on-surface-variant">Username</label>
                                <input type="text" value={editingUser.username || ''} onChange={e => setEditingUser({...editingUser, username: e.target.value})} className="form-input" required placeholder="mario.rossi" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 text-on-surface-variant">Ruolo Sistema</label>
                                <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as any})} className="form-select">
                                    <option value="SIMPLE">Simple User</option>
                                    <option value="MANAGER">Manager</option>
                                    <option value="SENIOR MANAGER">Senior Manager</option>
                                    <option value="MANAGING DIRECTOR">Managing Director</option>
                                    <option value="ADMIN">Administrator</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 text-on-surface-variant">Associa a Risorsa</label>
                                <SearchableSelect name="resourceId" value={editingUser.resourceId || ''} onChange={(_, v) => setEditingUser({...editingUser, resourceId: v})} options={resourceOptions} placeholder="Seleziona risorsa..." />
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-surface-container rounded-2xl">
                                <input type="checkbox" checked={editingUser.isActive} onChange={e => setEditingUser({...editingUser, isActive: e.target.checked})} className="form-checkbox h-6 w-6" id="user-active" />
                                <label htmlFor="user-active" className="text-sm font-bold">Account Abilitato all'accesso</label>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-full font-bold text-on-surface-variant">Annulla</button>
                            <button type="submit" className="px-8 py-2 bg-primary text-on-primary rounded-full font-bold shadow-lg">Salva Profilo</button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

// --- PILASTRO 2: MATRICE RBAC UNIFICATA ---
const RBACPillar: React.FC = () => {
    const { data: permissionsData, loading, updateCache } = useAuthorizedResource<RolePermission[]>(
        'security-rbac',
        createAuthorizedFetcher<RolePermission[]>('/api/resources?entity=role-permissions')
    );
    const { pageVisibility, updatePageVisibility } = useEntitiesContext();
    const { addToast } = useToast();
    
    const ROLES: UserRole[] = ['SIMPLE', 'MANAGER', 'SENIOR MANAGER', 'MANAGING DIRECTOR'];
    const manageableRoutes = useMemo(() => 
        routesManifest.filter(r => r.requiresAuth !== false).sort((a,b) => a.label.localeCompare(b.label)),
    []);

    const handleTogglePerm = (role: UserRole, path: string) => {
        updateCache(prev => {
            const list = prev || [];
            const idx = list.findIndex(x => x.role === role && x.pagePath === path);
            const newList = [...list];
            if (idx >= 0) newList[idx] = { ...newList[idx], allowed: !newList[idx].allowed };
            else newList.push({ role, pagePath: path, allowed: true });
            return newList;
        });
    };

    const handleToggleVisibility = (path: string) => {
        const nextVisibility = { ...pageVisibility, [path]: !pageVisibility[path] };
        updatePageVisibility(nextVisibility);
    };

    const handleSave = async () => {
        try {
            await authorizedJsonFetch('/api/resources?entity=role-permissions', {
                method: 'POST',
                body: JSON.stringify({ permissions: permissionsData })
            });
            addToast('Matrice dei permessi salvata con successo', 'success');
        } catch (e) { addToast('Errore nel salvataggio della matrice', 'error'); }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h3 className="text-2xl font-bold text-on-surface">Matrice Accessi Unificata</h3>
                    <p className="text-sm text-on-surface-variant">Configura chi può vedere cosa e quali moduli sono riservati esclusivamente agli amministratori.</p>
                </div>
                <button onClick={handleSave} className="px-6 py-2 bg-primary text-on-primary rounded-full font-bold flex items-center gap-2 shadow-lg">
                    <span className="material-symbols-outlined">save</span> Salva Configurazione
                </button>
            </div>

            <div className="border border-outline-variant rounded-[2rem] overflow-hidden bg-surface shadow-inner">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-surface-container-high">
                            <tr className="border-b border-outline-variant">
                                <th className="px-6 py-5 text-left font-black uppercase text-[10px] tracking-widest text-on-surface-variant">Modulo / Percorso</th>
                                <th className="px-2 py-5 text-center font-black uppercase text-[10px] tracking-widest text-error">Solo Admin</th>
                                {ROLES.map(role => (
                                    <th key={role} className="px-2 py-5 text-center font-black uppercase text-[10px] tracking-widest text-on-surface-variant w-24">
                                        {role.replace('MANAGING ', 'M.').substring(0, 10)}
                                    </th>
                                ))}
                                <th className="px-4 py-5 text-center font-black uppercase text-[10px] tracking-widest bg-primary/5 text-primary">Admin</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant">
                            {manageableRoutes.map(route => {
                                const isAdminOnly = pageVisibility[route.path];
                                const isRouteCritical = route.path === '/security-center';

                                return (
                                    <tr key={route.path} className="hover:bg-surface-container-low transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <span className="material-symbols-outlined text-primary/60">{route.icon}</span>
                                                <div>
                                                    <p className="font-bold text-on-surface">{route.label}</p>
                                                    <p className="text-[10px] font-mono text-on-surface-variant">{route.path}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-2 py-4 text-center">
                                            <input 
                                                type="checkbox" 
                                                checked={!!isAdminOnly} 
                                                disabled={isRouteCritical}
                                                onChange={() => handleToggleVisibility(route.path)}
                                                className="form-checkbox h-5 w-5 rounded-lg border-error/30 text-error focus:ring-error"
                                            />
                                        </td>
                                        {ROLES.map(role => {
                                            const allowed = permissionsData?.find(x => x.role === role && x.pagePath === route.path)?.allowed;
                                            return (
                                                <td key={role} className="px-2 py-4 text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={!!allowed && !isAdminOnly} 
                                                        disabled={isAdminOnly || isRouteCritical}
                                                        onChange={() => handleTogglePerm(role, route.path)}
                                                        className={`form-checkbox h-5 w-5 rounded-lg transition-opacity ${isAdminOnly ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}`}
                                                    />
                                                </td>
                                            );
                                        })}
                                        <td className="px-4 py-4 text-center bg-primary/5">
                                            <span className="material-symbols-outlined text-primary text-xl">verified_user</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- PILASTRO 3: NAVIGAZIONE E ARCHITETTURA ---
const NavigationPillar: React.FC = () => {
    const { sidebarConfig, updateSidebarConfig, roleHomePages, updateRoleHomePages } = useEntitiesContext();
    const { addToast } = useToast();
    const [localSidebar, setLocalSidebar] = useState(sidebarConfig);
    
    const ROLES: UserRole[] = ['SIMPLE', 'MANAGER', 'SENIOR MANAGER', 'MANAGING DIRECTOR', 'ADMIN'];
    const availablePages = useMemo(() => 
        routesManifest.filter(r => r.requiresAuth !== false).sort((a,b) => a.label.localeCompare(b.label)),
    []);

    const handleSaveMenu = async () => {
        await updateSidebarConfig(localSidebar);
        addToast('Struttura menu aggiornata', 'success');
    };

    return (
        <div className="space-y-10">
            <section>
                <div className="mb-6">
                    <h3 className="text-2xl font-bold text-on-surface">Pagine di Atterraggio</h3>
                    <p className="text-sm text-on-surface-variant">Definisci la Home Page predefinita per ogni ruolo utente.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {ROLES.map(role => (
                        <div key={role} className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant shadow-sm">
                            <label className="block text-[10px] font-black text-primary mb-3 uppercase tracking-widest">Home per {role}</label>
                            <select 
                                value={roleHomePages[role] || '/staffing'} 
                                onChange={e => updateRoleHomePages({...roleHomePages, [role]: e.target.value})}
                                className="form-select text-sm font-bold bg-transparent border-primary/20"
                            >
                                {availablePages.map(p => <option key={p.path} value={p.path}>{p.label}</option>)}
                            </select>
                        </div>
                    ))}
                </div>
            </section>

            <section>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-2xl font-bold text-on-surface">Struttura Sidebar</h3>
                        <p className="text-sm text-on-surface-variant">Personalizza etichette e icone visualizzate nel menu principale.</p>
                    </div>
                    <button onClick={handleSaveMenu} className="px-6 py-2 bg-primary text-on-primary rounded-full font-bold shadow-lg">Salva Ordinamento</button>
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant rounded-[2rem] shadow-inner max-h-[500px] overflow-y-auto">
                    {localSidebar.map((item, idx) => (
                        <div key={item.path} className="flex items-center gap-5 p-4 border-b border-outline-variant hover:bg-surface-container-low transition-colors">
                            <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface-variant">
                                <span className="material-symbols-outlined">{item.icon}</span>
                            </div>
                            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input 
                                    type="text" 
                                    value={item.label} 
                                    onChange={e => {
                                        const next = [...localSidebar];
                                        next[idx] = { ...item, label: e.target.value };
                                        setLocalSidebar(next);
                                    }} 
                                    className="bg-transparent font-bold text-on-surface border-none focus:ring-0 p-0"
                                    placeholder="Etichetta menu"
                                />
                                <div className="flex items-center gap-2 text-[10px] font-mono text-on-surface-variant">
                                    <span className="material-symbols-outlined text-sm">link</span>
                                    {item.path}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${
                                    item.section === 'Amministrazione' ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container'
                                }`}>
                                    {item.section}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

// --- PILASTRO 4: AUDIT E SICUREZZA GLOBALE ---
const AuditPillar: React.FC = () => {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const { isLoginProtectionEnabled, toggleLoginProtection } = useAuth();

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const data = await authorizedJsonFetch<AuditLogEntry[]>('/api/resources?entity=audit_logs&limit=50');
            setLogs(data);
        } catch(e) {} finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    return (
        <div className="space-y-10">
            <section className="bg-error-container/10 p-6 rounded-[2rem] border border-error/20">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-error">Sicurezza Globale</h3>
                        <p className="text-sm text-on-surface-variant">Impostazioni critiche per l'intera infrastruttura.</p>
                    </div>
                    <div className="flex items-center gap-4 bg-surface p-3 rounded-2xl shadow-sm border border-outline-variant">
                         <span className="text-sm font-bold">Protezione Login</span>
                         <button 
                            onClick={() => toggleLoginProtection(!isLoginProtectionEnabled)}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${isLoginProtectionEnabled ? 'bg-primary' : 'bg-outline'}`}
                         >
                            <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${isLoginProtectionEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
                         </button>
                    </div>
                </div>
            </section>

            <section>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-on-surface">Registro Attività (Audit)</h3>
                    <button onClick={fetchLogs} className="p-2 rounded-full hover:bg-surface-container text-primary">
                        <span className="material-symbols-outlined">refresh</span>
                    </button>
                </div>
                <div className="overflow-hidden border border-outline-variant rounded-[2rem] bg-surface shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                            <thead className="bg-surface-container text-on-surface-variant font-black uppercase tracking-widest">
                                <tr>
                                    <th className="px-6 py-4 text-left">Data e Ora</th>
                                    <th className="px-6 py-4 text-left">Soggetto</th>
                                    <th className="px-6 py-4 text-left">Evento</th>
                                    <th className="px-6 py-4 text-left">Metadati</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant">
                                {loading ? (
                                    <tr><td colSpan={4} className="p-12 text-center"><SpinnerIcon className="w-8 h-8 mx-auto text-primary" /></td></tr>
                                ) : logs.length === 0 ? (
                                    <tr><td colSpan={4} className="p-12 text-center text-on-surface-variant font-bold italic">Nessun log recente trovato.</td></tr>
                                ) : logs.map(log => (
                                    <tr key={log.id} className="hover:bg-surface-container-low transition-colors">
                                        <td className="px-6 py-3 font-mono text-on-surface-variant">{new Date(log.createdAt).toLocaleString('it-IT')}</td>
                                        <td className="px-6 py-3">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-on-surface">{log.username}</span>
                                                <span className="text-[10px] opacity-60 font-mono">{log.ipAddress}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`px-2 py-0.5 rounded font-black tracking-tighter ${
                                                log.action.includes('FAIL') ? 'bg-error-container text-on-error-container' : 'bg-surface-container-high'
                                            }`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="max-w-[300px] truncate font-mono text-[10px] opacity-70" title={JSON.stringify(log.details)}>
                                                {JSON.stringify(log.details)}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
};

// --- PAGINA PRINCIPALE SECURITY CENTER ---
const SecurityCenterPage: React.FC = () => {
    const [activePillar, setActivePillar] = useState<'id' | 'rbac' | 'nav' | 'audit'>('rbac');

    const pillars = [
        { id: 'rbac', label: 'Access Control Matrix', icon: 'security', desc: 'Rotte e Ruoli' },
        { id: 'id', label: 'Identity & Users', icon: 'badge', desc: 'Whitelist Utenti' },
        { id: 'nav', label: 'App Architecture', icon: 'account_tree', desc: 'Menu e Landing' },
        { id: 'audit', label: 'Security Audit', icon: 'policy', desc: 'Log di sistema' },
    ];

    return (
        <div className="flex h-full flex-col lg:flex-row gap-8">
            {/* Sidebar di Navigazione Interna */}
            <div className="lg:w-80 flex-shrink-0 space-y-3">
                <div className="p-2 mb-6">
                    <h1 className="text-3xl font-black text-primary tracking-tighter italic">SECURITY<span className="text-on-surface font-normal">CENTER</span></h1>
                    <p className="text-xs font-bold text-on-surface-variant opacity-60 uppercase tracking-widest mt-1">Control Panel v2.0</p>
                </div>
                
                {pillars.map(p => (
                    <button
                        key={p.id}
                        onClick={() => setActivePillar(p.id as any)}
                        className={`w-full flex items-center gap-4 px-6 py-5 rounded-[2rem] font-bold text-left transition-all duration-300 group ${
                            activePillar === p.id 
                                ? 'bg-primary text-on-primary shadow-xl scale-105' 
                                : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant'
                        }`}
                    >
                        <span className={`material-symbols-outlined text-2xl ${activePillar === p.id ? 'text-on-primary' : 'text-primary'}`}>
                            {p.icon}
                        </span>
                        <div>
                            <p className="text-sm leading-none mb-1">{p.label}</p>
                            <p className={`text-[10px] font-normal uppercase tracking-widest opacity-60 ${activePillar === p.id ? 'text-on-primary' : ''}`}>
                                {p.desc}
                            </p>
                        </div>
                    </button>
                ))}
                
                <div className="mt-12 p-6 bg-error-container/10 border border-error/10 rounded-[2.5rem] relative overflow-hidden">
                    <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-7xl text-error/5 rotate-12">lock_open</span>
                    <p className="text-[10px] font-black text-error uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span> Safety Lock Active
                    </p>
                    <p className="text-[10px] text-on-surface-variant leading-relaxed font-bold">
                        Accesso permanente garantito al ruolo ADMIN. Le modifiche ai permessi critici richiedono ricaricamento sessione.
                    </p>
                </div>
            </div>

            {/* Contenitore Dinamico Contenuto */}
            <div className="flex-grow bg-surface rounded-[3rem] shadow-2xl border border-outline-variant overflow-hidden flex flex-col mb-20 lg:mb-0">
                <div className="p-10 flex-grow overflow-y-auto animate-fade-in custom-scrollbar">
                    {activePillar === 'id' && <IdentityPillar />}
                    {activePillar === 'rbac' && <RBACPillar />}
                    {activePillar === 'nav' && <NavigationPillar />}
                    {activePillar === 'audit' && <AuditPillar />}
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-outline-variant); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--color-primary); }
            `}</style>
        </div>
    );
};

export default SecurityCenterPage;
