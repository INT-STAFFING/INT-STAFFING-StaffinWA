/**
 * @file AuditPage.tsx
 * @description Pagina per l'audit delle assegnazioni, che mostra progetti non staffati e risorse non allocate.
 */

import React, { useState, useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { PlusCircleIcon } from '../components/icons';

const AuditPage: React.FC = () => {
    const { projects, assignments, resources, addMultipleAssignments, clients, roles } = useEntitiesContext();
    const [isAssignmentModalOpen, setAssignmentModalOpen] = useState(false);
    const [newAssignmentData, setNewAssignmentData] = useState<{ resourceId: string, projectIds: string[] }>({ resourceId: '', projectIds: [] });

    const { unassignedProjects, unassignedResources } = useMemo(() => {
        const assignedProjectIds = new Set(assignments.map(a => a.projectId));
        const assignedResourceIds = new Set(assignments.map(a => a.resourceId));

        const unassignedProjects = projects.filter(p => !assignedProjectIds.has(p.id!));
        const unassignedResources = resources.filter(r => !assignedResourceIds.has(r.id!));

        return { unassignedProjects, unassignedResources };
    }, [projects, assignments, resources]);

    const openNewAssignmentModal = (resourceId: string = '', projectId: string = '') => {
        setNewAssignmentData({ resourceId: resourceId, projectIds: projectId ? [projectId] : [] });
        setAssignmentModalOpen(true);
    };

    const handleNewAssignmentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newAssignmentData.resourceId && newAssignmentData.projectIds.length > 0) {
            const assignmentsToCreate = newAssignmentData.projectIds.map(projectId => ({
                resourceId: newAssignmentData.resourceId,
                projectId: projectId,
            }));
            addMultipleAssignments(assignmentsToCreate);
            setAssignmentModalOpen(false);
        }
    };

    const handleNewAssignmentChange = (name: string, value: string) => {
        setNewAssignmentData(d => ({ ...d, [name]: value }));
    };

    const handleNewAssignmentMultiSelectChange = (name: string, values: string[]) => {
        setNewAssignmentData(d => ({ ...d, [name]: values }));
    };

    const assignableProjects = useMemo(() => projects.filter(p => p.status !== 'Completato'), [projects]);

    return (
        <div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Unassigned Projects Section */}
                <div className="bg-primary-light dark:bg-primary-dark rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">Progetti senza Assegnazioni ({unassignedProjects.length})</h2>
                    <div className="overflow-y-auto max-h-96">
                        <ul className="divide-y divide-gray-200 dark:divide-white/20">
                            {unassignedProjects.map(project => (
                                <li key={project.id} className="py-3 flex justify-between items-center">
                                    <div>
                                        <p className="font-medium text-primary-dark dark:text-primary-light">{project.name}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{clients.find(c => c.id === project.clientId)?.name || 'N/A'}</p>
                                    </div>
                                    <button onClick={() => openNewAssignmentModal('', project.id!)} className="text-accent-teal hover:opacity-80" title="Assegna Risorsa">
                                        <PlusCircleIcon className="w-6 h-6"/>
                                    </button>
                                </li>
                            ))}
                             {unassignedProjects.length === 0 && <p className="text-sm text-gray-500 py-4 text-center">Tutti i progetti hanno almeno una risorsa assegnata.</p>}
                        </ul>
                    </div>
                </div>

                {/* Unassigned Resources Section */}
                <div className="bg-primary-light dark:bg-primary-dark rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">Risorse non Assegnate ({unassignedResources.length})</h2>
                     <div className="overflow-y-auto max-h-96">
                        <ul className="divide-y divide-gray-200 dark:divide-white/20">
                            {unassignedResources.map(resource => (
                                <li key={resource.id} className="py-3 flex justify-between items-center">
                                    <div>
                                        <p className="font-medium text-primary-dark dark:text-primary-light">{resource.name}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{roles.find(r => r.id === resource.roleId)?.name || 'N/A'}</p>
                                    </div>
                                    <button onClick={() => openNewAssignmentModal(resource.id!)} className="text-accent-teal hover:opacity-80" title="Assegna a Progetto">
                                         <PlusCircleIcon className="w-6 h-6"/>
                                    </button>
                                </li>
                            ))}
                            {unassignedResources.length === 0 && <p className="text-sm text-gray-500 py-4 text-center">Tutte le risorse sono assegnate ad almeno un progetto.</p>}
                        </ul>
                    </div>
                </div>
            </div>

             {/* Modal for New Assignment */}
            <Modal isOpen={isAssignmentModalOpen} onClose={() => setAssignmentModalOpen(false)} title="Assegna Risorsa a Progetto">
                <form onSubmit={handleNewAssignmentSubmit} className="flex flex-col h-96">
                    <div className="space-y-4 flex-grow">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Risorsa</label>
                            <SearchableSelect
                                name="resourceId"
                                value={newAssignmentData.resourceId}
                                onChange={handleNewAssignmentChange}
                                options={resources.map(r => ({ value: r.id!, label: r.name }))}
                                placeholder="Seleziona una risorsa"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Progetto/i</label>
                            <MultiSelectDropdown
                                name="projectIds"
                                selectedValues={newAssignmentData.projectIds}
                                onChange={handleNewAssignmentMultiSelectChange}
                                options={assignableProjects.map(p => ({ value: p.id!, label: p.name }))}
                                placeholder="Seleziona uno o più progetti"
                            />
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={() => setAssignmentModalOpen(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">Annulla</button>
                        <button type="submit" className="px-4 py-2 bg-accent-teal text-primary-dark font-semibold rounded-md hover:opacity-90">Aggiungi Assegnazioni</button>
                    </div>
                </form>
            </Modal>
            <style>{`
                .form-input, .form-select, .form-textarea {
                    border-color: #D1D5DB; 
                    background-color: #FDFFFC;
                }
                .dark .form-input, .dark .form-select, .dark .form-textarea {
                    border-color: #4B5563;
                    background-color: #011627;
                    color: #FDFFFC;
                }
                .form-input:focus, .form-select:focus, .form-textarea:focus {
                    --tw-ring-color: #2EC4B6;
                    border-color: #2EC4B6;
                }
            `}</style>
        </div>
    );
};

export default AuditPage;
