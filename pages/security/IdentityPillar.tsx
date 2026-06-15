import React, { useState, useMemo, useCallback } from 'react';
import { useResourcesContext } from '../../context/ResourcesContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { SpinnerIcon } from '../../components/icons';
import Modal from '../../components/Modal';
import SearchableSelect from '../../components/SearchableSelect';
import MultiSelectDropdown from '../../components/MultiSelectDropdown';
import { AppUser } from '../../types';
import { authorizedJsonFetch } from '../../utils/api';
import { useAuthorizedResource, createAuthorizedFetcher } from '../../hooks/useAuthorizedResource';
import { DataTable, ColumnDef } from '../../components/DataTable';

// --- PILASTRO 1: GESTIONE IDENTITÀ ---
export const IdentityPillar: React.FC = () => {
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
                            <div>
                                <label className="block text-sm font-bold mb-1 text-on-surface-variant">Manager (Superiori Gerarchici)</label>
                                <MultiSelectDropdown name="managerIds" selectedValues={editingUser.managerIds || []} onChange={(_, v) => setEditingUser({...editingUser, managerIds: v})} options={(users || []).filter(u => u.id !== editingUser.id).map(u => ({ value: u.id, label: `${u.username} (${u.role})` }))} placeholder="Nessun manager (root)..." />
                                {(editingUser.role === 'SIMPLE' || editingUser.role === 'SIMPLE_EXT') && (
                                    <p className="text-[10px] text-on-surface-variant mt-1 italic">Per i ruoli SIMPLE i manager vengono anche auto-derivati dai Project Manager dei progetti assegnati.</p>
                                )}
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
