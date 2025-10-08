import React, { useState, useMemo } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { Project } from '../types';
import Modal from '../components/Modal';
import { PencilIcon, TrashIcon } from '../components/icons';

const ProjectsPage: React.FC = () => {
    const { projects, clients, projectStatuses, addProject, updateProject, deleteProject } = useStaffingContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | Omit<Project, 'id'> | null>(null);

    // START: Filters State
    const [filters, setFilters] = useState({ name: '', clientId: '', status: '' });
    // END: Filters State

    const emptyProject: Omit<Project, 'id'> = {
        name: '',
        clientId: '',
        startDate: '',
        endDate: '',
        budget: 0,
        realizationPercentage: 100,
        projectManager: '',
        status: projectStatuses[0]?.value || '',
        notes: '',
    };
    
    // START: Filtering Logic
    const filteredProjects = useMemo(() => {
        return projects.filter(project => {
            const nameMatch = project.name.toLowerCase().includes(filters.name.toLowerCase());
            const clientMatch = filters.clientId ? project.clientId === filters.clientId : true;
            const statusMatch = filters.status ? project.status === filters.status : true;
            return nameMatch && clientMatch && statusMatch;
        });
    }, [projects, filters]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const resetFilters = () => {
        setFilters({ name: '', clientId: '', status: '' });
    };
    // END: Filtering Logic

    const openModalForNew = () => {
        setEditingProject(emptyProject);
        setIsModalOpen(true);
    };

    const openModalForEdit = (project: Project) => {
        setEditingProject(project);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProject(null);
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingProject) {
            if ('id' in editingProject) {
                updateProject(editingProject as Project);
            } else {
                addProject(editingProject as Omit<Project, 'id'>);
            }
            handleCloseModal();
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        if (editingProject) {
            const { name, value } = e.target;
            const numericFields = ['budget', 'realizationPercentage'];
            setEditingProject({
                ...editingProject,
                [name]: numericFields.includes(name) ? parseFloat(value) || 0 : value
            });
        }
    };

    const getStatusBadgeClass = (status: string | null) => {
        switch (status) {
            case 'Completato': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            case 'In pausa': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
            case 'In corso': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    };
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Gestione Progetti</h1>
                <button onClick={openModalForNew} className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700">Aggiungi Progetto</button>
            </div>

            {/* START: Filters JSX */}
            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nome Progetto</label>
                        <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="mt-1 w-full form-input" placeholder="Cerca per nome..." />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cliente</label>
                        <select name="clientId" value={filters.clientId} onChange={handleFilterChange} className="mt-1 w-full form-select">
                            <option value="">Tutti i clienti</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Stato</label>
                        <select name="status" value={filters.status} onChange={handleFilterChange} className="mt-1 w-full form-select">
                            <option value="">Tutti gli stati</option>
                            {projectStatuses.map(s => <option key={s.id} value={s.value}>{s.value}</option>)}
                        </select>
                    </div>
                    <button onClick={resetFilters} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full md:w-auto">Reset Filtri</button>
                </div>
            </div>
            {/* END: Filters JSX */}

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nome Progetto</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cliente</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Stato</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Budget</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">% Realizzo</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredProjects.map(project => {
                            const client = clients.find(c => c.id === project.clientId);
                            return (
                            <tr key={project.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{project.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{client?.name || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(project.status)}`}>
                                        {project.status || 'Non definito'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{project.budget.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 font-semibold">{project.realizationPercentage}%</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => openModalForEdit(project)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 mr-4"><PencilIcon className="w-5 h-5"/></button>
                                    <button onClick={() => deleteProject(project.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200"><TrashIcon className="w-5 h-5"/></button>
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>

            {editingProject && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingProject ? 'Modifica Progetto' : 'Aggiungi Progetto'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium">Nome Progetto *</label>
                            <input type="text" name="name" value={editingProject.name} onChange={handleChange} required className="mt-1 w-full form-input"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Cliente</label>
                            {/* COMMENTO: Rimosso 'required' e aggiunto '|| ""' al valore per gestire correttamente i
                                progetti senza cliente assegnato e rendere il form stabile. */}
                            <select name="clientId" value={editingProject.clientId || ''} onChange={handleChange} className="mt-1 w-full form-select">
                                <option value="">Seleziona un cliente</option>
                                {clients.sort((a, b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium">Data Inizio</label>
                                 {/* COMMENTO: Aggiunto '|| ""' per gestire correttamente le date non impostate. */}
                                <input type="date" name="startDate" value={editingProject.startDate || ''} onChange={handleChange} className="mt-1 w-full form-input"/>
                            </div>
                             <div>
                                <label className="block text-sm font-medium">Data Fine</label>
                                {/* COMMENTO: Aggiunto '|| ""' per gestire correttamente le date non impostate. */}
                                <input type="date" name="endDate" value={editingProject.endDate || ''} onChange={handleChange} className="mt-1 w-full form-input"/>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium">Budget (€)</label>
                                <input type="number" step="0.01" name="budget" value={editingProject.budget} onChange={handleChange} className="mt-1 w-full form-input"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Percentuale di Realizzo ({editingProject.realizationPercentage}%)</label>
                                <input type="range" min="30" max="100" name="realizationPercentage" value={editingProject.realizationPercentage} onChange={handleChange} className="mt-1 w-full"/>
                            </div>
                        </div>
                         <div>
                            <label className="block text-sm font-medium">Project Manager</label>
                            {/* COMMENTO: Aggiunto `|| ''` per garantire che il campo sia sempre controllato,
                                anche se il valore `projectManager` dal database è nullo. Questo risolve il bug
                                che impediva il salvataggio. */}
                            <input type="text" name="projectManager" value={editingProject.projectManager || ''} onChange={handleChange} className="mt-1 w-full form-input"/>
                        </div>
                         <div>
                            <label className="block text-sm font-medium">Stato</label>
                             {/* COMMENTO: Rimosso 'required', aggiunto '|| ""' e un'opzione vuota per consentire
                                progetti senza stato e risolvere problemi di salvataggio. */}
                            <select name="status" value={editingProject.status || ''} onChange={handleChange} className="mt-1 w-full form-select">
                                <option value="">Nessuno stato</option>
                                {projectStatuses.sort((a, b) => a.value.localeCompare(b.value)).map(s => <option key={s.id} value={s.value}>{s.value}</option>)}
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium">Note</label>
                            <textarea name="notes" value={editingProject.notes || ''} onChange={handleChange} rows={3} className="mt-1 w-full form-textarea"></textarea>
                        </div>

                        <div className="flex justify-end space-x-3 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Annulla</button>
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Salva</button>
                        </div>
                    </form>
                </Modal>
            )}
            <style>{`
                .form-input, .form-select, .form-textarea { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; }
                .dark .form-input, .dark .form-select, .dark .form-textarea { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }
            `}</style>
        </div>
    );
};

export default ProjectsPage;