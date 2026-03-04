/**
 * @file pages/OrgChartPage.tsx
 * @description Pagina Organigramma — visualizzazione grafica della gerarchia organizzativa degli utenti.
 * Mostra una struttura ad albero verticale con nodi card collegati da linee.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useResourcesContext } from '../context/ResourcesContext';
import { SpinnerIcon } from '../components/icons';
import { AppUser } from '../types';
import { useAuthorizedResource, createAuthorizedFetcher } from '../hooks/useAuthorizedResource';

// --- Types ---
interface OrgNode {
    user: AppUser;
    children: OrgNode[];
    depth: number;
}

// --- Role color mapping (MD3 tokens) ---
const ROLE_STYLES: Record<string, { bg: string; border: string; badge: string }> = {
    'ADMIN':                  { bg: 'bg-error-container/60',     border: 'border-error/40',           badge: 'bg-error text-on-error' },
    'MANAGING DIRECTOR':      { bg: 'bg-primary-container/60',   border: 'border-primary/40',         badge: 'bg-primary text-on-primary' },
    'MANAGING DIRECTOR_EXT':  { bg: 'bg-primary-container/40',   border: 'border-primary/25',         badge: 'bg-primary/80 text-on-primary' },
    'ASSOCIATE DIRECTOR':     { bg: 'bg-tertiary-container/60',  border: 'border-tertiary/40',        badge: 'bg-tertiary text-on-tertiary' },
    'ASSOCIATE DIRECTOR_EXT': { bg: 'bg-tertiary-container/40',  border: 'border-tertiary/25',        badge: 'bg-tertiary/80 text-on-tertiary' },
    'SENIOR MANAGER':         { bg: 'bg-secondary-container/60', border: 'border-secondary/40',       badge: 'bg-secondary text-on-secondary' },
    'SENIOR MANAGER_EXT':     { bg: 'bg-secondary-container/40', border: 'border-secondary/25',       badge: 'bg-secondary/80 text-on-secondary' },
    'MANAGER':                { bg: 'bg-primary/10',             border: 'border-primary/20',         badge: 'bg-primary/70 text-on-primary' },
    'MANAGER_EXT':            { bg: 'bg-primary/5',              border: 'border-primary/15',         badge: 'bg-primary/50 text-white' },
    'SIMPLE':                 { bg: 'bg-surface-container',      border: 'border-outline-variant',    badge: 'bg-on-surface-variant/20 text-on-surface-variant' },
    'SIMPLE_EXT':             { bg: 'bg-surface-container-low',  border: 'border-outline-variant/50', badge: 'bg-on-surface-variant/10 text-on-surface-variant' },
};

const getStyle = (role: string) => ROLE_STYLES[role] || ROLE_STYLES['SIMPLE'];

// --- Node Card ---
const OrgNodeCard: React.FC<{
    node: OrgNode;
    resourceMap: Record<string, { name: string; function: string }>;
    isExpanded: boolean;
    onToggle: () => void;
    isHighlighted: boolean;
}> = ({ node, resourceMap, isExpanded, onToggle, isHighlighted }) => {
    const { user } = node;
    const resource = user.resourceId ? resourceMap[user.resourceId] : null;
    const style = getStyle(user.role);
    const hasChildren = node.children.length > 0;

    return (
        <div
            className={`relative flex flex-col items-center transition-all duration-200 ${isHighlighted ? 'scale-105 z-10' : ''}`}
        >
            <div
                onClick={hasChildren ? onToggle : undefined}
                className={`
                    w-52 rounded-2xl border-2 p-4 transition-all duration-200 select-none
                    ${style.bg} ${style.border}
                    ${hasChildren ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02]' : ''}
                    ${!user.isActive ? 'opacity-40' : ''}
                    ${isHighlighted ? 'ring-2 ring-primary ring-offset-2 shadow-xl' : 'shadow-md'}
                `}
            >
                {/* Avatar */}
                <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black ${style.badge}`}>
                        {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-on-surface truncate leading-tight">
                            {resource?.name || user.username}
                        </p>
                        <p className="text-[10px] text-on-surface-variant truncate">{user.username}</p>
                    </div>
                </div>

                {/* Role badge */}
                <div className="flex items-center justify-between gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${style.badge}`}>
                        {user.role}
                    </span>
                    {resource?.function && (
                        <span className="text-[9px] text-on-surface-variant font-medium truncate max-w-[80px]">
                            {resource.function}
                        </span>
                    )}
                </div>

                {/* Children indicator */}
                {hasChildren && (
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition-transform ${isExpanded ? 'bg-primary text-on-primary rotate-180' : 'bg-surface-container-high text-on-surface-variant border border-outline-variant'}`}>
                            <span className="material-symbols-outlined text-sm">expand_more</span>
                        </div>
                    </div>
                )}

                {/* Inactive overlay */}
                {!user.isActive && (
                    <div className="absolute top-1 right-1">
                        <span className="material-symbols-outlined text-error text-sm">block</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Recursive Tree Renderer ---
const OrgTreeLevel: React.FC<{
    nodes: OrgNode[];
    resourceMap: Record<string, { name: string; function: string }>;
    expandedNodes: Set<string>;
    onToggle: (id: string) => void;
    searchTerm: string;
    matchingIds: Set<string>;
}> = ({ nodes, resourceMap, expandedNodes, onToggle, searchTerm, matchingIds }) => {
    if (nodes.length === 0) return null;

    return (
        <div className="flex flex-col items-center">
            <div className="flex items-start justify-center gap-6 flex-wrap">
                {nodes.map((node) => {
                    const isExpanded = expandedNodes.has(node.user.id);
                    const hasChildren = node.children.length > 0;
                    const isHighlighted = searchTerm.length > 0 && matchingIds.has(node.user.id);

                    return (
                        <div key={node.user.id} className="flex flex-col items-center">
                            <OrgNodeCard
                                node={node}
                                resourceMap={resourceMap}
                                isExpanded={isExpanded}
                                onToggle={() => onToggle(node.user.id)}
                                isHighlighted={isHighlighted}
                            />

                            {/* Vertical connector line */}
                            {hasChildren && isExpanded && (
                                <>
                                    <div className="w-0.5 h-6 bg-outline-variant/60" />
                                    {/* Horizontal connector for multiple children */}
                                    {node.children.length > 1 && (
                                        <div className="relative w-full flex justify-center">
                                            <div
                                                className="h-0.5 bg-outline-variant/60 absolute top-0"
                                                style={{
                                                    width: `calc(100% - ${100 / node.children.length}%)`,
                                                    maxWidth: `${(node.children.length - 1) * 232}px`,
                                                }}
                                            />
                                        </div>
                                    )}
                                    {/* Recurse into children */}
                                    <div className="flex items-start justify-center gap-6 flex-wrap pt-0">
                                        {node.children.map(child => (
                                            <div key={child.user.id} className="flex flex-col items-center">
                                                <div className="w-0.5 h-4 bg-outline-variant/60" />
                                                <OrgTreeLevel
                                                    nodes={[child]}
                                                    resourceMap={resourceMap}
                                                    expandedNodes={expandedNodes}
                                                    onToggle={onToggle}
                                                    searchTerm={searchTerm}
                                                    matchingIds={matchingIds}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- Main Page ---
const OrgChartPage: React.FC = () => {
    const { data: users, loading, error } = useAuthorizedResource<AppUser[]>(
        'orgchart-users',
        createAuthorizedFetcher<AppUser[]>('/api/resources?entity=app-users')
    );
    const { resources } = useResourcesContext();

    const [searchTerm, setSearchTerm] = useState('');
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [showInactive, setShowInactive] = useState(false);
    const [zoom, setZoom] = useState(100);
    const containerRef = useRef<HTMLDivElement>(null);

    // Resource lookup map
    const resourceMap = useMemo(() => {
        const map: Record<string, { name: string; function: string }> = {};
        resources.forEach(r => { if (r.id) map[r.id] = { name: r.name, function: r.function }; });
        return map;
    }, [resources]);

    // Build tree
    const { roots, orphans, allNodeIds } = useMemo(() => {
        if (!users) return { roots: [] as OrgNode[], orphans: [] as AppUser[], allNodeIds: new Set<string>() };

        const filteredUsers = showInactive ? users : users.filter(u => u.isActive);
        const userMap = new Map<string, AppUser>();
        filteredUsers.forEach(u => userMap.set(u.id, u));

        const childrenMap = new Map<string, OrgNode[]>();
        const rootNodes: OrgNode[] = [];
        const orphanUsers: AppUser[] = [];
        const ids = new Set<string>();

        filteredUsers.forEach(u => {
            ids.add(u.id);
            if (u.managerId && userMap.has(u.managerId)) {
                if (!childrenMap.has(u.managerId)) childrenMap.set(u.managerId, []);
                childrenMap.get(u.managerId)!.push({ user: u, children: [], depth: 0 });
            } else if (u.role === 'ADMIN' || !u.managerId) {
                rootNodes.push({ user: u, children: [], depth: 0 });
            } else {
                orphanUsers.push(u);
            }
        });

        const buildTree = (node: OrgNode, depth: number): OrgNode => {
            node.depth = depth;
            const kids = childrenMap.get(node.user.id) || [];
            node.children = kids.map(k => buildTree(k, depth + 1)).sort((a, b) => a.user.username.localeCompare(b.user.username));
            return node;
        };

        return {
            roots: rootNodes.map(n => buildTree(n, 0)).sort((a, b) => {
                if (a.user.role === 'ADMIN' && b.user.role !== 'ADMIN') return -1;
                if (b.user.role === 'ADMIN' && a.user.role !== 'ADMIN') return 1;
                return a.user.username.localeCompare(b.user.username);
            }),
            orphans: orphanUsers,
            allNodeIds: ids,
        };
    }, [users, showInactive]);

    // Search matching
    const matchingIds = useMemo(() => {
        if (!searchTerm || !users) return new Set<string>();
        const term = searchTerm.toLowerCase();
        const matched = new Set<string>();
        users.forEach(u => {
            const resource = u.resourceId ? resourceMap[u.resourceId] : null;
            const searchable = [u.username, u.role, resource?.name, resource?.function].filter(Boolean).join(' ').toLowerCase();
            if (searchable.includes(term)) matched.add(u.id);
        });
        return matched;
    }, [searchTerm, users, resourceMap]);

    // Auto-expand to show search results
    useEffect(() => {
        if (matchingIds.size === 0 || !users) return;

        const userMap = new Map<string, AppUser>();
        users.forEach(u => userMap.set(u.id, u));

        const toExpand = new Set<string>();
        matchingIds.forEach(id => {
            let current = userMap.get(id);
            while (current?.managerId) {
                toExpand.add(current.managerId);
                current = userMap.get(current.managerId);
            }
        });
        setExpandedNodes(prev => {
            const next = new Set(prev);
            toExpand.forEach(id => next.add(id));
            return next;
        });
    }, [matchingIds, users]);

    const toggleExpand = useCallback((id: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const expandAll = useCallback(() => setExpandedNodes(new Set(allNodeIds)), [allNodeIds]);
    const collapseAll = useCallback(() => setExpandedNodes(new Set()), []);

    // Zoom controls
    const zoomIn = useCallback(() => setZoom(z => Math.min(z + 10, 150)), []);
    const zoomOut = useCallback(() => setZoom(z => Math.max(z - 10, 40)), []);
    const zoomReset = useCallback(() => setZoom(100), []);

    // Keyboard zoom
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === '=') { e.preventDefault(); zoomIn(); }
            if ((e.metaKey || e.ctrlKey) && e.key === '-') { e.preventDefault(); zoomOut(); }
            if ((e.metaKey || e.ctrlKey) && e.key === '0') { e.preventDefault(); zoomReset(); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [zoomIn, zoomOut, zoomReset]);

    // Stats
    const stats = useMemo(() => {
        if (!users) return { total: 0, active: 0, managers: 0, maxDepth: 0 };
        const active = users.filter(u => u.isActive).length;
        const managers = new Set(users.filter(u => u.managerId).map(u => u.managerId)).size;
        const getMaxDepth = (node: OrgNode): number => {
            if (node.children.length === 0) return 0;
            return 1 + Math.max(...node.children.map(getMaxDepth));
        };
        const maxDepth = roots.length > 0 ? Math.max(...roots.map(getMaxDepth)) : 0;
        return { total: users.length, active, managers, maxDepth };
    }, [users, roots]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <span className="material-symbols-outlined text-error text-5xl">error</span>
                <p className="text-on-surface font-bold">Errore nel caricamento dell'organigramma</p>
                <p className="text-sm text-on-surface-variant">{error}</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <SpinnerIcon className="w-10 h-10 text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-on-surface tracking-tight">Organigramma</h1>
                    <p className="text-sm text-on-surface-variant mt-1">Struttura gerarchica dell'organizzazione</p>
                </div>

                {/* Stats badges */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full">
                        <span className="material-symbols-outlined text-primary text-sm">group</span>
                        <span className="text-xs font-bold text-primary">{stats.total} utenti</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-tertiary/10 rounded-full">
                        <span className="material-symbols-outlined text-tertiary text-sm">device_hub</span>
                        <span className="text-xs font-bold text-tertiary">{stats.maxDepth + 1} livelli</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/10 rounded-full">
                        <span className="material-symbols-outlined text-secondary text-sm">supervisor_account</span>
                        <span className="text-xs font-bold text-secondary">{stats.managers} manager</span>
                    </div>
                </div>
            </div>

            {/* Controls bar */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-surface-container rounded-2xl border border-outline-variant">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
                    <input
                        type="text"
                        placeholder="Cerca per nome, username, ruolo..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="form-input pl-10 text-sm"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                        >
                            <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                    )}
                </div>

                <div className="h-8 w-px bg-outline-variant hidden sm:block" />

                {/* Expand/Collapse */}
                <button onClick={expandAll} className="px-3 py-1.5 rounded-full text-xs font-bold text-primary hover:bg-primary/10 transition-colors flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">unfold_more</span>
                    <span className="hidden sm:inline">Espandi tutto</span>
                </button>
                <button onClick={collapseAll} className="px-3 py-1.5 rounded-full text-xs font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">unfold_less</span>
                    <span className="hidden sm:inline">Comprimi</span>
                </button>

                <div className="h-8 w-px bg-outline-variant hidden sm:block" />

                {/* Zoom */}
                <div className="flex items-center gap-1">
                    <button onClick={zoomOut} className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant" title="Riduci">
                        <span className="material-symbols-outlined text-sm">remove</span>
                    </button>
                    <button onClick={zoomReset} className="px-2 py-1 rounded-lg text-xs font-bold text-on-surface-variant hover:bg-surface-container-high min-w-[40px] text-center" title="Reset zoom">
                        {zoom}%
                    </button>
                    <button onClick={zoomIn} className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant" title="Ingrandisci">
                        <span className="material-symbols-outlined text-sm">add</span>
                    </button>
                </div>

                <div className="h-8 w-px bg-outline-variant hidden sm:block" />

                {/* Show inactive */}
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none text-on-surface-variant">
                    <input
                        type="checkbox"
                        checked={showInactive}
                        onChange={e => setShowInactive(e.target.checked)}
                        className="form-checkbox h-4 w-4 rounded"
                    />
                    Mostra inattivi
                </label>
            </div>

            {/* Search results count */}
            {searchTerm && (
                <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-xl border border-primary/10">
                    <span className="material-symbols-outlined text-primary text-sm">filter_list</span>
                    <span className="text-xs text-on-surface-variant">
                        {matchingIds.size === 0
                            ? `Nessun risultato per "${searchTerm}"`
                            : `${matchingIds.size} risultat${matchingIds.size === 1 ? 'o' : 'i'} per "${searchTerm}"`
                        }
                    </span>
                </div>
            )}

            {/* Org chart canvas */}
            <div
                ref={containerRef}
                className="overflow-auto bg-surface-container-low rounded-3xl border border-outline-variant p-8 min-h-[400px]"
                style={{ maxHeight: 'calc(100vh - 320px)' }}
            >
                <div
                    className="transition-transform duration-200 origin-top-left inline-block min-w-full"
                    style={{ transform: `scale(${zoom / 100})` }}
                >
                    {roots.length === 0 && !loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <span className="material-symbols-outlined text-6xl text-on-surface-variant/30">account_tree</span>
                            <p className="text-on-surface-variant font-bold">Nessuna gerarchia definita</p>
                            <p className="text-xs text-on-surface-variant">Configura i rapporti gerarchici dal Security Center &rarr; Gerarchia</p>
                        </div>
                    ) : (
                        <OrgTreeLevel
                            nodes={roots}
                            resourceMap={resourceMap}
                            expandedNodes={expandedNodes}
                            onToggle={toggleExpand}
                            searchTerm={searchTerm}
                            matchingIds={matchingIds}
                        />
                    )}
                </div>
            </div>

            {/* Orphan users */}
            {orphans.length > 0 && (
                <div className="p-5 bg-yellow-container/10 border border-yellow-container/30 rounded-2xl">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-yellow-700">warning</span>
                        <h3 className="text-sm font-bold text-on-surface">Utenti con manager non valido ({orphans.length})</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {orphans.map(u => (
                            <span key={u.id} className="px-3 py-1.5 rounded-full text-xs font-bold bg-surface-container border border-outline-variant">
                                {u.username} <span className="opacity-50">({u.role})</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-3">Legenda Ruoli</p>
                <div className="flex flex-wrap gap-2">
                    {Object.entries(ROLE_STYLES).map(([role, style]) => (
                        <div key={role} className="flex items-center gap-1.5">
                            <div className={`w-3 h-3 rounded ${style.badge}`} />
                            <span className="text-[10px] text-on-surface-variant font-medium">{role}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default OrgChartPage;
