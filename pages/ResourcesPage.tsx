/**
 * @file ResourcesPage.tsx
 * @description Pagina per la gestione delle risorse umane (dipendenti).
 */
import React, { useState } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { Resource } from '../types';
import Modal from '../components/Modal';
import { PencilIcon, TrashIcon, PencilSquareIcon, CheckIcon, XMarkIcon } from '../components/icons';

/**
 * Componente per la pagina di gestione delle risorse.
 * Permette di visualizzare, filtrare, aggiungere, modificare (sia in modale che inline) ed eliminare le risorse.
 * @returns {React.ReactElement} La pagina di gestione delle risorse.
 */
const ResourcesPage: React.FC = () => {
    const { resources, roles, horizontals, addResource, updateResource, deleteResource } = useStaffingContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingResource, setEditingResource] = useState<Resource | Omit<Resource, 'id'> | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Stati per la modifica inline
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    const [editedData, setEditedData] = useState<Partial<Resource>>({});

    /**
     * Apre la modale per aggiungere una nuova risorsa o modificare una esistente.
     * @param {Resource | null} [resource=null] - La risorsa da modificare, o null per crearne una nuova.
     */
    const handleOpenModal = (resource: Resource | null = null) => {
        setEditingResource(resource || { name: '', email: '', roleId: '', horizontal: '', hireDate: '', workSeniority: 0, notes: '' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingResource(null);
    };

    /**
     * Gestisce l'invio del form della modale per creare o aggiornare una risorsa.
     * @param {React.FormEvent} e - L'evento di submit del form.
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingResource) {
            try {
                if ('id' in editingResource) {
                    await updateResource(editingResource as Resource);
                } else {
                    await addResource(editingResource as Omit<Resource, 'id'>);
                }
                handleCloseModal();
            } catch (error) {
                console.error("Failed to save resource:", error);
            }
        }
    };

    /**
     * Gestisce le modifiche ai campi di input nel form della modale.
     * @param {React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>} e - L'evento di input.
     */
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        if (editingResource) {
             const { name, value, type } = e.target;
            const isNumber = type === 'number';
            setEditingResource({ ...editingResource, [name]: isNumber ? parseInt(value, 10) || 0 : value });
        }
    };

    /**
     * Attiva la modalità di modifica inline per una specifica riga della tabella.
     * @param {Resource} resource - La risorsa su cui avviare la modifica inline.
     */
    const handleStartInlineEdit = (resource: Resource) => {
        setEditingRowId(resource.id!);
        setEditedData(resource);
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
                await updateResource(editedData as Resource);
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
        const { name, value } = e.target;
        setEditedData(prev => ({ ...prev, [name]: value }));
    };
    
    /**
     * Ottiene il nome di un ruolo a partire dal suo ID per la visualizzazione.
     * @param {string} roleId - L'ID del ruolo.
     * @returns {string} Il nome del ruolo o 'N/A'.
     */
    const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || 'N/A';
    
    /**
     * @description Filtra le risorse in base al termine di ricerca inserito.
     */
    const filteredResources = resources.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getRoleName(r.roleId).toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.horizontal.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
             <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white self-start">Gestione Risorse</h1>
                <div className="self-end w-full md:w-auto flex gap-4">
                     <input
                        type="text"
                        placeholder="Cerca risorsa..."
                        className="form-input w-full md:w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700 whitespace-nowrap">
                        Aggiungi Risorsa
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Nome</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ruolo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Horizontal</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredResources.map(r => (
                            <tr key={r.id}>
                                {editingRowId === r.id ? (
                                    <>
                                        <td className="px-6 py-4"><input type="text" name="name" value={editedData.name || ''} onChange={handleInlineChange} className="form-input w-full" /></td>
                                        <td className="px-6 py-4"><input type="email" name="email" value={editedData.email || ''} onChange={handleInlineChange} className="form-input w-full" /></td>
                                        <td className="px-6 py-4">
                                            <select name="roleId" value={editedData.roleId || ''} onChange={handleInlineChange} className="form-select w-full">
                                                {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-6 py-4">
                                            <select name="horizontal" value={editedData.horizontal || ''} onChange={handleInlineChange} className="form-select w-full">
                                                {horizontals.map(h => <option key={h.id} value={h.value}>{h.value}</option>)}
                                            </select>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{r.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{r.email}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{getRoleName(r.roleId)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{r.horizontal}</td>
                                    </>
                                )}
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                     {editingRowId === r.id ? (
                                        <>
                                            <button onClick={handleSaveInlineEdit} className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-200 mr-3"><CheckIcon className="w-5 h-5" /></button>
                                            <button onClick={handleCancelInlineEdit} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200"><XMarkIcon className="w-5 h-5" /></button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => handleStartInlineEdit(r)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mr-3"><PencilSquareIcon className="w-5 h-5" /></button>
                                            <button onClick={() => handleOpenModal(r)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 mr-3"><PencilIcon className="w-5 h-5" /></button>
                                            <button onClick={() => deleteResource(r.id!)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200"><TrashIcon className="w-5 h-5" /></button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editingResource && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={('id' in editingResource ? 'Modifica' : 'Aggiungi') + ' Risorsa'}>
                    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium">Nome *</label>
                                <input type="text" name="name" value={editingResource.name} onChange={handleChange} required className="mt-1 w-full form-input" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Email *</label>
                                <input type="email" name="email" value={editingResource.email} onChange={handleChange} required className="mt-1 w-full form-input" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Ruolo *</label>
                                <select name="roleId" value={editingResource.roleId} onChange={handleChange} required className="mt-1 w-full form-select">
                                    <option value="">Seleziona un ruolo...</option>
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Horizontal *</label>
                                <select name="horizontal" value={editingResource.horizontal} onChange={handleChange} required className="mt-1 w-full form-select">
                                    <option value="">Seleziona un horizontal...</option>
                                    {horizontals.map(h => <option key={h.id} value={h.value}>{h.value}</option>)}
                                </select>
                            </div>
                             <div>
                                <label className="block text-sm font-medium">Data Assunzione *</label>
                                <input type="date" name="hireDate" value={editingResource.hireDate} onChange={handleChange} required className="mt-1 w-full form-input" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Anzianità Lavorativa (anni) *</label>
                                <input type="number" name="workSeniority" value={editingResource.workSeniority} onChange={handleChange} required className="mt-1 w-full form-input" />
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium">Note</label>
                            <textarea name="notes" value={editingResource.notes || ''} onChange={handleChange} rows={3} className="mt-1 w-full form-input" />
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

export default ResourcesPage;