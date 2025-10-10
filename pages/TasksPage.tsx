import React, { useState, useMemo, useEffect } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { Task } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { PencilIcon, TrashIcon, ArrowsUpDownIcon, XCircleIcon } from '../components/icons';

type SortConfig = { key: keyof Task | 'projectName' | 'clientName' | 'internalFees' | 'externalFees' | 'expenses' | 'realization'; direction: 'ascending' | 'descending' } | null;

const formatCurrency = (value: number | undefined): string => {
    return (value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

const TasksPage: React.FC = () => {
    const { tasks, projects, clients, resources, roles, taskResources, addTask, updateTask, deleteTask } = useStaffingContext();
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | Omit<Task, 'id'> | null>(null);
    const [assignedResources, setAssignedResources] = useState<Set<string>>(new Set());
    const [resourceToAdd, setResourceToAdd] = useState('');
    
    const [filters, setFilters] = useState({ name: '', projectId: '', clientId: '' });
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

    const emptyTask: Omit<Task, 'id'> = {
        wbs: '', name: '', projectId: '', totalFees: 0, internalFees: 0,
        externalFees: 0, expenses: 0, realization: 100, margin: 0, roleEfforts: {}
    };

    // Effetto per i calcoli automatici nella modale
    useEffect(() => {
        if (!editingTask) return;

        const { roleEfforts, totalFees, externalFees } = editingTask;

        const sumOfDailyCosts = Object.entries(roleEfforts || {}).reduce((acc, [roleId, days]) => {
            const role = roles.find(r => r.id === roleId);
            return acc + ((Number(days) || 0) * (role?.dailyCost || 0));
        }, 0);

        const sumOfStandardCosts = Object.entries(roleEfforts || {}).reduce((acc, [roleId, days]) => {
            const role = roles.find(r => r.id === roleId);
            return acc + ((Number(days) || 0) * (role?.standardCost || role?.dailyCost || 0));
        }, 0);
        
        // Spese = Sommatoria per ogni Ruolo di (numero giornate * costo giornaliero del ruolo * 0,035)
        const calculatedExpenses = sumOfDailyCosts * 0.035;
        
        // Onorari Interni = Onorari Totale - Onorari Esterni - Spese
        const calculatedInternalFees = (Number(totalFees) || 0) - (Number(externalFees) || 0) - calculatedExpenses;

        // REALIZZO = Onorari Interni / (Sommatoria per ogni ruolo di (numero giornate * Costo Giornaliero del ruolo))
        const calculatedRealization = sumOfDailyCosts > 0 ? (calculatedInternalFees / sumOfDailyCosts) * 100 : 0;

        // MARGINE = (Onorari Totale - Sommatoria per ruolo (numero giornate * Costi Stardard del ruolo)) / Onorari Totale * 100
        const calculatedMargin = (Number(totalFees) || 0) > 0 
            ? (((Number(totalFees) || 0) - sumOfStandardCosts) / (Number(totalFees) || 0)) * 100 
            : 0;

        setEditingTask(prev => {
            if (!prev) return null;
            return {
                ...prev,
                internalFees: calculatedInternalFees,
                expenses: calculatedExpenses,
                realization: calculatedRealization,
                margin: calculatedMargin,
            };
        });

    }, [editingTask?.roleEfforts, editingTask?.totalFees, editingTask?.externalFees, roles]);


    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            const project = projects.find(p => p.id === task.projectId);
            const nameMatch = task.name.toLowerCase().includes(filters.name.toLowerCase()) || task.wbs.toLowerCase().includes(filters.name.toLowerCase());
            const projectMatch = filters.projectId ? task.projectId === filters.projectId : true;
            const clientMatch = filters.clientId ? project?.clientId === filters.clientId : true;
            return nameMatch && projectMatch && clientMatch;
        });
    }, [tasks, projects, filters]);

    const sortedTasks = useMemo(() => {
        let sortableItems = [...filteredTasks];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const projectA = projects.find(p => p.id === a.projectId);
                const projectB = projects.find(p => p.id === b.projectId);

                let aValue: any;
                let bValue: any;

                switch (sortConfig.key) {
                    case 'projectName':
                        aValue = projectA?.name || '';
                        bValue = projectB?.name || '';
                        break;
                    case 'clientName':
                        aValue = clients.find(c => c.id === projectA?.clientId)?.name || '';
                        bValue = clients.find(c => c.id === projectB?.clientId)?.name || '';
                        break;
                    default:
                        aValue = a[sortConfig.key as keyof Task];
                        bValue = b[sortConfig.key as keyof Task];
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
    }, [filteredTasks, sortConfig, projects, clients]);

    const requestSort = (key: SortConfig['key']) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleFilterSelectChange = (name: string, value: string) => setFilters(prev => ({ ...prev, [name]: value }));
    const resetFilters = () => setFilters({ name: '', projectId: '', clientId: '' });

    const openModalForNew = () => {
        setEditingTask(emptyTask);
        setAssignedResources(new Set());
        setIsModalOpen(true);
    };

    const openModalForEdit = (task: Task) => {
        setEditingTask(task);
        const currentAssigned = taskResources.filter(tr => tr.taskId === task.id).map(tr => tr.resourceId);
        setAssignedResources(new Set(currentAssigned));
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingTask(null);
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingTask) {
            if ('id' in editingTask) {
                updateTask(editingTask as Task, Array.from(assignedResources));
            } else {
                addTask(editingTask as Omit<Task, 'id'>, Array.from(assignedResources));
            }
            handleCloseModal();
        }
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (editingTask) {
            const { name, value } = e.target;
            const numericFields = ['totalFees', 'internalFees', 'externalFees', 'expenses', 'realization', 'margin'];
            setEditingTask({ ...editingTask, [name]: numericFields.includes(name) ? parseFloat(value) || 0 : value });
        }
    };

    const handleRoleEffortChange = (roleId: string, value: string) => {
        if (editingTask) {
            const newEfforts = { ...(editingTask.roleEfforts || {}), [roleId]: Number(value) || 0 };
            setEditingTask({ ...editingTask, roleEfforts: newEfforts });
        }
    };

    const handleProjectSelectChange = (name: string, value: string) => {
        if (editingTask) {
            setEditingTask({ ...editingTask, [name]: value });
        }
    };
    
    const handleAddResource = () => {
        if (resourceToAdd) {
            setAssignedResources(prev => {
                const newSet = new Set(prev);
                newSet.add(resourceToAdd);
                return newSet;
            });
            setResourceToAdd('');
        }
    };

    const handleRemoveResource = (resourceId: string) => {
        setAssignedResources(prev => {
            const newSet = new Set(prev);
            newSet.delete(resourceId);
            return newSet;
        });
    };

    const getSortableHeader = (label: string, key: SortConfig['key']) => (
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            <button type="button" onClick={() => requestSort(key)} className="flex items-center space-x-1 hover:text-gray-900 dark:hover:text-white">
                <span className={sortConfig?.key === key ? 'font-bold text-gray-800 dark:text-white' : ''}>{label}</span>
                <ArrowsUpDownIcon className="w-4 h-4 text-gray-400" />
            </button>
        </th>
    );

    const projectOptions = useMemo(() => projects.map(p => ({ value: p.id!, label: p.name })), [projects]);
    const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.name })), [clients]);
    const resourceOptions = useMemo(() => resources.map(r => ({ value: r.id!, label: r.name })), [resources]);
    
    const selectedProject = useMemo(() => {
        if (!editingTask || !('projectId' in editingTask) || !editingTask.projectId) return null;
        return projects.find(p => p.id === editingTask.projectId);
    }, [editingTask, projects]);

    const selectedClient = useMemo(() => {
        if (!selectedProject || !selectedProject.clientId) return null;
        return clients.find(c => c.id === selectedProject.clientId);
    }, [selectedProject, clients]);


    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white self-start">Gestione Incarichi</h1>
                <button onClick={openModalForNew} className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700">Aggiungi Incarico</button>
            </div>

            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca WBS o Nome..."/>
                    <SearchableSelect name="projectId" value={filters.projectId} onChange={handleFilterSelectChange} options={projectOptions} placeholder="Tutti i progetti" />
                    <SearchableSelect name="clientId" value={filters.clientId} onChange={handleFilterSelectChange} options={clientOptions} placeholder="Tutti i clienti" />
                    <button onClick={resetFilters} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full md:w-auto">Reset</button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="min-w-full">
                    <thead className="border-b border-gray-200 dark:border-gray-700">
                        <tr>
                            {getSortableHeader('WBS', 'wbs')}
                            {getSortableHeader('Nome Incarico', 'name')}
                            {getSortableHeader('Progetto', 'projectName')}
                            {getSortableHeader('Cliente', 'clientName')}
                            {getSortableHeader('Onorari Totali', 'totalFees')}
                            {getSortableHeader('Onorari Interni', 'internalFees')}
                            {getSortableHeader('Onorari Esterni', 'externalFees')}
                            {getSortableHeader('Spese', 'expenses')}
                            {getSortableHeader('Realizzo', 'realization')}
                            {getSortableHeader('Margine', 'margin')}
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {sortedTasks.map(task => {
                            const project = projects.find(p => p.id === task.projectId);
                            const client = clients.find(c => c.id === project?.clientId);
                            return (
                                <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700 dark:text-gray-300">{task.wbs}</td>
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{task.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{project?.name || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{client?.name || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{formatCurrency(task.totalFees)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{formatCurrency(task.internalFees)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{formatCurrency(task.externalFees)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{formatCurrency(task.expenses)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{(task.realization || 0).toFixed(2)}%</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{(task.margin || 0).toFixed(2)}%</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end space-x-3">
                                            <button onClick={() => openModalForEdit(task)} className="text-gray-500 hover:text-blue-600" title="Modifica"><PencilIcon className="w-5 h-5"/></button>
                                            <button onClick={() => deleteTask(task.id!)} className="text-gray-500 hover:text-red-600" title="Elimina"><TrashIcon className="w-5 h-5"/></button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {editingTask && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingTask ? 'Modifica Incarico' : 'Aggiungi Incarico'}>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Sezione Anagrafica */}
                        <fieldset className="border p-4 rounded-md">
                            <legend className="text-lg font-medium px-2">Anagrafica</legend>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                <input type="text" name="wbs" value={editingTask.wbs} onChange={handleChange} required className="form-input" placeholder="WBS *"/>
                                <input type="text" name="name" value={editingTask.name} onChange={handleChange} required className="form-input" placeholder="Nome Incarico *"/>
                                <SearchableSelect name="projectId" value={editingTask.projectId} onChange={handleProjectSelectChange} options={projectOptions} placeholder="Seleziona Progetto *" required/>
                                <input type="text" value={selectedClient?.name || 'Nessun cliente selezionato'} readOnly className="form-input bg-gray-100 dark:bg-gray-700" placeholder="Cliente"/>
                            </div>
                        </fieldset>

                        {/* Sezione Economica */}
                        <fieldset className="border p-4 rounded-md">
                            <legend className="text-lg font-medium px-2">Dati Economici</legend>
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                                <div>
                                    <label htmlFor="totalFees" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Onorari Totali (€)</label>
                                    <input id="totalFees" type="number" step="0.01" name="totalFees" value={editingTask.totalFees} onChange={handleChange} className="form-input mt-1" placeholder="0"/>
                                </div>
                                <div>
                                    <label htmlFor="internalFees" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Onorari Interni (€)</label>
                                    <input id="internalFees" type="number" step="0.01" name="internalFees" value={editingTask.internalFees} onChange={handleChange} className="form-input mt-1" placeholder="0"/>
                                </div>
                                <div>
                                    <label htmlFor="externalFees" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Onorari Esterni (€)</label>
                                    <input id="externalFees" type="number" step="0.01" name="externalFees" value={editingTask.externalFees} onChange={handleChange} className="form-input mt-1" placeholder="0"/>
                                </div>
                                <div>
                                    <label htmlFor="expenses" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Spese (€)</label>
                                    <input id="expenses" type="number" step="0.01" name="expenses" value={editingTask.expenses} onChange={handleChange} className="form-input mt-1" placeholder="0"/>
                                </div>
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <div>
                                    <label htmlFor="realization" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Realizzo (%)</label>
                                    <input id="realization" type="number" step="0.01" name="realization" value={editingTask.realization} onChange={handleChange} className="form-input mt-1" placeholder="100"/>
                                </div>
                                <div>
                                    <label htmlFor="margin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Margine (%)</label>
                                    <input id="margin" type="number" step="0.01" name="margin" value={editingTask.margin} onChange={handleChange} className="form-input mt-1" placeholder="0"/>
                                </div>
                            </div>
                        </fieldset>
                        
                         {/* Sezione Sforzo per Ruolo */}
                        <fieldset className="border p-4 rounded-md">
                            <legend className="text-lg font-medium px-2">Sforzo Previsto per Ruolo (giorni)</legend>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-2 max-h-48 overflow-y-auto">
                               {roles.map(role => (
                                    <div key={role.id}>
                                        <label className="block text-sm text-gray-600 dark:text-gray-400">{role.name}</label>
                                        <input
                                            type="number"
                                            value={(editingTask.roleEfforts || {})[role.id!] || ''}
                                            onChange={(e) => handleRoleEffortChange(role.id!, e.target.value)}
                                            className="form-input mt-1"
                                            placeholder="0"
                                        />
                                    </div>
                               ))}
                            </div>
                        </fieldset>

                        {/* Sezione Assegnazione Risorse */}
                        <fieldset className="border p-4 rounded-md">
                            <legend className="text-lg font-medium px-2">Risorse Assegnate</legend>
                            <div className="flex items-center gap-2 mt-2">
                                <div className="flex-grow">
                                    <SearchableSelect
                                        name="resourceToAdd"
                                        value={resourceToAdd}
                                        onChange={(_, value) => setResourceToAdd(value)}
                                        options={resourceOptions.filter(opt => !assignedResources.has(opt.value))}
                                        placeholder="Aggiungi una risorsa..."
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddResource}
                                    disabled={!resourceToAdd}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
                                >
                                    Aggiungi
                                </button>
                            </div>
                            <div className="mt-4 max-h-48 overflow-y-auto space-y-2">
                                {Array.from(assignedResources).map(resourceId => {
                                    const resource = resources.find(r => r.id === resourceId);
                                    return (
                                        <div key={resourceId} className="flex items-center justify-between p-2 rounded-md bg-gray-100 dark:bg-gray-700">
                                            <span className="text-sm text-gray-800 dark:text-gray-200">{resource?.name || 'Risorsa non trovata'}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveResource(resourceId)}
                                                className="text-red-500 hover:text-red-700"
                                                title="Rimuovi risorsa"
                                            >
                                                <XCircleIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    );
                                })}
                                {assignedResources.size === 0 && (
                                    <p className="text-sm text-gray-500 text-center py-4">Nessuna risorsa assegnata.</p>
                                )}
                            </div>
                        </fieldset>
                        
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

export default TasksPage;