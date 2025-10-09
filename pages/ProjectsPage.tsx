/**
 * @file ProjectsPage.tsx
 * @description Pagina per la gestione dei progetti (CRUD e visualizzazione).
 */

import React, { useState, useMemo } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { Project } from '../types';
import Modal from '../components/Modal';
import { PencilIcon, TrashIcon, PencilSquareIcon, CheckIcon, XMarkIcon } from '../components/icons';

/**
 * Componente per la pagina di gestione dei Progetti.
 * Permette di visualizzare, filtrare, aggiungere, modificare (in modale o inline) ed eliminare progetti.
 * @returns {React.ReactElement} La pagina di gestione dei progetti.
 */
const ProjectsPage: React.FC = () => {
    const { projects, clients, projectStatuses, addProject, updateProject, deleteProject } = useStaffingContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | Omit<Project, 'id'> | null>(null);
    const [filters, setFilters] = useState({ name: '', clientId: '', status: '' });

    // Stati per la gestione della modifica inline.
    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
    const [inlineEditingData, setInlineEditingData] = useState<Project | null>(null);

    // Oggetto progetto vuoto usato come stato iniziale per il form di creazione.
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
    
    // Memoizza i progetti filtrati per ottimizzare le performance.
    const filteredProjects = useMemo(() => {
        return projects.filter(project => {
            const nameMatch = project.name.toLowerCase().includes(filters.name.toLowerCase());
            const clientMatch = filters.clientId ? project.clientId === filters.clientId : true;
            const statusMatch = filters.status ? project.status === filters.status : true;
            return nameMatch && clientMatch && statusMatch;
        });
    }, [projects, filters]);

    /**
     * Aggiorna lo stato dei filtri.
     * @param {React.ChangeEvent<HTMLInputElement | HTMLSelectElement>} e - L'evento di input.
     */
    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const resetFilters = () => {
        setFilters({ name: '', clientId: '', status: '' });
    };

    /** Apre la modale per creare un nuovo progetto. */
    const openModalForNew = () => {
        setEditingProject(emptyProject);
        setIsModalOpen(true);
    };

    /**
     * Apre la modale per modificare un progetto esistente.
     * @param {Project} project - Il progetto da modificare.
     */
    const openModalForEdit = (project: Project) => {
        setEditingProject(project);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProject(null);
    };

    /**
     * Gestisce l'invio del form della modale (creazione/modifica).
     * @param {React.FormEvent<HTMLFormElement>} e - L'evento di submit.
     */
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

    /**
     * Gestisce le modifiche ai campi del form nella modale.
     * @param {React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>} e - L'evento di input.
     */
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

    /**
     * Attiva la modalità di modifica inline per una riga.
     * @param {Project} project - Il progetto da modificare.
     */
    const handleStartInlineEdit = (project: Project) => {
        setInlineEditingId(project.id!);
        setInlineEditingData({ ...project });
    };

    /** Annulla la modalità di modifica inline. */
    const handleCancelInlineEdit = () => {
        setInlineEditingId(null);
        setInlineEditingData(null);
    };

    /**
     * Gestisce le modifiche ai campi del form durante la modifica inline.
     * @param {React.ChangeEvent<HTMLInputElement | HTMLSelectElement>} e - L'evento di input.
     */
    const handleInlineFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (inlineEditingData) {
            const { name, value } = e.target;
            const numericFields = ['budget', 'realizationPercentage'];
            setInlineEditingData({
                ...inlineEditingData,
                [name]: numericFields.includes(name) ? parseFloat(value) || 0 : value
            });
        }
    };

    /** Salva le modifiche effettuate in modalità inline. */
    const handleSaveInlineEdit = () => {
        if (inlineEditingData) {
            updateProject(inlineEditingData);
            handleCancelInlineEdit();
        }
    };

    /**
     * Restituisce la classe CSS per il badge dello stato del progetto in base al valore.
     * @param {string | null} status - Lo stato del progetto.
     * @returns {string} La classe CSS per il colore del badge.
     */
    const getStatusBadgeClass = (status: string | null): string => {
        switch (status) {
            case 'Completato': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            case 'In pausa': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
            case 'In corso': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    };
    
    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white self-start">Gestione Progetti</h1>
                <button onClick={openModalForNew} className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700">Aggiungi Progetto</button>
            </div>

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

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y md:divide-y-0 divide-gray-200 dark:divide-gray-700">
                    <thead className="hidden md:table-header-group bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nome Progetto</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cliente</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Stato</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Budget</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">% Realizzo</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="block md:table-row-group divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredProjects.map(project => {
                            const client = clients.find(c => c.id === project.clientId);
                            const isEditing = inlineEditingId === project.id;
                            
                            if(isEditing){
                                // Riga in modalità modifica inline
                                return (
                                    <tr key={project.id} className="block md:table-row p-4 md:p-0 border-b dark:border-gray-600">
                                        <td data-label="Progetto" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none"><input type="text" name="name" value={inlineEditingData.name} onChange={handleInlineFormChange} className="w-full text-sm form-input p-1" /></td>
                                        <td data-label="Cliente" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none">
                                            <select name="clientId" value={inlineEditingData.clientId || ''} onChange={handleInlineFormChange} className="w-full text-sm form-select p-1">
                                                <option value="">Nessun cliente</option>
                                                {clients.sort((a,b)=>a.name.localeCompare(b.name)).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </td>
                                        <td data-label="Stato" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none">
                                            <select name="status" value={inlineEditingData.status || ''} onChange={handleInlineFormChange} className="w-full text-sm form-select p-1">
                                                <option value="">Nessuno stato</option>
                                                {projectStatuses.sort((a,b)=>a.value.localeCompare(b.value)).map(s=><option key={s.id} value={s.value}>{s.value}</option>)}
                                            </select>
                                        </td>
                                        <td data-label="Budget" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none"><input type="number" name="budget" value={inlineEditingData.budget} onChange={handleInlineFormChange} className="w-full text-sm form-input p-1" /></td>
                                        <td data-label="% Realizzo" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none"><input type="number" name="realizationPercentage" value={inlineEditingData.realizationPercentage} onChange={handleInlineFormChange} className="w-full text-sm form-input p-1" /></td>
                                        <td className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap text-right text-sm font-medium">
                                             <div className="flex items-center justify-end space-x-2">
                                                <button onClick={handleSaveInlineEdit} className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-200"><CheckIcon className="w-5 h-5"/></button>
                                                <button onClick={handleCancelInlineEdit} className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"><XMarkIcon className="w-5 h-5"/></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }

                            // Riga in modalità visualizzazione
                            return (
                            <tr key={project.id} className="block md:table-row p-4 md:p-0 border-b dark:border-gray-600">
                                <td data-label="Progetto" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none">{project.name}</td>
                                <td data-label="Cliente" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none">{client?.name || 'N/A'}</td>
                                <td data-label="Stato" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap text-sm before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(project.status)}`}>
                                        {project.status || 'Non definito'}
                                    </span>
                                </td>
                                <td data-label="Budget" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none">{project.budget.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</td>
                                <td data-label="% Realizzo" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 font-semibold before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none">{project.realizationPercentage}%</td>
                                <td className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex items-center justify-end space-x-2">
                                        <button onClick={() => openModalForEdit(project)} title="Modifica in modale" className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200"><PencilIcon className="w-5 h-5"/></button>
                                        <button onClick={() => handleStartInlineEdit(project)} title="Modifica inline" className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200"><PencilSquareIcon className="w-5 h-5"/></button>
                                        <button onClick={() => deleteProject(project.id)} title="Elimina" className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200"><TrashIcon className="w-5 h-5"/></button>
                                    </div>
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
                            <select name="clientId" value={editingProject.clientId || ''} onChange={handleChange} className="mt-1 w-full form-select">
                                <option value="">Seleziona un cliente</option>
                                {clients.sort((a, b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium">Data Inizio</label>
                                <input type="date" name="startDate" value={editingProject.startDate || ''} onChange={handleChange} className="mt-1 w-full form-input"/>
                            </div>
                             <div>
                                <label className="block text-sm font-medium">Data Fine</label>
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
                            <input type="text" name="projectManager" value={editingProject.projectManager || ''} onChange={handleChange} className="mt-1 w-full form-input"/>
                        </div>
                         <div>
                            <label className="block text-sm font-medium">Stato</label>
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