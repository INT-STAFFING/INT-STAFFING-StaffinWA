/**
 * @file ProjectsPage.tsx
 * @description Pagina per la gestione dei progetti (CRUD e visualizzazione).
 */

import React, { useState, useMemo } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { Project } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { PencilIcon, TrashIcon, CheckIcon, XMarkIcon, ArrowsUpDownIcon } from '../components/icons';

/**
 * @type SortConfig
 * @description Configurazione per l'ordinamento della tabella.
 */
type SortConfig = { key: keyof Project | 'clientName'; direction: 'ascending' | 'descending' } | null;

/**
 * Formatta una data per la visualizzazione.
 * @param {string | null} dateStr - La stringa della data (YYYY-MM-DD).
 * @returns {string} La data formattata (DD/MM/YYYY) o 'N/A'.
 */
const formatDateForDisplay = (dateStr: string | null): string => {
    if (!dateStr) return 'N/A';
    // Aggiunge un controllo per evitare 'Invalid Date' se la stringa non è un formato valido
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('it-IT', { year: 'numeric', month: '2-digit', day: '2-digit' });
};


/**
 * Componente per la pagina di gestione dei Progetti.
 * Permette di visualizzare, filtrare, ordinare, aggiungere, modificare ed eliminare progetti.
 * @returns {React.ReactElement} La pagina di gestione dei progetti.
 */
