/**
 * @file RolesPage.tsx
 * @description Pagina per la gestione dei ruoli professionali (CRUD e visualizzazione).
 */

import React, { useState, useMemo } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { Role } from '../types';
import Modal from '../components/Modal';
import { PencilIcon, TrashIcon, CheckIcon, XMarkIcon, ArrowsUpDownIcon } from '../components/icons';

/**
 * @type SortConfig
 * @description Configurazione per l'ordinamento della tabella.
 */
type SortConfig = { key: keyof Role; direction: 'ascending' | 'descending' } | null;

/**
 * Formatta un valore numerico come valuta EUR in formato italiano.
 * @param {number} value - Il valore numerico da formattare.
 * @returns {string} La stringa formattata (es. "€ 1.234,56").
 */
const formatCurrency = (value: number): string => {
    return (value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

/**
 * Componente per la pagina di gestione dei Ruoli.
 * Permette di visualizzare, filtrare, ordinare, aggiungere, modificare ed eliminare ruoli.
 * @returns {React.ReactElement} La pagina di gestione dei ruoli.
 */
const RolesPage: React.FC = () => {
    const { roles, seniorityLevels, addRole, updateRole, deleteRole } = useStaffingContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | Omit<Role, 'id'> | null>(null);
    const [filters, setFilters] = useState({ name: '', seniorityLevel: '' });
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);
    
    // Stati per la gestione della modifica inline.
    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
    const [inlineEditingData, setInlineEditingData] = useState<Role | null>(null);

    const emptyRole: Omit<Role, 'id'> = { name: '', seniorityLevel: seniorityLevels[0]?.value || '', dailyCost: 0 };

    const filteredRoles = useMemo(() => {
        return roles.filter(role => {
            const nameMatch = role.name.toLowerCase().includes(filters.name.toLowerCase());
            const seniorityMatch = filters.seniorityLevel ? role.seniorityLevel === filters.seniorityLevel : true;
            return nameMatch && seniorityMatch;
        });
    }, [roles, filters]);

    // Applica l'ordinamento ai dati filtrati
    const sortedRoles = useMemo(() => {
        let sortableItems = [...filteredRoles];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                
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
    }, [filteredRoles, sortConfig]);
    
    const requestSort = (key: keyof Role) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const resetFilters = () => setFilters({ name: '', seniorityLevel: '' });

    const openModalForNew = () => { setEditingRole(emptyRole); setIsModalOpen(true); };
    const openModalForEdit = (role: Role) => { setEditingRole(role); setIsModalOpen(true); handleCancelInlineEdit(); };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingRole(null); };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingRole) {
            if ('id' in editingRole) updateRole(editingRole);
            else addRole(editingRole);
            handleCloseModal();
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (editingRole) {
            const { name, value } = e.target;
            const numericFields = ['dailyCost'];
            setEditingRole({ ...editingRole, [name]: numericFields.includes(name) ? parseFloat(value) || 0 : value } as Role | Omit<Role, 'id'>);
        }
    };
    
    const handleStartInlineEdit = (role: Role) => { setInlineEditingId(role.id!); setInlineEditingData({ ...role }); };
    const handleCancelInlineEdit = () => { setInlineEditingId(null); setInlineEditingData(null); };

    const handleInlineFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (inlineEditingData) {
            const { name, value } = e.target;
            const isNumeric = name === 'dailyCost';
            setInlineEditingData({ ...inlineEditingData, [name]: isNumeric ? parseFloat(value) || 0 : value });
        }
    };

    const handleSaveInlineEdit = () => { if (inlineEditingData) { updateRole(inlineEditingData); handleCancelInlineEdit(); } };

    const getSortableHeader = (label: string, key: keyof Role) => (
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            <button type="button" onClick={() => requestSort(key)} className="flex items-center space-x-1 hover:text-gray-900 dark:hover:text-white">
                <span className={sortConfig?.key === key ? 'font-bold text-gray-800 dark:text-white' : ''}>{label}</span>
                <ArrowsUpDownIcon className="w-4 h-4 text-gray-400" />
            </button>
        </th>
    );

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white self-start">Gestione Ruoli</h1>
                <button onClick={openModalForNew} className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700">Aggiungi Ruolo</button>
            </div>

            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per nome..."/>
                    <select name="seniorityLevel" value={filters.seniorityLevel} onChange={handleFilterChange} className="w-full form-select"><option value="">Tutti i livelli</option>{seniorityLevels.sort((a,b)=>a.value.localeCompare(b.value)).map(s => <option key={s.id} value={s.value}>{s.value}</option>)}</select>
                    <button onClick={resetFilters} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full md:w-auto">Reset</button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                {getSortableHeader('Nome Ruolo', 'name')}
                                {getSortableHeader('Livello Seniority', 'seniorityLevel')}
                                {getSortableHeader('Costo Giornaliero', 'dailyCost')}
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {sortedRoles.map(role => {
                                const isEditing = inlineEditingId === role.id;
                                if (isEditing) {
                                    return (
                                    <tr key={role.id}>
                                        <td className="px-6 py-4"><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full form-input p-1"/></td>
                                        <td className="px-6 py-4"><select name="seniorityLevel" value={inlineEditingData!.seniorityLevel} onChange={handleInlineFormChange} className="w-full form-select p-1">{seniorityLevels.sort((a,b)=>a.value.localeCompare(b.value)).map(s=><option key={s.id} value={s.value}>{s.value}</option>)}</select></td>
                                        <td className="px-6 py-4"><input type="number" step="0.01" name="dailyCost" value={inlineEditingData!.dailyCost} onChange={handleInlineFormChange} className="w-full form-input p-1"/></td>
                                        <td className="px-6 py-4 text-right"><div className="flex items-center justify-end space-x-2"><button onClick={handleSaveInlineEdit} className="p-1 text-green-600 hover:text-green-500"><CheckIcon className="w-5 h-5"/></button><button onClick={handleCancelInlineEdit} className="p-1 text-gray-500 hover:text-gray-400"><XMarkIcon className="w-5 h-5"/></button></div></td>
                                    </tr>
                                    )
                                }
                                return (
                                <tr key={role.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{role.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{role.seniorityLevel}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{formatCurrency(role.dailyCost)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end space-x-3">
                                            <button onClick={() => openModalForEdit(role)} className="text-gray-500 hover:text-blue-600" title="Modifica Dettagli"><PencilIcon className="w-5 h-5"/></button>
                                            <button onClick={() => handleStartInlineEdit(role)} className="text-gray-500 hover:text-green-600" title="Modifica Rapida"><PencilIcon className="w-5 h-5"/></button>
                                            <button onClick={() => deleteRole(role.id!)} className="text-gray-500 hover:text-red-600" title="Elimina"><TrashIcon className="w-5 h-5"/></button>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Cards */}
                 <div className="md:hidden p-4 space-y-4">
                     {sortedRoles.map(role => {
                        const isEditing = inlineEditingId === role.id;
                        if (isEditing) {
                             return (
                                <div key={role.id} className="p-4 rounded-lg shadow-md bg-white dark:bg-gray-800 border border-blue-500">
                                    <div className="space-y-3">
                                        <div><label className="text-xs font-medium text-gray-500">Nome Ruolo</label><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full form-input p-1"/></div>
                                        <div><label className="text-xs font-medium text-gray-500">Livello Seniority</label><select name="seniorityLevel" value={inlineEditingData!.seniorityLevel} onChange={handleInlineFormChange} className="w-full form-select p-1">{seniorityLevels.sort((a,b)=>a.value.localeCompare(b.value)).map(s=><option key={s.id} value={s.value}>{s.value}</option>)}</select></div>
                                        <div><label className="text-xs font-medium text-gray-500">Costo Giornaliero</label><input type="number" step="0.01" name="dailyCost" value={inlineEditingData!.dailyCost} onChange={handleInlineFormChange} className="w-full form-input p-1"/></div>
                                        <div className="flex justify-end space-x-2 pt-2">
                                            <button onClick={handleSaveInlineEdit} className="p-2 bg-green-100 text-green-700 rounded-full"><CheckIcon className="w-5 h-5"/></button>
                                            <button onClick={handleCancelInlineEdit} className="p-2 bg-gray-100 text-gray-700 rounded-full"><XMarkIcon className="w-5 h-5"/></button>
                                        </div>
                                    </div>
                                </div>
                            )
                        }
                        return(
                             <div key={role.id} className="p-4 rounded-lg shadow-md bg-gray-50 dark:bg-gray-900/50">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-lg text-gray-900 dark:text-white">{role.name}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{role.seniorityLevel}</p>
                                    </div>
                                    <div className="flex items-center space-x-1 flex-shrink-0 ml-4">
                                        <button onClick={() => openModalForEdit(role)} className="p-1 text-gray-500 hover:text-blue-600"><PencilIcon className="w-5 h-5"/></button>
                                        <button onClick={() => handleStartInlineEdit(role)} className="p-1 text-gray-500 hover:text-green-600"><PencilIcon className="w-5 h-5"/></button>
                                        <button onClick={() => deleteRole(role.id!)} className="p-1 text-gray-500 hover:text-red-600"><TrashIcon className="w-5 h-5"/></button>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm">
                                    <div><p className="text-gray-500 dark:text-gray-400">Costo Giornaliero</p><p className="font-medium text-lg text-gray-900 dark:text-white">{formatCurrency(role.dailyCost)}</p></div>
                                </div>
                            </div>
                        )
                     })}
                 </div>
            </div>

            {editingRole && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingRole ? 'Modifica Ruolo' : 'Aggiungi Ruolo'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input type="text" name="name" value={editingRole.name} onChange={handleChange} required className="w-full form-input" placeholder="Nome Ruolo *"/>
                        <select name="seniorityLevel" value={editingRole.seniorityLevel} onChange={handleChange} required className="w-full form-select">{seniorityLevels.sort((a, b) => a.value.localeCompare(b.value)).map(s => <option key={s.id} value={s.value}>{s.value}</option>)}</select>
                        <input type="number" step="0.01" name="dailyCost" value={editingRole.dailyCost} onChange={handleChange} className="w-full form-input" placeholder="Costo Giornaliero (€)"/>
                        <div className="flex justify-end space-x-3 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 rounded-md">Annulla</button>
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">Salva</button>
                        </div>
                    </form>
                </Modal>
            )}
             <style>{`.form-input, .form-select { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-input, .dark .form-select { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }`}</style>
        </div>
    );
};

export default RolesPage;