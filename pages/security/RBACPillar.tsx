import React, { useState, useEffect, useMemo } from 'react';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { useUIConfigContext } from '../../context/UIConfigContext';
import { useToast } from '../../context/ToastContext';
import { RolePermission, UserRole } from '../../types';
import { authorizedJsonFetch } from '../../utils/api';
import { routesManifest } from '../../routes';
import { useAuthorizedResource, createAuthorizedFetcher } from '../../hooks/useAuthorizedResource';
import { ROLE_ABBR } from './securityShared';

// --- PILASTRO 2: MATRICE RBAC UNIFICATA ---
export const RBACPillar: React.FC = () => {
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
        } catch (e: unknown) {
            addToast(`Errore nel salvataggio della configurazione: ${getErrorMessage(e)}`, 'error');
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

            <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-base" aria-hidden="true">info</span> Note
                </p>
                <ul className="text-xs text-on-surface-variant space-y-1">
                    <li>• Le modifiche hanno effetto al prossimo login dell'utente o ricaricamento della sessione: gli utenti già autenticati conservano i permessi correnti fino ad allora.</li>
                    <li>• Il ruolo ADMIN ha sempre accesso a tutti i moduli e non è limitabile da questa matrice.</li>
                </ul>
            </div>
        </div>
    );
};
