
import React, { useState, useCallback, useMemo } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { Resource } from '../types';
import Modal from '../components/Modal';
import { PencilIcon, TrashIcon } from '../components/icons';
import { getWorkingDaysBetween } from '../utils/dateUtils';

const formatCurrency = (value: number) => {
    return (value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

const ResourcesPage: React.FC = () => {
    const { resources, roles, addResource, updateResource, deleteResource, horizontals, assignments, allocations } = useStaffingContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingResource, setEditingResource] = useState<Resource | Omit<Resource, 'id'> | null>(null);

    // START: Filters State
    const [filters, setFilters] = useState({ name: '', roleId: '', horizontal: '' });
    // END: Filters State

    const emptyResource: Omit<Resource, 'id'> = {
        name: '',
        email: '',
        roleId: '',
        horizontal: horizontals[0]?.value || '',
        hireDate: '',
        workSeniority: 0,
        notes: '',
    };
    
    // START: Filtering Logic
    const filteredResources = useMemo(() => {
        return resources.filter(resource => {
            const nameMatch = resource.name.toLowerCase().includes(filters.name.toLowerCase());
            const roleMatch = filters.roleId ? resource.roleId === filters.roleId : true;
            const horizontalMatch = filters.horizontal ? resource.horizontal === filters.horizontal : true;
            return nameMatch && roleMatch && horizontalMatch;
        });
    }, [resources, filters]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const resetFilters = () => {
        setFilters({ name: '', roleId: '', horizontal: '' });
    };
    // END: Filtering Logic

    const calculateResourceAllocation = useCallback((resourceId: string): number => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const workingDaysInMonth = getWorkingDaysBetween(firstDay, lastDay);

        if (workingDaysInMonth === 0) return 0;

        const resourceAssignments = assignments.filter(a => a.resourceId === resourceId);
        if (resourceAssignments.length === 0) return 0;

        let totalPersonDays = 0;
        
        resourceAssignments.forEach(assignment => {
            const assignmentAllocations = allocations[assignment.id];
            if (assignmentAllocations) {
                for (const dateStr in assignmentAllocations) {
                    const allocDate = new Date(dateStr);
                    if (allocDate >= firstDay && allocDate <= lastDay) {
                        totalPersonDays += (assignmentAllocations[dateStr] / 100);
                    }
                }
            }
        });

        return Math.round((totalPersonDays / workingDaysInMonth) * 100);
    }, [assignments, allocations]);

    const getAllocationColor = (avg: number) => {
        if (avg > 100) return 'text-red-600 dark:text-red-400 font-bold';
        if (avg >= 90) return 'text-yellow-600 dark:text-yellow-400 font-semibold';
        if (avg > 0) return 'text-green-600 dark:text-green-400';
        return 'text-gray-500';
    };

    const openModalForNew = () => {
        setEditingResource(emptyResource);
        setIsModalOpen(true);
    };

    const openModalForEdit = (resource: Resource) => {
        setEditingResource(resource);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingResource(null);
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingResource) {
            if ('id' in editingResource) {
                updateResource(editingResource);
            } else {
                addResource(editingResource);
            }
            handleCloseModal();
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        if (editingResource) {
            const { name, value } = e.target;
            const numericFields = ['workSeniority'];
            setEditingResource({
                ...editingResource,
                [name]: numericFields.includes(name) ? parseFloat(value) || 0 : value
            });
        }
    };
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Gestione Risorse</h1>
                <button onClick={openModalForNew} className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700">Aggiungi Risorsa</button>
            </div>

            {/* START: Filters JSX */}
            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nome</label>
                        <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="mt-1 w-full form-input" placeholder="Cerca per nome..." />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ruolo</label>
                        <select name="roleId" value={filters.roleId} onChange={handleFilterChange} className="mt-1 w-full form-select">
                            <option value="">Tutti i ruoli</option>
                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Horizontal</label>
                        <select name="horizontal" value={filters.horizontal} onChange={handleFilterChange} className="mt-1 w-full form-select">
                            <option value="">Tutti gli horizontal</option>
                            {horizontals.map(h => <option key={h.id} value={h.value}>{h.value}</option>)}
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
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nome</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Ruolo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Horizontal</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Costo Giornaliero</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Alloc. Media (Mese Corr.)</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredResources.map(resource => {
                            const role = roles.find(r => r.id === resource.roleId);
                            const allocation = calculateResourceAllocation(resource.id);
                            return (
                            <tr key={resource.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                    <div>{resource.name}</div>
                                    <div className="text-xs text-gray-400">{resource.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{role?.name || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{resource.horizontal}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{formatCurrency(role?.dailyCost || 0)}</td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm ${getAllocationColor(allocation)}`}>{allocation}%</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => openModalForEdit(resource)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 mr-4">
                                        <PencilIcon className="w-5 h-5"/>
                                    </button>
                                    <button onClick={() => deleteResource(resource.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200">
                                        <TrashIcon className="w-5 h-5"/>
                                    </button>
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>

            {editingResource && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingResource ? 'Modifica Risorsa' : 'Aggiungi Risorsa'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium">Nome e Cognome *</label>
                                <input type="text" name="name" value={editingResource.name} onChange={handleChange} required className="mt-1 w-full form-input"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Email *</label>
                                <input type="email" name="email" value={editingResource.email} onChange={handleChange} required className="mt-1 w-full form-input"/>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium">Ruolo *</label>
                                <select name="roleId" value={editingResource.roleId} onChange={handleChange} required className="mt-1 w-full form-select">
                                    <option value="">Seleziona un ruolo</option>
                                    {roles.sort((a, b) => a.name.localeCompare(b.name)).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                             <div>
                                <label className="block text-sm font-medium">Horizontal *</label>
                                <select name="horizontal" value={editingResource.horizontal} onChange={handleChange} required className="mt-1 w-full form-select">
                                    {horizontals.sort((a, b) => a.value.localeCompare(b.value)).map(h => <option key={h.id} value={h.value}>{h.value}</option>)}
                                </select>
                            </div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium">Data Assunzione</label>
                                <input type="date" name="hireDate" value={editingResource.hireDate} onChange={handleChange} className="mt-1 w-full form-input"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Anzianità Lavorativa (anni)</label>
                                <input type="number" name="workSeniority" value={editingResource.workSeniority} onChange={handleChange} className="mt-1 w-full form-input"/>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Note</label>
                            <textarea name="notes" value={editingResource.notes || ''} onChange={handleChange} rows={3} className="mt-1 w-full form-textarea"></textarea>
                        </div>
                        <div className="flex justify-end space-x-3 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Annulla</button>
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Salva</button>
                        </div>
                    </form>
                </Modal>
            )}
            <style>{`
                .form-input, .form-select, .form-textarea {
                    display: block;
                    width: 100%;
                    border-radius: 0.375rem;
                    border: 1px solid #D1D5DB;
                    background-color: #FFFFFF;
                    padding: 0.5rem 0.75rem;
                    font-size: 0.875rem;
                    line-height: 1.25rem;
                }
                .dark .form-input, .dark .form-select, .dark .form-textarea {
                    border-color: #4B5563;
                    background-color: #374151;
                    color: #F9FAFB;
                }
            `}</style>
        </div>
    );
};

export default ResourcesPage;
