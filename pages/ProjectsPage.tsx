/**
 * @file ProjectsPage.tsx
 * @description Pagina per la gestione dei progetti.
 */
import React, { useState } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { Project } from '../types';
import Modal from '../components/Modal';
import { PencilIcon, TrashIcon, PencilSquareIcon, CheckIcon, XMarkIcon } from '../components/icons';

/**
 * Componente per la pagina di gestione dei progetti.
 * Permette di visualizzare, filtrare, aggiungere, modificare (sia in modale che inline) ed eliminare i progetti.
 * @returns {React.ReactElement} La pagina di gestione dei progetti.
 */
const ProjectsPage: React.FC = () => {
    const { projects, clients, projectStatuses, addProject, updateProject, deleteProject } = useStaffingContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | Omit<Project, 'id'> | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Stati per la modifica inline
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    const [editedData, setEditedData] = useState<Partial<Project>>({});

    /**
     * Apre la modale per aggiungere un nuovo progetto o modificare uno esistente.
     * @param {Project | null} [project=null] - Il progetto da modificare, o null per crearne uno nuovo.
     */
    const handleOpenModal = (project: Project | null = null) => {
        setEditingProject(project || { name: '', clientId: null, startDate: null, endDate: null, budget: 0, realizationPercentage: 100, projectManager: null, status: null, notes: '' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProject(null);
    };

    /**
     * Gestisce l'invio del form della modale per creare o aggiornare un progetto.
     * @param {React.FormEvent} e - L'evento di submit del form.
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingProject) {
            try {
                if ('id' in editingProject) {
                    await updateProject(editingProject as Project);
                } else {
                    await addProject(editingProject as Omit<Project, 'id'>);
                }
                handleCloseModal();
            } catch (error) {
                console.error("Failed to save project:", error);
            }
        }
    };
    
    /**
     * Gestisce le modifiche ai campi di input nel form della modale.
     * @param {React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>} e - L'evento di input.
     */
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        if (editingProject) {
            const { name, value, type } = e.target;
            const isNumber = type === 'number';
            setEditingProject({ ...editingProject, [name]: isNumber ? parseFloat(value) || 0 : (value || null) });
        }
    };
    
    /**
     * Attiva la modalità di modifica inline per una specifica riga della tabella.
     * @param {Project} project - Il progetto su cui avviare la modifica inline.
     */
    const handleStartInlineEdit = (project: Project) => {
        setEditingRowId(project.id!);
        setEditedData(project);
    };

    /** Annulla la modifica inline e ripristina lo stato originale della riga. */
    const handleCancelInlineEdit = () => {
        setEditingRowId(null);
        setEditedData({});
    };

    /**
     * Salva le modifiche apportate inline.
     * Chiama l'API per l'aggiornamento e disattiva la modalità di modifica.
     */
    const handleSaveInlineEdit = async () => {
        if (editingRowId) {
             try {
                await updateProject(editedData as Project);
                setEditingRowId(null);
                setEditedData({});
            } catch(error) {
                 console.error("Failed to save inline edit:", error);
            }
        }
    };
    
    /**
     * Gestisce le modifiche ai campi di input durante la modifica inline.
     * @param {React.ChangeEvent<HTMLInputElement | HTMLSelectElement>} e - L'evento di input.
     */
    const handleInlineChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const isNumber = type === 'number';
        setEditedData(prev => ({ ...prev, [name]: isNumber ? parseFloat(value) : (value || null) }));
    };

    /**
     * Ottiene il nome di un cliente a partire dal suo ID per la visualizzazione.
     * @param {string | null} clientId - L'ID del cliente.
     * @returns {string} Il nome del cliente o 'N/A'.
     */
    const getClientName = (clientId: string | null) => {
        if (!clientId) return 'N/A';
        return clients.find(c => c.id === clientId)?.name || 'Sconosciuto';
    };

    /**
     * @description Filtra i progetti in base al termine di ricerca inserito.
     */
    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.projectManager && p.projectManager.toLowerCase().includes(searchTerm.toLowerCase())) ||
        getClientName(p.clientId).toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white self-start">Gestione Progetti</h1>
                <div className="self-end w-full md:w-auto flex gap-4">
                     <input
                        type="text"
                        placeholder="Cerca progetto..."
                        className="form-input w-full md:w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700 whitespace-nowrap">
                        Aggiungi Progetto
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Nome Progetto</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cliente</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Stato</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredProjects.map(p => (
                            <tr key={p.id}>
                                {editingRowId === p.id ? (
                                    <>
                                        <td className="px-6 py-4"><input type="text" name="name" value={editedData.name || ''} onChange={handleInlineChange} className="form-input" /></td>
                                        <td className="px-6 py-4">
                                            <select name="clientId" value={editedData.clientId || ''} onChange={handleInlineChange} className="form-select">
                                                <option value="">Nessun cliente</option>
                                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-6 py-4">
                                            <input type="date" name="startDate" value={editedData.startDate || ''} onChange={handleInlineChange} className="form-input text-sm" />
                                            <input type="date" name="endDate" value={editedData.endDate || ''} onChange={handleInlineChange} className="form-input text-sm mt-1" />
                                        </td>
                                        <td className="px-6 py-4">
                                            <select name="status" value={editedData.status || ''} onChange={handleInlineChange} className="form-select">
                                                <option value="">Nessuno stato</option>
                                                {projectStatuses.map(s => <option key={s.id} value={s.value}>{s.value}</option>)}
                                            </select>
                                        </td>
                                    </>
                                ) : (
                                     <>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{p.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{getClientName(p.clientId)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{p.startDate || 'N/A'} - {p.endDate || 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{p.status || 'N/A'}</td>
                                    </>
                                )}
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                     {editingRowId === p.id ? (
                                        <>
                                            <button onClick={handleSaveInlineEdit} className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-200 mr-3"><CheckIcon className="w-5 h-5" /></button>
                                            <button onClick={handleCancelInlineEdit} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200"><XMarkIcon className="w-5 h-5" /></button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => handleStartInlineEdit(p)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mr-3"><PencilSquareIcon className="w-5 h-5" /></button>
                                            <button onClick={() => handleOpenModal(p)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 mr-3"><PencilIcon className="w-5 h-5" /></button>
                                            <button onClick={() => deleteProject(p.id!)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200"><TrashIcon className="w-5 h-5" /></button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editingProject && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={('id' in editingProject ? 'Modifica' : 'Aggiungi') + ' Progetto'}>
                    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium">Nome *</label>
                                <input type="text" name="name" value={editingProject.name} onChange={handleChange} required className="mt-1 w-full form-input" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Cliente</label>
                                <select name="clientId" value={editingProject.clientId || ''} onChange={handleChange} className="mt-1 w-full form-select">
                                    <option value="">Nessun cliente</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Data Inizio</label>
                                <input type="date" name="startDate" value={editingProject.startDate || ''} onChange={handleChange} className="mt-1 w-full form-input" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Data Fine</label>
                                <input type="date" name="endDate" value={editingProject.endDate || ''} onChange={handleChange} className="mt-1 w-full form-input" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium">Budget</label>
                                <input type="number" step="0.01" name="budget" value={editingProject.budget} onChange={handleChange} className="mt-1 w-full form-input" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium">% Realizzazione</label>
                                <input type="number" name="realizationPercentage" min="0" max="100" value={editingProject.realizationPercentage} onChange={handleChange} className="mt-1 w-full form-input" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Project Manager</label>
                                <input type="text" name="projectManager" value={editingProject.projectManager || ''} onChange={handleChange} className="mt-1 w-full form-input" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Stato</label>
                                <select name="status" value={editingProject.status || ''} onChange={handleChange} className="mt-1 w-full form-select">
                                    <option value="">Nessuno stato</option>
                                    {projectStatuses.map(s => <option key={s.id} value={s.value}>{s.value}</option>)}
                                </select>
                            </div>
                        </div>
                         <div className="col-span-2">
                            <label className="block text-sm font-medium">Note</label>
                            <textarea name="notes" value={editingProject.notes || ''} onChange={handleChange} rows={3} className="mt-1 w-full form-input" />
                        </div>
                        <div className="flex justify-end space-x-3 pt-2">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md">Annulla</button>
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">Salva</button>
                        </div>
                    </form>
                </Modal>
            )}
             <style>{`
                .form-input, .form-select { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; }
                .dark .form-input, .dark .form-select { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }
            `}</style>
        </div>
    );
};

export default ProjectsPage;