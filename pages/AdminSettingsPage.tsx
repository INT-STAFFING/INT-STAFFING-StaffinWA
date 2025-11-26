import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { SpinnerIcon } from '../components/icons';
import Modal from '../components/Modal';
import { AppUser, RolePermission, SidebarItem, AuditLogEntry, UserRole, DashboardCategory } from '../types';
import { useEntitiesContext } from '../context/AppContext';
import SearchableSelect from '../components/SearchableSelect';
import ConfirmationModal from '../components/ConfirmationModal';
import { DASHBOARD_CARDS_CONFIG } from '../config/dashboardLayout';

const UserManagementSection: React.FC = () => {
    const [users, setUsers] = useState<AppUser[]>([]);
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();
    const { resources } = useEntitiesContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Partial<AppUser> & { password?: string }>({});
    const [showPassword, setShowPassword] = useState(false);
    
    // Bulk Action State
    const [selectedBulkRole, setSelectedBulkRole] = useState<UserRole | ''>('');
    const [isBulkLoading, setIsBulkLoading] = useState(false);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/resources?entity=app-users', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        const isNew = !editingUser.id;
        const method = isNew ? 'POST' : 'PUT';
        const url = `/api/resources?entity=app-users${isNew ? '' : `&id=${editingUser.id}`}`;
        
        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(editingUser)
            });
            
            if (!res.ok) throw new Error('Failed to save user');
            
            addToast('Utente salvato con successo', 'success');
            setIsModalOpen(false);
            fetchUsers();
        } catch (e) {
            addToast('Errore nel salvataggio utente', 'error');
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (!confirm('Sei sicuro di voler eliminare questo utente?')) return;
        try {
            await fetch(`/api/resources?entity=app-users&id=${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });
            addToast('Utente eliminato', 'success');
            fetchUsers();
        } catch (e) {
            addToast('Errore eliminazione utente', 'error');
        }
    };

    const handleBulkStatusUpdate = async (isActive: boolean) => {
        if (!selectedBulkRole) {
            addToast('Seleziona un ruolo per eseguire l\'azione massiva.', 'error');
            return;
        }
        
        const actionLabel = isActive ? 'ABILITARE' : 'DISABILITARE';
        if (!confirm(`Sei sicuro di voler ${actionLabel} tutti gli utenti con ruolo ${selectedBulkRole}?`)) return;

        setIsBulkLoading(true);
        try {
            const res = await fetch(`/api/resources?entity=app-users&action=bulk_status_update`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ role: selectedBulkRole, isActive })
            });

            if (!res.ok) throw new Error('Failed bulk update');
            const data = await res.json();
            
            addToast(`Operazione completata. ${data.updatedCount} utenti aggiornati.`, 'success');
            fetchUsers();
        } catch (e) {
            addToast('Errore durante l\'aggiornamento massivo.', 'error');
        } finally {
            setIsBulkLoading(false);
        }
    };

    const openModal = (user?: AppUser) => {
        setEditingUser(user ? { ...user } : { role: 'SIMPLE', isActive: true, username: '', mustChangePassword: false });
        setShowPassword(false);
        setIsModalOpen(true);
    };

    const resourceOptions = useMemo(() => resources.map(r => ({ value: r.id!, label: r.name })), [resources]);

    return (
        <div className="bg-surface rounded-2xl shadow p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-on-surface">Gestione Utenti</h2>
                <button onClick={() => openModal()} className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">add</span> Nuovo Utente
                </button>
            </div>
            
            {/* Bulk Actions Toolbar */}
            <div className="mb-6 p-3 bg-surface-container-low rounded-lg border border-outline-variant flex flex-wrap items-center gap-4">
                <span className="text-sm font-bold text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-lg">groups</span> Azioni di Gruppo:
                </span>
                <select 
                    value={selectedBulkRole} 
                    onChange={(e) => setSelectedBulkRole(e.target.value as UserRole)}
                    className="form-select text-sm py-1 w-48"
                >
                    <option value="">Seleziona Ruolo...</option>
                    <option value="SIMPLE">Simple User</option>
                    <option value="MANAGER">Manager</option>
                    <option value="SENIOR MANAGER">Senior Manager</option>
                    <option value="MANAGING DIRECTOR">Managing Director</option>
                </select>
                <div className="flex gap-2">
                    <button 
                        onClick={() => handleBulkStatusUpdate(true)} 
                        disabled={!selectedBulkRole || isBulkLoading}
                        className="px-3 py-1 bg-tertiary-container text-on-tertiary-container rounded text-xs font-bold hover:opacity-80 disabled:opacity-50 transition-opacity"
                    >
                        Abilita Tutti
                    </button>
                    <button 
                        onClick={() => handleBulkStatusUpdate(false)} 
                        disabled={!selectedBulkRole || isBulkLoading}
                        className="px-3 py-1 bg-error-container text-on-error-container rounded text-xs font-bold hover:opacity-80 disabled:opacity-50 transition-opacity"
                    >
                        Disabilita Tutti
                    </button>
                </div>
                {isBulkLoading && <SpinnerIcon className="w-4 h-4 text-primary ml-2" />}
            </div>
            
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-surface-container-low text-on-surface-variant">
                        <tr>
                            <th className="px-4 py-2 text-left">Username</th>
                            <th className="px-4 py-2 text-left">Ruolo</th>
                            <th className="px-4 py-2 text-left">Risorsa Collegata</th>
                            <th className="px-4 py-2 text-center">Stato</th>
                            <th className="px-4 py-2 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                        {users.map(u => {
                            const resourceName = resources.find(r => r.id === u.resourceId)?.name || '-';
                            return (
                                <tr key={u.id} className="hover:bg-surface-container-low">
                                    <td className="px-4 py-2 font-medium text-on-surface">
                                        {u.username}
                                        {u.mustChangePassword && <span className="ml-2 text-xs text-yellow-600 bg-yellow-100 px-1 rounded">Reset richiesto</span>}
                                    </td>
                                    <td className="px-4 py-2 text-on-surface-variant">{u.role}</td>
                                    <td className="px-4 py-2 text-on-surface-variant">{resourceName}</td>
                                    <td className="px-4 py-2 text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${u.isActive ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-error-container text-on-error-container'}`}>
                                            {u.isActive ? 'Attivo' : 'Disabilitato'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        <button onClick={() => openModal(u)} className="p-1 text-primary hover:bg-primary-container rounded mr-1">
                                            <span className="material-symbols-outlined text-sm">edit</span>
                                        </button>
                                        {u.username !== 'admin' && (
                                            <button onClick={() => handleDeleteUser(u.id)} className="p-1 text-error hover:bg-error-container rounded">
                                                <span className="material-symbols-outlined text-sm">delete</span>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser.id ? 'Modifica Utente' : 'Nuovo Utente'}>
                    <form onSubmit={handleSaveUser} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Username *</label>
                            <input 
                                type="text" 
                                required 
                                value={editingUser.username} 
                                onChange={e => setEditingUser({...editingUser, username: e.target.value})}
                                className="form-input w-full"
                            />
                        </div>
                        
                        {(!editingUser.id || showPassword) && (
                            <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-1">Password {editingUser.id && '(Lascia vuoto per non cambiare)'}</label>
                                <input 
                                    type="password" 
                                    required={!editingUser.id}
                                    value={editingUser.password || ''} 
                                    onChange={e => setEditingUser({...editingUser, password: e.target.value})}
                                    className="form-input w-full"
                                />
                            </div>
                        )}
                        
                        {editingUser.id && !showPassword && (
                            <button type="button" onClick={() => setShowPassword(true)} className="text-sm text-primary hover:underline">Cambia Password</button>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Ruolo</label>
                            <select 
                                value={editingUser.role} 
                                onChange={e => setEditingUser({...editingUser, role: e.target.value as any})}
                                className="form-select w-full"
                            >
                                <option value="SIMPLE">Simple User</option>
                                <option value="MANAGER">Manager</option>
                                <option value="SENIOR MANAGER">Senior Manager</option>
                                <option value="MANAGING DIRECTOR">Managing Director</option>
                                <option value="ADMIN">Admin</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Risorsa Collegata (Opzionale)</label>
                            <SearchableSelect 
                                name="resourceId" 
                                value={editingUser.resourceId || ''} 
                                onChange={(_, v) => setEditingUser({...editingUser, resourceId: v})} 
                                options={resourceOptions} 
                                placeholder="Nessuna"
                            />
                            <p className="text-xs text-on-surface-variant mt-1">Collega l'utente a una risorsa per funzionalità self-service (es. ferie).</p>
                        </div>

                        <div className="space-y-2 bg-surface-container-low p-3 rounded">
                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    checked={editingUser.isActive} 
                                    onChange={e => setEditingUser({...editingUser, isActive: e.target.checked})}
                                    className="form-checkbox"
                                />
                                <label className="text-sm text-on-surface">Utente Attivo</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    checked={editingUser.mustChangePassword} 
                                    onChange={e => setEditingUser({...editingUser, mustChangePassword: e.target.checked})}
                                    className="form-checkbox"
                                />
                                <label className="text-sm text-on-surface">Forza cambio password al prossimo login</label>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-outline rounded-full text-primary hover:bg-surface-container">Annulla</button>
                            <button type="submit" className="px-4 py-2 bg-primary text-on-primary rounded-full hover:opacity-90">Salva</button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

const PermissionMatrixSection: React.FC = () => {
    const [permissions, setPermissions] = useState<RolePermission[]>([]);
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();

    // Define all protectable paths
    const allPaths = [
        '/dashboard', '/notifications', '/staffing', '/workload', '/gantt', '/projects', '/contracts', 
        '/clients', '/forecasting', '/resources', '/skills', '/skill-analysis', 
        '/roles', '/leaves', '/resource-requests', '/interviews', '/skills-map', 
        '/staffing-visualization', '/manuale-utente', '/simple-user-manual', 
        '/reports', '/calendar', '/config', '/import', '/export', '/test-staffing',
        '/admin-settings', '/db-inspector'
    ];

    const fetchPermissions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/resources?entity=role-permissions', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
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

    const handleToggle = (role: 'SIMPLE' | 'MANAGER' | 'SENIOR MANAGER' | 'MANAGING DIRECTOR', path: string) => {
        setPermissions(prev => {
            const existingIndex = prev.findIndex(p => p.role === role && p.pagePath === path);
            const newPerms = [...prev];
            if (existingIndex >= 0) {
                newPerms[existingIndex] = { ...newPerms[existingIndex], allowed: !newPerms[existingIndex].allowed };
            } else {
                newPerms.push({ role, pagePath: path, allowed: true });
            }
            return newPerms;
        });
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/resources?entity=role-permissions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ permissions })
            });
            
            if (!res.ok) throw new Error('Failed to save permissions');
            
            // Update local state with exact response from server to ensure sync
            const data = await res.json();
            if (data.permissions) setPermissions(data.permissions);

            addToast('Permessi salvati con successo', 'success');
        } catch (e) {
            addToast('Errore nel salvataggio permessi', 'error');
        } finally {
            setLoading(false);
        }
    };

    const isAllowed = (role: 'SIMPLE' | 'MANAGER' | 'SENIOR MANAGER' | 'MANAGING DIRECTOR', path: string) => {
        const perm = permissions.find(p => p.role === role && p.pagePath === path);
        return perm ? perm.allowed : false; // Default false if not set
    };

    return (
        <div className="bg-surface rounded-2xl shadow p-6 mt-6">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-xl font-semibold text-on-surface">Matrice Permessi (RBAC)</h2>
                    <p className="text-xs text-on-surface-variant">Definisci quali ruoli possono accedere a quali pagine. Admin ha sempre accesso completo.</p>
                </div>
                <button onClick={handleSave} disabled={loading} className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                    {loading ? <SpinnerIcon className="w-4 h-4" /> : <><span className="material-symbols-outlined text-sm">save</span> Salva Permessi</>}
                </button>
            </div>

            <div className="overflow-x-auto border border-outline-variant rounded-lg">
                <table className="min-w-full text-sm">
                    <thead className="bg-surface-container-low text-on-surface-variant">
                        <tr>
                            <th className="px-4 py-2 text-left">Pagina / Percorso</th>
                            <th className="px-4 py-2 text-center w-24">Simple</th>
                            <th className="px-4 py-2 text-center w-24">Manager</th>
                            <th className="px-4 py-2 text-center w-24">Senior Mgr</th>
                            <th className="px-4 py-2 text-center w-24">Man. Dir</th>
                            <th className="px-4 py-2 text-center w-24 bg-surface-container text-on-surface/50">Admin</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                        {allPaths.map(path => (
                            <tr key={path} className="hover:bg-surface-container-low">
                                <td className="px-4 py-2 font-mono text-xs text-on-surface">{path}</td>
                                <td className="px-4 py-2 text-center">
                                    <input 
                                        type="checkbox" 
                                        checked={isAllowed('SIMPLE', path)} 
                                        onChange={() => handleToggle('SIMPLE', path)}
                                        className="form-checkbox text-primary rounded focus:ring-primary cursor-pointer"
                                    />
                                </td>
                                <td className="px-4 py-2 text-center">
                                    <input 
                                        type="checkbox" 
                                        checked={isAllowed('MANAGER', path)} 
                                        onChange={() => handleToggle('MANAGER', path)}
                                        className="form-checkbox text-primary rounded focus:ring-primary cursor-pointer"
                                    />
                                </td>
                                <td className="px-4 py-2 text-center">
                                    <input 
                                        type="checkbox" 
                                        checked={isAllowed('SENIOR MANAGER', path)} 
                                        onChange={() => handleToggle('SENIOR MANAGER', path)}
                                        className="form-checkbox text-primary rounded focus:ring-primary cursor-pointer"
                                    />
                                </td>
                                <td className="px-4 py-2 text-center">
                                    <input 
                                        type="checkbox" 
                                        checked={isAllowed('MANAGING DIRECTOR', path)} 
                                        onChange={() => handleToggle('MANAGING DIRECTOR', path)}
                                        className="form-checkbox text-primary rounded focus:ring-primary cursor-pointer"
                                    />
                                </td>
                                <td className="px-4 py-2 text-center bg-surface-container text-success font-bold text-xs">
                                    ALWAYS
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const AuditLogSection: React.FC = () => {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [cleanupModalOpen, setCleanupModalOpen] = useState(false);
    const [cleanupStrategy, setCleanupStrategy] = useState<'30' | '60' | '90' | 'all'>('90');
    const { addToast } = useToast();

    // Filters
    const [filterUser, setFilterUser] = useState('');
    const [filterAction, setFilterAction] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            if (filterUser) queryParams.append('username', filterUser);
            if (filterAction) queryParams.append('actionType', filterAction);
            if (startDate) queryParams.append('startDate', startDate);
            if (endDate) queryParams.append('endDate', endDate);
            queryParams.append('limit', '200');

            const res = await fetch(`/api/resources?entity=audit_logs&${queryParams.toString()}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [filterUser, filterAction, startDate, endDate]);

    useEffect(() => {
        fetchLogs();
    }, []);

    const handleCleanup = async () => {
        try {
            const res = await fetch(`/api/resources?entity=audit_logs&action=cleanup&olderThanDays=${cleanupStrategy}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });
            
            if (!res.ok) throw new Error('Cleanup failed');
            const data = await res.json();
            
            addToast(`Pulizia completata. ${data.deletedCount} record eliminati.`, 'success');
            setCleanupModalOpen(false);
            fetchLogs();
        } catch (e) {
            addToast('Errore durante la pulizia dei log.', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-surface rounded-2xl shadow p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-on-surface">Audit Log (Attività Utenti)</h2>
                    <button 
                        onClick={() => setCleanupModalOpen(true)} 
                        className="px-4 py-2 bg-error-container text-on-error-container rounded-full text-sm font-medium flex items-center gap-2 hover:opacity-80"
                    >
                        <span className="material-symbols-outlined text-sm">delete_sweep</span> Manutenzione Log
                    </button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 bg-surface-container-low p-4 rounded-lg">
                    <input 
                        type="text" 
                        placeholder="Filtra per Username" 
                        value={filterUser} 
                        onChange={e => setFilterUser(e.target.value)}
                        className="form-input text-sm"
                    />
                    <input 
                        type="text" 
                        placeholder="Filtra per Azione (es. LOGIN, CREATE)" 
                        value={filterAction} 
                        onChange={e => setFilterAction(e.target.value)}
                        className="form-input text-sm"
                    />
                    <input 
                        type="date" 
                        value={startDate} 
                        onChange={e => setStartDate(e.target.value)}
                        className="form-input text-sm"
                    />
                    <input 
                        type="date" 
                        value={endDate} 
                        onChange={e => setEndDate(e.target.value)}
                        className="form-input text-sm"
                    />
                    <button onClick={fetchLogs} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-md text-sm font-medium hover:opacity-90">
                        Filtra
                    </button>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-outline-variant rounded-lg max-h-[600px]">
                    <table className="min-w-full text-sm">
                        <thead className="bg-surface-container sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-on-surface-variant uppercase">Data/Ora</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-on-surface-variant uppercase">Utente</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-on-surface-variant uppercase">Azione</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-on-surface-variant uppercase">Entità</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-on-surface-variant uppercase">Dettagli</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-on-surface-variant uppercase">IP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant bg-surface">
                            {loading ? (
                                <tr><td colSpan={6} className="p-8 text-center"><SpinnerIcon className="w-6 h-6 mx-auto text-primary"/></td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-on-surface-variant">Nessun log trovato con i filtri correnti.</td></tr>
                            ) : (
                                logs.map(log => (
                                    <tr key={log.id} className="hover:bg-surface-container-low">
                                        <td className="px-4 py-2 whitespace-nowrap text-xs text-on-surface-variant">
                                            {new Date(log.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2 font-medium text-primary">
                                            {log.username || 'System'}
                                        </td>
                                        <td className="px-4 py-2 font-mono text-xs">
                                            <span className={`px-2 py-0.5 rounded ${log.action.includes('DELETE') ? 'bg-error-container text-on-error-container' : log.action.includes('CREATE') ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-surface-container text-on-surface'}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-xs text-on-surface-variant">
                                            {log.entity} {log.entityId ? `(${log.entityId.substring(0,8)}...)` : ''}
                                        </td>
                                        <td className="px-4 py-2 text-xs font-mono text-on-surface-variant max-w-xs truncate" title={JSON.stringify(log.details, null, 2)}>
                                            {JSON.stringify(log.details)}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-on-surface-variant">
                                            {log.ipAddress}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Cleanup Modal */}
            <ConfirmationModal
                isOpen={cleanupModalOpen}
                onClose={() => setCleanupModalOpen(false)}
                onConfirm={handleCleanup}
                title="Manutenzione Audit Log"
                confirmButtonText="Esegui Pulizia"
                message={
                    <div className="space-y-4">
                        <p>Seleziona i criteri per la pulizia dei log. Questa operazione è irreversibile.</p>
                        <div>
                            <label className="block text-sm font-medium mb-2">Criterio di Cancellazione:</label>
                            <select 
                                value={cleanupStrategy} 
                                onChange={(e) => setCleanupStrategy(e.target.value as any)}
                                className="form-select w-full"
                            >
                                <option value="30">Più vecchi di 30 giorni</option>
                                <option value="60">Più vecchi di 60 giorni</option>
                                <option value="90">Più vecchi di 90 giorni</option>
                                <option value="all">Elimina TUTTI i log (Attenzione!)</option>
                            </select>
                        </div>
                        {cleanupStrategy === 'all' && (
                            <p className="text-error text-xs font-bold bg-error-container p-2 rounded">
                                Attenzione: Stai per cancellare l'intera storia delle azioni.
                            </p>
                        )}
                    </div>
                }
            />
        </div>
    );
};

const DashboardConfigSection: React.FC = () => {
    const { dashboardLayout, updateDashboardLayout, isActionLoading } = useEntitiesContext();
    const { addToast } = useToast();
    const [layout, setLayout] = useState<DashboardCategory[]>(dashboardLayout);
    const [hasChanges, setHasChanges] = useState(false);
    
    // State for adding/editing category
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    
    useEffect(() => { setLayout(dashboardLayout); }, [dashboardLayout]);

    const handleAddCategory = () => {
        if (!newCategoryName) return;
        const newId = newCategoryName.toLowerCase().replace(/\s+/g, '_');
        if (layout.some(c => c.id === newId)) {
            addToast('Esiste già una categoria con questo ID/Nome.', 'error');
            return;
        }
        setLayout(prev => [...prev, { id: newId, label: newCategoryName, cards: [] }]);
        setNewCategoryName('');
        setHasChanges(true);
    };

    const handleDeleteCategory = (id: string) => {
        if (layout.length <= 1) {
            addToast('Deve esserci almeno una categoria.', 'error');
            return;
        }
        if (!confirm('Sei sicuro? Le card in questa categoria verranno rimosse dalla dashboard.')) return;
        setLayout(prev => prev.filter(c => c.id !== id));
        setHasChanges(true);
    };

    const moveCategory = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === layout.length - 1) return;
        const newLayout = [...layout];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newLayout[index], newLayout[targetIndex]] = [newLayout[targetIndex], newLayout[index]];
        setLayout(newLayout);
        setHasChanges(true);
    };

    const moveCard = (catIndex: number, cardId: string, direction: 'up' | 'down') => {
        const category = layout[catIndex];
        const cardIndex = category.cards.indexOf(cardId);
        if (cardIndex === -1) return;
        if (direction === 'up' && cardIndex === 0) return;
        if (direction === 'down' && cardIndex === category.cards.length - 1) return;

        const newCards = [...category.cards];
        const targetIndex = direction === 'up' ? cardIndex - 1 : cardIndex + 1;
        [newCards[cardIndex], newCards[targetIndex]] = [newCards[targetIndex], newCards[cardIndex]];

        const newLayout = [...layout];
        newLayout[catIndex] = { ...category, cards: newCards };
        setLayout(newLayout);
        setHasChanges(true);
    };

    const removeCardFromCategory = (catIndex: number, cardId: string) => {
        const newLayout = [...layout];
        newLayout[catIndex].cards = newLayout[catIndex].cards.filter(c => c !== cardId);
        setLayout(newLayout);
        setHasChanges(true);
    };

    const addCardToCategory = (catIndex: number, cardId: string) => {
        // Check if card exists elsewhere? Maybe allow duplicates or move? 
        // Let's implement MOVE logic: remove from others, add to this.
        let newLayout = [...layout];
        
        // Remove from all categories
        newLayout = newLayout.map(cat => ({
            ...cat,
            cards: cat.cards.filter(c => c !== cardId)
        }));

        // Add to target
        newLayout[catIndex].cards.push(cardId);
        setLayout(newLayout);
        setHasChanges(true);
    };

    const handleSave = async () => {
        try {
            await updateDashboardLayout(layout);
            addToast('Layout dashboard salvato.', 'success');
            setHasChanges(false);
        } catch (e) {
            addToast('Errore nel salvataggio.', 'error');
        }
    };

    // Find unassigned cards
    const assignedCardIds = new Set(layout.flatMap(c => c.cards));
    const unassignedCards = DASHBOARD_CARDS_CONFIG.filter(c => !assignedCardIds.has(c.id));

    return (
        <div className="bg-surface rounded-2xl shadow p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-on-surface">Configurazione Dashboard</h2>
                    <p className="text-xs text-on-surface-variant">Organizza le card della dashboard in tab (categorie).</p>
                </div>
                {hasChanges && (
                    <button onClick={handleSave} disabled={isActionLoading('updateDashboardLayout')} className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium flex items-center gap-2">
                        {isActionLoading('updateDashboardLayout') ? <SpinnerIcon className="w-4 h-4" /> : <><span className="material-symbols-outlined text-sm">save</span> Salva Layout</>}
                    </button>
                )}
            </div>

            {/* Add Category */}
            <div className="flex gap-2 mb-6">
                <input 
                    type="text" 
                    value={newCategoryName} 
                    onChange={e => setNewCategoryName(e.target.value)} 
                    placeholder="Nuova Categoria (es. Finanza)..."
                    className="form-input flex-grow"
                />
                <button onClick={handleAddCategory} disabled={!newCategoryName} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded font-bold disabled:opacity-50">
                    Aggiungi
                </button>
            </div>

            <div className="space-y-4">
                {layout.map((category, catIndex) => (
                    <div key={category.id} className="border border-outline-variant rounded-lg bg-surface-container-low overflow-hidden">
                        {/* Category Header */}
                        <div className="p-3 flex justify-between items-center bg-surface-container border-b border-outline-variant">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-on-surface">{category.label}</span>
                                <div className="flex flex-col">
                                    <button onClick={() => moveCategory(catIndex, 'up')} disabled={catIndex === 0} className="text-on-surface-variant hover:text-primary disabled:opacity-30 p-0 leading-none"><span className="material-symbols-outlined text-sm">keyboard_arrow_up</span></button>
                                    <button onClick={() => moveCategory(catIndex, 'down')} disabled={catIndex === layout.length - 1} className="text-on-surface-variant hover:text-primary disabled:opacity-30 p-0 leading-none"><span className="material-symbols-outlined text-sm">keyboard_arrow_down</span></button>
                                </div>
                            </div>
                            <button onClick={() => handleDeleteCategory(category.id)} className="text-error hover:bg-error-container p-1 rounded"><span className="material-symbols-outlined text-sm">delete</span></button>
                        </div>

                        {/* Cards List */}
                        <div className="p-2 space-y-2">
                            {category.cards.map((cardId, cardIndex) => {
                                const cardInfo = DASHBOARD_CARDS_CONFIG.find(c => c.id === cardId);
                                return (
                                    <div key={cardId} className="flex items-center justify-between p-2 bg-surface border border-outline-variant rounded shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">{cardInfo?.icon || '❓'}</span>
                                            <span className="text-sm font-medium">{cardInfo?.label || cardId}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => moveCard(catIndex, cardId, 'up')} disabled={cardIndex === 0} className="text-on-surface-variant hover:text-primary disabled:opacity-30"><span className="material-symbols-outlined text-sm">arrow_upward</span></button>
                                            <button onClick={() => moveCard(catIndex, cardId, 'down')} disabled={cardIndex === category.cards.length - 1} className="text-on-surface-variant hover:text-primary disabled:opacity-30"><span className="material-symbols-outlined text-sm">arrow_downward</span></button>
                                            <button onClick={() => removeCardFromCategory(catIndex, cardId)} className="text-on-surface-variant hover:text-error ml-2"><span className="material-symbols-outlined text-sm">close</span></button>
                                        </div>
                                    </div>
                                );
                            })}
                            {category.cards.length === 0 && <p className="text-xs text-on-surface-variant italic text-center p-2">Nessuna card.</p>}
                            
                            {/* Add Card Dropdown */}
                            <div className="mt-2 pt-2 border-t border-dashed border-outline-variant">
                                <select 
                                    className="form-select text-xs"
                                    value=""
                                    onChange={(e) => {
                                        if(e.target.value) addCardToCategory(catIndex, e.target.value);
                                    }}
                                >
                                    <option value="">+ Aggiungi / Sposta Card qui...</option>
                                    {DASHBOARD_CARDS_CONFIG.filter(c => !category.cards.includes(c.id)).map(c => (
                                        <option key={c.id} value={c.id}>{c.icon} {c.label} {assignedCardIds.has(c.id) ? '(Sposta)' : '(Nuova)'}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Orphaned Cards Warning */}
            {unassignedCards.length > 0 && (
                <div className="mt-6 p-4 bg-yellow-container/20 border border-yellow-container rounded-lg">
                    <h3 className="text-sm font-bold text-on-yellow-container mb-2">Card non assegnate (non visibili):</h3>
                    <div className="flex flex-wrap gap-2">
                        {unassignedCards.map(c => (
                            <span key={c.id} className="inline-flex items-center px-2 py-1 rounded bg-surface border border-yellow-container text-xs">
                                {c.icon} {c.label}
                            </span>
                        ))}
                    </div>
                    <p className="text-xs mt-2 text-on-yellow-container">Usa i dropdown sopra per aggiungerle a una categoria.</p>
                </div>
            )}
        </div>
    );
};

// --- NEW SECTION: Cache Control ---
const CacheControlSection: React.FC = () => {
    const { forceRecalculateAnalytics, isActionLoading } = useEntitiesContext();
    
    return (
        <div className="bg-surface rounded-2xl shadow p-6 mt-6">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-xl font-semibold text-on-surface">Gestione Cache Analytics</h2>
                    <p className="text-xs text-on-surface-variant">
                        Gestisce i dati precalcolati per la Dashboard. I dati vengono aggiornati automaticamente, ma puoi forzarne il ricalcolo qui.
                    </p>
                </div>
                <button 
                    onClick={forceRecalculateAnalytics} 
                    disabled={isActionLoading('recalculateAnalytics')}
                    className="px-4 py-2 bg-tertiary-container text-on-tertiary-container rounded-full text-sm font-medium flex items-center gap-2 disabled:opacity-50 hover:opacity-80"
                >
                    {isActionLoading('recalculateAnalytics') ? <SpinnerIcon className="w-4 h-4" /> : <><span className="material-symbols-outlined text-sm">refresh</span> Forza Ricalcolo Totale</>}
                </button>
            </div>
        </div>
    );
};

const AdminSettingsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState('general');

    const tabs = [
        { id: 'general', label: 'Generale', icon: 'settings' },
        { id: 'users', label: 'Utenti & Sicurezza', icon: 'security' },
        { id: 'dashboard', label: 'Dashboard', icon: 'dashboard_customize' }, 
        { id: 'audit', label: 'Audit Log', icon: 'history' },
        { id: 'menu', label: 'Menu & Navigazione', icon: 'menu_open' },
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
                {activeTab === 'general' && <SecuritySection />}
                {activeTab === 'users' && (
                    <div className="space-y-8">
                        <UserManagementSection />
                        <PermissionMatrixSection />
                    </div>
                )}
                {activeTab === 'dashboard' && (
                    <div className="space-y-8">
                        <DashboardConfigSection />
                        <CacheControlSection /> 
                    </div>
                )}
                {activeTab === 'audit' && <AuditLogSection />}
                {activeTab === 'menu' && <MenuConfigurationEditor />}
                {activeTab === 'business' && (
                    <div className="space-y-6">
                        <SkillThresholdsEditor />
                        <LeaveConfigurationEditor />
                    </div>
                )}
                {activeTab === 'ui' && <ThemeSection />}
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
    const { sidebarConfig, updateSidebarConfig, sidebarSections, updateSidebarSections, sidebarSectionColors, updateSidebarSectionColors, isActionLoading } = useEntitiesContext();
    const { addToast } = useToast();
    const [config, setConfig] = useState<SidebarItem[]>(sidebarConfig);
    const [hasChanges, setHasChanges] = useState(false);
    const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
    
    // Sections Management State
    const [localSections, setLocalSections] = useState<string[]>(sidebarSections);
    const [localSectionColors, setLocalSectionColors] = useState<Record<string, string>>(sidebarSectionColors);
    
    const [newSectionName, setNewSectionName] = useState('');
    const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null);
    const [editSectionValue, setEditSectionValue] = useState('');

    useEffect(() => { setConfig(sidebarConfig); }, [sidebarConfig]);
    useEffect(() => { setLocalSections(sidebarSections); }, [sidebarSections]);
    useEffect(() => { setLocalSectionColors(sidebarSectionColors); }, [sidebarSectionColors]);

    const handleChange = (index: number, field: keyof SidebarItem, value: string) => {
        const newConfig = [...config];
        // If value is empty string for color, make it undefined
        if (field === 'color' && value === '') {
             newConfig[index] = { ...newConfig[index], color: undefined };
        } else {
             newConfig[index] = { ...newConfig[index], [field]: value };
        }
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
            console.error("Error saving menu config:", error);
            addToast('Errore salvataggio menu.', 'error');
        }
    };

    // Section Management Handlers
    const handleAddSection = () => {
        if (newSectionName && !localSections.includes(newSectionName)) {
            setLocalSections([...localSections, newSectionName]);
            setNewSectionName('');
        }
    };

    const handleMoveSection = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === localSections.length - 1) return;
        const newSecs = [...localSections];
        const target = direction === 'up' ? index - 1 : index + 1;
        [newSecs[index], newSecs[target]] = [newSecs[target], newSecs[index]];
        setLocalSections(newSecs);
    };

    const startEditSection = (index: number) => {
        setEditingSectionIndex(index);
        setEditSectionValue(localSections[index]);
    };

    const saveEditSection = (index: number) => {
        if (editSectionValue && editSectionValue !== localSections[index]) {
            const oldName = localSections[index];
            const newSecs = [...localSections];
            newSecs[index] = editSectionValue;
            setLocalSections(newSecs);
            
            // Migrate colors
            const newColors = { ...localSectionColors };
            if (newColors[oldName]) {
                newColors[editSectionValue] = newColors[oldName];
                delete newColors[oldName];
                setLocalSectionColors(newColors);
            }
            
            // Cascade rename to menu items
            const newConfig = config.map(item => item.section === oldName ? { ...item, section: editSectionValue } : item);
            setConfig(newConfig);
            setHasChanges(true);
        }
        setEditingSectionIndex(null);
        setEditSectionValue('');
    };

    const handleSectionColorChange = (section: string, color: string) => {
        setLocalSectionColors(prev => ({
            ...prev,
            [section]: color
        }));
    };

    const saveSections = async () => {
        try {
            await updateSidebarSections(localSections);
            await updateSidebarSectionColors(localSectionColors);
            if (hasChanges) {
                await updateSidebarConfig(config);
                setHasChanges(false);
            }
            addToast('Sezioni salvate con successo.', 'success');
            setIsSectionModalOpen(false);
        } catch (e) {
            console.error("Error saving sections:", e);
            addToast('Errore salvataggio sezioni.', 'error');
        }
    };

    const colorOptions = [
        { value: '', label: 'Default' },
        { value: 'primary', label: 'Primary' },
        { value: 'secondary', label: 'Secondary' },
        { value: 'tertiary', label: 'Tertiary' },
        { value: 'error', label: 'Error' },
    ];

    return (
        <div className="bg-surface rounded-2xl shadow p-6">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-xl font-semibold text-on-surface">Configurazione Menu Sidebar</h2>
                    <p className="text-xs text-on-surface-variant">Personalizza nomi, icone, ordine e colori delle voci del menu.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsSectionModalOpen(true)} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full text-sm font-medium flex items-center gap-2 hover:opacity-90">
                        <span className="material-symbols-outlined text-sm">category</span> Gestisci Sezioni
                    </button>
                    {hasChanges && (
                        <button onClick={handleSave} disabled={isActionLoading('updateSidebarConfig')} className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium flex items-center gap-2 hover:opacity-90">
                            {isActionLoading('updateSidebarConfig') ? <SpinnerIcon className="w-4 h-4" /> : <><span className="material-symbols-outlined text-sm">save</span> Salva Modifiche</>}
                        </button>
                    )}
                </div>
            </div>

            <div className="border border-outline-variant rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-4 bg-surface-container-low p-3 font-bold text-xs text-on-surface-variant uppercase border-b border-outline-variant">
                    <div className="col-span-1 text-center">Ordine</div>
                    <div className="col-span-3">Etichetta</div>
                    <div className="col-span-3">Icona & Colore</div>
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
                                <span className="material-symbols-outlined" style={{ color: item.color ? `var(--color-${item.color})` : 'var(--color-primary)' }}>{item.icon}</span>
                                <input 
                                    type="text" 
                                    value={item.icon} 
                                    onChange={(e) => handleChange(index, 'icon', e.target.value)}
                                    className="w-24 bg-transparent border-b border-transparent hover:border-outline focus:border-primary text-sm text-on-surface-variant outline-none px-1 font-mono"
                                    placeholder="Icon"
                                />
                                <select 
                                    value={item.color || ''}
                                    onChange={(e) => handleChange(index, 'color', e.target.value)}
                                    className="bg-transparent border-b border-transparent hover:border-outline focus:border-primary text-xs text-on-surface-variant outline-none py-1"
                                >
                                    {colorOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            </div>
                            <div className="col-span-3">
                                <select 
                                    value={item.section}
                                    onChange={(e) => handleChange(index, 'section', e.target.value)}
                                    className="w-full bg-transparent border-b border-transparent hover:border-outline focus:border-primary text-sm text-on-surface outline-none py-1"
                                >
                                    {localSections.map(sec => (
                                        <option key={sec} value={sec}>{sec}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-2 text-right text-xs text-on-surface-variant font-mono truncate" title={item.path}>
                                {item.path}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal for Managing Sections */}
            {isSectionModalOpen && (
                <Modal isOpen={isSectionModalOpen} onClose={() => setIsSectionModalOpen(false)} title="Gestisci Sezioni Menu">
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={newSectionName} 
                                onChange={(e) => setNewSectionName(e.target.value)} 
                                placeholder="Nome nuova sezione..."
                                className="form-input flex-grow"
                            />
                            <button 
                                onClick={handleAddSection} 
                                disabled={!newSectionName}
                                className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-bold disabled:opacity-50"
                            >
                                Aggiungi
                            </button>
                        </div>
                        
                        <div className="border border-outline-variant rounded-lg overflow-hidden">
                            <div className="bg-surface-container-low p-2 grid grid-cols-4 text-xs font-bold text-on-surface-variant uppercase border-b border-outline-variant">
                                <div className="col-span-2">Nome Sezione</div>
                                <div className="col-span-1">Colore</div>
                                <div className="col-span-1 text-right">Azioni</div>
                            </div>
                            <ul className="divide-y divide-outline-variant max-h-60 overflow-y-auto">
                                {localSections.map((section, idx) => (
                                    <li key={idx} className="p-3 grid grid-cols-4 items-center hover:bg-surface-container-low gap-2">
                                        <div className="col-span-2 flex items-center gap-2">
                                            {editingSectionIndex === idx ? (
                                                <div className="flex items-center w-full gap-2">
                                                    <input 
                                                        type="text" 
                                                        value={editSectionValue} 
                                                        onChange={(e) => setEditSectionValue(e.target.value)}
                                                        className="form-input py-1 px-2 h-8 text-sm"
                                                        autoFocus
                                                    />
                                                    <button onClick={() => saveEditSection(idx)} className="text-primary"><span className="material-symbols-outlined">check</span></button>
                                                    <button onClick={() => setEditingSectionIndex(null)} className="text-on-surface-variant"><span className="material-symbols-outlined">close</span></button>
                                                </div>
                                            ) : (
                                                <>
                                                    <span 
                                                        className="text-sm font-medium text-on-surface"
                                                        style={localSectionColors[section] ? { color: `var(--color-${localSectionColors[section]})` } : {}}
                                                    >
                                                        {section}
                                                    </span>
                                                    <button onClick={() => startEditSection(idx)} className="text-on-surface-variant hover:text-primary opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity">
                                                        <span className="material-symbols-outlined text-sm">edit</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                        <div className="col-span-1">
                                            <select
                                                value={localSectionColors[section] || ''}
                                                onChange={(e) => handleSectionColorChange(section, e.target.value)}
                                                className="form-select text-xs py-1 pl-2 pr-6 h-8"
                                            >
                                                {colorOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-1 flex justify-end gap-1">
                                            <button onClick={() => handleMoveSection(idx, 'up')} disabled={idx === 0} className="text-on-surface-variant disabled:opacity-30 hover:bg-surface-container rounded p-1">
                                                <span className="material-symbols-outlined">arrow_upward</span>
                                            </button>
                                            <button onClick={() => handleMoveSection(idx, 'down')} disabled={idx === localSections.length - 1} className="text-on-surface-variant disabled:opacity-30 hover:bg-surface-container rounded p-1">
                                                <span className="material-symbols-outlined">arrow_downward</span>
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant">
                            <button onClick={() => setIsSectionModalOpen(false)} className="px-4 py-2 border border-outline rounded-full text-primary font-semibold text-sm hover:bg-surface-container-low">Annulla</button>
                            <button onClick={saveSections} className="px-4 py-2 bg-primary text-on-primary rounded-full font-semibold text-sm hover:opacity-90">
                                {isActionLoading('updateSidebarSections') ? 'Salvataggio...' : 'Salva Ordine & Nomi'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

const SkillThresholdsEditor: React.FC = () => {
    const { skillThresholds, updateSkillThresholds, isActionLoading } = useEntitiesContext();
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
    const { leaveTypes, addLeaveType, updateLeaveType, deleteLeaveType, isActionLoading } = useEntitiesContext();
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[600px] overflow-y-auto pr-2">
                        {Object.entries(localTheme.light).map(([key, val]) => (
                            <div key={key} className="flex items-center gap-2 p-1 hover:bg-surface-container rounded">
                                <input type="color" value={val as string} onChange={(e) => handleColorChange('light', key, e.target.value)} className="h-8 w-8 rounded cursor-pointer border-0 p-0 flex-shrink-0"/>
                                <span className="text-xs text-on-surface-variant truncate" title={key}>{key}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <h3 className="font-medium text-on-surface mb-3">Colori Scuri (Dark Mode)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[600px] overflow-y-auto pr-2">
                        {Object.entries(localTheme.dark).map(([key, val]) => (
                            <div key={key} className="flex items-center gap-2 p-1 hover:bg-surface-container rounded">
                                <input type="color" value={val as string} onChange={(e) => handleColorChange('dark', key, e.target.value)} className="h-8 w-8 rounded cursor-pointer border-0 p-0 flex-shrink-0"/>
                                <span className="text-xs text-on-surface-variant truncate" title={key}>{key}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminSettingsPage;