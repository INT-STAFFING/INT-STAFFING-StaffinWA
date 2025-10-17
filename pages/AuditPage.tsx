/**
 * @file AuditPage.tsx
 * @description Pagina per l'audit delle assegnazioni, che mostra progetti senza risorse e risorse senza progetti.
 */

import React, { useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';

const AuditPage: React.FC = () => {
    const { projects, assignments, resources, clients, roles } = useEntitiesContext();

    /**
     * @description Memoizza la lista dei progetti che non hanno assegnazioni.
     * Esclude i progetti con stato "Completato".
     */
    const projectsWithoutAssignments = useMemo(() => {
        const assignedProjectIds = new Set(assignments.map(a => a.projectId));
        return projects.filter(p => !assignedProjectIds.has(p.id!) && p.status !== 'Completato')
                       .sort((a, b) => a.name.localeCompare(b.name));
    }, [projects, assignments]);

    /**
     * @description Memoizza la lista delle risorse che non sono assegnate a nessun progetto.
     */
    const resourcesWithoutAssignments = useMemo(() => {
        const assignedResourceIds = new Set(assignments.map(a => a.resourceId));
        return resources.filter(r => !assignedResourceIds.has(r.id!))
                        .sort((a, b) => a.name.localeCompare(b.name));
    }, [resources, assignments]);

    /**
     * @description Restituisce le classi CSS per un badge di stato.
     * @param {string | null} status - Lo stato del progetto.
     * @returns {string} Le classi Tailwind CSS.
     */
    const getStatusBadgeClass = (status: string | null): string => {
        switch (status) {
            case 'Completato': return 'bg-accent-teal/20 text-accent-teal';
            case 'In pausa': return 'bg-accent-orange/20 text-accent-orange';
            case 'In corso': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    };

    return (
        <div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Card Progetti senza Assegnazioni */}
                <div className="bg-primary-light dark:bg-primary-dark rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">Progetti senza Assegnazioni ({projectsWithoutAssignments.length})</h2>
                    {projectsWithoutAssignments.length > 0 ? (
                        <ul className="divide-y divide-gray-200 dark:divide-white/20 max-h-[60vh] overflow-y-auto">
                            {projectsWithoutAssignments.map(project => (
                                <li key={project.id} className="py-3">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-medium text-primary-dark dark:text-primary-light">{project.name}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{clients.find(c => c.id === project.clientId)?.name || 'Nessun cliente'}</p>
                                        </div>
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(project.status)}`}>
                                            {project.status || 'Non definito'}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400">Tutti i progetti attivi hanno almeno una risorsa assegnata.</p>
                    )}
                </div>

                {/* Card Risorse non Assegnate */}
                <div className="bg-primary-light dark:bg-primary-dark rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">Risorse non Assegnate ({resourcesWithoutAssignments.length})</h2>
                    {resourcesWithoutAssignments.length > 0 ? (
                        <ul className="divide-y divide-gray-200 dark:divide-white/20 max-h-[60vh] overflow-y-auto">
                            {resourcesWithoutAssignments.map(resource => (
                                <li key={resource.id} className="py-3">
                                    <p className="font-medium text-primary-dark dark:text-primary-light">{resource.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{roles.find(r => r.id === resource.roleId)?.name || 'Nessun ruolo'}</p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400">Tutte le risorse sono assegnate ad almeno un progetto.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuditPage;
