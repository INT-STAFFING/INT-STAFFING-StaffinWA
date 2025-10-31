/**
 * @file RolesPage.tsx
 * @description Pagina per la gestione dei ruoli professionali (CRUD e visualizzazione).
 */

import React, { useState, useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Role } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { SpinnerIcon } from '../components/icons';
import { DataTable, ColumnDef } from '../components/DataTable';

const formatCurrency = (value: number | undefined): string => {
    return (value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

const RolesPage: React.FC = () => {
    const { roles, seniorityLevels, addRole, updateRole, deleteRole, isActionLoading } = useEntitiesContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | Omit<Role, 'id'> | null>(null);
    const [filters, setFilters] = useState({ name: '', seniorityLevel: '' });
    
    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
    const [inlineEditingData, setInlineEditingData] = useState<Role | null>(null);

    const emptyRole: Omit<Role, 'id'> = { name: '', seniorityLevel: seniorityLevels[0]?.value || '', dailyCost: 0, standardCost: 0 };

    const filteredRoles = useMemo(() => {
        return roles.filter(role => {
            const nameMatch = role.name.toLowerCase().includes(filters.name.toLowerCase());
            const seniorityMatch = filters.seniorityLevel ? role.seniorityLevel === filters.seniorityLevel : true;
            return nameMatch && seniorityMatch;
        });
    }, [roles, filters]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleFilterSelectChange = (name: string, value: string) => setFilters(prev => ({ ...prev, [name]: value }));
    const resetFilters = () => setFilters({ name: '', seniorityLevel: '' });

    const openModalForNew = () => { setEditingRole(emptyRole); setIsModalOpen(true); };
    const openModalForEdit = (role: Role) => { setEditingRole(role); setIsModalOpen(true); handleCancelInlineEdit(); };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingRole(null); };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingRole) {
            try {
                if ('id' in editingRole) await updateRole(editingRole);
                else await addRole(editingRole);
                handleCloseModal();
            } catch (e) {}
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (editingRole) {
            const { name, value } = e.target;
            const numericFields = ['dailyCost', 'standardCost'];
            setEditingRole({ ...editingRole, [name]: numericFields.includes(name) ? parseFloat(value) || 0 : value } as Role | Omit<Role, 'id'>);
        }
    };

    const handleSelectChange = (name: string, value: string) => {
        if (editingRole) setEditingRole({ ...editingRole, [name]: value });
    };
    
    const handleStartInlineEdit = (role: Role) => { setInlineEditingId(role.id!); setInlineEditingData({ ...role }); };
    const handleCancelInlineEdit = () => { setInlineEditingId(null); setInlineEditingData(null); };

    const handleInlineFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (inlineEditingData) {
            const { name, value } = e.target;
            const isNumeric = ['dailyCost', 'standardCost'].includes(name);
            setInlineEditingData({ ...inlineEditingData, [name]: isNumeric ? parseFloat(value) || 0 : value });
        }
    };
    
    const handleInlineSelectChange = (name: string, value: string) => {
        if (inlineEditingData) setInlineEditingData({ ...inlineEditingData, [name]: value });
    };

    const handleSaveInlineEdit = async () => { if (inlineEditingData) { await updateRole(inlineEditingData); handleCancelInlineEdit(); } };

    const seniorityOptions = useMemo(() => seniorityLevels.sort((a,b)=>a.value.localeCompare(b.value)).map(s => ({ value: s.value, label: s.value })), [seniorityLevels]);

    const columns: ColumnDef<Role>[] = [
        { header: 'Nome Ruolo', sortKey: 'name', cell: (role) => <span className="font-medium text-gray-900 dark:text-white">{role.name}</span> },
        { header: 'Livello Seniority', sortKey: 'seniorityLevel', cell: (role) => <span className="text-sm text-gray-600 dark:text-gray-300">{role.seniorityLevel}</span> },
        { header: 'Costo Giornaliero', sortKey: 'dailyCost', cell: (role) => <span className="text-sm text-gray-600 dark:text-gray-300">{formatCurrency(role.dailyCost)}</span> },
        { header: 'Costo Standard', sortKey: 'standardCost', cell: (role) => <span className="text-sm text-gray-600 dark:text-gray-300">{formatCurrency(role.standardCost)}</span> },
        { header: 'Spese Giornaliere', sortKey: 'dailyExpenses', cell: (role) => <span className="text-sm text-gray-600 dark:text-gray-300">{formatCurrency(role.dailyExpenses)}</span> },
    ];
    
    const renderRow = (role: Role) => {
        const isEditing = inlineEditingId === role.id;
        const isSaving = isActionLoading(`updateRole-${role.id}`);
        if (isEditing) {
            return (
                <tr key={role.id}>
                    <td className="px-6 py-4"><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full form-input p-1"/></td>
                    <td className="px-6 py-4"><SearchableSelect name="seniorityLevel" value={inlineEditingData!.seniorityLevel} onChange={handleInlineSelectChange} options={seniorityOptions} placeholder="Seleziona livello"/></td>
                    <td className="px-6 py-4"><input type="number" step="0.01" name="dailyCost" value={inlineEditingData!.dailyCost} onChange={handleInlineFormChange} className="w-full form-input p-1"/></td>
                    <td className="px-6 py-4"><input type="number" step="0.01" name="standardCost" value={inlineEditingData!.standardCost || 0} onChange={handleInlineFormChange} className="w-full form-input p-1"/></td>
                    <td className="px-6 py-4 text-sm">{formatCurrency((inlineEditingData!.dailyCost || 0) * 0.035)}</td>
                    <td className="px-6 py-4 text-right"><div className="flex items-center justify-end space-x-2">
                        <button onClick={handleSaveInlineEdit} disabled={isSaving} className="p-1 text-green-600 hover:text-green-500 disabled:opacity-50">
                           {isSaving ? <SpinnerIcon className="w-5 h-5"/> : <span className="text-xl">✔️</span>}
                        </button>
                        <button onClick={handleCancelInlineEdit} className="p-1 text-gray-500 hover:text-gray-400"><span className="text-xl">❌</span></button>
                    </div></td>
                </tr>
            );
        }
        return (
            <tr key={role.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap overflow-hidden text-ellipsis" title={col.sortKey ? String((role as any)[col.sortKey]) : undefined}>{col.cell(role)}</td>)}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-3">
                        <button onClick={() => openModalForEdit(role)} className="text-gray-500 hover:text-blue-600" title="Modifica Dettagli"><span className="text-xl">✏️</span></button>
                        <button onClick={() => handleStartInlineEdit(role)} className="text-gray-500 hover:text-green-600" title="Modifica Rapida"><span className="text-xl">✏️</span></button>
                        <button onClick={() => deleteRole(role.id!)} className="text-gray-500 hover:text-red-600" title="Elimina">
                             {isActionLoading(`deleteRole-${role.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="text-xl">🗑️</span>}
                        </button>
                    </div>
                </td>
            </tr>
        );
    };

    const renderMobileCard = (role: Role) => {
        const isEditing = inlineEditingId === role.id;
        const isSaving = isActionLoading(`updateRole-${role.id}`);
        if (isEditing) {
            return (
                <div key={role.id} className="p-4 rounded-lg shadow-md bg-white dark:bg-gray-800 border border-blue-500">
                    <div className="space-y-3">
                        <div><label className="text-xs font-medium text-gray-500">Nome Ruolo</label><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full form-input p-1"/></div>
                        <div><label className="text-xs font-medium text-gray-500">Livello Seniority</label><SearchableSelect name="seniorityLevel" value={inlineEditingData!.seniorityLevel} onChange={handleInlineSelectChange} options={seniorityOptions} placeholder="Seleziona livello"/></div>
                        <div><label className="text-xs font-medium text-gray-500">Costo Giornaliero</label><input type="number" step="0.01" name="dailyCost" value={inlineEditingData!.dailyCost} onChange={handleInlineFormChange} className="w-full form-input p-1"/></div>
                        <div><label className="text-xs font-medium text-gray-500">Costo Standard</label><input type="number" step="0.01" name="standardCost" value={inlineEditingData!.standardCost || 0} onChange={handleInlineFormChange} className="w-full form-input p-1"/></div>
                        <div className="flex justify-end space-x-2 pt-2">
                             <button onClick={handleSaveInlineEdit} disabled={isSaving} className="p-2 bg-green-100 text-green-700 rounded-full disabled:opacity-50">
                                {isSaving ? <SpinnerIcon className="w-5 h-5"/> : <span className="text-xl">✔️</span>}
                            </button>
                            <button onClick={handleCancelInlineEdit} className="p-2 bg-gray-100 text-gray-700 rounded-full"><span className="text-xl">❌</span></button>
                        </div>
                    </div>
                </div>
            );
        }
        return (
             <div key={role.id} className="p-4 rounded-lg shadow-md bg-card dark:bg-dark-card">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-bold text-lg text-gray-900 dark:text-white">{role.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{role.seniorityLevel}</p>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0 ml-4">
                        <button onClick={() => openModalForEdit(role)} className="p-1 text-gray-500 hover:text-blue-600"><span className="text-xl">✏️</span></button>
                        <button onClick={() => handleStartInlineEdit(role)} className="p-1 text-gray-500 hover:text-green-600"><span className="text-xl">✏️</span></button>
                        <button onClick={() => deleteRole(role.id!)} className="p-1 text-gray-500 hover:text-red-600">
                             {isActionLoading(`deleteRole-${role.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="text-xl">🗑️</span>}
                        </button>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-4 text-sm">
                     <div><p className="text-gray-500 dark:text-gray-400">Costo G.</p><p className="font-medium text-gray-900 dark:text-white">{formatCurrency(role.dailyCost)}</p></div>
                     <div><p className="text-gray-500 dark:text-gray-400">Costo Std.</p><p className="font-medium text-gray-900 dark:text-white">{formatCurrency(role.standardCost)}</p></div>
                     <div><p className="text-gray-500 dark:text-gray-400">Spese G.</p><p className="font-medium text-gray-900 dark:text-white">{formatCurrency(role.dailyExpenses)}</p></div>
                </div>
            </div>
        );
    };

    const filtersNode = (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per nome..."/>
            <SearchableSelect name="seniorityLevel" value={filters.seniorityLevel} onChange={handleFilterSelectChange} options={seniorityOptions} placeholder="Tutti i livelli" />
            <button onClick={resetFilters} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full md:w-auto">Reset</button>
        </div>
    );

    return (
        <div>
            <DataTable
                title="Gestione Ruoli"
                addNewButtonLabel="Aggiungi Ruolo"
                data={filteredRoles}
                columns={columns}
                filtersNode={filtersNode}
                onAddNew={openModalForNew}
                renderRow={renderRow}
                renderMobileCard={renderMobileCard}
                initialSortKey="name"
            />

            {editingRole && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingRole ? 'Modifica Ruolo' : 'Aggiungi Ruolo'}>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome Ruolo *</label>
                            <input type="text" name="name" value={editingRole.name} onChange={handleChange} required className="w-full form-input"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Livello Seniority *</label>
                            <SearchableSelect name="seniorityLevel" value={editingRole.seniorityLevel} onChange={handleSelectChange} options={seniorityOptions} placeholder="Seleziona un livello" required />
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Costo Giornaliero (€)</label>
                                <input type="number" step="0.01" name="dailyCost" value={editingRole.dailyCost} onChange={handleChange} className="w-full form-input"/>
                            </div>
{/* Fix: complete truncated file */ }
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Costo Standard (€)</label>
                                <input type="number" step="0.01" name="standardCost" value={editingRole.standardCost || 0} onChange={handleChange} className="w-full form-input"/>
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Annulla</button>
                             <button type="submit" disabled={isActionLoading('addRole') || isActionLoading(`updateRole-${'id' in editingRole ? editingRole.id : ''}`)} className="flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400">
                                {(isActionLoading('addRole') || isActionLoading(`updateRole-${'id' in editingRole ? editingRole.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
             <style>{`.form-input, .form-select { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-input, .dark .form-select { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }`}</style>
        </div>
    );
};

export default RolesPage;