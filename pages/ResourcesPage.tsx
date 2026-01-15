
/**
 * @file ResourcesPage.tsx
 * @description Pagina per la gestione delle risorse umane (CRUD e visualizzazione).
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { Resource, SKILL_LEVELS, SkillLevelValue } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { SpinnerIcon } from '../components/icons';
import { getWorkingDaysBetween, isHoliday, formatDateFull } from '../utils/dateUtils';
import { DataTable, ColumnDef } from '../components/DataTable';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { formatCurrency } from '../utils/formatters';
import { useToast } from '../context/ToastContext';
import { ExportButton } from '@/components/shared/ExportButton';

// --- Types ---
type EnrichedResource = Resource & {
    roleName: string;
    dailyCost: number;
    allocation: number;
    isAssigned: boolean;
    activeProjects: number;
    seniority: number;
    tutorName: string;
};

// --- Component ---
const ResourcesPage: React.FC = () => {
    const { resources, roles, addResource, updateResource, deleteResource, horizontals, assignments, locations, companyCalendar, isActionLoading, loading, skills, resourceSkills, addResourceSkill, deleteResourceSkill } = useEntitiesContext();
    const { allocations } = useAllocationsContext();
    const { addToast } = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingResource, setEditingResource] = useState<Resource | Omit<Resource, 'id'> | null>(null);
    
    // Filters and Debounced Filters
    const [filters, setFilters] = useState({ name: '', roleId: '', horizontal: '', location: '', status: 'active', tutorId: '' });
    const [debouncedFilters, setDebouncedFilters] = useState(filters);

    // Debounce Effect
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedFilters(filters);
        }, 400);
        return () => clearTimeout(handler);
    }, [filters]);

    const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(false);
    
    // State for skills management in modal
    const [selectedSkillDetails, setSelectedSkillDetails] = useState<{ skillId: string, acquisitionDate: string, expirationDate: string, level: number }[]>([]);
    const [tempSelectedSkillId, setTempSelectedSkillId] = useState<string>('');

    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        if (searchParams.get('filter') === 'unassigned') {
            setShowOnlyUnassigned(true);
            // Remove the query param after applying the filter
            setSearchParams({});
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
        tutorId: null
    };

    // KPI Calculations
    const kpis = useMemo(() => {
        const activeResources = resources.filter(r => !r.resigned);
        const totalActive = activeResources.length;
        
        const assignedResourceIds = new Set(assignments.map(a => a.resourceId));
        const benchCount = activeResources.filter(r => !assignedResourceIds.has(r.id!)).length;
        
        const totalCost = activeResources.reduce((sum, r) => {
            const role = roles.find(role => role.id === r.roleId);
            return sum + (role?.dailyCost || 0);
        }, 0);
        const avgCost = totalActive > 0 ? totalCost / totalActive : 0;

        return { totalActive, benchCount, avgCost };
    }, [resources, assignments, roles]);
    
    const calculateResourceAllocation = useCallback((resource: Resource): number => {
        const now = new Date();
        const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
        
        const effectiveLastDay = resource.lastDayOfWork && new Date(resource.lastDayOfWork) < lastDay ? new Date(resource.lastDayOfWork) : lastDay;
        
        // Use getTime for numeric comparison of Dates
        if(firstDay.getTime() > effectiveLastDay.getTime()) return 0;
        
        const workingDaysInMonth = getWorkingDaysBetween(firstDay, effectiveLastDay, companyCalendar, resource.location);

        if (workingDaysInMonth === 0) return 0;
        const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
        if (resourceAssignments.length === 0) return 0;

        let totalPersonDays = 0;
        resourceAssignments.forEach(assignment => {
            const assignmentAllocations = allocations[assignment.id!];
            if (assignmentAllocations) {
                for (const dateStr in assignmentAllocations) {
                    const allocDate = new Date(dateStr);
                    // Use UTC comparison
                    if (allocDate.getTime() >= firstDay.getTime() && allocDate.getTime() <= effectiveLastDay.getTime()) {
                         // Check holiday and weekends using UTC methods
                         if (!isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getUTCDay() !== 0 && allocDate.getUTCDay() !== 6) {
                            totalPersonDays += (assignmentAllocations[dateStr] / 100);
                        }
                    }
                }
            }
        });
        return Math.round((totalPersonDays / workingDaysInMonth) * 100);
    }, [assignments, allocations, companyCalendar]);
    
    // Uses debouncedFilters for expensive filtering
    const dataForTable = useMemo<EnrichedResource[]>(() => {
        const assignedResourceIds = new Set(assignments.map(a => a.resourceId));

        const filtered = resources.filter(resource => {
            if (showOnlyUnassigned && assignedResourceIds.has(resource.id!)) {
                return false;
            }
            // Use debouncedFilters instead of filters
            const nameMatch = resource.name.toLowerCase().includes(debouncedFilters.name.toLowerCase());
            const roleMatch = debouncedFilters.roleId ? resource.roleId === debouncedFilters.roleId : true;
            const horizontalMatch = debouncedFilters.horizontal ? resource.horizontal === debouncedFilters.horizontal : true;
            const locationMatch = debouncedFilters.location ? resource.location === debouncedFilters.location : true;
            const statusMatch = debouncedFilters.status === 'all' ? true : debouncedFilters.status === 'active' ? !resource.resigned : resource.resigned;
            const tutorMatch = debouncedFilters.tutorId ? resource.tutorId === debouncedFilters.tutorId : true;
            
            return nameMatch && roleMatch && horizontalMatch && locationMatch && statusMatch && tutorMatch;
        });

        return filtered.map(resource => {
            const role = roles.find(r => r.id === resource.roleId);
            const activeProjects = assignments.filter(a => a.resourceId === resource.id).length;
            const hireDate = new Date(resource.hireDate);
            const seniority = !isNaN(hireDate.getTime()) ? (new Date().getTime() - hireDate.getTime()) / (1000 * 3600 * 24 * 365.25) : 0;
            const tutor = resources.find(r => r.id === resource.tutorId);

            return {
                ...resource,
                roleName: role?.name || 'N/A',
                dailyCost: role?.dailyCost || 0,
                allocation: resource.resigned ? 0 : calculateResourceAllocation(resource),
                isAssigned: assignedResourceIds.has(resource.id!),
                activeProjects,
                seniority,
                tutorName: tutor?.name || '-'
            };
        });
    }, [resources, debouncedFilters, roles, calculateResourceAllocation, assignments, showOnlyUnassigned]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleFilterSelectChange = (name: string, value: string) => setFilters(prev => ({ ...prev, [name]: value }));
    const resetFilters = () => {
        setFilters({ name: '', roleId: '', horizontal: '', location: '', status: 'active', tutorId: '' });
        setShowOnlyUnassigned(false);
    };
    
    const getAllocationColor = (avg: number): string => {
        if (avg > 100) return 'text-red-600 dark:text-red-400 font-bold';
        if (avg >= 95) return 'text-green-600 dark:text-green-400';
        if (avg > 0) return 'text-yellow-600 dark:text-yellow-400 font-semibold';
        return 'text-gray-500';
    };

    const openModalForNew = () => { 
        setEditingResource(emptyResource); 
        setSelectedSkillDetails([]);
        setTempSelectedSkillId('');
        setIsModalOpen(true); 
    };
    const openModalForEdit = (resource: Resource) => { 
        const formattedResource = {
            ...resource,
            hireDate: resource.hireDate ? resource.hireDate.split('T')[0] : '',
            lastDayOfWork: resource.lastDayOfWork ? resource.lastDayOfWork.split('T')[0] : null,
        };
        setEditingResource(formattedResource); 
        
        // Pre-load existing skills with dates
        const currentSkills = resourceSkills
            .filter(rs => rs.resourceId === resource.id)
            .map(rs => ({
                skillId: rs.skillId,
                acquisitionDate: rs.acquisitionDate ? rs.acquisitionDate.split('T')[0] : '',
                expirationDate: rs.expirationDate ? rs.expirationDate.split('T')[0] : '',
                level: rs.level || 1
            }));
        setSelectedSkillDetails(currentSkills);
        setTempSelectedSkillId('');
        
        setIsModalOpen(true); 
        handleCancelInlineEdit(); 
    };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingResource(null); setSelectedSkillDetails([]); setTempSelectedSkillId(''); };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingResource) return;

        // Validazione Manuale
        if (!editingResource.name || !editingResource.email || !editingResource.roleId || !editingResource.horizontal || !editingResource.location) {
            addToast('Compila tutti i campi obbligatori (Nome, Email, Ruolo, Horizontal, Sede).', 'error');
            return;
        }

        // Sanitizzazione Payload: rimuove campi extra derivanti da EnrichedResource (es. roleName)
        const resourcePayload: any = {
            name: editingResource.name,
            email: editingResource.email,
            roleId: editingResource.roleId,
            horizontal: editingResource.horizontal,
            location: editingResource.location,
            hireDate: editingResource.hireDate || null, // Converti stringa vuota in null
            workSeniority: editingResource.workSeniority || 0,
            maxStaffingPercentage: editingResource.maxStaffingPercentage,
            resigned: editingResource.resigned,
            lastDayOfWork: editingResource.lastDayOfWork || null, // Converti stringa vuota in null
            notes: editingResource.notes,
            tutorId: editingResource.tutorId || null
        };

        // Se stiamo modificando, aggiungiamo l'ID
        if ('id' in editingResource && editingResource.id) {
            resourcePayload.id = editingResource.id;
        }

        try {
            let resourceId: string;
            if ('id' in editingResource) {
                await updateResource(resourcePayload as Resource);
                resourceId = editingResource.id!;
            } else {
                const newResource = await addResource(resourcePayload as Omit<Resource, 'id'>);
                resourceId = newResource.id!;
            }

            // Update Skills
            const oldSkills = resourceSkills.filter(rs => rs.resourceId === resourceId).map(rs => rs.skillId);
            const currentSkillIds = selectedSkillDetails.map(s => s.skillId);
            
            const toAddOrUpdate = selectedSkillDetails;
            const toRemove = oldSkills.filter(id => !currentSkillIds.includes(id));
            
            await Promise.all([
                ...toAddOrUpdate.map(detail => addResourceSkill({ 
                    resourceId, 
                    skillId: detail.skillId, 
                    acquisitionDate: detail.acquisitionDate || null, 
                    expirationDate: detail.expirationDate || null,
                    level: detail.level
                })),
                ...toRemove.map(skillId => deleteResourceSkill(resourceId, skillId))
            ]);

            addToast('Risorsa salvata con successo!', 'success');
            handleCloseModal();
        } catch (e) {
            console.error(e);
            addToast('Errore durante il salvataggio della risorsa.', 'error');
        }
    };

    const handleAddSkill = () => {
        if (tempSelectedSkillId && !selectedSkillDetails.some(s => s.skillId === tempSelectedSkillId)) {
            setSelectedSkillDetails([...selectedSkillDetails, { skillId: tempSelectedSkillId, acquisitionDate: '', expirationDate: '', level: 1 }]);
            setTempSelectedSkillId('');
        }
    };

    const handleRemoveSkill = (skillId: string) => {
        setSelectedSkillDetails(selectedSkillDetails.filter(s => s.skillId !== skillId));
    };

    const handleSkillDateChange = (skillId: string, field: 'acquisitionDate' | 'expirationDate', value: string) => {
        setSelectedSkillDetails(prev => prev.map(s => s.skillId === skillId ? { ...s, [field]: value } : s));
    };

    const handleSkillLevelChange = (skillId: string, value: string) => {
        setSelectedSkillDetails(prev => prev.map(s => s.skillId === skillId ? { ...s, level: parseInt(value, 10) } : s));
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
    
    const handleSaveInlineEdit = async () => { 
        if (inlineEditingData) { 
            try {
                await updateResource(inlineEditingData); 
                addToast('Risorsa aggiornata.', 'success');
                handleCancelInlineEdit(); 
            } catch (e) {
                addToast('Errore aggiornamento rapido.', 'error');
            }
        } 
    };
    
    const roleOptions = useMemo(() => roles.sort((a, b) => a.name.localeCompare(b.name)).map(r => ({ value: r.id!, label: r.name })), [roles]);
    const horizontalOptions = useMemo(() => horizontals.sort((a,b)=> a.value.localeCompare(b.value)).map(h => ({ value: h.value, label: h.value })), [horizontals]);
    const locationOptions = useMemo(() => locations.sort((a,b)=> a.value.localeCompare(b.value)).map(l => ({ value: l.value, label: l.value })), [locations]);
    const statusOptions = useMemo(() => [{value: 'all', label: 'Tutti'}, {value: 'active', label: 'Attivi'}, {value: 'resigned', label: 'Dimessi'}], []);
    const skillOptions = useMemo(() => skills.sort((a,b) => a.name.localeCompare(b.name)).map(s => ({ value: s.id!, label: s.name })), [skills]);
    const resourceOptions = useMemo(() => resources.filter(r => !r.resigned).sort((a, b) => a.name.localeCompare(b.name)).map(r => ({ value: r.id!, label: r.name })), [resources]);


    const columns: ColumnDef<EnrichedResource>[] = [
        { header: 'Nome', sortKey: 'name', cell: r => <div className="font-medium text-on-surface sticky left-0 bg-inherit pl-6">{r.name}</div> },
        { header: 'Ruolo', sortKey: 'roleName', cell: r => <span className="text-sm text-on-surface-variant">{r.roleName}</span> },
        { header: 'Sede', sortKey: 'location', cell: r => <span className="text-sm text-on-surface-variant">{r.location}</span> },
        { header: 'Tutor', sortKey: 'tutorName', cell: r => <span className="text-sm text-on-surface-variant">{r.tutorName}</span> },
        { header: 'Stato', sortKey: 'resigned', cell: r => <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${r.resigned ? 'bg-error-container text-on-error-container' : 'bg-tertiary-container text-on-tertiary-container'}`}>{r.resigned ? 'Dimesso' : 'Attivo'}</span> },
        // Updated Date Format
        { header: 'Ultimo Giorno', sortKey: 'lastDayOfWork', cell: r => <span className="text-sm text-on-surface-variant">{formatDateFull(r.lastDayOfWork)}</span> },
        { header: 'Alloc. Media', sortKey: 'allocation', cell: r => (
            r.isAssigned && !r.resigned
                ? <span className={`text-sm font-semibold ${getAllocationColor(r.allocation)}`}>{r.allocation}%</span>
                : <span className="text-sm font-semibold text-on-yellow-container">Non Assegnata</span>
        )},
        { header: 'Progetti Attivi', sortKey: 'activeProjects', cell: r => <span className="text-sm text-center font-semibold text-on-surface-variant">{r.activeProjects}</span> },
        { header: 'Anzianità (anni)', sortKey: 'seniority', cell: r => <span className="text-sm text-center font-semibold text-on-surface-variant">{r.seniority.toFixed(1)}</span> },
    ];
    
    const renderRow = (resource: EnrichedResource) => {
        const isEditing = inlineEditingId === resource.id;
        const isSaving = isActionLoading(`updateResource-${resource.id}`);
        if (isEditing) {
            return (
                <tr key={resource.id} className="h-16">
                    <td className="px-6 py-4 sticky left-0 bg-inherit"><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                    <td className="px-6 py-4"><SearchableSelect name="roleId" value={inlineEditingData!.roleId} onChange={handleInlineSelectChange} options={roleOptions} placeholder="Seleziona ruolo" /></td>
                    <td className="px-6 py-4"><SearchableSelect name="location" value={inlineEditingData!.location} onChange={handleInlineSelectChange} options={locationOptions} placeholder="Seleziona sede" /></td>
                    <td className="px-6 py-4 bg-inherit"><SearchableSelect name="tutorId" value={inlineEditingData!.tutorId || ''} onChange={handleInlineSelectChange} options={resourceOptions.filter(o => o.value !== resource.id)} placeholder="Seleziona tutor" /></td>
                    <td className="px-6 py-4 bg-inherit">{columns.find(c => c.header === 'Stato')?.cell(resource)}</td>
                    <td className="px-6 py-4 bg-inherit">{columns.find(c => c.header === 'Ultimo Giorno')?.cell(resource)}</td>
                    <td className={`px-6 py-4 text-sm bg-inherit ${getAllocationColor(resource.allocation)}`}>{resource.allocation}%</td>
                    <td className="px-6 py-4 text-sm text-center bg-inherit">{resource.activeProjects}</td>
                    <td className="px-6 py-4 text-sm text-center bg-inherit">{resource.seniority.toFixed(1)}</td>
                    <td className="px-6 py-4 text-right sticky right-0 bg-inherit"><div className="flex items-center justify-end space-x-2">
                        <button onClick={handleSaveInlineEdit} disabled={isSaving} className="p-2 rounded-full hover:bg-surface-container text-primary disabled:opacity-50">
                           {isSaving ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">check</span>}
                        </button>
                        <button onClick={handleCancelInlineEdit} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant"><span className="material-symbols-outlined">close</span></button>
                    </div></td>
                </tr>
            );
        }
        return (
            <tr key={resource.id} className="group h-16 hover:bg-surface-container">
                {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap overflow-hidden text-ellipsis bg-inherit" title={col.sortKey ? String((resource as any)[col.sortKey]) : undefined}>{col.cell(resource)}</td>)}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 bg-inherit">
                    <div className="flex items-center justify-end space-x-2">
                        <button onClick={() => openModalForEdit(resource)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary" title="Modifica Dettagli"><span className="material-symbols-outlined">edit_note</span></button>
                        <button onClick={() => handleStartInlineEdit(resource)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary" title="Modifica Rapida"><span className="material-symbols-outlined">edit</span></button>
                        <button onClick={() => deleteResource(resource.id!)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-error" title="Elimina">
                             {isActionLoading(`deleteResource-${resource.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">delete</span>}
                        </button>
                    </div>
                </td>
            </tr>
        );
    };

    const renderMobileCard = (resource: EnrichedResource) => {
        return (
            <div key={resource.id} className={`p-4 rounded-lg shadow-md bg-surface-container border-l-4 ${resource.resigned ? 'border-error' : 'border-primary'}`}>
                 <div className="flex justify-between items-start">
                    <div>
                        <p className="font-bold text-lg text-on-surface">{resource.name}</p>
                         <span className={`mt-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${resource.resigned ? 'bg-error-container text-on-error-container' : 'bg-tertiary-container text-on-tertiary-container'}`}>
                            {resource.resigned ? 'Dimesso' : 'Attivo'}
                        </span>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0 ml-4">
                        <button onClick={() => openModalForEdit(resource)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high"><span className="material-symbols-outlined">edit_note</span></button>
                        <button onClick={() => deleteResource(resource.id!)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high">
                             {isActionLoading(`deleteResource-${resource.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">delete</span>}
                        </button>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-outline-variant grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-on-surface-variant">Ruolo</p><p className="text-on-surface font-medium">{resource.roleName}</p></div>
                    <div><p className="text-on-surface-variant">Sede</p><p className="text-on-surface font-medium">{resource.location}</p></div>
                    <div><p className="text-on-surface-variant">Tutor</p><p className="text-on-surface font-medium">{resource.tutorName}</p></div>
                    <div>
                        <p className="text-on-surface-variant">Alloc. Media</p>
                        {resource.isAssigned && !resource.resigned
                            ? <p className={`font-semibold ${getAllocationColor(resource.allocation)}`}>{resource.allocation}%</p>
                            : <p className="font-semibold text-on-yellow-container">Non Assegnata</p>
                        }
                    </div>
                    {resource.resigned && (
                         <div><p className="text-on-surface-variant">Ultimo Giorno</p><p className="text-on-surface font-medium">{formatDateFull(resource.lastDayOfWork)}</p></div>
                    )}
                    <div><p className="text-on-surface-variant">Progetti</p><p className="font-medium text-on-surface">{resource.activeProjects}</p></div>
                    <div><p className="text-on-surface-variant">Anzianità</p><p className="font-medium text-on-surface">{resource.seniority.toFixed(1)} anni</p></div>
                </div>
            </div>
        );
    };

    const filtersNode = (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
            <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per nome..." />
            <SearchableSelect name="roleId" value={filters.roleId} onChange={handleFilterSelectChange} options={roleOptions} placeholder="Tutti i ruoli" />
            <SearchableSelect name="location" value={filters.location} onChange={handleFilterSelectChange} options={locationOptions} placeholder="Tutte le sedi" />
            <SearchableSelect name="tutorId" value={filters.tutorId} onChange={handleFilterSelectChange} options={resourceOptions} placeholder="Filtra per Tutor" />
            <SearchableSelect name="status" value={filters.status} onChange={handleFilterSelectChange} options={statusOptions} placeholder="Stato" />
            <div className="flex items-center">
                <label htmlFor="unassigned-filter" className="flex items-center cursor-pointer">
                    <div className="relative">
                        <input
                            type="checkbox"
                            id="unassigned-filter"
                            className="sr-only"
                            checked={showOnlyUnassigned}
                            onChange={(e) => setShowOnlyUnassigned(e.target.checked)}
                        />
                        <div className="block bg-surface-variant w-14 h-8 rounded-full"></div>
                        <div className={`dot absolute left-1 top-1 bg-outline w-6 h-6 rounded-full transition-transform duration-300 ease-in-out ${showOnlyUnassigned ? 'transform translate-x-6 !bg-primary' : ''}`}></div>
                    </div>
                    <span className="ml-3 text-sm text-on-surface">Solo non allocate</span>
                </label>
            </div>
            <button onClick={resetFilters} className="px-6 py-2 bg-secondary-container text-on-secondary-container font-semibold rounded-full hover:opacity-90 w-full">Reset</button>
        </div>
    );

    return (
        <div>
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-primary">
                    <p className="text-sm text-on-surface-variant">Risorse Attive</p>
                    <p className="text-2xl font-bold text-on-surface">{kpis.totalActive}</p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-error">
                     <p className="text-sm text-on-surface-variant">Risorse in Bench</p>
                     <p className="text-2xl font-bold text-on-surface">{kpis.benchCount}</p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-tertiary">
                     <p className="text-sm text-on-surface-variant">Costo Medio Giornaliero</p>
                     <p className="text-2xl font-bold text-on-surface">{formatCurrency(kpis.avgCost)}</p>
                </div>
            </div>

            <DataTable<EnrichedResource>
                title="Gestione Risorse"
                addNewButtonLabel="Aggiungi Risorsa"
                data={dataForTable}
                columns={columns}
                filtersNode={filtersNode}
                onAddNew={openModalForNew}
                renderRow={renderRow}
                renderMobileCard={renderMobileCard}
                headerActions={<ExportButton data={dataForTable} title="Gestione Risorse" />}
                initialSortKey="name"
                isLoading={loading}
                tableLayout={{
                    dense: true,
                    striped: true,
                    headerSticky: true,
                    headerBackground: true,
                    headerBorder: true,
                }}
                tableClassNames={{
                    base: 'w-full text-sm',
                }}
                numActions={3} // MODIFICA, EDIT VELOCE, ELIMINA
            />
            
            {/* Modals are the same as previous version, just keeping them for completeness if needed */}
            {editingResource && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingResource ? 'Modifica Risorsa' : 'Aggiungi Risorsa'}>
                    <form onSubmit={handleSubmit} className="space-y-4 flex flex-col h-[80vh]">
                        <div className="flex-grow overflow-y-auto px-1 space-y-4">
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

                            {/* Tutor Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tutor</label>
                                <SearchableSelect 
                                    name="tutorId" 
                                    value={editingResource.tutorId || ''} 
                                    onChange={handleSelectChange} 
                                    options={resourceOptions.filter(o => o.value !== ('id' in editingResource ? editingResource.id : ''))} 
                                    placeholder="Seleziona un Tutor" 
                                />
                            </div>
                            
                            {/* Skills Section */}
                            <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Competenze</label>
                                <div className="flex gap-2 mb-3">
                                    <div className="flex-grow">
                                        <SearchableSelect
                                            name="tempSkillId"
                                            value={tempSelectedSkillId}
                                            onChange={(_, val) => setTempSelectedSkillId(val)}
                                            options={skillOptions.filter(s => !selectedSkillDetails.some(sd => sd.skillId === s.value))}
                                            placeholder="Aggiungi competenza..."
                                        />
                                    </div>
                                    <button type="button" onClick={handleAddSkill} disabled={!tempSelectedSkillId} className="px-3 py-1 bg-primary text-on-primary rounded-md disabled:opacity-50">
                                        <span className="material-symbols-outlined">add</span>
                                    </button>
                                </div>
                                
                                {selectedSkillDetails.length > 0 && (
                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                        {selectedSkillDetails.map(detail => {
                                            const skillName = skills.find(s => s.id === detail.skillId)?.name || 'Unknown';
                                            return (
                                                <div key={detail.skillId} className="p-2 bg-surface rounded border border-outline flex flex-col gap-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-medium text-sm text-on-surface">{skillName}</span>
                                                        <button type="button" onClick={() => handleRemoveSkill(detail.skillId)} className="text-error hover:text-error-container">
                                                            <span className="material-symbols-outlined text-sm">close</span>
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div className="col-span-3 md:col-span-1">
                                                            <label className="text-xs text-on-surface-variant block">Livello</label>
                                                            <select 
                                                                value={detail.level || 1} 
                                                                onChange={(e) => handleSkillLevelChange(detail.skillId, e.target.value)}
                                                                className="w-full text-xs p-1 border rounded bg-transparent"
                                                            >
                                                                {Object.entries(SKILL_LEVELS).map(([val, label]) => (
                                                                    <option key={val} value={val}>{label}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-xs text-on-surface-variant block">Data Conseguimento</label>
                                                            <input 
                                                                type="date" 
                                                                value={detail.acquisitionDate} 
                                                                onChange={(e) => handleSkillDateChange(detail.skillId, 'acquisitionDate', e.target.value)}
                                                                className="w-full text-xs p-1 border rounded bg-transparent"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs text-on-surface-variant block">Data Scadenza</label>
                                                            <input 
                                                                type="date" 
                                                                value={detail.expirationDate} 
                                                                onChange={(e) => handleSkillDateChange(detail.skillId, 'expirationDate', e.target.value)}
                                                                className="w-full text-xs p-1 border rounded bg-transparent"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
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
                        </div>
                        <div className="flex justify-end space-x-3 pt-4 border-t border-outline-variant">
                            <button type="button" onClick={handleCloseModal} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold">Annulla</button>
                             <button type="submit" disabled={isActionLoading('addResource') || isActionLoading(`updateResource-${'id' in editingResource ? editingResource.id : ''}`)} className="flex justify-center items-center px-6 py-2 bg-primary text-on-primary rounded-full disabled:opacity-50 font-semibold hover:opacity-90">
                               {(isActionLoading('addResource') || isActionLoading(`updateResource-${'id' in editingResource ? editingResource.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default ResourcesPage;