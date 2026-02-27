
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useResourcesContext } from '../context/ResourcesContext';
import { useUIConfigContext } from '../context/UIConfigContext';
import { useToast } from '../context/ToastContext';
import { SpinnerIcon } from '../components/icons';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { AppUser, RolePermission, RoleEntityVisibility, UserRole, AuditLogEntry } from '../types';
import { authorizedJsonFetch } from '../utils/api';
import { routesManifest } from '../routes';
import { useAuthorizedResource, createAuthorizedFetcher } from '../hooks/useAuthorizedResource';
import { DataTable, ColumnDef } from '../components/DataTable';

// --- PILASTRO 1: GESTIONE IDENTITÀ ---
const IdentityPillar: React.FC = () => {
    const { data: users, loading, error, updateCache } = useAuthorizedResource<AppUser[]>(
        'security-users',
        createAuthorizedFetcher<AppUser[]>('/api/resources?entity=app-users')
    );

    if (error) {
        return (
            <div className="p-8 text-center bg-error-container/10 rounded-3xl border border-error/20">
                <span className="material-symbols-outlined text-error text-4xl mb-2">error</span>
                <p className="text-on-surface font-bold">Errore nel caricamento degli utenti</p>
                <p className="text-xs text-on-surface-variant mt-1">{error}</p>
            </div>
        );
    }

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

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkLoading, setBulkLoading] = useState(false);

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
        } catch (e: any) {
            addToast(`Errore durante il salvataggio utente: ${e.message}`, 'error');
        }
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
        return users.filter(u => {
            const matchSearch = !searchTerm || u.username.toLowerCase().includes(searchTerm.toLowerCase());
            const matchRole = !roleFilter || u.role === roleFilter;
            const matchStatus = statusFilter === '' || (statusFilter === 'active' ? u.isActive : !u.isActive);
            return matchSearch && matchRole && matchStatus;
        });
    }, [users, searchTerm, roleFilter, statusFilter]);

    // Derived selection state
    const allFilteredSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedIds.has(u.id));
    const someFilteredSelected = filteredUsers.some(u => selectedIds.has(u.id));

    const toggleSelectAll = useCallback(() => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allFilteredSelected) {
                filteredUsers.forEach(u => next.delete(u.id));
            } else {
                filteredUsers.forEach(u => next.add(u.id));
            }
            return next;
        });
    }, [allFilteredSelected, filteredUsers]);

    const toggleSelectUser = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleBulkToggle = useCallback(async (enable: boolean) => {
        if (selectedIds.size === 0) return;
        setBulkLoading(true);
        try {
            const selectedUsers = (users || []).filter(u => selectedIds.has(u.id));
            await Promise.all(
                selectedUsers.map(u =>
                    authorizedJsonFetch<AppUser>(`/api/resources?entity=app-users&id=${u.id}`, {
                        method: 'PUT',
                        body: JSON.stringify({ ...u, isActive: enable })
                    })
                )
            );
            updateCache(prev => (prev || []).map(u => selectedIds.has(u.id) ? { ...u, isActive: enable } : u));
            const count = selectedIds.size;
            addToast(`${count} ${count === 1 ? 'utente' : 'utenti'} ${enable ? 'abilitati' : 'disabilitati'} con successo`, 'success');
            setSelectedIds(new Set());
        } catch (e: any) {
            addToast(`Errore durante l'operazione bulk: ${e.message}`, 'error');
        } finally {
            setBulkLoading(false);
        }
    }, [selectedIds, users, updateCache, addToast]);

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
        <tr key={u.id} className={`group hover:bg-surface-container-low transition-colors ${selectedIds.has(u.id) ? 'bg-primary/5' : ''}`}>
            {columns.map((col, i) => (
                <td key={i} className="px-6 py-4 whitespace-nowrap bg-inherit">
                    {col.cell(u)}
                </td>
            ))}
            <td className="px-3 py-4 whitespace-nowrap text-right text-sm font-medium bg-inherit">
                <div className="flex items-center justify-end gap-1.5">
                    <input
                        type="checkbox"
                        checked={selectedIds.has(u.id)}
                        onChange={() => toggleSelectUser(u.id)}
                        onClick={e => e.stopPropagation()}
                        className="form-checkbox h-4 w-4 rounded cursor-pointer shrink-0 mr-1"
                        title="Seleziona utente"
                    />
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
        <div key={u.id} className={`p-5 rounded-3xl border shadow-sm hover:shadow-md transition-all group mb-4 ${selectedIds.has(u.id) ? 'bg-primary/5 border-primary/30' : 'bg-surface-container-low border-outline-variant'}`}>
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        checked={selectedIds.has(u.id)}
                        onChange={() => toggleSelectUser(u.id)}
                        className="form-checkbox h-5 w-5 rounded cursor-pointer shrink-0 mt-0.5"
                    />
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

    const selectAllRef = useCallback((el: HTMLInputElement | null) => {
        if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected;
    }, [someFilteredSelected, allFilteredSelected]);

    const filtersNode = (
        <div className="flex flex-wrap items-center gap-3">
            <div className="w-full md:w-52">
                <input
                    type="text"
                    className="form-input"
                    placeholder="Cerca utente..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="w-full md:w-44">
                <select
                    value={roleFilter}
                    onChange={e => setRoleFilter(e.target.value)}
                    className="form-select"
                    aria-label="Filtra per ruolo"
                >
                    <option value="">Tutti i ruoli</option>
                    <option value="SIMPLE">Simple User</option>
                    <option value="SIMPLE_EXT">Simple User (Ext)</option>
                    <option value="MANAGER">Manager</option>
                    <option value="MANAGER_EXT">Manager (Ext)</option>
                    <option value="SENIOR MANAGER">Senior Manager</option>
                    <option value="SENIOR MANAGER_EXT">Senior Manager (Ext)</option>
                    <option value="ASSOCIATE DIRECTOR">Associate Director</option>
                    <option value="ASSOCIATE DIRECTOR_EXT">Associate Director (Ext)</option>
                    <option value="MANAGING DIRECTOR">Managing Director</option>
                    <option value="MANAGING DIRECTOR_EXT">Managing Director (Ext)</option>
                    <option value="ADMIN">Administrator</option>
                </select>
            </div>
            <div className="w-full md:w-40">
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="form-select"
                    aria-label="Filtra per stato"
                >
                    <option value="">Tutti gli stati</option>
                    <option value="active">Attivi</option>
                    <option value="inactive">Disabilitati</option>
                </select>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-on-surface-variant ml-auto shrink-0">
                <input
                    type="checkbox"
                    ref={selectAllRef}
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    className="form-checkbox h-4 w-4 rounded"
                />
                <span>Seleziona tutti ({filteredUsers.length})</span>
            </label>
        </div>
    );

    // Bulk action bar shown next to "Nuovo Utente" button when users are selected
    const bulkActionsBar = selectedIds.size > 0 ? (
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5">
            <span className="text-xs font-bold text-primary whitespace-nowrap">{selectedIds.size} {selectedIds.size === 1 ? 'utente' : 'utenti'} selezionati</span>
            <div className="h-4 w-px bg-primary/30" />
            <button
                onClick={() => handleBulkToggle(true)}
                disabled={bulkLoading}
                title="Abilita selezionati"
                className="flex items-center gap-1 text-xs font-bold text-tertiary hover:underline disabled:opacity-50 whitespace-nowrap"
            >
                {bulkLoading
                    ? <SpinnerIcon className="w-3 h-3" />
                    : <span className="material-symbols-outlined text-sm">check_circle</span>
                }
                Abilita
            </button>
            <button
                onClick={() => handleBulkToggle(false)}
                disabled={bulkLoading}
                title="Disabilita selezionati"
                className="flex items-center gap-1 text-xs font-bold text-error hover:underline disabled:opacity-50 whitespace-nowrap"
            >
                {bulkLoading
                    ? <SpinnerIcon className="w-3 h-3" />
                    : <span className="material-symbols-outlined text-sm">block</span>
                }
                Disabilita
            </button>
            <button
                onClick={() => setSelectedIds(new Set())}
                title="Deseleziona tutti"
                className="p-0.5 text-on-surface-variant hover:text-on-surface"
            >
                <span className="material-symbols-outlined text-sm">close</span>
            </button>
        </div>
    ) : null;

    return (
        <div className="space-y-6">
            <DataTable<AppUser>
                title="Gestione Identità"
                addNewButtonLabel="Nuovo Utente"
                onAddNew={() => { setEditingUser({ role: 'SIMPLE', isActive: true }); setIsModalOpen(true); }}
                data={filteredUsers}
                columns={columns}
                filtersNode={filtersNode}
                headerActions={bulkActionsBar}
                renderRow={renderRow}
                renderMobileCard={renderMobileCard}
                isLoading={loading}
                initialSortKey="username"
                numActions={4}
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
                                    <option value="SIMPLE_EXT">Simple User (Ext)</option>
                                    <option value="MANAGER">Manager</option>
                                    <option value="MANAGER_EXT">Manager (Ext)</option>
                                    <option value="SENIOR MANAGER">Senior Manager</option>
                                    <option value="SENIOR MANAGER_EXT">Senior Manager (Ext)</option>
                                    <option value="ASSOCIATE DIRECTOR">Associate Director</option>
                                    <option value="ASSOCIATE DIRECTOR_EXT">Associate Director (Ext)</option>
                                    <option value="MANAGING DIRECTOR">Managing Director</option>
                                    <option value="MANAGING DIRECTOR_EXT">Managing Director (Ext)</option>
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

// Abbreviazioni etichette ruoli per l'intestazione della matrice RBAC
const ROLE_ABBR: Record<string, string> = {
    'SIMPLE':                 'SIMPLE',
    'SIMPLE_EXT':             'SMP_EXT',
    'MANAGER':                'MANAGER',
    'MANAGER_EXT':            'MGR_EXT',
    'SENIOR MANAGER':         'SR.MGR',
    'SENIOR MANAGER_EXT':     'SR.M_EXT',
    'ASSOCIATE DIRECTOR':     'ASSOC.D',
    'ASSOCIATE DIRECTOR_EXT': 'ASC_EXT',
    'MANAGING DIRECTOR':      'M.DIR',
    'MANAGING DIRECTOR_EXT':  'M.D_EXT',
    'ADMIN':                  'ADMIN',
};

// --- PILASTRO 2: MATRICE RBAC UNIFICATA ---
const RBACPillar: React.FC = () => {
    const { data: permissionsData, loading, error, updateCache } = useAuthorizedResource<RolePermission[]>(
        'security-rbac',
        createAuthorizedFetcher<RolePermission[]>('/api/resources?entity=role-permissions')
    );

    if (error) {
        return (
            <div className="p-8 text-center bg-error-container/10 rounded-3xl border border-error/20">
                <span className="material-symbols-outlined text-error text-4xl mb-2">error</span>
                <p className="text-on-surface font-bold">Errore nel caricamento dei permessi</p>
                <p className="text-xs text-on-surface-variant mt-1">{error}</p>
            </div>
        );
    }

    const { pageVisibility, updatePageVisibility } = useUIConfigContext();
    const { addToast } = useToast();
    
    // Manage visibility changes locally first to match "Save" button UX
    const [localVisibility, setLocalVisibility] = useState(pageVisibility);

    // Sync local state when context updates (initial load)
    useEffect(() => {
        setLocalVisibility(pageVisibility);
    }, [pageVisibility]);

    const ROLES: UserRole[] = [
        'SIMPLE', 'SIMPLE_EXT',
        'MANAGER', 'MANAGER_EXT',
        'SENIOR MANAGER', 'SENIOR MANAGER_EXT',
        'ASSOCIATE DIRECTOR', 'ASSOCIATE DIRECTOR_EXT',
        'MANAGING DIRECTOR', 'MANAGING DIRECTOR_EXT',
    ];
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
        if (!permissionsData) {
            addToast('Dati dei permessi non pronti', 'warning');
            return;
        }

        try {
            // 1. Save Permissions Matrix
            await authorizedJsonFetch('/api/resources?entity=role-permissions', {
                method: 'POST',
                body: JSON.stringify({ permissions: permissionsData })
            });

            // 2. Save Page Visibility (Admin Only config)
            await updatePageVisibility(localVisibility);

            addToast('Configurazione salvata con successo', 'success');
        } catch (e: any) { 
            addToast(`Errore nel salvataggio della configurazione: ${e.message}`, 'error'); 
        }
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
                                    <th key={role} className="px-2 py-5 text-center font-black uppercase text-[10px] tracking-widest text-on-surface-variant w-20" title={role}>
                                        {ROLE_ABBR[role] ?? role.substring(0, 8)}
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

// --- PILASTRO 3: VISIBILITÀ ENTITÀ ---
const ENTITY_VISIBILITY_DEPS: Record<string, string[]> = {
    'allocations':          ['assignments'],
    'assignments':          ['resources', 'projects'],
    'interviews':           ['resource_requests'],
    'leaves':               ['resources'],
    'billing_milestones':   ['contracts'],
    'wbs_tasks':            ['clients'],
    'resource_evaluations': ['resources'],
    'contracts':            ['projects', 'clients'],
};

const MANAGEABLE_ENTITIES: { key: string; label: string; group: string }[] = [
    { key: 'resources',           label: 'Risorse',              group: 'HR' },
    { key: 'allocations',         label: 'Allocazioni',          group: 'HR' },
    { key: 'leaves',              label: 'Ferie / Permessi',     group: 'HR' },
    { key: 'resource_evaluations',label: 'Valutazioni',          group: 'HR' },
    { key: 'projects',            label: 'Progetti',             group: 'Progetti' },
    { key: 'clients',             label: 'Clienti',              group: 'Progetti' },
    { key: 'contracts',           label: 'Contratti',            group: 'Progetti' },
    { key: 'assignments',         label: 'Assegnazioni',         group: 'Progetti' },
    { key: 'billing_milestones',  label: 'Milestone Fattur.',    group: 'Progetti' },
    { key: 'wbs_tasks',           label: 'WBS Task',             group: 'Progetti' },
    { key: 'rate_cards',          label: 'Rate Card',            group: 'Finanza' },
    { key: 'resource_requests',   label: 'Richieste Risorsa',    group: 'Recruiting' },
    { key: 'interviews',          label: 'Colloqui',             group: 'Recruiting' },
    { key: 'skills',              label: 'Competenze',           group: 'Skills' },
];

const ENTITY_VISIBILITY_ROLES: UserRole[] = [
    'SIMPLE', 'SIMPLE_EXT',
    'MANAGER', 'MANAGER_EXT',
    'SENIOR MANAGER', 'SENIOR MANAGER_EXT',
    'ASSOCIATE DIRECTOR', 'ASSOCIATE DIRECTOR_EXT',
    'MANAGING DIRECTOR', 'MANAGING DIRECTOR_EXT',
];

const EntityVisibilityPillar: React.FC = () => {
    const { data: visibilityData, loading, error, updateCache } = useAuthorizedResource<RoleEntityVisibility[]>(
        'security-entity-visibility',
        createAuthorizedFetcher<RoleEntityVisibility[]>('/api/resources?entity=role_entity_visibility')
    );

    const { addToast } = useToast();

    if (error) {
        return (
            <div className="p-8 text-center bg-error-container/10 rounded-3xl border border-error/20">
                <span className="material-symbols-outlined text-error text-4xl mb-2">error</span>
                <p className="text-on-surface font-bold">Errore nel caricamento della visibilità entità</p>
                <p className="text-xs text-on-surface-variant mt-1">{error}</p>
            </div>
        );
    }

    const isEntityVisible = (role: UserRole, entity: string): boolean => {
        const rule = visibilityData?.find(r => r.role === role && r.entity === entity);
        return rule ? rule.isVisible : true; // default: visibile se nessuna regola esplicita
    };

    const handleToggle = (role: UserRole, entity: string) => {
        updateCache(prev => {
            const list = prev || [];
            const idx = list.findIndex(x => x.role === role && x.entity === entity);
            const newList = [...list];
            if (idx >= 0) {
                newList[idx] = { ...newList[idx], isVisible: !newList[idx].isVisible };
            } else {
                newList.push({ role, entity, isVisible: false }); // default era true, toggle → false
            }
            return newList;
        });
    };

    const validateDependencies = (rules: RoleEntityVisibility[]): string[] => {
        const errors: string[] = [];
        for (const [entity, deps] of Object.entries(ENTITY_VISIBILITY_DEPS)) {
            for (const role of ENTITY_VISIBILITY_ROLES) {
                const entityRule = rules.find(r => r.role === role && r.entity === entity);
                const entityVisible = entityRule ? entityRule.isVisible : true;
                if (entityVisible) {
                    for (const dep of deps) {
                        const depRule = rules.find(r => r.role === role && r.entity === dep);
                        const depVisible = depRule ? depRule.isVisible : true;
                        if (!depVisible) {
                            const entityLabel = MANAGEABLE_ENTITIES.find(e => e.key === entity)?.label ?? entity;
                            const depLabel = MANAGEABLE_ENTITIES.find(e => e.key === dep)?.label ?? dep;
                            errors.push(`${role}: "${entityLabel}" richiede "${depLabel}" visibile`);
                        }
                    }
                }
            }
        }
        return errors;
    };

    const dependencyErrors = useMemo(() => validateDependencies(visibilityData || []), [visibilityData]);

    const handleSave = async () => {
        if (!visibilityData) {
            addToast('Dati non pronti', 'warning');
            return;
        }
        const errors = validateDependencies(visibilityData);
        if (errors.length > 0) {
            addToast(`Dipendenze invalide:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? `\n... e altri ${errors.length - 3}` : ''}`, 'error');
            return;
        }
        try {
            await authorizedJsonFetch('/api/resources?entity=role_entity_visibility', {
                method: 'POST',
                body: JSON.stringify({ visibilityRules: visibilityData }),
            });
            addToast('Visibilità entità salvata con successo', 'success');
        } catch (e: any) {
            addToast(`Errore nel salvataggio: ${e.message}`, 'error');
        }
    };

    const entityGroups = useMemo(() => {
        const groups: Record<string, typeof MANAGEABLE_ENTITIES> = {};
        MANAGEABLE_ENTITIES.forEach(e => {
            if (!groups[e.group]) groups[e.group] = [];
            groups[e.group].push(e);
        });
        return groups;
    }, []);

    // Calcola errori per entità+ruolo specifico (per evidenziare celle problematiche)
    const errorSet = useMemo(() => {
        const set = new Set<string>();
        for (const [entity, deps] of Object.entries(ENTITY_VISIBILITY_DEPS)) {
            for (const role of ENTITY_VISIBILITY_ROLES) {
                const entityRule = (visibilityData || []).find(r => r.role === role && r.entity === entity);
                const entityVisible = entityRule ? entityRule.isVisible : true;
                if (entityVisible) {
                    for (const dep of deps) {
                        const depRule = (visibilityData || []).find(r => r.role === role && r.entity === dep);
                        const depVisible = depRule ? depRule.isVisible : true;
                        if (!depVisible) {
                            set.add(`${role}:${dep}`); // il dep mancante è il problema
                        }
                    }
                }
            }
        }
        return set;
    }, [visibilityData]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end flex-wrap gap-4">
                <div>
                    <h3 className="text-2xl font-bold text-on-surface">Visibilità Entità per Ruolo</h3>
                    <p className="text-sm text-on-surface-variant">Controlla quali entità dati sono accessibili da ciascun ruolo. Il ruolo ADMIN vede sempre tutto.</p>
                </div>
                <button onClick={handleSave} disabled={loading} className="px-6 py-2 bg-primary text-on-primary rounded-full font-bold flex items-center gap-2 shadow-lg disabled:opacity-50">
                    <span className="material-symbols-outlined">save</span> Salva Visibilità
                </button>
            </div>

            {dependencyErrors.length > 0 && (
                <div className="p-4 bg-warning-container/20 border border-warning/30 rounded-2xl flex gap-3">
                    <span className="material-symbols-outlined text-warning mt-0.5 flex-shrink-0">warning</span>
                    <div>
                        <p className="font-bold text-on-surface text-sm">Dipendenze non soddisfatte</p>
                        <ul className="text-xs text-on-surface-variant mt-1 space-y-0.5">
                            {dependencyErrors.slice(0, 5).map((err, i) => <li key={i}>• {err}</li>)}
                            {dependencyErrors.length > 5 && <li>• ... e altri {dependencyErrors.length - 5} problemi</li>}
                        </ul>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-20"><SpinnerIcon className="w-10 h-10 text-primary animate-spin" /></div>
            ) : (
                <div className="space-y-6">
                    {Object.entries(entityGroups).map(([group, entities]) => (
                        <div key={group} className="border border-outline-variant rounded-[2rem] overflow-hidden bg-surface shadow-inner">
                            <div className="bg-surface-container-high px-6 py-3 border-b border-outline-variant">
                                <h4 className="font-black uppercase text-[10px] tracking-widest text-on-surface-variant">{group}</h4>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-surface-container">
                                        <tr className="border-b border-outline-variant">
                                            <th className="px-6 py-3 text-left font-black uppercase text-[10px] tracking-widest text-on-surface-variant">Entità</th>
                                            {ENTITY_VISIBILITY_ROLES.map(role => (
                                                <th key={role} className="px-2 py-3 text-center font-black uppercase text-[10px] tracking-widest text-on-surface-variant w-20" title={role}>
                                                    {ROLE_ABBR[role] ?? role.substring(0, 8)}
                                                </th>
                                            ))}
                                            <th className="px-4 py-3 text-center font-black uppercase text-[10px] tracking-widest bg-primary/5 text-primary">Admin</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-outline-variant">
                                        {entities.map(entityDef => (
                                            <tr key={entityDef.key} className="hover:bg-surface-container-low transition-colors">
                                                <td className="px-6 py-3">
                                                    <span className="font-bold text-on-surface">{entityDef.label}</span>
                                                    {ENTITY_VISIBILITY_DEPS[entityDef.key] && (
                                                        <span className="ml-2 text-[10px] text-on-surface-variant font-mono opacity-60" title={`Richiede: ${(ENTITY_VISIBILITY_DEPS[entityDef.key] || []).map(d => MANAGEABLE_ENTITIES.find(e => e.key === d)?.label ?? d).join(', ')}`}>
                                                            ↳ {(ENTITY_VISIBILITY_DEPS[entityDef.key] || []).map(d => MANAGEABLE_ENTITIES.find(e => e.key === d)?.label ?? d).join(', ')}
                                                        </span>
                                                    )}
                                                </td>
                                                {ENTITY_VISIBILITY_ROLES.map(role => {
                                                    const visible = isEntityVisible(role, entityDef.key);
                                                    const hasError = errorSet.has(`${role}:${entityDef.key}`);
                                                    return (
                                                        <td key={role} className={`px-2 py-3 text-center ${hasError ? 'bg-error-container/10' : ''}`}>
                                                            <input
                                                                type="checkbox"
                                                                checked={visible}
                                                                onChange={() => handleToggle(role, entityDef.key)}
                                                                title={hasError ? 'Dipendenza mancante — questa entità è richiesta da un\'altra entità visibile' : undefined}
                                                                className={`form-checkbox h-5 w-5 rounded-lg cursor-pointer transition-all ${hasError ? 'border-error text-error' : ''}`}
                                                            />
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-4 py-3 text-center bg-primary/5">
                                                    <span className="material-symbols-outlined text-primary text-xl">verified_user</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">info</span>
                    Note sulla sicurezza
                </p>
                <ul className="text-xs text-on-surface-variant space-y-1">
                    <li>• Il filtro viene applicato lato server: i dati non raggiungono mai il browser se il ruolo non ha visibilità.</li>
                    <li>• Il ruolo ADMIN bypassa sempre tutti i controlli di visibilità.</li>
                    <li>• Le modifiche hanno effetto al prossimo login dell'utente o ricaricamento della sessione.</li>
                    <li>• Le entità con dipendenze (↳) richiedono che le entità dipendenti siano anch'esse visibili.</li>
                </ul>
            </div>
        </div>
    );
};

// --- PILASTRO 5: NAVIGAZIONE E ARCHITETTURA ---
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
    
    const ROLES: UserRole[] = [
        'SIMPLE', 'SIMPLE_EXT',
        'MANAGER', 'MANAGER_EXT',
        'SENIOR MANAGER', 'SENIOR MANAGER_EXT',
        'ASSOCIATE DIRECTOR', 'ASSOCIATE DIRECTOR_EXT',
        'MANAGING DIRECTOR', 'MANAGING DIRECTOR_EXT',
        'ADMIN',
    ];
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
    const [error, setError] = useState<string | null>(null);
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

    const { addToast } = useToast();

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.append('entity', 'audit_logs');
            params.append('limit', '200'); // Increased limit for timeline
            if (filters.username) params.append('username', filters.username);
            if (filters.actionType) params.append('actionType', filters.actionType);
            
            // FIX: Map frontend filter 'entity' to API expected 'targetEntity'
            if (filters.entity) params.append('targetEntity', filters.entity); 
            
            if (filters.entityId) params.append('entityId', filters.entityId);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);

            const data = await authorizedJsonFetch<AuditLogEntry[]>(`/api/resources?${params.toString()}`);
            setLogs(data || []);
        } catch(e: any) {
            console.error(e);
            setError(e.message || 'Errore durante il recupero dei log');
            addToast('Errore caricamento audit log', 'error');
        } finally {
            setLoading(false);
        }
    }, [filters, addToast]);


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
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider ml-1 mb-1 block">Azione</label>
                        <input 
                            type="text" 
                            className="form-input py-2 text-sm" 
                            placeholder="es. LOGIN" 
                            value={filters.actionType}
                            onChange={e => setFilters(prev => ({...prev, actionType: e.target.value}))}
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
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider ml-1 mb-1 block">A</label>
                        <input 
                            type="date" 
                            className="form-input py-2 text-sm" 
                            value={filters.endDate}
                            onChange={e => setFilters(prev => ({...prev, endDate: e.target.value}))}
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
                    ) : error ? (
                        <div className="p-12 text-center bg-error-container/10 rounded-2xl border border-error/20">
                            <span className="material-symbols-outlined text-error text-4xl mb-2">error</span>
                            <p className="text-on-surface font-bold">Impossibile caricare i log</p>
                            <p className="text-xs text-on-surface-variant mt-1">{error}</p>
                            <button onClick={fetchLogs} className="mt-4 px-4 py-2 bg-primary text-on-primary rounded-full text-xs font-bold">Riprova</button>
                        </div>
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
    const [activePillar, setActivePillar] = useState<'id' | 'rbac' | 'entity' | 'nav' | 'audit'>('audit'); // Default to Audit per request focus

    const pillars = [
        { id: 'audit',  label: 'Security Audit',         icon: 'policy',        desc: 'Timeline Attività' },
        { id: 'rbac',   label: 'Access Control Matrix',  icon: 'security',      desc: 'Rotte e Ruoli' },
        { id: 'entity', label: 'Entity Visibility',      icon: 'visibility',    desc: 'Visibilità Entità' },
        { id: 'id',     label: 'Identity & Users',       icon: 'badge',         desc: 'Whitelist Utenti' },
        { id: 'nav',    label: 'App Architecture',       icon: 'account_tree',  desc: 'Menu e Landing' },
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
                    {activePillar === 'entity' && <EntityVisibilityPillar />}
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
