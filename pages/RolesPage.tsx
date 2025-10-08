
import React, { useState, useMemo } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { Role } from '../types';
import Modal from '../components/Modal';
import { PencilIcon, TrashIcon } from '../components/icons';

const formatCurrency = (value: number) => {
    return (value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

const RolesPage: React.FC = () => {
    const { roles, seniorityLevels, addRole, updateRole, deleteRole } = useStaffingContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | Omit<Role, 'id'> | null>(null);

    // START: Filters State
    const [filters, setFilters] = useState({ name: '', seniorityLevel: '' });
    // END: Filters State
    
    const emptyRole: Omit<Role, 'id'> = {
        name: '',
        seniorityLevel: seniorityLevels[0]?.value || '',
        dailyCost: 0,
    };

    // START: Filtering Logic
    const filteredRoles = useMemo(() => {
        return roles.filter(role => {
            const nameMatch = role.name.toLowerCase().includes(filters.name.toLowerCase());
            const seniorityMatch = filters.seniorityLevel ? role.seniorityLevel === filters.seniorityLevel : true;
            return nameMatch && seniorityMatch;
        });
    }, [roles, filters]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const resetFilters = () => {
        setFilters({ name: '', seniorityLevel: '' });
    };
    // END: Filtering Logic

    const openModalForNew = () => {
        setEditingRole(emptyRole);
        setIsModalOpen(true);
    };

    const openModalForEdit = (role: Role) => {
        setEditingRole(role);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingRole(null);
    };

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

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Gestione Ruoli</h1>
                <button onClick={openModalForNew} className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700">Aggiungi Ruolo</button>
            </div>

            {/* START: Filters JSX */}
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
            {/* END: Filters JSX */}

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nome Ruolo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Livello Seniority</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Costo Giornaliero</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredRoles.map(role => (
                            <tr key={role.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{role.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{role.seniorityLevel}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{formatCurrency(role.dailyCost)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => openModalForEdit(role)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 mr-4"><PencilIcon className="w-5 h-5"/></button>
                                    <button onClick={() => deleteRole(role.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200"><TrashIcon className="w-5 h-5"/></button>
                                </td>
                            </tr>
                        ))}
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
                            <input type="number" step="0.01" name="dailyCost" value={editingRole.dailyCost} onChange={handleChange} required className="mt-1 w-full form-input"/>
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