const ProjectsPage: React.FC = () => {
    const { projects, clients, projectStatuses, addProject, updateProject, deleteProject } = useStaffingContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | Omit<Project, 'id'> | null>(null);
    const [filters, setFilters] = useState({ name: '', clientId: '', status: '' });
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

    // Stati per la gestione della modifica inline.
    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
    const [inlineEditingData, setInlineEditingData] = useState<Project | null>(null);

    const emptyProject: Omit<Project, 'id'> = {
        name: '', clientId: '', startDate: '', endDate: '', budget: 0,
        realizationPercentage: 100, projectManager: '', status: projectStatuses[0]?.value || '', notes: '',
    };
    
    const filteredProjects = useMemo(() => {
        return projects.filter(project => {
            const nameMatch = project.name.toLowerCase().includes(filters.name.toLowerCase());
            const clientMatch = filters.clientId ? project.clientId === filters.clientId : true;
            const statusMatch = filters.status ? project.status === filters.status : true;
            return nameMatch && clientMatch && statusMatch;
        });
    }, [projects, filters]);

    // Applica l'ordinamento ai dati filtrati
    const sortedProjects = useMemo(() => {
        let sortableItems = [...filteredProjects];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue: any;
                let bValue: any;

                if (sortConfig.key === 'clientName') {
                    aValue = clients.find(c => c.id === a.clientId)?.name || '';
                    bValue = clients.find(c => c.id === b.clientId)?.name || '';
                } else {
                    aValue = a[sortConfig.key as keyof Project];
                    bValue = b[sortConfig.key as keyof Project];
                }

                if (aValue === null || aValue === undefined) aValue = '';
                if (bValue === null || bValue === undefined) bValue = '';

                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
                }
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
                }
                return 0;
            });
        }
        return sortableItems;
    }, [filteredProjects, sortConfig, clients]);
    
    const requestSort = (key: SortConfig['key']) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleFilterSelectChange = (name: string, value: string) => setFilters(prev => ({ ...prev, [name]: value }));
    const resetFilters = () => setFilters({ name: '', clientId: '', status: '' });

    const openModalForNew = () => { setEditingProject(emptyProject); setIsModalOpen(true); };
    const openModalForEdit = (project: Project) => { setEditingProject(project); setIsModalOpen(true); handleCancelInlineEdit(); };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingProject(null); };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingProject) {
            if ('id' in editingProject) updateProject(editingProject as Project);
            else addProject(editingProject as Omit<Project, 'id'>);
            handleCloseModal();
        }
    };
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (editingProject) {
            const { name, value } = e.target;
            const numericFields = ['budget', 'realizationPercentage'];
            setEditingProject({ ...editingProject, [name]: numericFields.includes(name) ? parseFloat(value) || 0 : value });
        }
    };

    const handleSelectChange = (name: string, value: string) => {
        if (editingProject) {
            setEditingProject({ ...editingProject, [name]: value });
        }
    };

    const handleStartInlineEdit = (project: Project) => { setInlineEditingId(project.id!); setInlineEditingData({ ...project }); };
    const handleCancelInlineEdit = () => { setInlineEditingId(null); setInlineEditingData(null); };

    const handleInlineFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (inlineEditingData) {
            const { name, value } = e.target;
            const numericFields = ['budget', 'realizationPercentage'];
            setInlineEditingData({ ...inlineEditingData, [name]: numericFields.includes(name) ? parseFloat(value) || 0 : value });
        }
    };
    
    const handleInlineSelectChange = (name: string, value: string) => {
        if (inlineEditingData) {
            setInlineEditingData({ ...inlineEditingData, [name]: value });
        }
    };

    const handleSaveInlineEdit = () => { if (inlineEditingData) { updateProject(inlineEditingData); handleCancelInlineEdit(); } };

    const getStatusBadgeClass = (status: string | null): string => {
        switch (status) {
            case 'Completato': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            case 'In pausa': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
            case 'In corso': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    };

    const getSortableHeader = (label: string, key: SortConfig['key']) => (
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            <button type="button" onClick={() => requestSort(key)} className="flex items-center space-x-1 hover:text-gray-900 dark:hover:text-white">
                <span className={sortConfig?.key === key ? 'font-bold text-gray-800 dark:text-white' : ''}>{label}</span>
                <ArrowsUpDownIcon className="w-4 h-4 text-gray-400" />
            </button>
        </th>
    );

    const clientOptions = useMemo(() => clients.sort((a,b)=>a.name.localeCompare(b.name)).map(c => ({ value: c.id!, label: c.name })), [clients]);
    const statusOptions = useMemo(() => projectStatuses.sort((a,b)=>a.value.localeCompare(b.value)).map(s => ({ value: s.value, label: s.value })), [projectStatuses]);
    
    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white self-start">Gestione Progetti</h1>
                <button onClick={openModalForNew} className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700">Aggiungi Progetto</button>
            </div>

            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per nome..."/>
                    <SearchableSelect name="clientId" value={filters.clientId} onChange={handleFilterSelectChange} options={clientOptions} placeholder="Tutti i clienti"/>
                    <SearchableSelect name="status" value={filters.status} onChange={handleFilterSelectChange} options={statusOptions} placeholder="Tutti gli stati"/>
                    <button onClick={resetFilters} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full md:w-auto">Reset</button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                {getSortableHeader('Nome Progetto', 'name')}
                                {getSortableHeader('Cliente', 'clientName')}
                                {getSortableHeader('Stato', 'status')}
                                {getSortableHeader('Data Inizio', 'startDate')}
                                {getSortableHeader('Data Fine', 'endDate')}
                                {getSortableHeader('Budget', 'budget')}
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {sortedProjects.map(project => {
                                const client = clients.find(c => c.id === project.clientId);
                                const isEditing = inlineEditingId === project.id;
                                
                                if(isEditing){
                                    return (
                                        <tr key={project.id}>
                                            <td className="px-6 py-4"><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                                            <td className="px-6 py-4"><SearchableSelect name="clientId" value={inlineEditingData!.clientId || ''} onChange={handleInlineSelectChange} options={clientOptions} placeholder="Nessun cliente" /></td>
                                            <td className="px-6 py-4"><SearchableSelect name="status" value={inlineEditingData!.status || ''} onChange={handleInlineSelectChange} options={statusOptions} placeholder="Nessuno stato" /></td>
                                            <td className="px-6 py-4"><input type="date" name="startDate" value={inlineEditingData!.startDate || ''} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                                            <td className="px-6 py-4"><input type="date" name="endDate" value={inlineEditingData!.endDate || ''} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                                            <td className="px-6 py-4"><input type="number" name="budget" value={inlineEditingData!.budget} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                                            <td className="px-6 py-4 text-right"><div className="flex items-center justify-end space-x-2"><button onClick={handleSaveInlineEdit} className="p-1 text-green-600 hover:text-green-500"><CheckIcon className="w-5 h-5"/></button><button onClick={handleCancelInlineEdit} className="p-1 text-gray-500 hover:text-gray-400"><XMarkIcon className="w-5 h-5"/></button></div></td>
                                        </tr>
                                    );
                                }

                                return (
                                <tr key={project.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{project.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{client?.name || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(project.status)}`}>{project.status || 'Non definito'}</span></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{formatDateForDisplay(project.startDate)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{formatDateForDisplay(project.endDate)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{project.budget.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end space-x-3">
                                            <button onClick={() => openModalForEdit(project)} className="text-gray-500 hover:text-blue-600" title="Modifica Dettagli"><PencilIcon className="w-5 h-5"/></button>
                                            <button onClick={() => handleStartInlineEdit(project)} className="text-gray-500 hover:text-green-600" title="Modifica Rapida"><PencilIcon className="w-5 h-5"/></button>
                                            <button onClick={() => deleteProject(project.id!)} className="text-gray-500 hover:text-red-600" title="Elimina"><TrashIcon className="w-5 h-5"/></button>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
                 {/* Mobile Cards */}
                <div className="md:hidden p-4 space-y-4">
                    {sortedProjects.map(project => {
                        const client = clients.find(c => c.id === project.clientId);
                        const isEditing = inlineEditingId === project.id;

                        if (isEditing) {
                             return (
                                <div key={project.id} className="p-4 rounded-lg shadow-md bg-white dark:bg-gray-800 border border-blue-500">
                                    <div className="space-y-3">
                                        <div><label className="text-xs font-medium text-gray-500">Nome Progetto</label><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full form-input p-1" /></div>
                                        <div><label className="text-xs font-medium text-gray-500">Cliente</label><SearchableSelect name="clientId" value={inlineEditingData!.clientId || ''} onChange={handleInlineSelectChange} options={clientOptions} placeholder="Nessun cliente" /></div>
                                        <div><label className="text-xs font-medium text-gray-500">Stato</label><SearchableSelect name="status" value={inlineEditingData!.status || ''} onChange={handleInlineSelectChange} options={statusOptions} placeholder="Nessuno stato" /></div>
                                        <div><label className="text-xs font-medium text-gray-500">Data Inizio</label><input type="date" name="startDate" value={inlineEditingData!.startDate || ''} onChange={handleInlineFormChange} className="w-full form-input p-1" /></div>
                                        <div><label className="text-xs font-medium text-gray-500">Data Fine</label><input type="date" name="endDate" value={inlineEditingData!.endDate || ''} onChange={handleInlineFormChange} className="w-full form-input p-1" /></div>
                                        <div><label className="text-xs font-medium text-gray-500">Budget</label><input type="number" name="budget" value={inlineEditingData!.budget} onChange={handleInlineFormChange} className="w-full form-input p-1" /></div>
                                        <div className="flex justify-end space-x-2 pt-2">
                                            <button onClick={handleSaveInlineEdit} className="p-2 bg-green-100 text-green-700 rounded-full"><CheckIcon className="w-5 h-5"/></button>
                                            <button onClick={handleCancelInlineEdit} className="p-2 bg-gray-100 text-gray-700 rounded-full"><XMarkIcon className="w-5 h-5"/></button>
                                        </div>
                                    </div>
                                </div>
                            )
                        }

                        return (
                            <div key={project.id} className="p-4 rounded-lg shadow-md bg-gray-50 dark:bg-gray-900/50">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-lg text-gray-900 dark:text-white">{project.name}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{client?.name || 'N/A'}</p>
                                    </div>
                                     <div className="flex items-center space-x-1 flex-shrink-0 ml-4">
                                        <button onClick={() => openModalForEdit(project)} className="p-1 text-gray-500 hover:text-blue-600"><PencilIcon className="w-5 h-5"/></button>
                                        <button onClick={() => handleStartInlineEdit(project)} className="p-1 text-gray-500 hover:text-green-600"><PencilIcon className="w-5 h-5"/></button>
                                        <button onClick={() => deleteProject(project.id!)} className="p-1 text-gray-500 hover:text-red-600"><TrashIcon className="w-5 h-5"/></button>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-4 text-sm">
                                    <div><p className="text-gray-500 dark:text-gray-400">Stato</p><p><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(project.status)}`}>{project.status || 'Non definito'}</span></p></div>
                                    <div><p className="text-gray-500 dark:text-gray-400">Budget</p><p className="font-medium text-gray-900 dark:text-white">{project.budget.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</p></div>
                                    <div><p className="text-gray-500 dark:text-gray-400">Data Inizio</p><p className="font-medium text-gray-900 dark:text-white">{formatDateForDisplay(project.startDate)}</p></div>
                                    <div><p className="text-gray-500 dark:text-gray-400">Data Fine</p><p className="font-medium text-gray-900 dark:text-white">{formatDateForDisplay(project.endDate)}</p></div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {editingProject && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingProject ? 'Modifica Progetto' : 'Aggiungi Progetto'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input type="text" name="name" value={editingProject.name} onChange={handleChange} required className="w-full form-input" placeholder="Nome Progetto *"/>
                        <SearchableSelect
                            name="clientId"
                            value={editingProject.clientId || ''}
                            onChange={handleSelectChange}
                            options={clientOptions}
                            placeholder="Seleziona un cliente"
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Inizio</label>
                                <input type="date" name="startDate" value={editingProject.startDate || ''} onChange={handleChange} className="w-full form-input"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Fine</label>
                                <input type="date" name="endDate" value={editingProject.endDate || ''} onChange={handleChange} className="w-full form-input"/>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 items-center"><input type="number" step="0.01" name="budget" value={editingProject.budget} onChange={handleChange} className="w-full form-input" placeholder="Budget (€)"/>
                            <div>
                                <label className="block text-sm text-gray-500">% Realizzo: {editingProject.realizationPercentage}%</label>
                                <input type="range" min="30" max="100" name="realizationPercentage" value={editingProject.realizationPercentage} onChange={handleChange} className="w-full"/>
                            </div>
                        </div>
                         <input type="text" name="projectManager" value={editingProject.projectManager || ''} onChange={handleChange} className="w-full form-input" placeholder="Project Manager"/>
                         <SearchableSelect
                            name="status"
                            value={editingProject.status || ''}
                            onChange={handleSelectChange}
                            options={statusOptions}
                            placeholder="Nessuno stato"
                        />
                         <textarea name="notes" value={editingProject.notes || ''} onChange={handleChange} rows={3} className="w-full form-textarea" placeholder="Note"></textarea>
                        <div className="flex justify-end space-x-3 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 rounded-md">Annulla</button>
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">Salva</button>
                        </div>
                    </form>
                </Modal>
            )}
            <style>{`.form-input, .form-select, .form-textarea { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-input, .dark .form-select, .dark .form-textarea { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }`}</style>
        </div>
    );
};

export default ProjectsPage;