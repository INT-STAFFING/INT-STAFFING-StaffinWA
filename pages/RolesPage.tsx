import React, { useState } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { Role } from '../types';
import Modal from '../components/Modal';
import { PencilIcon, TrashIcon } from '../components/icons';

const RolesPage: React.FC = () => {
    const { roles, seniorityLevels, addRole, updateRole, deleteRole } = useStaffingContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | Omit<Role, 'id'> | null>(null);
    
    const handleOpenModal = (role: Role | null = null) => {
        setEditingRole(role || { name: '', seniorityLevel: '', dailyCost: 0 });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingRole(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingRole) {
            try {
                if ('id' in editingRole) {
                    await updateRole(editingRole as Role);
                } else {
                    await addRole(editingRole as Omit<Role, 'id'>);
                }
                handleCloseModal();
            } catch (error) {
                console.error("Failed to save role:", error);
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (editingRole) {
            const { name, value, type } = e.target;
            const isNumber = type === 'number';
            setEditingRole({ ...editingRole, [name]: isNumber ? parseFloat(value) || 0 : value });
        }
    };
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Gestione Ruoli</h1>
                <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700">
                    Aggiungi Ruolo
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Nome</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Livello Seniority</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Costo Giornaliero</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {roles.map(role => (
                            <tr key={role.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{role.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{role.seniorityLevel}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{role.dailyCost.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => handleOpenModal(role)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 mr-3"><PencilIcon className="w-5 h-5" /></button>
                                    <button onClick={() => deleteRole(role.id!)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200"><TrashIcon className="w-5 h-5" /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editingRole && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={('id' in editingRole ? 'Modifica' : 'Aggiungi') + ' Ruolo'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium">Nome *</label>
                            <input type="text" name="name" value={editingRole.name} onChange={handleChange} required className="mt-1 w-full form-input" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Livello Seniority *</label>
                             <select name="seniorityLevel" value={editingRole.seniorityLevel} onChange={handleChange} required className="mt-1 w-full form-select">
                                <option value="">Seleziona un livello...</option>
                                {seniorityLevels.map(s => <option key={s.id} value={s.value}>{s.value}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Costo Giornaliero *</label>
                            <input type="number" name="dailyCost" value={editingRole.dailyCost} onChange={handleChange} required className="mt-1 w-full form-input" />
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

export default RolesPage;
