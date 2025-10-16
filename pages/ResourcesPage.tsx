/**
 * @file ResourcesPage.tsx
 * @description Pagina per la gestione delle risorse umane (CRUD e visualizzazione).
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { Resource } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { PencilIcon, TrashIcon, CheckIcon, XMarkIcon, SpinnerIcon } from '../components/icons';
import { getWorkingDaysBetween, isHoliday } from '../utils/dateUtils';
import { DataTable, ColumnDef } from '../components/DataTable';

// --- Types ---
type EnrichedResource = Resource & {
    roleName: string;
    dailyCost: number;
    allocation: number;
};

// --- Helper Functions ---
const formatCurrency = (value: number | undefined): string => {
    return (value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

// --- Component ---
const ResourcesPage: React.FC = () => {
    const { resources, roles, addResource, updateResource, deleteResource, horizontals, assignments, locations, companyCalendar, isActionLoading } = useEntitiesContext();
    const { allocations } = useAllocationsContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingResource, setEditingResource] = useState<Resource | Omit<Resource, 'id'> | null>(null);
    const [filters, setFilters] = useState({ name: '', roleId: '', horizontal: '', location: '' });
    
    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
    const [inlineEditingData, setInlineEditingData] = useState<Resource | null>(null);

    const emptyResource: Omit<Resource, 'id'> = {
        name: '', email: '', roleId: '', horizontal: horizontals[0]?.value || '',
        location: locations[0]?.value || '',
        hireDate: '', workSeniority: 0, notes: '', maxStaffingPercentage: 100,
    };
    
    const calculateResourceAllocation = useCallback((resource: Resource): number => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const workingDaysInMonth = getWorkingDaysBetween(firstDay, lastDay, companyCalendar, resource.location);

        if (workingDaysInMonth === 0) return 0;
        const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
        if (resourceAssignments.length === 0) return 0;

        let totalPersonDays = 0;
        resourceAssignments.forEach(assignment => {
            const assignmentAllocations = allocations[assignment.id];
            if (assignmentAllocations) {
                for (const dateStr in assignmentAllocations) {
                    const allocDate = new Date(dateStr);
                    if (allocDate >= firstDay && allocDate <= lastDay) {
                         if (!isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getDay() !== 0 && allocDate.getDay() !== 6) {
                            totalPersonDays += (assignmentAllocations[dateStr] / 100);
                        }
                    }
                }
            }
        });
        return Math.round((totalPersonDays / workingDaysInMonth) * 100);
    }, [assignments, allocations, companyCalendar]);
    
    const dataForTable = useMemo<EnrichedResource[]>(() => {
        const filtered = resources.filter(resource => {
            const nameMatch = resource.name.toLowerCase().includes(filters.name.toLowerCase());
            const roleMatch = filters.roleId ? resource.roleId === filters.roleId : true;
            const horizontalMatch = filters.horizontal ? resource.horizontal === filters.horizontal : true;
            const locationMatch = filters.location ? resource.location === filters.location : true;
            return nameMatch && roleMatch && horizontalMatch && locationMatch;
        });

        return filtered.map(resource => {
            const role = roles.find(r => r.id === resource.roleId);
            return {
                ...resource,
                roleName: role?.name || 'N/A',
                dailyCost: role?.dailyCost || 0,
                allocation: calculateResourceAllocation(resource),
            };
        });
    }, [resources, filters, roles, calculateResourceAllocation]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleFilterSelectChange = (name: string, value: string) => setFilters(prev => ({ ...prev, [name]: value }));
    const resetFilters = () => setFilters({ name: '', roleId: '', horizontal: '', location: '' });
    
    const getAllocationColor = (avg: number): string => {
        if (avg > 100) return 'text-red-600 dark:text-red-400 font-bold';
        if (avg >= 90) return 'text-yellow-600 dark:text-yellow-400 font-semibold';
        if (avg > 0) return 'text-green-600 dark:text-green-400';
        return 'text-gray-500';
    };

    const openModalForNew = () => { setEditingResource(emptyResource); setIsModalOpen(true); };
    const openModalForEdit = (resource: Resource) => { setEditingResource(resource); setIsModalOpen(true); handleCancelInlineEdit(); };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingResource(null); };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingResource) {
            try {
                if ('id' in editingResource) await updateResource(editingResource as Resource);
                else await addResource(editingResource as Omit<Resource, 'id'>);
                handleCloseModal();
            } catch (e) {}
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (editingResource) {
            const { name, value } = e.target;
            const numericFields = ['workSeniority', 'maxStaffingPercentage'];
            setEditingResource({ ...editingResource, [name]: numericFields.includes(name) ? (value === '' ? undefined : parseFloat(value)) : value });
        }
    };
    
    const handleSelectChange = (name: string, value: string) => {
        if (editingResource) setEditingResource({ ...editingResource, [name]: value });
    };

    const handleStartInlineEdit = (resource: Resource) => { setInlineEditingId(resource.id!); setInlineEditingData({ ...resource }); };
    const handleCancelInlineEdit = () => { setInlineEditingId(null); setInlineEditingData(null); };
    const handleInlineFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (inlineEditingData) {
            const { name, value } = e.target;
            const numericFields = ['workSeniority', 'maxStaffingPercentage'];
            setInlineEditingData({ ...inlineEditingData, [name]: numericFields.includes(name) ? parseFloat(value) : value });
        }
    };
    
    const handleInlineSelectChange = (name: string, value: string) => {
        if (inlineEditingData) setInlineEditingData({ ...inlineEditingData, [name]: value });
    };
    
    const handleSaveInlineEdit = async () => { if (inlineEditingData) { await updateResource(inlineEditingData); handleCancelInlineEdit(); } };
    
    const roleOptions = useMemo(() => roles.sort((a, b) => a.name.localeCompare(b.name)).map(r => ({ value: r.id!, label: r.name })), [roles]);
    const horizontalOptions = useMemo(() => horizontals.sort((a,b)=> a.value.localeCompare(b.value)).map(h => ({ value: h.value, label: h.value })), [horizontals]);
    const locationOptions = useMemo(() => locations.sort((a,b)=> a.value.localeCompare(b.value)).map(l => ({ value: l.value, label: l.value })), [locations]);

    const columns: ColumnDef<EnrichedResource>[] = [
        { header: 'Nome', sortKey: 'name', cell: r => <div><div className="font-medium text-gray-900 dark:text-white">{r.name}</div><div className="text-sm text-gray-500 dark:text-gray-400">{r.email}</div></div> },
        { header: 'Ruolo', sortKey: 'roleName', cell: r => <span className="text-sm text-gray-600 dark:text-gray-300">{r.roleName}</span> },
        { header: 'Costo Giornaliero', sortKey: 'dailyCost', cell: r => <span className="text-sm text-gray-600 dark:text-gray-300">{formatCurrency(r.dailyCost)}</span> },
        { header: 'Alloc. Media', sortKey: 'allocation', cell: r => <span className={`text-sm font-semibold ${getAllocationColor(r.allocation)}`}>{r.allocation}%</span> },
        { header: 'Max. Staffing %', sortKey: 'maxStaffingPercentage', cell: r => <span className="text-sm text-gray-600 dark:text-gray-300">{r.maxStaffingPercentage}%</span> },
    ];
    
    const renderRow = (resource: EnrichedResource) => {
        const isEditing = inlineEditingId === resource.id;
        const isSaving = isActionLoading(`updateResource-${resource.id}`);
        if (isEditing) {
            const editingRole = roles.find(r => r.id === inlineEditingData!.roleId);
            return (
                <tr key={resource.id}>
                    <td className="px-6 py-4"><div className="space-y-1"><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full text-sm form-input p-1" /><input type="email" name="email" value={inlineEditingData!.email} onChange={handleInlineFormChange} className="w-full text-xs form-input p-1" /></div></td>
                    <td className="px-6 py-4"><SearchableSelect name="roleId" value={inlineEditingData!.roleId} onChange={handleInlineSelectChange} options={roleOptions} placeholder="Seleziona ruolo" /></td>
                    <td className="px-6 py-4 text-sm">{formatCurrency(editingRole?.dailyCost)}</td>
                    <td className={`px-6 py-4 text-sm ${getAllocationColor(resource.allocation)}`}>{resource.allocation}%</td>
                    <td className="px-6 py-4"><input type="number" name="maxStaffingPercentage" value={inlineEditingData!.maxStaffingPercentage} onChange={handleInlineFormChange} className="w-20 text-sm form-input p-1" /></td>
                    <td className="px-6 py-4 text-right"><div className="flex items-center justify-end space-x-2">
                        <button onClick={handleSaveInlineEdit} disabled={isSaving} className="p-1 text-green-600 hover:text-green-500 disabled:opacity-50">
                           {isSaving ? <SpinnerIcon className="w-5 h-5"/> : <CheckIcon className="w-5 h-5"/>}
                        </button>
                        <button onClick={handleCancelInlineEdit} className="p-1 text-gray-500 hover:text-gray-400"><XMarkIcon className="w-5 h-5"/></button>
                    </div></td>
                </tr>
            );
        }
        return (
            <tr key={resource.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap">{col.cell(resource)}</td>)}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-3">
                        <button onClick={() => openModalForEdit(resource)} className="text-gray-500 hover:text-blue-600" title="Modifica Dettagli"><PencilIcon className="w-5 h-5"/></button>
                        <button onClick={() => handleStartInlineEdit(resource)} className="text-gray-500 hover:text-green-600" title="Modifica Rapida"><PencilIcon className="w-5 h-5"/></button>
                        <button onClick={() => deleteResource(resource.id!)} className="text-gray-500 hover:text-red-600" title="Elimina">
                             {isActionLoading(`deleteResource-${resource.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <TrashIcon className="w-5 h-5"/>}
                        </button>
                    </div>
                </td>
            </tr>
        );
    };

    const renderMobileCard = (resource: EnrichedResource) => {
        const isEditing = inlineEditingId === resource.id;
        const isSaving = isActionLoading(`updateResource-${resource.id}`);
        if (isEditing) {
            return (
                <div key={resource.id} className="p-4 rounded-lg shadow-md bg-white dark:bg-gray-800 border border-blue-500">
                    <div className="space-y-3">
                        <div><label className="text-xs font-medium text-gray-500">Nome</label><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full text-sm form-input p-1" /></div>
                        <div><label className="text-xs font-medium text-gray-500">Email</label><input type="email" name="email" value={inlineEditingData!.email} onChange={handleInlineFormChange} className="w-full text-xs form-input p-1" /></div>
                        <div><label className="text-xs font-medium text-gray-500">Ruolo</label><SearchableSelect name="roleId" value={inlineEditingData!.roleId} onChange={handleInlineSelectChange} options={roleOptions} placeholder="Seleziona ruolo"/></div>
                        <div><label className="text-xs font-medium text-gray-500">Max Staffing %</label><input type="number" name="maxStaffingPercentage" value={inlineEditingData!.maxStaffingPercentage} onChange={handleInlineFormChange} className="w-full text-sm form-input p-1" /></div>
                        <div className="flex justify-end space-x-2 pt-2">
                            <button onClick={handleSaveInlineEdit} disabled={isSaving} className="p-2 bg-green-100 text-green-700 rounded-full disabled:opacity-50">
                                {isSaving ? <SpinnerIcon className="w-5 h-5"/> : <CheckIcon className="w-5 h-5"/>}
                            </button>
                            <button onClick={handleCancelInlineEdit} className="p-2 bg-gray-100 text-gray-700 rounded-full"><XMarkIcon className="w-5 h-5"/></button>
                        </div>
                    </div>
                </div>
            );
        }
        return (
            <div key={resource.id} className="p-4 rounded-lg shadow-md bg-gray-50 dark:bg-gray-900/50">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-bold text-lg text-gray-900 dark:text-white">{resource.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{resource.email}</p>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0 ml-4">
                        <button onClick={() => openModalForEdit(resource)} className="p-1 text-gray-500 hover:text-blue-600"><PencilIcon className="w-5 h-5"/></button>
                        <button onClick={() => handleStartInlineEdit(resource)} className="p-1 text-gray-500 hover:text-green-600"><PencilIcon className="w-5 h-5"/></button>
                        <button onClick={() => deleteResource(resource.id!)} className="p-1 text-gray-500 hover:text-red-600">
                             {isActionLoading(`deleteResource-${resource.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <TrashIcon className="w-5 h-5"/>}
                        </button>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-gray-500 dark:text-gray-400">Ruolo</p><p className="text-gray-900 dark:text-white font-medium">{resource.roleName}</p></div>
                    <div><p className="text-gray-500 dark:text-gray-400">Alloc. Media</p><p className={`font-semibold ${getAllocationColor(resource.allocation)}`}>{resource.allocation}%</p></div>
                    <div><p className="text-gray-500 dark:text-gray-400">Costo G.</p><p className="text-gray-900 dark:text-white font-medium">{formatCurrency(resource.dailyCost)}</p></div>
                    <div><p className="text-gray-500 dark:text-gray-400">Max Staffing</p><p className="text-gray-900 dark:text-white font-medium">{resource.maxStaffingPercentage}%</p></div>
                </div>
            </div>
        );
    };

    const filtersNode = (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per nome..." />
            <SearchableSelect name="roleId" value={filters.roleId} onChange={handleFilterSelectChange} options={roleOptions} placeholder="Tutti i ruoli" />
            <SearchableSelect name="horizontal" value={filters.horizontal} onChange={handleFilterSelectChange} options={horizontalOptions} placeholder="Tutti gli horizontal" />
            <SearchableSelect name="location" value={filters.location} onChange={handleFilterSelectChange} options={locationOptions} placeholder="Tutte le sedi" />
            <button onClick={resetFilters} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full md:w-auto">Reset</button>
        </div>
    );

    return (
        <div>
            <DataTable<EnrichedResource>
                title="Gestione Risorse"
                addNewButtonLabel="Aggiungi Risorsa"
                data={dataForTable}
                columns={columns}
                filtersNode={filtersNode}
                onAddNew={openModalForNew}
                renderRow={renderRow}
                renderMobileCard={renderMobileCard}
                initialSortKey="name"
            />
            
            {editingResource && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingResource ? 'Modifica Risorsa' : 'Aggiungi Risorsa'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome e Cognome *</label>
                                <input type="text" name="name" value={editingResource.name} onChange={handleChange} required className="form-input"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                                <input type="email" name="email" value={editingResource.email} onChange={handleChange} required className="form-input"/>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ruolo *</label>
                                <SearchableSelect name="roleId" value={editingResource.roleId} onChange={handleSelectChange} options={roleOptions} placeholder="Seleziona un ruolo" required />
                           </div>
                           <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Horizontal *</label>
                                <SearchableSelect name="horizontal" value={editingResource.horizontal} onChange={handleSelectChange} options={horizontalOptions} placeholder="Seleziona un horizontal" required />
                           </div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sede *</label>
                                <SearchableSelect name="location" value={editingResource.location} onChange={handleSelectChange} options={locationOptions} placeholder="Seleziona una sede" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Assunzione</label>
                                <input type="date" name="hireDate" value={editingResource.hireDate} onChange={handleChange} className="form-input"/>
                            </div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Anzianità (anni)</label>
                                <input type="number" name="workSeniority" value={editingResource.workSeniority} onChange={handleChange} className="form-input"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Staffing ({editingResource.maxStaffingPercentage}%)</label>
                                <input type="range" min="0" max="100" step="5" name="maxStaffingPercentage" value={editingResource.maxStaffingPercentage} onChange={handleChange} className="w-full"/>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Note</label>
                            <textarea name="notes" value={editingResource.notes || ''} onChange={handleChange} rows={3} className="form-textarea"></textarea>
                        </div>
                        <div className="flex justify-end space-x-3 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 rounded-md">Annulla</button>
                             <button type="submit" disabled={isActionLoading('addResource') || isActionLoading(`updateResource-${'id' in editingResource ? editingResource.id : ''}`)} className="flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400">
                               {(isActionLoading('addResource') || isActionLoading(`updateResource-${'id' in editingResource ? editingResource.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
            <style>{`.form-input, .form-select, .form-textarea { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-input, .dark .form-select, .dark .form-textarea { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }`}</style>
        </div>
    );
};

export default ResourcesPage;