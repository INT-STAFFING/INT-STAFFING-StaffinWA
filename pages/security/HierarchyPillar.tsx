import React, { useState, useMemo, useCallback } from 'react';
import { useResourcesContext } from '../../context/ResourcesContext';
import { useToast } from '../../context/ToastContext';
import { SpinnerIcon } from '../../components/icons';
import MultiSelectDropdown from '../../components/MultiSelectDropdown';
import { AppUser } from '../../types';
import { useProjectsContext } from '../../context/ProjectsContext';
import { authorizedJsonFetch } from '../../utils/api';
import { useAuthorizedResource, createAuthorizedFetcher } from '../../hooks/useAuthorizedResource';

// --- PILASTRO 6: GERARCHIA ORGANIZZATIVA ---
interface HierarchyNode {
    user: AppUser;
    children: HierarchyNode[];
}

export const HierarchyPillar: React.FC = () => {
    const { data: users, loading, error, updateCache } = useAuthorizedResource<AppUser[]>(
        'security-users',
        createAuthorizedFetcher<AppUser[]>('/api/resources?entity=app-users')
    );
    const { resources } = useResourcesContext();
    const { projects, assignments } = useProjectsContext();
    const { addToast } = useToast();
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [selectedManagerIds, setSelectedManagerIds] = useState<string[]>([]);

    const resourceMap = useMemo(() => {
        const map: Record<string, { name: string; function: string; roleId: string }> = {};
        resources.forEach(r => { if (r.id) map[r.id] = { name: r.name, function: r.function, roleId: r.roleId }; });
        return map;
    }, [resources]);

    // Build a map: resource name → app_user IDs (for resolving projectManager names to user IDs)
    const pmNameToUserIds = useMemo(() => {
        if (!users) return new Map<string, string[]>();
        const resourceIdToUserIds = new Map<string, string[]>();
        users.forEach(u => {
            if (u.resourceId) {
                if (!resourceIdToUserIds.has(u.resourceId)) resourceIdToUserIds.set(u.resourceId, []);
                resourceIdToUserIds.get(u.resourceId)!.push(u.id);
            }
        });
        const nameMap = new Map<string, string[]>();
        resources.forEach(r => {
            if (r.id && r.name) {
                const uIds = resourceIdToUserIds.get(r.id);
                if (uIds) nameMap.set(r.name.toLowerCase(), uIds);
            }
        });
        return nameMap;
    }, [users, resources]);

    // Compute effective managerIds for each user (manual + auto-derived from project assignments for SIMPLE/SIMPLE_EXT)
    const effectiveManagerIds = useMemo(() => {
        if (!users) return new Map<string, { manual: string[]; auto: string[]; all: string[] }>();
        const userMap = new Map<string, AppUser>();
        users.forEach(u => userMap.set(u.id, u));

        const result = new Map<string, { manual: string[]; auto: string[]; all: string[] }>();
        users.forEach(u => {
            const manual = (u.managerIds || []).filter(id => userMap.has(id));
            let auto: string[] = [];

            if (u.role === 'SIMPLE' || u.role === 'SIMPLE_EXT') {
                if (u.resourceId) {
                    // Find projects this user is assigned to
                    const userProjectIds = assignments
                        .filter(a => a.resourceId === u.resourceId)
                        .map(a => a.projectId);

                    // Get project managers for those projects
                    const pmUserIds = new Set<string>();
                    projects.forEach(p => {
                        if (p.id && userProjectIds.includes(p.id) && p.projectManager) {
                            const ids = pmNameToUserIds.get(p.projectManager.toLowerCase());
                            ids?.forEach(id => { if (id !== u.id) pmUserIds.add(id); });
                        }
                    });
                    auto = [...pmUserIds].filter(id => !manual.includes(id));
                }
            }

            const all = [...new Set([...manual, ...auto])];
            result.set(u.id, { manual, auto, all });
        });
        return result;
    }, [users, assignments, projects, pmNameToUserIds]);

    const { roots, orphans } = useMemo(() => {
        if (!users) return { roots: [] as HierarchyNode[], orphans: [] as AppUser[] };
        const userMap = new Map<string, AppUser>();
        users.forEach(u => userMap.set(u.id, u));

        // Build children map: manager → list of children (a user can appear under multiple managers)
        const childrenMap = new Map<string, HierarchyNode[]>();
        const rootNodes: HierarchyNode[] = [];
        const orphanUsers: AppUser[] = [];
        const placedUsers = new Set<string>();

        users.forEach(u => {
            const eff = effectiveManagerIds.get(u.id);
            const allMgrs = eff?.all || [];
            const validMgrs = allMgrs.filter(id => userMap.has(id));

            if (validMgrs.length > 0) {
                validMgrs.forEach(mgrId => {
                    if (!childrenMap.has(mgrId)) childrenMap.set(mgrId, []);
                    childrenMap.get(mgrId)!.push({ user: u, children: [] });
                });
                placedUsers.add(u.id);
            } else if (u.role === 'ADMIN' || allMgrs.length === 0) {
                rootNodes.push({ user: u, children: [] });
                placedUsers.add(u.id);
            } else {
                orphanUsers.push(u);
            }
        });

        // Recursively attach children (with cycle protection via visited set)
        const buildTree = (node: HierarchyNode, visited: Set<string>): HierarchyNode => {
            if (visited.has(node.user.id)) return { ...node, children: [] };
            const nextVisited = new Set(visited);
            nextVisited.add(node.user.id);
            const kids = childrenMap.get(node.user.id) || [];
            node.children = kids.map(k => buildTree({ ...k }, nextVisited)).sort((a, b) => a.user.username.localeCompare(b.user.username));
            return node;
        };

        return {
            roots: rootNodes.map(n => buildTree(n, new Set())).sort((a, b) => {
                if (a.user.role === 'ADMIN' && b.user.role !== 'ADMIN') return -1;
                if (b.user.role === 'ADMIN' && a.user.role !== 'ADMIN') return 1;
                return a.user.username.localeCompare(b.user.username);
            }),
            orphans: orphanUsers,
        };
    }, [users, effectiveManagerIds]);

    const countDescendants = useCallback((node: HierarchyNode): number => {
        return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
    }, []);

    const toggleExpand = useCallback((id: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const expandAll = useCallback(() => {
        if (!users) return;
        setExpandedNodes(new Set(users.map(u => u.id)));
    }, [users]);

    const collapseAll = useCallback(() => {
        setExpandedNodes(new Set());
    }, []);

    const handleManagersChange = useCallback(async (userId: string, newManagerIds: string[]) => {
        if (!users) return;
        const user = users.find(u => u.id === userId);
        if (!user) return;
        try {
            const updated = await authorizedJsonFetch<AppUser>(`/api/resources?entity=app-users&id=${userId}`, {
                method: 'PUT',
                body: JSON.stringify({ ...user, managerIds: newManagerIds })
            });
            updateCache(prev => (prev || []).map(u => u.id === userId ? { ...u, managerIds: newManagerIds, version: updated.version } : u));
            addToast('Gerarchia aggiornata con successo', 'success');
            setEditingUserId(null);
        } catch (e: any) {
            addToast(`Errore: ${e.message}`, 'error');
        }
    }, [users, updateCache, addToast]);

    const ROLE_COLORS: Record<string, string> = {
        'ADMIN': 'bg-error/15 text-error border-error/30',
        'MANAGING DIRECTOR': 'bg-primary/15 text-primary border-primary/30',
        'MANAGING DIRECTOR_EXT': 'bg-primary/10 text-primary border-primary/20',
        'ASSOCIATE DIRECTOR': 'bg-tertiary/15 text-tertiary border-tertiary/30',
        'ASSOCIATE DIRECTOR_EXT': 'bg-tertiary/10 text-tertiary border-tertiary/20',
        'SENIOR MANAGER': 'bg-secondary/15 text-secondary border-secondary/30',
        'SENIOR MANAGER_EXT': 'bg-secondary/10 text-secondary border-secondary/20',
        'MANAGER': 'bg-primary/10 text-on-surface border-primary/20',
        'MANAGER_EXT': 'bg-primary/5 text-on-surface-variant border-primary/10',
        'SIMPLE': 'bg-surface-container text-on-surface-variant border-outline-variant',
        'SIMPLE_EXT': 'bg-surface-container-low text-on-surface-variant border-outline-variant/50',
    };

    const renderNode = (node: HierarchyNode, depth: number = 0, parentKey: string = ''): React.ReactNode => {
        const { user } = node;
        const nodeKey = parentKey ? `${parentKey}-${user.id}` : user.id;
        const isExpanded = expandedNodes.has(user.id);
        const hasChildren = node.children.length > 0;
        const descendantCount = countDescendants(node);
        const resource = user.resourceId ? resourceMap[user.resourceId] : null;
        const isEditing = editingUserId === user.id;
        const roleColor = ROLE_COLORS[user.role] || ROLE_COLORS['SIMPLE'];
        const eff = effectiveManagerIds.get(user.id);
        const hasAutoManagers = (eff?.auto.length || 0) > 0;

        return (
            <div key={nodeKey} className="relative">
                {depth > 0 && (
                    <div className="absolute left-0 top-0 bottom-0 border-l-2 border-outline-variant/40" style={{ marginLeft: `${(depth - 1) * 32 + 16}px` }} />
                )}
                {depth > 0 && (
                    <div className="absolute border-t-2 border-outline-variant/40" style={{ left: `${(depth - 1) * 32 + 16}px`, top: '24px', width: '16px' }} />
                )}

                <div className="flex items-center gap-2 py-1.5" style={{ paddingLeft: `${depth * 32}px` }}>
                    <button
                        onClick={() => hasChildren && toggleExpand(user.id)}
                        className={`w-6 h-6 flex items-center justify-center rounded-full shrink-0 transition-colors ${hasChildren ? 'hover:bg-surface-container-high cursor-pointer text-on-surface-variant' : 'text-transparent cursor-default'}`}
                    >
                        {hasChildren && (
                            <span className={`material-symbols-outlined text-base transition-transform ${isExpanded ? 'rotate-90' : ''}`}>chevron_right</span>
                        )}
                    </button>

                    <div className={`flex-1 flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all ${roleColor} ${!user.isActive ? 'opacity-40' : ''}`}>
                        <div className="w-8 h-8 rounded-full bg-on-surface/10 flex items-center justify-center text-sm font-bold shrink-0">
                            {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sm truncate">{user.username}</span>
                                <span className="text-[9px] font-black uppercase tracking-widest opacity-70">{user.role}</span>
                                {!user.isActive && <span className="text-[9px] font-black text-error uppercase">DISAB.</span>}
                                {hasAutoManagers && (
                                    <span className="text-[9px] font-bold text-tertiary bg-tertiary/10 px-1.5 py-0.5 rounded" title="Manager auto-derivati da assegnazioni progetto">AUTO</span>
                                )}
                            </div>
                            {resource && (
                                <p className="text-[11px] opacity-60 truncate">{resource.name} · {resource.function}</p>
                            )}
                        </div>
                        {hasChildren && (
                            <span className="text-[10px] font-bold opacity-50 shrink-0">
                                {node.children.length} dirett{node.children.length === 1 ? 'o' : 'i'}{descendantCount > node.children.length ? ` · ${descendantCount} totali` : ''}
                            </span>
                        )}

                        {isEditing ? (
                            <div className="flex items-center gap-1 shrink-0 max-w-[300px]" onClick={e => e.stopPropagation()}>
                                <MultiSelectDropdown
                                    name="edit-managers"
                                    selectedValues={selectedManagerIds}
                                    onChange={(_, v) => setSelectedManagerIds(v)}
                                    options={(users || []).filter(u => u.id !== user.id).map(u => ({ value: u.id, label: `${u.username} (${u.role})` }))}
                                    placeholder="Manager..."
                                />
                                <button
                                    onClick={() => handleManagersChange(user.id, selectedManagerIds)}
                                    className="p-1 rounded-full hover:bg-surface-container text-primary"
                                    title="Conferma"
                                >
                                    <span className="material-symbols-outlined text-base">check</span>
                                </button>
                                <button
                                    onClick={() => setEditingUserId(null)}
                                    className="p-1 rounded-full hover:bg-surface-container text-on-surface-variant"
                                    title="Annulla"
                                >
                                    <span className="material-symbols-outlined text-base">close</span>
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => { setEditingUserId(user.id); setSelectedManagerIds(user.managerIds || []); }}
                                className="p-1 rounded-full hover:bg-on-surface/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                title="Gestisci manager manuali"
                            >
                                <span className="material-symbols-outlined text-base">swap_vert</span>
                            </button>
                        )}
                    </div>
                </div>

                {isExpanded && node.children.map(child => renderNode(child, depth + 1, nodeKey))}
            </div>
        );
    };

    if (error) {
        return (
            <div className="p-8 text-center bg-error-container/10 rounded-3xl border border-error/20">
                <span className="material-symbols-outlined text-error text-4xl mb-2">error</span>
                <p className="text-on-surface font-bold">Errore nel caricamento della gerarchia</p>
                <p className="text-xs text-on-surface-variant mt-1">{error}</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <SpinnerIcon className="w-8 h-8 text-primary" />
            </div>
        );
    }

    const usersWithReports = users?.filter(u => (users || []).some(c => (effectiveManagerIds.get(c.id)?.all || []).includes(u.id))).length || 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-on-surface tracking-tight">Gerarchia Organizzativa</h2>
                    <p className="text-xs text-on-surface-variant mt-1">Struttura ad albero dei rapporti gerarchici tra utenti. Per SIMPLE/SIMPLE_EXT i manager vengono auto-derivati dai Project Manager.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={expandAll} className="px-3 py-1.5 rounded-full text-xs font-bold text-primary hover:bg-primary/10 transition-colors flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">unfold_more</span> Espandi
                    </button>
                    <button onClick={collapseAll} className="px-3 py-1.5 rounded-full text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">unfold_less</span> Comprimi
                    </button>
                </div>
            </div>

            <div className="space-y-0.5 [&_>_div]:group">
                {roots.map(node => renderNode(node, 0))}
            </div>

            {orphans.length > 0 && (
                <div className="mt-8 p-5 bg-yellow-container/10 border border-yellow-container/30 rounded-3xl">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-yellow-700 text-lg">warning</span>
                        <h3 className="text-sm font-bold text-on-surface">Utenti con manager non validi ({orphans.length})</h3>
                    </div>
                    <p className="text-xs text-on-surface-variant mb-3">Questi utenti hanno managerIds che non corrispondono a utenti attivi. Assegna nuovi manager.</p>
                    <div className="flex flex-wrap gap-2">
                        {orphans.map(u => (
                            <span key={u.id} className="px-3 py-1 rounded-full text-xs font-bold bg-surface-container border border-outline-variant">
                                {u.username} <span className="opacity-50">({u.role})</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                <div className="p-4 bg-surface-container-low rounded-2xl text-center">
                    <p className="text-2xl font-black text-primary">{users?.length || 0}</p>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Utenti Totali</p>
                </div>
                <div className="p-4 bg-surface-container-low rounded-2xl text-center">
                    <p className="text-2xl font-black text-tertiary">{roots.length}</p>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Nodi Root</p>
                </div>
                <div className="p-4 bg-surface-container-low rounded-2xl text-center">
                    <p className="text-2xl font-black text-secondary">{usersWithReports}</p>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Con Riporti</p>
                </div>
                <div className="p-4 bg-surface-container-low rounded-2xl text-center">
                    <p className="text-2xl font-black text-error">{orphans.length}</p>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Orfani</p>
                </div>
            </div>
        </div>
    );
};
