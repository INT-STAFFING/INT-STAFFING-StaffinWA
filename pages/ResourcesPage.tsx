/**
 * @file ResourcesPage.tsx
 * @description Pagina per la gestione delle risorse umane (CRUD e visualizzazione).
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { Resource } from '../types';
import Modal from '../components/Modal';
import { PencilIcon, TrashIcon, PencilSquareIcon, CheckIcon, XMarkIcon, ArrowsUpDownIcon } from '../components/icons';
import { getWorkingDaysBetween } from '../utils/dateUtils';

/**
 * @type SortConfig
 * @description Configurazione per l'ordinamento della tabella.
 */
type SortConfig = { key: keyof Resource | 'dailyCost' | 'allocation'; direction: 'ascending' | 'descending' } | null;


/**
 * Formatta un valore numerico come valuta EUR in formato italiano.
 * @param {number} value - Il valore numerico da formattare.
 * @returns {string} La stringa formattata (es. "€ 1.234,56").
 */
const formatCurrency = (value: number): string => {
    return (value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

/**
 * Componente per la pagina di gestione delle Risorse.
 * Permette di visualizzare, filtrare, ordinare, aggiungere, modificare ed eliminare risorse.
 * @returns {React.ReactElement} La pagina di gestione delle risorse.
 */
const ResourcesPage: React.FC = () => {
    const { resources, roles, addResource, updateResource, deleteResource, horizontals, assignments, allocations } = useStaffingContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingResource, setEditingResource] = useState<Resource | Omit<Resource, 'id'> | null>(null);
    const [filters, setFilters] = useState({ name: '', roleId: '', horizontal: '' });
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);
    
    // Stati per la gestione della modifica inline.
    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
    const [inlineEditingData, setInlineEditingData] = useState<Resource | null>(null);

    const emptyResource: Omit<Resource, 'id'> = {
        name: '', email: '', roleId: '', horizontal: horizontals[0]?.value || '',
        hireDate: '', workSeniority: 0, notes: '',
    };
    
    const filteredResources = useMemo(() => {
        return resources.filter(resource => {
            const nameMatch = resource.name.toLowerCase().includes(filters.name.toLowerCase());
            const roleMatch = filters.roleId ? resource.roleId === filters.roleId : true;
            const horizontalMatch = filters.horizontal ? resource.horizontal === filters.horizontal : true;
            return nameMatch && roleMatch && horizontalMatch;
        });
    }, [resources, filters]);

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
    
    // Applica l'ordinamento ai dati filtrati
    const sortedResources = useMemo(() => {
        let sortableItems = [...filteredResources];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aRole = roles.find(r => r.id === a.roleId);
                const bRole = roles.find(r => r.id === b.roleId);

                let aValue: any;
                let bValue: any;

                switch(sortConfig.key) {
                    case 'dailyCost':
                        aValue = aRole?.dailyCost || 0;
                        bValue = bRole?.dailyCost || 0;
                        break;
                    case 'allocation':
                         aValue = calculateResourceAllocation(a.id!);
                         bValue = calculateResourceAllocation(b.id!);
                        break;
                    case 'roleId':
                        aValue = aRole?.name || '';
                        bValue = bRole?.name || '';
                        break;
                    default:
                        aValue = a[sortConfig.key as keyof Resource];
                        bValue = b[sortConfig.key as keyof Resource];
                }

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
    }, [filteredResources, sortConfig, roles, calculateResourceAllocation]);

    const requestSort = (key: SortConfig['key']) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const resetFilters = () => setFilters({ name: '', roleId: '', horizontal: '' });
    
    const getAllocationColor = (avg: number): string => {
        if (avg > 100) return 'text-red-600 dark:text-red-400 font-bold';
        if (avg >= 90) return 'text-yellow-600 dark:text-yellow-400 font-semibold';
        if (avg > 0) return 'text-green-600 dark:text-green-400';
        return 'text-gray-500';
    };

    const openModalForNew = () => { setEditingResource(emptyResource); setIsModalOpen(true); };
    const openModalForEdit = (resource: Resource) => { setEditingResource(resource); setIsModalOpen(true); };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingResource(null); };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingResource) {
            if ('id' in editingResource) updateResource(editingResource);
            else addResource(editingResource);
            handleCloseModal();
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        if (editingResource) {
            const { name, value } = e.target;
            const numericFields = ['workSeniority'];
            setEditingResource({ ...editingResource, [name]: numericFields.includes(name) ? parseFloat(value) || 0 : value });
        }
    };

    const handleStartInlineEdit = (resource: Resource) => { setInlineEditingId(resource.id!); setInlineEditingData({ ...resource }); };
    const handleCancelInlineEdit = () => { setInlineEditingId(null); setInlineEditingData(null); };
    const handleInlineFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (inlineEditingData) setInlineEditingData({ ...inlineEditingData, [e.target.name]: e.target.value });
    };
    const handleSaveInlineEdit = () => { if (inlineEditingData) { updateResource(inlineEditingData); handleCancelInlineEdit(); } };
    
    const getSortableHeader = (label: string, key: SortConfig['key']) => (
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            <button type="button" onClick={() => requestSort(key)} className="flex items-center space-x-1">
                <span className={sortConfig?.key === key ? 'font-bold text-gray-700 dark:text-white' : ''}>{label}</span>
                <ArrowsUpDownIcon className="w-4 h-4" />
            </button>
        </th>
    );

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white self-start">Gestione Risorse</h1>
                <button onClick={openModalForNew} className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700">Aggiungi Risorsa</button>
            </div>
            
            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per nome..." />
                    <select name="roleId" value={filters.roleId} onChange={handleFilterChange} className="w-full form-select">
                        <option value="">Tutti i ruoli</option>
                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <select name="horizontal" value={filters.horizontal} onChange={handleFilterChange} className="w-full form-select">
                        <option value="">Tutti gli horizontal</option>
                        {horizontals.map(h => <option key={h.id} value={h.value}>{h.value}</option>)}
                    </select>
                    <button onClick={resetFilters} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full md:w-auto">Reset</button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y md:divide-y-0 divide-gray-200 dark:divide-gray-700">
                    <thead className="hidden md:table-header-group bg-gray-50 dark:bg-gray-700">
                        <tr>
                            {getSortableHeader('Nome', 'name')}
                            {getSortableHeader('Ruolo', 'roleId')}
                            {getSortableHeader('Horizontal', 'horizontal')}
                            {getSortableHeader('Costo Giornaliero', 'dailyCost')}
                            {getSortableHeader('Alloc. Media', 'allocation')}
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="block md:table-row-group divide-y divide-gray-200 dark:divide-gray-700">
                        {sortedResources.map(resource => {
                            const role = roles.find(r => r.id === resource.roleId);
                            const allocation = calculateResourceAllocation(resource.id!);
                            const isEditing = inlineEditingId === resource.id;

                            if (isEditing) {
                                // Riga in modalità modifica inline
                                return (
                                <tr key={resource.id} className="block md:table-row p-4 md:p-0 border-b dark:border-gray-600">
                                    <td data-label="Nome"><div className="space-y-1"><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full text-sm form-input p-1" /><input type="email" name="email" value={inlineEditingData!.email} onChange={handleInlineFormChange} className="w-full text-xs form-input p-1" /></div></td>
                                    <td data-label="Ruolo"><select name="roleId" value={inlineEditingData!.roleId} onChange={handleInlineFormChange} className="w-full text-sm form-select p-1">{roles.sort((a, b) => a.name.localeCompare(b.name)).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></td>
                                    <td data-label="Horizontal"><select name="horizontal" value={inlineEditingData!.horizontal} onChange={handleInlineFormChange} className="w-full text-sm form-select p-1">{horizontals.sort((a,b)=> a.value.localeCompare(b.value)).map(h => <option key={h.id} value={h.value}>{h.value}</option>)}</select></td>
                                    <td data-label="Costo">{formatCurrency(roles.find(r => r.id === inlineEditingData!.roleId)?.dailyCost || 0)}</td>
                                    <td data-label="Allocazione" className={getAllocationColor(allocation)}>{allocation}%</td>
                                    <td data-label="Azioni" className="text-right"><button onClick={handleSaveInlineEdit} className="text-green-600"><CheckIcon className="w-5 h-5"/></button><button onClick={handleCancelInlineEdit} className="text-gray-600"><XMarkIcon className="w-5 h-5"/></button></td>
                                </tr>
                                )
                            }
                            
                            // Riga in modalità visualizzazione
                            return (
                            <tr key={resource.id} className="block md:table-row p-4 md:p-0 border-b dark:border-gray-600">
                                <td data-label="Nome"><div>{resource.name}</div><div className="text-xs text-gray-400">{resource.email}</div></td>
                                <td data-label="Ruolo">{role?.name || 'N/A'}</td>
                                <td data-label="Horizontal">{resource.horizontal}</td>
                                <td data-label="Costo">{formatCurrency(role?.dailyCost || 0)}</td>
                                <td data-label="Allocazione" className={getAllocationColor(allocation)}>{allocation}%</td>
                                <td className="text-right">
                                    <div className="flex items-center justify-end space-x-2">
                                        <button onClick={() => openModalForEdit(resource)}><PencilIcon className="w-5 h-5"/></button>
                                        <button onClick={() => handleStartInlineEdit(resource)}><PencilSquareIcon className="w-5 h-5"/></button>
                                        <button onClick={() => deleteResource(resource.id!)}><TrashIcon className="w-5 h-5"/></button>
                                    </div>
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
                            <input type="text" name="name" value={editingResource.name} onChange={handleChange} required className="form-input" placeholder="Nome e Cognome *"/>
                            <input type="email" name="email" value={editingResource.email} onChange={handleChange} required className="form-input" placeholder="Email *"/>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <select name="roleId" value={editingResource.roleId} onChange={handleChange} required className="form-select">{roles.sort((a, b) => a.name.localeCompare(b.name)).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
                            <select name="horizontal" value={editingResource.horizontal} onChange={handleChange} required className="form-select">{horizontals.sort((a, b) => a.value.localeCompare(b.value)).map(h => <option key={h.id} value={h.value}>{h.value}</option>)}</select>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <input type="date" name="hireDate" value={editingResource.hireDate} onChange={handleChange} className="form-input"/>
                            <input type="number" name="workSeniority" value={editingResource.workSeniority} onChange={handleChange} className="form-input" placeholder="Anzianità (anni)"/>
                        </div>
                        <textarea name="notes" value={editingResource.notes || ''} onChange={handleChange} rows={3} className="form-textarea" placeholder="Note"></textarea>
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

export default ResourcesPage;