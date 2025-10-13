import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { Task, Role } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { PencilIcon, TrashIcon, ArrowsUpDownIcon, XCircleIcon } from '../components/icons';

type SortConfig = { key: keyof Task | 'projectName' | 'clientName'; direction: 'ascending' | 'descending' } | null;

const formatCurrency = (value: number | undefined | null): string => {
    return (value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

const renderCalculationDetail = (title: string, items: { label: string, value: string }[], formula: string, result: string) => (
    <div className="mt-4">
        <h4 className="font-semibold text-md text-gray-700 dark:text-gray-300">{title}</h4>
        <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mt-2 space-y-1">
            {items.map(item => <li key={item.label}><strong>{item.label}:</strong> {item.value}</li>)}
        </ul>
        <p className="text-sm font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded-md mt-2">
            <strong>Formula:</strong> {formula}
        </p>
        <p className="text-md font-semibold text-right mt-1">Risultato: {result}</p>
    </div>
);


const TasksManagerPage: React.FC = () => {
    const { tasks, projects, clients, resources, roles, taskResources, addTask, updateTask, deleteTask } = useStaffingContext();
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);
    const [assignedResources, setAssignedResources] = useState<Set<string>>(new Set());
    const [resourceToAdd, setResourceToAdd] = useState('');
    
    const [filters, setFilters] = useState({ name: '', projectId: '', clientId: '' });
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    const emptyTask: Omit<Task, 'id'> = {
        wbs: '', name: '', projectId: '', totalFees: 0, internalFees: 0,
        externalFees: 0, expenses: 0, realization: 100, margin: 0, roleEfforts: {}
    };

    const calculateDependentFields = useCallback((task: Partial<Task>): Partial<Task> => {
        const { roleEfforts, totalFees, externalFees } = task;

        const sumOfDailyCosts = Object.entries(roleEfforts || {}).reduce((acc, [roleId, days]) => {
            const role = roles.find(r => r.id === roleId);
            return acc + ((Number(days) || 0) * (role?.dailyCost || 0));
        }, 0);

        const sumOfStandardCosts = Object.entries(roleEfforts || {}).reduce((acc, [roleId, days]) => {
            const role = roles.find(r => r.id === roleId);
            return acc + ((Number(days) || 0) * (role?.standardCost || role?.dailyCost || 0));
        }, 0);
        
        const calculatedExpenses = sumOfDailyCosts * 0.035;
        const calculatedInternalFees = (Number(totalFees) || 0) - (Number(externalFees) || 0) - calculatedExpenses;
        const calculatedRealization = sumOfDailyCosts > 0 ? (calculatedInternalFees / sumOfDailyCosts) * 100 : 0;
        const calculatedMargin = (Number(totalFees) || 0) > 0 
            ? (((Number(totalFees) || 0) - sumOfStandardCosts) / (Number(totalFees) || 0)) * 100 
            : 0;
        
        return {
            ...task,
            internalFees: calculatedInternalFees,
            expenses: calculatedExpenses,
            realization: calculatedRealization,
            margin: calculatedMargin
        };
    }, [roles]);

    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            const project = projects.find(p => p.id === task.projectId);
            const nameMatch = (task.name || '').toLowerCase().includes(filters.name.toLowerCase()) || (task.wbs || '').toLowerCase().includes(filters.name.toLowerCase());
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

                if (aValue === null || aValue === undefined) aValue = 0;
                if (bValue === null || bValue === undefined) bValue = 0;

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
    
    useEffect(() => {
        const isSelectedTaskVisible = sortedTasks.some(task => task.id === selectedTaskId);

        if (sortedTasks.length > 0 && !isSelectedTaskVisible) {
            setSelectedTaskId(sortedTasks[0]?.id ?? null);
        } else if (sortedTasks.length === 0 && selectedTaskId !== null) {
            setSelectedTaskId(null);
        }
    }, [sortedTasks, selectedTaskId]);

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
            const taskToSend = { ...emptyTask, ...editingTask };
            if ('id' in editingTask && editingTask.id) {
                updateTask(taskToSend as Task, Array.from(assignedResources));
            } else {
                addTask(taskToSend, Array.from(assignedResources));
            }
            handleCloseModal();
        }
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!editingTask) return;
        
        const { name, value } = e.target;
        const numericFields = ['totalFees', 'internalFees', 'externalFees', 'expenses', 'realization', 'margin'];
        const newPartialTask = { ...editingTask, [name]: numericFields.includes(name) ? parseFloat(value) || 0 : value };

        if (name === 'totalFees' || name === 'externalFees') {
            setEditingTask(calculateDependentFields(newPartialTask));
        } else {
            setEditingTask(newPartialTask);
        }
    };

    const handleRoleEffortChange = (roleId: string, value: string) => {
        if (!editingTask) return;
        
        const newEfforts = { ...(editingTask.roleEfforts || {}), [roleId]: Number(value) || 0 };
        if (!newEfforts[roleId]) delete newEfforts[roleId];
        const newPartialTask = { ...editingTask, roleEfforts: newEfforts };
        setEditingTask(calculateDependentFields(newPartialTask));
    };

    const handleSelectChange = (name: string, value: string) => {
        if (editingTask) setEditingTask({ ...editingTask, [name]: value });
    };
    
    const handleAddResource = () => {
        if (resourceToAdd) {
            setAssignedResources(prev => new Set(prev).add(resourceToAdd));
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

    const selectedTaskData = useMemo(() => {
        if (!selectedTaskId) return null;
        const task = tasks.find(t => t.id === selectedTaskId);
        if (!task) return null;

        const project = projects.find(p => p.id === task.projectId);
        const client = clients.find(c => c.id === project?.clientId);

        const roleBreakdown = Object.entries(task.roleEfforts || {}).map(([roleId, days]) => {
            const role = roles.find(r => r.id === roleId);
            const dailyCost = role?.dailyCost ?? 0;
            const standardCost = role?.standardCost ?? dailyCost;
            return {
                roleName: role?.name ?? 'N/A',
                days: Number(days) || 0,
                dailyCost, standardCost,
                totalDailyCost: (Number(days) || 0) * dailyCost,
                totalStandardCost: (Number(days) || 0) * standardCost,
            };
        });
        const sumOfDailyCosts = roleBreakdown.reduce((acc, item) => acc + item.totalDailyCost, 0);
        const sumOfStandardCosts = roleBreakdown.reduce((acc, item) => acc + item.totalStandardCost, 0);

        return { task, project, client, sumOfDailyCosts, sumOfStandardCosts, roleBreakdown };
    }, [selectedTaskId, tasks, projects, clients, roles]);

    const projectOptions = useMemo(() => projects.map(p => ({ value: p.id!, label: p.name })), [projects]);
    const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.name })), [clients]);
    const resourceOptions = useMemo(() => resources.map(r => ({ value: r.id!, label: r.name })), [resources]);
    const selectedProject = useMemo(() => {
        if (!editingTask || !editingTask.projectId) return null;
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

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-8">
                <div className="lg:col-span-1 xl:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <h2 className="text-xl font-semibold mb-4">Elenco Incarichi</h2>
                    <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                        {sortedTasks.map(task => {
                             const project = projects.find(p => p.id === task.projectId);
                             return (
                                <div key={task.id} onClick={() => setSelectedTaskId(task.id!)}
                                className={`p-3 rounded-lg cursor-pointer border-2 ${selectedTaskId === task.id ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500' : 'bg-gray-50 dark:bg-gray-800/50 border-transparent hover:border-blue-300'}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold text-gray-800 dark:text-white">{task.wbs} - {task.name}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{project?.name ?? 'N/A'}</p>
                                        </div>
                                        <div className="flex-shrink-0 flex space-x-2">
                                            <button onClick={(e) => { e.stopPropagation(); openModalForEdit(task); }} className="text-gray-400 hover:text-blue-500"><PencilIcon className="w-4 h-4" /></button>
                                            <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id!); }} className="text-gray-400 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-xs mt-2 text-gray-600 dark:text-gray-300">
                                        <span>Onorari: {formatCurrency(task.totalFees)}</span>
                                        <span>Margine: {(task.margin ?? 0).toFixed(1)}%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="lg:col-span-1 xl:col-span-3">
                    {!selectedTaskData ? (
                         <div className="flex items-center justify-center h-full bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-500 dark:text-gray-400">
                            <p>Seleziona un incarico dalla lista per visualizzarne i dettagli.</p>
                        </div>
                    ) : (
                        <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                <h2 className="text-xl font-semibold mb-4">Dettagli Principali</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div><p className="text-gray-500">WBS</p><p className="font-medium">{selectedTaskData.task.wbs}</p></div>
                                    <div><p className="text-gray-500">Nome Incarico</p><p className="font-medium">{selectedTaskData.task.name ?? 'N/A'}</p></div>
                                    <div><p className="text-gray-500">Progetto</p><p className="font-medium">{selectedTaskData.project?.name ?? 'N/A'}</p></div>
                                    <div><p className="text-gray-500">Cliente</p><p className="font-medium">{selectedTaskData.client?.name ?? 'N/A'}</p></div>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                <h2 className="text-xl font-semibold mb-4">Dati Economici</h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-sm">
                                    <div><p className="text-gray-500">Onorari Totali</p><p className="font-medium text-lg">{formatCurrency(selectedTaskData.task.totalFees)}</p></div>
                                    <div><p className="text-gray-500">Onorari Interni</p><p className="font-medium text-lg">{formatCurrency(selectedTaskData.task.internalFees)}</p></div>
                                    <div><p className="text-gray-500">Onorari Esterni</p><p className="font-medium text-lg">{formatCurrency(selectedTaskData.task.externalFees)}</p></div>
                                    <div><p className="text-gray-500">Spese</p><p className="font-medium text-lg">{formatCurrency(selectedTaskData.task.expenses)}</p></div>
                                    <div><p className="text-gray-500">Realizzo</p><p className="font-medium text-lg">{(selectedTaskData.task.realization ?? 0).toFixed(2)}%</p></div>
                                    <div><p className="text-gray-500">Margine</p><p className="font-medium text-lg">{(selectedTaskData.task.margin ?? 0).toFixed(2)}%</p></div>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                <h2 className="text-xl font-semibold mb-4">Sforzo e Costi per Ruolo</h2>
                                <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ruolo</th><th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Giornate</th><th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Costo Totale</th></tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-700">{selectedTaskData.roleBreakdown.map(item => (<tr key={item.roleName}><td className="px-4 py-2 whitespace-nowrap text-sm font-medium">{item.roleName}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-right">{item.days}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-right">{formatCurrency(item.totalDailyCost)}</td></tr>))}</tbody><tfoot><tr className="font-bold bg-gray-50 dark:bg-gray-700"><td className="px-4 py-2 text-left text-sm">Totale</td><td className="px-4 py-2 text-right text-sm">{selectedTaskData.roleBreakdown.reduce((s, i) => s + i.days, 0)}</td><td className="px-4 py-2 text-right text-sm">{formatCurrency(selectedTaskData.sumOfDailyCosts)}</td></tr></tfoot></table></div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                <h2 className="text-xl font-semibold mb-4">Dettaglio Calcoli</h2>
                                {renderCalculationDetail("Calcolo Realizzo", [{ label: "Onorari Interni", value: formatCurrency(selectedTaskData.task.internalFees) }, { label: "Costo Totale G/U", value: formatCurrency(selectedTaskData.sumOfDailyCosts) },], `(Onorari Interni / Costo Totale G/U) * 100`, `${(selectedTaskData.task.realization ?? 0).toFixed(2)}%`)}
                                <div className="border-t my-6 dark:border-gray-700"></div>
                                {renderCalculationDetail("Calcolo Margine", [{ label: "Onorari Totali", value: formatCurrency(selectedTaskData.task.totalFees) }, { label: "Costo Standard Totale", value: formatCurrency(selectedTaskData.sumOfStandardCosts) },], `((Onorari Totali - Costo Standard Totale) / Onorari Totali) * 100`, `${(selectedTaskData.task.margin ?? 0).toFixed(2)}%`)}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {editingTask && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingTask.id ? 'Modifica Incarico' : 'Aggiungi Incarico'}>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <fieldset className="border p-4 rounded-md"><legend className="text-lg font-medium px-2">Anagrafica</legend><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2"><input type="text" name="wbs" value={editingTask.wbs || ''} onChange={handleChange} required className="form-input" placeholder="WBS *"/><input type="text" name="name" value={editingTask.name || ''} onChange={handleChange} required className="form-input" placeholder="Nome Incarico *"/><SearchableSelect name="projectId" value={editingTask.projectId || ''} onChange={handleSelectChange} options={projectOptions} placeholder="Seleziona Progetto *" required/><input type="text" value={selectedClient?.name || 'Nessun cliente selezionato'} readOnly className="form-input bg-gray-100 dark:bg-gray-700" placeholder="Cliente"/></div></fieldset>
                        <fieldset className="border p-4 rounded-md"><legend className="text-lg font-medium px-2">Dati Economici</legend><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2"><div><label htmlFor="totalFees" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Onorari Totali (€)</label><input id="totalFees" type="number" step="0.01" name="totalFees" value={editingTask.totalFees ?? ''} onChange={handleChange} className="form-input mt-1" placeholder="0"/></div><div><label htmlFor="externalFees" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Onorari Esterni (€)</label><input id="externalFees" type="number" step="0.01" name="externalFees" value={editingTask.externalFees ?? ''} onChange={handleChange} className="form-input mt-1" placeholder="0"/></div><div><label htmlFor="internalFees" className="block text-sm font-medium text-gray-500 dark:text-gray-400">Onorari Interni (€)</label><input id="internalFees" type="number" step="0.01" name="internalFees" value={(editingTask.internalFees ?? 0).toFixed(2)} readOnly className="form-input mt-1 bg-gray-100 dark:bg-gray-700"/></div><div><label htmlFor="expenses" className="block text-sm font-medium text-gray-500 dark:text-gray-400">Spese (€)</label><input id="expenses" type="number" step="0.01" name="expenses" value={(editingTask.expenses ?? 0).toFixed(2)} readOnly className="form-input mt-1 bg-gray-100 dark:bg-gray-700"/></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"><div><label htmlFor="realization" className="block text-sm font-medium text-gray-500 dark:text-gray-400">Realizzo (%)</label><input id="realization" type="number" step="0.01" name="realization" value={(editingTask.realization ?? 0).toFixed(2)} readOnly className="form-input mt-1 bg-gray-100 dark:bg-gray-700"/></div><div><label htmlFor="margin" className="block text-sm font-medium text-gray-500 dark:text-gray-400">Margine (%)</label><input id="margin" type="number" step="0.01" name="margin" value={(editingTask.margin ?? 0).toFixed(2)} readOnly className="form-input mt-1 bg-gray-100 dark:bg-gray-700"/></div></div></fieldset>
                        <fieldset className="border p-4 rounded-md"><legend className="text-lg font-medium px-2">Sforzo Previsto (giorni)</legend><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-2 max-h-48 overflow-y-auto p-1">{roles.map(role => (<div key={role.id}><label className="block text-sm text-gray-600 dark:text-gray-400">{role.name}</label><input type="number" value={(editingTask.roleEfforts || {})[role.id!] ?? ''} onChange={(e) => handleRoleEffortChange(role.id!, e.target.value)} className="form-input mt-1" placeholder="0"/></div>))}</div></fieldset>
                        <fieldset className="border p-4 rounded-md"><legend className="text-lg font-medium px-2">Risorse Assegnate</legend><div className="flex items-center gap-2 mt-2"><div className="flex-grow"><SearchableSelect name="resourceToAdd" value={resourceToAdd} onChange={(_, value) => setResourceToAdd(value)} options={resourceOptions.filter(opt => !assignedResources.has(opt.value))} placeholder="Aggiungi una risorsa..."/></div><button type="button" onClick={handleAddResource} disabled={!resourceToAdd} className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed">Aggiungi</button></div><div className="mt-4 max-h-48 overflow-y-auto space-y-2 p-1">{Array.from(assignedResources).map(resourceId => {const resource = resources.find(r => r.id === resourceId); return (<div key={resourceId} className="flex items-center justify-between p-2 rounded-md bg-gray-100 dark:bg-gray-700"><span className="text-sm text-gray-800 dark:text-gray-200">{resource?.name ?? 'Risorsa non trovata'}</span><button type="button" onClick={() => handleRemoveResource(resourceId)} className="text-red-500 hover:text-red-700" title="Rimuovi risorsa"><XCircleIcon className="w-5 h-5" /></button></div>);})}{assignedResources.size === 0 && (<p className="text-sm text-gray-500 text-center py-4">Nessuna risorsa assegnata.</p>)}</div></fieldset>
                        <div className="flex justify-end space-x-3 pt-4"><button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 rounded-md">Annulla</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">Salva</button></div>
                    </form>
                </Modal>
            )}
            <style>{`.form-input, .form-select { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-input, .dark .form-select { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }`}</style>
        </div>
    );
};

export default TasksManagerPage;
