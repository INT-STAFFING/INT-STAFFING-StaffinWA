
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useResourcesContext } from '../context/ResourcesContext';
import { useUIConfigContext } from '../context/UIConfigContext';
import { useToast } from '../context/ToastContext';
import { SpinnerIcon } from '../components/icons';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { AppUser, RolePermission, UserRole, AuditLogEntry } from '../types';
import { authorizedJsonFetch } from '../utils/api';
import { routesManifest } from '../routes';
import { useAuthorizedResource, createAuthorizedFetcher } from '../hooks/useAuthorizedResource';
import { DataTable, ColumnDef } from '../components/DataTable';

// --- PILASTRO 1: GESTIONE IDENTITÀ ---
const IdentityPillar: React.FC = () => {
    const { data: users, loading, updateCache } = useAuthorizedResource<AppUser[]>(
        'security-users',
        createAuthorizedFetcher<AppUser[]>('/api/resources?entity=app-users')
    );
    const { resources } = useResourcesContext();
    const { addToast } = useToast();
    const { impersonate } = useAuth();
    
    // User Edit Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Partial<AppUser>>({});

    // Password Reset Modal State
    const [isPwdModalOpen, setIsPwdModalOpen] = useState(false);
    const [userForPwd, setUserForPwd] = useState<AppUser | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pwdLoading, setPwdLoading] = useState(false);

    // Search Filter
    const [searchTerm, setSearchTerm] = useState('');

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

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userForPwd) return;

        if (newPassword.length < 8) {
            addToast('La password deve essere di almeno 8 caratteri.', 'warning');
            return;
        }
        if (newPassword !== confirmPassword) {
            addToast('Le password non coincidono.', 'warning');
            return;
        }

        setPwdLoading(true);
        try {
            await authorizedJsonFetch(`/api/resources?entity=app-users&action=change_password&id=${userForPwd.id}`, {
                method: 'PUT',
                body: JSON.stringify({ newPassword }),
            });
            addToast(`Password per ${userForPwd.username} resettata con successo.`, 'success');
            setIsPwdModalOpen(false);
            setNewPassword('');
            setConfirmPassword('');
            setUserForPwd(null);
        } catch (e) {
            addToast(`Errore durante il reset della password: ${(e as Error).message}`, 'error');
        } finally {
            setPwdLoading(false);
        }
    };

    const filteredUsers = useMemo(() => {
        if (!users) return [];
        if (!searchTerm) return users;
        return users.filter(u => u.username.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [users, searchTerm]);

    const resourceOptions = useMemo(() => resources.map(r => ({ value: r.id!, label: r.name })), [resources]);

    const columns: ColumnDef<AppUser>[] = [
        { 
            header: 'Utente', 
            sortKey: 'username', 
            cell: u => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {u.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-on-surface">{u.username}</span>
                </div>
            ) 
        },
        { 
            header: 'Ruolo', 
            sortKey: 'role', 
            cell: u => <span className="text-xs font-bold text-primary uppercase tracking-widest">{u.role}</span> 
        },
        { 
            header: 'Stato', 
            sortKey: 'isActive', 
            cell: u => (
                <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-tighter ${u.isActive ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-error-container text-on-error-container'}`}>
                    {u.isActive ? 'ATTIVO' : 'DISABILITATO'}
                </span>
            ) 
        },
    ];

    const renderRow = (u: AppUser) => (
        <tr key={u.id} className="group hover:bg-surface-container-low transition-colors">
            {columns.map((col, i) => (
                <td key={i} className="px-6 py-4 whitespace-nowrap bg-inherit">
                    {col.cell(u)}
                </td>
            ))}
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium bg-inherit">
                <div className="flex items-center justify-end gap-2">
                    <button onClick={() => impersonate(u.id)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors" title="Impersonifica">
                        <span className="material-symbols-outlined text-xl">visibility</span>
                    </button>
                    <button 
                        onClick={() => { setUserForPwd(u); setNewPassword(''); setConfirmPassword(''); setIsPwdModalOpen(true); }} 
                        className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-tertiary transition-colors"
                        title="Reset Password"
                    >
                        <span className="material-symbols-outlined text-xl">lock_reset</span>
                    </button>
                    <button onClick={() => { setEditingUser(u); setIsModalOpen(true); }} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors" title="Modifica Profilo">
                        <span className="material-symbols-outlined text-xl">edit</span>
                    </button>
                </div>
            </td>
        </tr>
    );

    const renderMobileCard = (u: AppUser) => (
        <div key={u.id} className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant shadow-sm hover:shadow-md transition-all group mb-4">
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
                    <button onClick={() => impersonate(u.id)} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">visibility</span> Impersonifica
                    </button>
                    <div className="flex gap-2">
                    <button 
                        onClick={() => { setUserForPwd(u); setNewPassword(''); setConfirmPassword(''); setIsPwdModalOpen(true); }} 
                        className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-tertiary"
                        title="Reset Password"
                    >
                        <span className="material-symbols-outlined">lock_reset</span>
                    </button>
                    <button onClick={() => { setEditingUser(u); setIsModalOpen(true); }} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant" title="Modifica Profilo">
                        <span className="material-symbols-outlined">edit</span>
                    </button>
                    </div>
            </div>
        </div>
    );

    const filtersNode = (
        <div className="w-full md:w-64">
            <input 
                type="text" 
                className="form-input" 
                placeholder="Cerca utente..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
            />
        </div>
    );

    return (
        <div className="space-y-6">
            <DataTable<AppUser>
                title="Gestione Identità"
                addNewButtonLabel="Nuovo Utente"
                onAddNew={() => { setEditingUser({ role: 'SIMPLE', isActive: true }); setIsModalOpen(true); }}
                data={filteredUsers}
                columns={columns}
                filtersNode={filtersNode}
                renderRow={renderRow}
                renderMobileCard={renderMobileCard}
                isLoading={loading}
                initialSortKey="username"
                numActions={3}
            />

            {/* Edit User Modal */}
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

            {/* Password Reset Modal */}
            {isPwdModalOpen && userForPwd && (
                <Modal isOpen={isPwdModalOpen} onClose={() => setIsPwdModalOpen(false)} title={`Reset Password: ${userForPwd.username}`}>
                    <form onSubmit={handlePasswordReset} className="space-y-5">
                        <div className="p-3 bg-yellow-container/20 border border-yellow-container rounded-xl text-sm text-on-surface-variant mb-4">
                            Stai per reimpostare manualmente la password per questo utente. Assicurati di comunicare la nuova password in modo sicuro.
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold mb-1 text-on-surface-variant">Nuova Password</label>
                                <input 
                                    type="password" 
                                    value={newPassword} 
                                    onChange={e => setNewPassword(e.target.value)} 
                                    className="form-input" 
                                    required 
                                    placeholder="Minimo 8 caratteri" 
                                    autoComplete="new-password"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 text-on-surface-variant">Conferma Password</label>
                                <input 
                                    type="password" 
                                    value={confirmPassword} 
                                    onChange={e => setConfirmPassword(e.target.value)} 
                                    className="form-input" 
                                    required 
                                    placeholder="Ripeti password" 
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
                            <button type="button" onClick={() => setIsPwdModalOpen(false)} className="px-6 py-2 rounded-full font-bold text-on-surface-variant hover:bg-surface-container">Annulla</button>
                            <button 
                                type="submit" 
                                disabled={pwdLoading}
                                className="px-8 py-2 bg-primary text-on-primary rounded-full font-bold shadow-lg disabled:opacity-50 flex items-center gap-2"
                            >
                                {pwdLoading ? <SpinnerIcon className="w-4 h-4" /> : 'Reimposta Password'}
                            </button>
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
    const { pageVisibility, updatePageVisibility } = useUIConfigContext();
    const { addToast } = useToast();
    
    // Manage visibility changes locally first to match "Save" button UX
    const [localVisibility, setLocalVisibility] = useState(pageVisibility);

    // Sync local state when context updates (initial load)
    useEffect(() => {
        setLocalVisibility(pageVisibility);
    }, [pageVisibility]);

    const ROLES: UserRole[] = ['SIMPLE', 'MANAGER', 'SENIOR MANAGER', 'MANAGING DIRECTOR'];
    const manageableRoutes = useMemo(() => 
        routesManifest.filter(r => r.requiresAuth !== false).sort((a,b) => a.label.localeCompare(b.label)),
    []);

    const handleTogglePerm = (role: UserRole, path: string) => {
        updateCache(prev => {
            const list = prev || [];
            const idx = list.findIndex(x => x.role === role && x.pagePath === path);
            const newList = [...list];
            if (idx >= 0) newList[idx] = { ...newList[idx], isAllowed: !newList[idx].isAllowed }; // FIX: isAllowed
            else newList.push({ role, pagePath: path, isAllowed: true });
            return newList;
        });
    };

    const handleToggleVisibility = (path: string) => {
        setLocalVisibility(prev => ({ ...prev, [path]: !prev[path] }));
    };

    const handleSave = async () => {
        try {
            // 1. Save Permissions Matrix
            await authorizedJsonFetch('/api/resources?entity=role-permissions', {
                method: 'POST',
                body: JSON.stringify({ permissions: permissionsData })
            });

            // 2. Save Page Visibility (Admin Only config)
            await updatePageVisibility(localVisibility);

            addToast('Configurazione salvata con successo', 'success');
        } catch (e) { addToast('Errore nel salvataggio della configurazione', 'error'); }
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
                                const isAdminOnly = localVisibility[route.path];

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
                                                onChange={() => handleToggleVisibility(route.path)}
                                                className="form-checkbox h-5 w-5 rounded-lg border-error/30 text-error focus:ring-error"
                                            />
                                        </td>
                                        {ROLES.map(role => {
                                            const allowed = permissionsData?.find(x => x.role === role && x.pagePath === route.path)?.isAllowed; // FIX: isAllowed
                                            return (
                                                <td key={role} className="px-2 py-4 text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={!!allowed && !isAdminOnly} 
                                                        disabled={isAdminOnly}
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
    const { sidebarConfig, updateSidebarConfig, roleHomePages, updateRoleHomePages, sidebarSections } = useUIConfigContext();
    const { addToast } = useToast();
    const [localSidebar, setLocalSidebar] = useState(sidebarConfig);
    
    // Sync local state with context when context updates (e.g. initial load)
    // AND MERGE WITH ROUTESMANIFEST to ensure new pages are visible
    useEffect(() => {
        const currentPaths = new Set(sidebarConfig.map(item => item.path));
        
        // Find routes in manifest that are missing from the stored config
        const newItems = routesManifest
            .filter(r => r.showInSidebar && !currentPaths.has(r.path))
            .map(r => ({
                path: r.path,
                label: r.label,
                icon: r.icon,
                section: r.section || 'Altro',
                requiredPermission: r.requiredPermission
            }));

        if (newItems.length > 0) {
            setLocalSidebar([...sidebarConfig, ...newItems]);
        } else {
            setLocalSidebar(sidebarConfig);
        }
    }, [sidebarConfig]);
    
    const ROLES: UserRole[] = ['SIMPLE', 'MANAGER', 'SENIOR MANAGER', 'MANAGING DIRECTOR', 'ADMIN'];
    const availablePages = useMemo(() => 
        routesManifest.filter(r => r.requiresAuth !== false).sort((a,b) => a.label.localeCompare(b.label)),
    []);

    const handleSaveMenu = async () => {
        await updateSidebarConfig(localSidebar);
        addToast('Struttura menu aggiornata', 'success');
    };

    const handleMove = (index: number, direction: -1 | 1) => {
        if ((direction === -1 && index === 0) || (direction === 1 && index === localSidebar.length - 1)) return;
        
        const newItems = [...localSidebar];
        const temp = newItems[index];
        newItems[index] = newItems[index + direction];
        newItems[index + direction] = temp;
        setLocalSidebar(newItems);
    };

    const handleSectionChange = (index: number, newSection: string) => {
        const newItems = [...localSidebar];
        newItems[index] = { ...newItems[index], section: newSection };
        setLocalSidebar(newItems);
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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div>
                        <h3 className="text-2xl font-bold text-on-surface">Struttura Sidebar</h3>
                        <p className="text-sm text-on-surface-variant">Ordina le voci e assegna le categorie per il menu principale.</p>
                    </div>
                    <button onClick={handleSaveMenu} className="w-full sm:w-auto px-6 py-2 bg-primary text-on-primary rounded-full font-bold shadow-lg">Salva Struttura</button>
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant rounded-[2rem] shadow-inner max-h-[600px] overflow-y-auto">
                    {localSidebar.map((item, idx) => (
                        <div key={item.path} className="flex items-center gap-4 p-3 border-b border-outline-variant hover:bg-surface-container-low transition-colors group">
                            {/* Reorder Controls */}
                            <div className="flex flex-col gap-1">
                                <button 
                                    onClick={() => handleMove(idx, -1)} 
                                    disabled={idx === 0}
                                    className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-container disabled:opacity-20 text-on-surface-variant"
                                >
                                    <span className="material-symbols-outlined text-sm">keyboard_arrow_up</span>
                                </button>
                                <button 
                                    onClick={() => handleMove(idx, 1)} 
                                    disabled={idx === localSidebar.length - 1}
                                    className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-container disabled:opacity-20 text-on-surface-variant"
                                >
                                    <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
                                </button>
                            </div>

                            {/* Icon */}
                            <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface-variant shrink-0">
                                <span className="material-symbols-outlined">{item.icon}</span>
                            </div>

                            {/* Main Info */}
                            <div className="flex-grow grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                {/* Label Input */}
                                <div className="md:col-span-5">
                                     <label className="text-[10px] font-bold text-primary uppercase tracking-widest block mb-1">Etichetta</label>
                                     <input 
                                        type="text" 
                                        value={item.label} 
                                        onChange={e => {
                                            const next = [...localSidebar];
                                            next[idx] = { ...item, label: e.target.value };
                                            setLocalSidebar(next);
                                        }} 
                                        className="w-full bg-transparent font-bold text-on-surface border-b border-transparent focus:border-primary focus:ring-0 p-0 text-sm"
                                    />
                                </div>

                                {/* Section Selector */}
                                <div className="md:col-span-4">
                                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block mb-1">Sezione</label>
                                    <select 
                                        value={item.section || ''}
                                        onChange={(e) => handleSectionChange(idx, e.target.value)}
                                        className="w-full bg-surface-container-high text-xs rounded-lg border-none focus:ring-1 focus:ring-primary py-1.5 px-2 font-medium"
                                    >
                                        {sidebarSections.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>

                                {/* Path Info (Read-only) */}
                                <div className="md:col-span-3 flex items-center gap-1 text-[10px] font-mono text-on-surface-variant/70 overflow-hidden">
                                    <span className="material-symbols-outlined text-[10px]">link</span>
                                    <span className="truncate" title={item.path}>{item.path}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

// --- TIMELINE COMPONENT FOR AUDIT ---
const AuditTimelineItem: React.FC<{ log: AuditLogEntry; isLast: boolean }> = ({ log, isLast }) => {
    const actionColor = useMemo(() => {
        if (log.action.includes('CREATE') || log.action.includes('ADD')) return 'text-tertiary bg-tertiary-container/30 border-tertiary';
        if (log.action.includes('UPDATE') || log.action.includes('EDIT')) return 'text-primary bg-primary-container/30 border-primary';
        if (log.action.includes('DELETE') || log.action.includes('REMOVE')) return 'text-error bg-error-container/30 border-error';
        if (log.action.includes('FAIL')) return 'text-error bg-error-container border-error';
        return 'text-secondary bg-surface-container-high border-outline';
    }, [log.action]);

    const icon = useMemo(() => {
        if (log.action.includes('CREATE')) return 'add_circle';
        if (log.action.includes('UPDATE')) return 'edit';
        if (log.action.includes('DELETE')) return 'delete';
        if (log.action.includes('LOGIN')) return 'login';
        if (log.action.includes('LOGOUT')) return 'logout';
        if (log.action.includes('FAIL')) return 'error';
        return 'info';
    }, [log.action]);

    const formattedTime = new Date(log.createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="relative pl-8 pb-8 group">
            {/* Vertical Line */}
            {!isLast && (
                <div className="absolute top-3 left-[11px] bottom-0 w-0.5 bg-outline-variant/50 group-hover:bg-primary/30 transition-colors"></div>
            )}
            
            {/* Icon Dot */}
            <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center ${actionColor} bg-surface z-10 shadow-sm`}>
                <span className="material-symbols-outlined text-[14px]">{icon}</span>
            </div>

            {/* Content Card */}
            <div className="bg-surface-container-low rounded-xl border border-outline-variant p-4 shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                            {log.username?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <span className="text-sm font-bold text-on-surface">{log.username || 'System'}</span>
                        <span className="text-[10px] text-on-surface-variant font-mono bg-surface px-1.5 py-0.5 rounded border border-outline-variant">{log.ipAddress}</span>
                    </div>
                    <span className="text-xs font-mono text-on-surface-variant">{formattedTime}</span>
                </div>
                
                <p className="text-sm font-medium text-on-surface mb-1">
                    <span className={`font-black tracking-tighter mr-2 ${actionColor.split(' ')[0]}`}>{log.action}</span>
                    {log.entity && <span className="opacity-80">su {log.entity}</span>}
                </p>

                {log.details && Object.keys(log.details).length > 0 && (
                     <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-primary hover:underline select-none font-medium">Dettagli tecnici</summary>
                        <pre className="mt-2 p-2 bg-surface rounded border border-outline-variant overflow-x-auto font-mono text-[10px] text-on-surface-variant">
                            {JSON.stringify(log.details, null, 2)}
                        </pre>
                    </details>
                )}
            </div>
        </div>
    );
};

// --- PILASTRO 4: AUDIT E SICUREZZA GLOBALE ---
const AuditPillar: React.FC = () => {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const { isLoginProtectionEnabled, toggleLoginProtection } = useAuth();

    // Filters state
    const [filters, setFilters] = useState({
        username: '',
        actionType: '',
        entity: '',
        entityId: '',
        startDate: '',
        endDate: ''
    });

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('entity', 'audit_logs');
            params.append('limit', '200'); // Increased limit for timeline
            if (filters.username) params.append('username', filters.username);
            if (filters.actionType) params.append('actionType', filters.actionType);
            
            // FIX: Map frontend filter 'entity' to API expected 'targetEntity'
            // or modify API to accept 'entity' as filter when entity='audit_logs'.
            // Here we use 'targetEntity' to match API expectation from step 2
            if (filters.entity) params.append('targetEntity', filters.entity); 
            
            if (filters.entityId) params.append('entityId', filters.entityId);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);

            const data = await authorizedJsonFetch<AuditLogEntry[]>(`/api/resources?${params.toString()}`);
            setLogs(data);
        } catch(e) {} finally { setLoading(false); }
    }, [filters]);

    // Initial load and updates when fetchLogs changes (i.e. filters change)
    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleReset = () => {
        setFilters({ username: '', actionType: '', entity: '', entityId: '', startDate: '', endDate: '' });
    };

    // Group logs by date
    const groupedLogs = useMemo(() => {
        const groups: Record<string, AuditLogEntry[]> = {};
        logs.forEach(log => {
            const dateKey = new Date(log.createdAt).toISOString().split('T')[0];
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(log);
        });
        return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
    }, [logs]);

    const formatDateHeader = (dateStr: string) => {
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return "Oggi";
        if (date.toDateString() === yesterday.toDateString()) return "Ieri";
        return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
    };

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
                    <h3 className="text-2xl font-bold text-on-surface">Timeline Attività</h3>
                </div>

                {/* Filters Bar */}
                <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant mb-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-3">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider ml-1 mb-1 block">Utente</label>
                        <input 
                            type="text" 
                            className="form-input py-2 text-sm" 
                            placeholder="Cerca username..." 
                            value={filters.username}
                            onChange={e => setFilters(prev => ({...prev, username: e.target.value}))}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider ml-1 mb-1 block">Entità</label>
                        <input 
                            type="text" 
                            className="form-input py-2 text-sm" 
                            placeholder="es. projects" 
                            value={filters.entity}
                            onChange={e => setFilters(prev => ({...prev, entity: e.target.value}))}
                        />
                    </div>
                     <div className="md:col-span-3">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider ml-1 mb-1 block">ID Entità</label>
                        <input 
                            type="text" 
                            className="form-input py-2 text-sm font-mono" 
                            placeholder="UUID..." 
                            value={filters.entityId}
                            onChange={e => setFilters(prev => ({...prev, entityId: e.target.value}))}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider ml-1 mb-1 block">Da</label>
                        <input 
                            type="date" 
                            className="form-input py-2 text-sm" 
                            value={filters.startDate}
                            onChange={e => setFilters(prev => ({...prev, startDate: e.target.value}))}
                        />
                    </div>
                    <div className="md:col-span-2 flex gap-2">
                        <button 
                            onClick={fetchLogs} 
                            className="flex-1 bg-primary text-on-primary py-2 rounded-lg font-bold shadow-sm hover:opacity-90 transition-opacity flex justify-center items-center"
                            title="Applica Filtri"
                        >
                            <span className="material-symbols-outlined text-lg">search</span>
                        </button>
                        <button 
                            onClick={handleReset} 
                            className="px-3 bg-surface-container-high text-on-surface py-2 rounded-lg font-bold hover:bg-surface-container-highest transition-colors"
                            title="Reset Filtri"
                        >
                            <span className="material-symbols-outlined text-lg">filter_alt_off</span>
                        </button>
                    </div>
                </div>

                {/* TIMELINE VIEW */}
                <div className="pl-4">
                    {loading ? (
                        <div className="p-12 text-center"><SpinnerIcon className="w-8 h-8 mx-auto text-primary" /></div>
                    ) : logs.length === 0 ? (
                        <div className="p-12 text-center text-on-surface-variant font-bold italic bg-surface-container-low rounded-2xl border border-dashed border-outline-variant">
                            Nessuna attività trovata con i filtri correnti.
                        </div>
                    ) : (
                        groupedLogs.map(([dateKey, groupLogs]) => (
                            <div key={dateKey} className="mb-8">
                                <h4 className="text-sm font-bold text-primary uppercase tracking-widest mb-4 sticky top-0 bg-surface/95 backdrop-blur py-2 z-10 border-b border-outline-variant">
                                    {formatDateHeader(dateKey)}
                                </h4>
                                <div className="border-l-2 border-outline-variant ml-2 pl-6 pt-2">
                                    {groupLogs.map((log, index) => (
                                        <div key={log.id} className="relative mb-6 last:mb-0">
                                            {/* Custom rendering logic instead of simple component to control connector line properly */}
                                            <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 border-surface bg-surface-container-high flex items-center justify-center z-10 ring-4 ring-surface">
                                                 <span className={`w-2 h-2 rounded-full ${
                                                     log.action.includes('CREATE') ? 'bg-tertiary' : 
                                                     log.action.includes('DELETE') ? 'bg-error' : 
                                                     log.action.includes('FAIL') ? 'bg-error' : 'bg-primary'
                                                 }`}></span>
                                            </div>
                                            <AuditTimelineItem log={log} isLast={index === groupLogs.length - 1} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
};

// --- PAGINA PRINCIPALE SECURITY CENTER ---
const SecurityCenterPage: React.FC = () => {
    const [activePillar, setActivePillar] = useState<'id' | 'rbac' | 'nav' | 'audit'>('audit'); // Default to Audit per request focus

    const pillars = [
        { id: 'audit', label: 'Security Audit', icon: 'policy', desc: 'Timeline Attività' },
        { id: 'rbac', label: 'Access Control Matrix', icon: 'security', desc: 'Rotte e Ruoli' },
        { id: 'id', label: 'Identity & Users', icon: 'badge', desc: 'Whitelist Utenti' },
        { id: 'nav', label: 'App Architecture', icon: 'account_tree', desc: 'Menu e Landing' },
    ];

    return (
        <div className="flex h-full flex-col lg:flex-row gap-8">
            {/* Sidebar di Navigazione Interna */}
            <div className="lg:w-80 flex-shrink-0 space-y-3">
                <div className="p-2 mb-6">
                    <h1 className="text-3xl font-black text-primary tracking-tighter italic">SECURITY<span className="text-on-surface font-normal">CENTER</span></h1>
                    <p className="text-xs font-bold text-on-surface-variant opacity-60 uppercase tracking-widest mt-1">Control Panel v2.1</p>
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
