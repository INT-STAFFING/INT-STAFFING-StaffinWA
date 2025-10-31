/**
 * @file ResourcesPage.tsx
 * @description Pagina per la gestione delle risorse umane (CRUD e visualizzazione).
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { Resource } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { SpinnerIcon } from '../components/icons';
import { getWorkingDaysBetween, isHoliday } from '../utils/dateUtils';
import { DataTable, ColumnDef } from '../components/DataTable';
import { useSearchParams } from 'react-router-dom';

// --- Types ---
type EnrichedResource = Resource & {
    roleName: string;
    dailyCost: number;
    allocation: number;
    isAssigned: boolean;
    activeProjects: number;
    seniority: number;
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
    const [filters, setFilters] = useState({ name: '', roleId: '', horizontal: '', location: '', status: 'active' });
    const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(false);
    
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        if (searchParams.get('filter') === 'unassigned') {
            setShowOnlyUnassigned(true);
            // Optional: remove the query param after applying the filter
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    
    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
    const [inlineEditingData, setInlineEditingData] = useState<Resource | null>(null);

    const emptyResource: Omit<Resource, 'id'> = {
        name: '', email: '', roleId: '', horizontal: horizontals[0]?.value || '',
        location: locations[0]?.value || '',
        hireDate: '', workSeniority: 0, notes: '', maxStaffingPercentage: 100,
        resigned: false,
        lastDayOfWork: null,
    };
    
    const calculateResourceAllocation = useCallback((resource: Resource): number => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const effectiveLastDay = resource.lastDayOfWork && new Date(resource.lastDayOfWork) < lastDay ? new Date(resource.lastDayOfWork) : lastDay;
        if(firstDay > effectiveLastDay) return 0;
        
        const workingDaysInMonth = getWorkingDaysBetween(firstDay, effectiveLastDay, companyCalendar, resource.location);

        if (workingDaysInMonth === 0) return 0;
        const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
        if (resourceAssignments.length === 0) return 0;

        let totalPersonDays = 0;
        resourceAssignments.forEach(assignment => {
            const assignmentAllocations = allocations[assignment.id];
            if (assignmentAllocations) {
                for (const dateStr in assignmentAllocations) {
                    const allocDate = new Date(dateStr);
                    if (allocDate >= firstDay && allocDate <= effectiveLastDay) {
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
        const assignedResourceIds = new Set(assignments.map(a => a.resourceId));

        const filtered = resources.filter(resource => {
            if (showOnlyUnassigned && assignedResourceIds.has(resource.id!)) {
                return false;
            }
            const nameMatch = resource.name.toLowerCase().includes(filters.name.toLowerCase());
            const roleMatch = filters.roleId ? resource.roleId === filters.roleId : true;
            const horizontalMatch = filters.horizontal ? resource.horizontal === filters.horizontal : true;
            const locationMatch = filters.location ? resource.location === filters.location : true;
            const statusMatch = filters.status === 'all' ? true : filters.status === 'active' ? !resource.resigned : resource.resigned;
            return nameMatch && roleMatch && horizontalMatch && locationMatch && statusMatch;
        });

        return filtered.map(resource => {
            const role = roles.find(r => r.id === resource.roleId);
            const activeProjects = assignments.filter(a => a.resourceId === resource.id).length;
            const hireDate = new Date(resource.hireDate);
            const seniority = !isNaN(hireDate.getTime()) ? (new Date().getTime() - hireDate.getTime()) / (1000 * 3600 * 24 * 365.25) : 0;

            return {
                ...resource,
                roleName: role?.name || 'N/A',
                dailyCost: role?.dailyCost || 0,
                allocation: resource.resigned ? 0 : calculateResourceAllocation(resource),
                isAssigned: assignedResourceIds.has(resource.id!),
                activeProjects,
                seniority,
            };
        });
    }, [resources, filters, roles, calculateResourceAllocation, assignments, showOnlyUnassigned]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleFilterSelectChange = (name: string, value: string) => setFilters(prev => ({ ...prev, [name]: value }));
    const resetFilters = () => {
        setFilters({ name: '', roleId: '', horizontal: '', location: '', status: 'active' });
        setShowOnlyUnassigned(false);
    };
    
    const getAllocationColor = (avg: number): string => {
        if (avg > 100) return 'text-red-600 dark:text-red-400 font-bold';
        if (avg >= 90) return 'text-yellow-600 dark:text-yellow-400 font-semibold';
        if (avg > 0) return 'text-green-600 dark:text-green-400';
        return 'text-gray-500';
    };

    const openModalForNew = () => { setEditingResource(emptyResource); setIsModalOpen(true); };
    const openModalForEdit = (resource: Resource) => { 
        const formattedResource = {
            ...resource,
            hireDate: resource.hireDate ? resource.hireDate.split('T')[0] : '',
            lastDayOfWork: resource.lastDayOfWork ? resource.lastDayOfWork.split('T')[0] : null,
        };
        setEditingResource(formattedResource); 
        setIsModalOpen(true); 
        handleCancelInlineEdit(); 
    };
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
            const target = e.target as HTMLInputElement;
            const { name, value, type } = target;
            const checked = target.checked;
    
            const numericFields = ['workSeniority', 'maxStaffingPercentage'];
            
            let newResourceState = { ...editingResource };
    
            if (type === 'checkbox') {
                newResourceState = {
                    ...newResourceState,
                    [name]: checked,
                };
                if (name === 'resigned' && !checked) {
                    newResourceState.lastDayOfWork = null;
                }
            } else {
                newResourceState = {
                    ...newResourceState,
                    [name]: numericFields.includes(name) ? (value === '' ? undefined : parseFloat(value)) : value,
                };
            }
            setEditingResource(newResourceState);
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
    const statusOptions = useMemo(() => [{value: 'all', label: 'Tutti'}, {value: 'active', label: 'Attivi'}, {value: 'resigned', label: 'Dimessi'}], []);

    const columns: ColumnDef<EnrichedResource>[] = [
        { header: 'Nome', sortKey: 'name', cell: r => <div className="font-medium text-gray-900 dark:text-white">{r.name}</div> },
        { header: 'Ruolo', sortKey: 'roleName', cell: r => <span className="text-sm text-gray-600 dark:text-gray-300">{r.roleName}</span> },
        { header: 'Sede', sortKey: 'location', cell: r => <span className="text-sm text-gray-600 dark:text-gray-300">{r.location}</span> },
        { header: 'Stato', sortKey: 'resigned', cell: r => <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${r.resigned ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>{r.resigned ? 'Dimesso' : 'Attivo'}</span> },
        { header: 'Ultimo Giorno', sortKey: 'lastDayOfWork', cell: r => <span className="text-sm text-gray-600 dark:text-gray-300">{r.lastDayOfWork ? new Date(r.lastDayOfWork).toLocaleDateString('it-IT', { timeZone: 'UTC'}) : 'N/A'}</span> },
        { header: 'Alloc. Media', sortKey: 'allocation', cell: r => (
            r.isAssigned && !r.resigned
                ? <span className={`text-sm font-semibold ${getAllocationColor(r.allocation)}`}>{r.allocation}%</span>
                : <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">Non Assegnata</span>
        )},
        { header: 'Progetti Attivi', sortKey: 'activeProjects', cell: r => <span className="text-sm text-center font-semibold text-gray-600 dark:text-gray-300">{r.activeProjects}</span> },
        { header: 'Anzianità (anni)', sortKey: 'seniority', cell: r => <span className="text-sm text-center font-semibold text-gray-600 dark:text-gray-300">{r.seniority.toFixed(1)}</span> },
    ];
    
    const renderRow = (resource: EnrichedResource) => {
        const isEditing = inlineEditingId === resource.id;
        const isSaving = isActionLoading(`updateResource-${resource.id}`);
        if (isEditing) {
            return (
                <tr key={resource.id}>
                    <td className="px-6 py-4"><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                    <td className="px-6 py-4"><SearchableSelect name="roleId" value={inlineEditingData!.roleId} onChange={handleInlineSelectChange} options={roleOptions} placeholder="Seleziona ruolo" /></td>
                    <td className="px-6 py-4"><SearchableSelect name="location" value={inlineEditingData!.location} onChange={handleInlineSelectChange} options={locationOptions} placeholder="Seleziona sede" /></td>
                    <td className="px-6 py-4">{columns.find(c => c.header === 'Stato')?.cell(resource)}</td>
                    <td className="px-6 py-4">{columns.find(c => c.header === 'Ultimo Giorno')?.cell(resource)}</td>
                    <td className={`px-6 py-4 text-sm ${getAllocationColor(resource.allocation)}`}>{resource.allocation}%</td>
                    <td className="px-6 py-4 text-sm text-center">{resource.activeProjects}</td>
                    <td className="px-6 py-4 text-sm text-center">{resource.seniority.toFixed(1)}</td>
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
            <tr key={resource.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap overflow-hidden text-ellipsis" title={col.sortKey ? String((resource as any)[col.sortKey]) : undefined}>{col.cell(resource)}</td>)}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-3">
                        <button onClick={() => openModalForEdit(resource)} className="text-gray-500 hover:text-blue-600" title="Modifica Dettagli"><span className="text-xl">✏️</span></button>
                        <button onClick={() => handleStartInlineEdit(resource)} className="text-gray-500 hover:text-green-600" title="Modifica Rapida"><span className="text-xl">✏️</span></button>
                        <button onClick={() => deleteResource(resource.id!)} className="text-gray-500 hover:text-red-600" title="Elimina">
                             {isActionLoading(`deleteResource-${resource.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="text-xl">🗑️</span>}
                        </button>
                    </div>
                </td>
            </tr>
        );
    };

    const renderMobileCard = (resource: EnrichedResource) => {
        return (
            <div key={resource.id} className="p-4 rounded-lg shadow-md bg-card dark:bg-dark-card">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-bold text-lg text-gray-900 dark:text-white">{resource.name}</p>
                         <span className={`mt-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${resource.resigned ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                            {resource.resigned ? 'Dimesso' : 'Attivo'}
                        </span>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0 ml-4">
                        <button onClick={() => openModalForEdit(resource)} className="p-1 text-gray-500 hover:text-blue-600"><span className="text-xl">✏️</span></button>
                        <button onClick={() => deleteResource(resource.id!)} className="p-1 text-gray-500 hover:text-red-600">
                             {isActionLoading(`deleteResource-${resource.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="text-xl">🗑️</span>}
                        </button>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-gray-500 dark:text-gray-400">Ruolo</p><p className="text-gray-900 dark:text-white font-medium">{resource.roleName}</p></div>
                    <div><p className="text-gray-500 dark:text-gray-400">Sede</p><p className="text-gray-900 dark:text-white font-medium">{resource.location}</p></div>
                    <div>
                        <p className="text-gray-500 dark:text-gray-400">Alloc. Media</p>
                        {resource.isAssigned && !resource.resigned
                            ? <p className={`font-semibold ${getAllocationColor(resource.allocation)}`}>{resource.allocation}%</p>
                            : <p className="font-semibold text-amber-600 dark:text-amber-400">Non Assegnata</p>
                        }
                    </div>
                    {resource.resigned && (
                         <div><p className="text-gray-500 dark:text-gray-400">Ultimo Giorno</p><p className="text-gray-900 dark:text-white font-medium">{resource.lastDayOfWork ? new Date(resource.lastDayOfWork).toLocaleDateString('it-IT', { timeZone: 'UTC'}) : 'N/A'}</p></div>
                    )}
                    <div><p className="text-gray-500 dark:text-gray-400">Progetti</p><p className="font-medium text-gray-900 dark:text-white">{resource.activeProjects}</p></div>
                    <div><p className="text-gray-500 dark:text-gray-400">Anzianità</p><p className="font-medium text-gray-900 dark:text-white">{resource.seniority.toFixed(1)} anni</p></div>
                </div>
            </div>
        );
    };

    const filtersNode = (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
            <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per nome..." />
            <SearchableSelect name="roleId" value={filters.roleId} onChange={handleFilterSelectChange} options={roleOptions} placeholder="Tutti i ruoli" />
            <SearchableSelect name="location" value={filters.location} onChange={handleFilterSelectChange} options={locationOptions} placeholder="Tutte le sedi" />
            <SearchableSelect name="status" value={filters.status} onChange={handleFilterSelectChange} options={statusOptions} placeholder="Stato" />
            <div className="flex items-center">
                <input id="unassigned-filter" type="checkbox" checked={showOnlyUnassigned} onChange={(e) => setShowOnlyUnassigned(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <label htmlFor="unassigned-filter" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">Solo non allocate</label>
            </div>
            <button onClick={resetFilters} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full">Reset</button>
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
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Staffing ({editingResource.maxStaffingPercentage}%)</label>
                                <input type="range" min="0" max="100" step="5" name="maxStaffingPercentage" value={editingResource.maxStaffingPercentage} onChange={handleChange} className="w-full" disabled={editingResource.resigned}/>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                             <label className="flex items-center space-x-3 mt-4">
                                <input type="checkbox" name="resigned" checked={editingResource.resigned} onChange={handleChange} className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Risorsa Dimessa</span>
                            </label>

                            {editingResource.resigned && (
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ultimo Giorno di Lavoro *</label>
                                    <input type="date" name="lastDayOfWork" value={editingResource.lastDayOfWork || ''} onChange={handleChange} required className="form-input"/>
                                </div>
                            )}
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