/**
 * @file RolesPage.tsx
 * @description Pagina per la gestione dei ruoli professionali (CRUD e visualizzazione).
 */

import React, { useState, useMemo } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { Role } from '../types';
import Modal from '../components/Modal';
import { PencilIcon, TrashIcon, PencilSquareIcon, CheckIcon, XMarkIcon } from '../components/icons';

/**
 * Formatta un valore numerico come valuta EUR.
 * @param {number} value - Il valore numerico da formattare.
 * @returns {string} La stringa formattata (es. "€ 1.234,56").
 */
const formatCurrency = (value: number): string => {
    return (value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

/**
 * Componente per la pagina di gestione dei Ruoli.
 * Permette di visualizzare, filtrare, aggiungere, modificare (in modale o inline) ed eliminare ruoli.
 * @returns {React.ReactElement} La pagina di gestione dei ruoli.
 */
const RolesPage: React.FC = () => {
    const { roles, seniorityLevels, addRole, updateRole, deleteRole } = useStaffingContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | Omit<Role, 'id'> | null>(null);
    const [filters, setFilters] = useState({ name: '', seniorityLevel: '' });
    
    // Stati per la gestione della modifica inline.
    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
    const [inlineEditingData, setInlineEditingData] = useState<Role | null>(null);

    // Oggetto ruolo vuoto usato come stato iniziale per il form di creazione.
    const emptyRole: Omit<Role, 'id'> = {
        name: '',
        seniorityLevel: seniorityLevels[0]?.value || '',
        dailyCost: 0,
    };

    // Memoizza i ruoli filtrati per ottimizzare le performance.
    const filteredRoles = useMemo(() => {
        return roles.filter(role => {
            const nameMatch = role.name.toLowerCase().includes(filters.name.toLowerCase());
            const seniorityMatch = filters.seniorityLevel ? role.seniorityLevel === filters.seniorityLevel : true;
            return nameMatch && seniorityMatch;
        });
    }, [roles, filters]);

    /**
     * Aggiorna lo stato dei filtri.
     * @param {React.ChangeEvent<HTMLInputElement | HTMLSelectElement>} e - L'evento di input.
     */
    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const resetFilters = () => {
        setFilters({ name: '', seniorityLevel: '' });
    };

    /** Apre la modale per creare un nuovo ruolo. */
    const openModalForNew = () => {
        setEditingRole(emptyRole);
        setIsModalOpen(true);
    };

    /**
     * Apre la modale per modificare un ruolo esistente.
     * @param {Role} role - Il ruolo da modificare.
     */
    const openModalForEdit = (role: Role) => {
        setEditingRole(role);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingRole(null);
    };

    /**
     * Gestisce l'invio del form della modale (creazione/modifica).
     * @param {React.FormEvent<HTMLFormElement>} e - L'evento di submit.
     */
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingRole) {
            if ('id' in editingRole) {
                updateRole(editingRole);
            } else {
                addRole(editingRole);
            }
            handleCloseModal();
        }
    };

    /**
     * Gestisce le modifiche ai campi del form nella modale.
     * @param {React.ChangeEvent<HTMLInputElement | HTMLSelectElement>} e - L'evento di input.
     */
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (editingRole) {
            const { name, value } = e.target;
            const numericFields = ['dailyCost'];
            setEditingRole({
                ...editingRole,
                [name]: numericFields.includes(name) ? parseFloat(value) || 0 : value
            } as Role | Omit<Role, 'id'>);
        }
    };

    /**
     * Attiva la modalità di modifica inline per una riga.
     * @param {Role} role - Il ruolo da modificare.
     */
    const handleStartInlineEdit = (role: Role) => {
        setInlineEditingId(role.id!);
        setInlineEditingData({ ...role });
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
            const isNumeric = name === 'dailyCost';
            setInlineEditingData({ 
                ...inlineEditingData, 
                [name]: isNumeric ? parseFloat(value) || 0 : value 
            });
        }
    };

    /** Salva le modifiche effettuate in modalità inline. */
    const handleSaveInlineEdit = () => {
        if (inlineEditingData) {
            updateRole(inlineEditingData);
            handleCancelInlineEdit();
        }
    };


    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white self-start">Gestione Ruoli</h1>
                <button onClick={openModalForNew} className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700">Aggiungi Ruolo</button>
            </div>

            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nome Ruolo</label>
                        <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="mt-1 w-full form-input" placeholder="Cerca per nome..." />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Livello Seniority</label>
                        <select name="seniorityLevel" value={filters.seniorityLevel} onChange={handleFilterChange} className="mt-1 w-full form-select">
                            <option value="">Tutti i livelli</option>
                            {seniorityLevels.map(s => <option key={s.id} value={s.value}>{s.value}</option>)}
                        </select>
                    </div>
                    <button onClick={resetFilters} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full md:w-auto">Reset Filtri</button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y md:divide-y-0 divide-gray-200 dark:divide-gray-700">
                    <thead className="hidden md:table-header-group bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nome Ruolo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Livello Seniority</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Costo Giornaliero</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="block md:table-row-group divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredRoles.map(role => {
                            const isEditing = inlineEditingId === role.id;
                            if (isEditing) {
                                // Riga in modalità modifica inline
                                return (
                                <tr key={role.id} className="block md:table-row p-4 md:p-0 border-b dark:border-gray-600">
                                    <td data-label="Ruolo" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none"><input type="text" name="name" value={inlineEditingData.name} onChange={handleInlineFormChange} className="w-full text-sm form-input p-1"/></td>
                                    <td data-label="Seniority" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none">
                                        <select name="seniorityLevel" value={inlineEditingData.seniorityLevel} onChange={handleInlineFormChange} className="w-full text-sm form-select p-1">
                                            {seniorityLevels.sort((a,b)=>a.value.localeCompare(b.value)).map(s=><option key={s.id} value={s.value}>{s.value}</option>)}
                                        </select>
                                    </td>
                                    <td data-label="Costo" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none"><input type="number" step="0.01" name="dailyCost" value={inlineEditingData.dailyCost} onChange={handleInlineFormChange} className="w-full text-sm form-input p-1"/></td>
                                    <td className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end space-x-2">
                                            <button onClick={handleSaveInlineEdit} className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-200"><CheckIcon className="w-5 h-5"/></button>
                                            <button onClick={handleCancelInlineEdit} className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"><XMarkIcon className="w-5 h-5"/></button>
                                        </div>
                                    </td>
                                </tr>
                                )
                            }
                            // Riga in modalità visualizzazione
                            return (
                            <tr key={role.id} className="block md:table-row p-4 md:p-0 border-b dark:border-gray-600">
                                <td data-label="Ruolo" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none">{role.name}</td>
                                <td data-label="Seniority" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none">{role.seniorityLevel}</td>
                                <td data-label="Costo" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none">{formatCurrency(role.dailyCost)}</td>
                                <td className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex items-center justify-end space-x-2">
                                        <button onClick={() => openModalForEdit(role)} title="Modifica in modale" className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200"><PencilIcon className="w-5 h-5"/></button>
                                        <button onClick={() => handleStartInlineEdit(role)} title="Modifica inline" className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200"><PencilSquareIcon className="w-5 h-5"/></button>
                                        <button onClick={() => deleteRole(role.id)} title="Elimina" className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200"><TrashIcon className="w-5 h-5"/></button>
                                    </div>
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>

            {editingRole && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingRole ? 'Modifica Ruolo' : 'Aggiungi Ruolo'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium">Nome Ruolo *</label>
                            <input type="text" name="name" value={editingRole.name} onChange={handleChange} required className="mt-1 w-full form-input"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Livello Seniority *</label>
                            <select name="seniorityLevel" value={editingRole.seniorityLevel} onChange={handleChange} required className="mt-1 w-full form-select">
                               {seniorityLevels.sort((a, b) => a.value.localeCompare(b.value)).map(s => <option key={s.id} value={s.value}>{s.value}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Costo Giornaliero (€)</label>
                            <input type="number" step="0.01" name="dailyCost" value={editingRole.dailyCost} onChange={handleChange} className="mt-1 w-full form-input"/>
                        </div>
                        <div className="flex justify-end space-x-3 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Annulla</button>
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Salva</button>
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

export default RolesPage;