import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SpinnerIcon } from '../../components/icons';
import { AuditLogEntry } from '../../types';
import { authorizedJsonFetch } from '../../utils/api';

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
export const AuditPillar: React.FC = () => {
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
        } catch (e: unknown) {
            console.error(e);
            setError(getErrorMessage(e) || 'Errore durante il recupero dei log');
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
                            aria-label="Applica Filtri" title="Applica Filtri"
                        >
                            <span className="material-symbols-outlined text-lg">search</span>
                        </button>
                        <button
                            onClick={handleReset}
                            className="px-3 bg-surface-container-high text-on-surface py-2 rounded-lg font-bold hover:bg-surface-container-highest transition-colors"
                            aria-label="Reset Filtri" title="Reset Filtri"
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
                                <h4 className="text-sm font-bold text-primary uppercase tracking-wide mb-4 sticky top-0 bg-surface/95 backdrop-blur py-2 z-10 border-b border-outline-variant">
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
