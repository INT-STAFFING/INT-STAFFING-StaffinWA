/**
 * @file ResourcesPage.tsx
 * @description Pagina per la gestione delle risorse umane (CRUD e visualizzazione).
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { Resource } from '../types';
import Modal from '../components/Modal';
import { PencilIcon, TrashIcon, PencilSquareIcon, CheckIcon, XMarkIcon } from '../components/icons';
import { getWorkingDaysBetween } from '../utils/dateUtils';

/**
 * Formatta un valore numerico come valuta EUR.
 * @param {number} value - Il valore numerico da formattare.
 * @returns {string} La stringa formattata (es. "€ 1.234,56").
 */
const formatCurrency = (value: number): string => {
    return (value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

/**
 * Componente per la pagina di gestione delle Risorse.
 * Permette di visualizzare, filtrare, aggiungere, modificare (in modale o inline) ed eliminare risorse.
 * @returns {React.ReactElement} La pagina di gestione delle risorse.
 */
const ResourcesPage: React.FC = () => {
    const { resources, roles, addResource, updateResource, deleteResource, horizontals, assignments, allocations } = useStaffingContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingResource, setEditingResource] = useState<Resource | Omit<Resource, 'id'> | null>(null);
    const [filters, setFilters] = useState({ name: '', roleId: '', horizontal: '' });
    
    // Stati per la gestione della modifica inline.
    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
    const [inlineEditingData, setInlineEditingData] = useState<Resource | null>(null);

    // Oggetto risorsa vuoto usato come stato iniziale per il form di creazione.
    const emptyResource: Omit<Resource, 'id'> = {
        name: '',
        email: '',
        roleId: '',
        horizontal: horizontals[0]?.value || '',
        hireDate: '',
        workSeniority: 0,
        notes: '',
    };
    
    // Memoizza le risorse filtrate per evitare ricalcoli a ogni render.
    const filteredResources = useMemo(() => {
        return resources.filter(resource => {
            const nameMatch = resource.name.toLowerCase().includes(filters.name.toLowerCase());
            const roleMatch = filters.roleId ? resource.roleId === filters.roleId : true;
            const horizontalMatch = filters.horizontal ? resource.horizontal === filters.horizontal : true;
            return nameMatch && roleMatch && horizontalMatch;
        });
    }, [resources, filters]);

    /**
     * Aggiorna lo stato dei filtri.
     * @param {React.ChangeEvent<HTMLInputElement | HTMLSelectElement>} e - L'evento di input.
     */
    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const resetFilters = () => {
        setFilters({ name: '', roleId: '', horizontal: '' });
    };

    /**
     * Calcola la percentuale di allocazione media di una risorsa nel mese corrente.
     * @param {string} resourceId - L'ID della risorsa.
     * @returns {number} La percentuale di allocazione media.
     */
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

    /**
     * Determina la classe CSS per il colore del testo dell'allocazione in base al suo valore.
     * @param {number} avg - La percentuale di allocazione media.
     * @returns {string} La classe CSS.
     */
    const getAllocationColor = (avg: number): string => {
        if (avg > 100) return 'text-red-600 dark:text-red-400 font-bold';
        if (avg >= 90) return 'text-yellow-600 dark:text-yellow-400 font-semibold';
        if (avg > 0) return 'text-green-600 dark:text-green-400';
        return 'text-gray-500';
    };

    /** Apre la modale per creare una nuova risorsa. */
    const openModalForNew = () => {
        setEditingResource(emptyResource);
        setIsModalOpen(true);
    };

    /**
     * Apre la modale per modificare una risorsa esistente.
     * @param {Resource} resource - La risorsa da modificare.
     */
    const openModalForEdit = (resource: Resource) => {
        setEditingResource(resource);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingResource(null);
    };

    /**
     * Gestisce l'invio del form della modale (sia per creazione che per modifica).
     * @param {React.FormEvent<HTMLFormElement>} e - L'evento di submit del form.
     */
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

    /**
     * Gestisce le modifiche ai campi del form nella modale.
     * @param {React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>} e - L'evento di input.
     */
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

    /**
     * Attiva la modalità di modifica inline per una riga specifica.
     * @param {Resource} resource - La risorsa da modificare.
     */
    const handleStartInlineEdit = (resource: Resource) => {
        setInlineEditingId(resource.id!);
        setInlineEditingData({ ...resource });
    };

    /** Annulla la modalità di modifica inline, resettando lo stato. */
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
            setInlineEditingData({ ...inlineEditingData, [e.target.name]: e.target.value });
        }
    };

    /** Salva le modifiche effettuate in modalità inline. */
    const handleSaveInlineEdit = () => {
        if (inlineEditingData) {
            updateResource(inlineEditingData);
            handleCancelInlineEdit();
        }
    };
    
    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white self-start">Gestione Risorse</h1>
                <button onClick={openModalForNew} className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700">Aggiungi Risorsa</button>
            </div>
            
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

            {/* La tabella ora utilizza classi responsive per trasformarsi in "card" su mobile. */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y md:divide-y-0 divide-gray-200 dark:divide-gray-700">
                    <thead className="hidden md:table-header-group bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nome</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Ruolo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Horizontal</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Costo Giornaliero</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Alloc. Media (Mese Corr.)</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="block md:table-row-group divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredResources.map(resource => {
                            const role = roles.find(r => r.id === resource.roleId);
                            const allocation = calculateResourceAllocation(resource.id);
                            const isEditing = inlineEditingId === resource.id;

                            if (isEditing) {
                                // Riga in modalità modifica inline
                                return (
                                <tr key={resource.id} className="block md:table-row p-4 md:p-0 border-b dark:border-gray-600">
                                    <td data-label="Nome" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none">
                                        <div className="space-y-1 inline-block w-auto">
                                            <input type="text" name="name" value={inlineEditingData.name} onChange={handleInlineFormChange} className="w-full text-sm form-input p-1" />
                                            <input type="email" name="email" value={inlineEditingData.email} onChange={handleInlineFormChange} className="w-full text-xs form-input p-1" />
                                        </div>
                                    </td>
                                    <td data-label="Ruolo" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none">
                                        <select name="roleId" value={inlineEditingData.roleId} onChange={handleInlineFormChange} className="w-full text-sm form-select p-1">
                                            {roles.sort((a, b) => a.name.localeCompare(b.name)).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                        </select>
                                    </td>
                                    <td data-label="Horizontal" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none">
                                        <select name="horizontal" value={inlineEditingData.horizontal} onChange={handleInlineFormChange} className="w-full text-sm form-select p-1">
                                            {horizontals.sort((a,b)=> a.value.localeCompare(b.value)).map(h => <option key={h.id} value={h.value}>{h.value}</option>)}
                                        </select>
                                    </td>
                                    <td data-label="Costo" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none">{formatCurrency(roles.find(r => r.id === inlineEditingData.roleId)?.dailyCost || 0)}</td>
                                    <td data-label="Allocazione" className={`block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap text-sm ${getAllocationColor(allocation)} before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none`}>{allocation}%</td>
                                    <td data-label="Azioni" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap text-right text-sm font-medium before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none">
                                        <button onClick={handleSaveInlineEdit} className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-200 mr-2"><CheckIcon className="w-5 h-5"/></button>
                                        <button onClick={handleCancelInlineEdit} className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"><XMarkIcon className="w-5 h-5"/></button>
                                    </td>
                                </tr>
                                )
                            }
                            
                            // Riga in modalità visualizzazione
                            return (
                            <tr key={resource.id} className="block md:table-row p-4 md:p-0 border-b dark:border-gray-600">
                                <td data-label="Nome" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none">
                                    <div>{resource.name}</div>
                                    <div className="text-xs text-gray-400">{resource.email}</div>
                                </td>
                                <td data-label="Ruolo" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none">{role?.name || 'N/A'}</td>
                                <td data-label="Horizontal" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none">{resource.horizontal}</td>
                                <td data-label="Costo" className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none">{formatCurrency(role?.dailyCost || 0)}</td>
                                <td data-label="Allocazione" className={`block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap text-sm ${getAllocationColor(allocation)} before:content-[attr(data-label)':_'] before:font-bold before:inline-block before:w-28 md:before:content-none`}>{allocation}%</td>
                                <td className="block md:table-cell px-2 py-1 md:px-6 md:py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex items-center justify-end space-x-2">
                                        <button onClick={() => openModalForEdit(resource)} title="Modifica in modale" className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200"><PencilIcon className="w-5 h-5"/></button>
                                        <button onClick={() => handleStartInlineEdit(resource)} title="Modifica inline" className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200"><PencilSquareIcon className="w-5 h-5"/></button>
                                        <button onClick={() => deleteResource(resource.id)} title="Elimina" className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200"><TrashIcon className="w-5 h-5"/></button>
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