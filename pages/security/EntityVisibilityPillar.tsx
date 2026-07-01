import React, { useMemo } from 'react';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { useToast } from '../../context/ToastContext';
import { SpinnerIcon } from '../../components/icons';
import { RoleEntityVisibility, UserRole } from '../../types';
import { authorizedJsonFetch } from '../../utils/api';
import { useAuthorizedResource, createAuthorizedFetcher } from '../../hooks/useAuthorizedResource';
import { ROLE_ABBR } from './securityShared';

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

export const EntityVisibilityPillar: React.FC = () => {
    const { data: visibilityData, loading, error, updateCache } = useAuthorizedResource<RoleEntityVisibility[]>(
        'security-entity-visibility',
        createAuthorizedFetcher<RoleEntityVisibility[]>('/api/resources?entity=role_entity_visibility')
    );

    const { addToast } = useToast();

    // Tutte le useMemo PRIMA di qualsiasi early return (regola hook di React)
    const entityGroups = useMemo(() => {
        const groups: Record<string, typeof MANAGEABLE_ENTITIES> = {};
        MANAGEABLE_ENTITIES.forEach(e => {
            if (!groups[e.group]) groups[e.group] = [];
            groups[e.group].push(e);
        });
        return groups;
    }, []);

    const dependencyErrors = useMemo(() => {
        const rules = visibilityData || [];
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
    }, [visibilityData]);

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

    // Early return DOPO tutti gli hook
    if (error) {
        return (
            <div className="p-8 text-center bg-error-container/10 rounded-2xl border border-error/20">
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
        } catch (e: unknown) {
            addToast(`Errore nel salvataggio: ${getErrorMessage(e)}`, 'error');
        }
    };

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
                                <h4 className="font-bold uppercase text-[10px] tracking-wide text-on-surface-variant">{group}</h4>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-surface-container">
                                        <tr className="border-b border-outline-variant">
                                            <th className="px-6 py-3 text-left font-bold uppercase text-[10px] tracking-wide text-on-surface-variant">Entità</th>
                                            {ENTITY_VISIBILITY_ROLES.map(role => (
                                                <th key={role} className="px-2 py-3 text-center font-bold uppercase text-[10px] tracking-wide text-on-surface-variant w-20" title={role}>
                                                    {ROLE_ABBR[role] ?? role.substring(0, 8)}
                                                </th>
                                            ))}
                                            <th className="px-4 py-3 text-center font-bold uppercase text-[10px] tracking-wide bg-primary/5 text-primary">Admin</th>
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
                <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant mb-2 flex items-center gap-2">
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
