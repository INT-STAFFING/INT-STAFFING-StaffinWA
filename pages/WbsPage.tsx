/**
 * @file WbsPage.tsx
 * @description Pagina per la gestione degli incarichi professionali (WBS).
 */
import React, { useState, useMemo, useCallback } from 'react';
// Fix: Use useEntitiesContext from AppContext
import { useEntitiesContext } from '../context/AppContext';
import { WbsTask } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { PencilIcon, TrashIcon, ArrowsUpDownIcon, SpinnerIcon } from '../components/icons';

type SortConfig = { key: keyof WbsTask | 'clientName'; direction: 'ascending' | 'descending' } | null;

const formatCurrency = (value: number | undefined): string => {
    return (value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

const WbsPage: React.FC = () => {
    // Fix: Use useEntitiesContext from AppContext
    const { wbsTasks, clients, resources, addWbsTask, updateWbsTask, deleteWbsTask, isActionLoading } = useEntitiesContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<WbsTask | Omit<WbsTask, 'id'> | null>(null);
    const [filters, setFilters] = useState({ elementoWbs: '', clientId: '', responsabileId: '' });
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

    const emptyTask: Omit<WbsTask, 'id'> = {
        elementoWbs: '', descrizioneWbe: '', clientId: null, periodo: '',
        ore: 0, produzioneLorda: 0, oreNetworkItalia: 0, produzioneLordaNetworkItalia: 0,
        perdite: 0, realisation: 100, speseOnorariEsterni: 0, speseAltro: 0,
        fattureOnorari: 0, fattureSpese: 0, iva: 0, incassi: 0,
        primoResponsabileId: null, secondoResponsabileId: null,
    };

    const filteredTasks = useMemo(() => {
        return wbsTasks.filter(task => {
            const wbsMatch = task.elementoWbs.toLowerCase().includes(filters.elementoWbs.toLowerCase());
            const clientMatch = filters.clientId ? task.clientId === filters.clientId : true;
            const responsabileMatch = filters.responsabileId ? (task.primoResponsabileId === filters.responsabileId || task.secondoResponsabileId === filters.responsabileId) : true;
            return wbsMatch && clientMatch && responsabileMatch;
        });
    }, [wbsTasks, filters]);

    const sortedTasks = useMemo(() => {
        let sortableItems = [...filteredTasks];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aVal = sortConfig.key === 'clientName' ? clients.find(c => c.id === a.clientId)?.name || '' : a[sortConfig.key as keyof WbsTask];
                const bVal = sortConfig.key === 'clientName' ? clients.find(c => c.id === b.clientId)?.name || '' : b[sortConfig.key as keyof WbsTask];
                
                if (typeof aVal === 'number' && typeof bVal === 'number') {
                     return sortConfig.direction === 'ascending' ? aVal - bVal : bVal - aVal;
                }
                 if (typeof aVal === 'string' && typeof bVal === 'string') {
                    return sortConfig.direction === 'ascending' ? aVal.localeCompare(bVal) : bVal.localeCompare(bVal);
                }
                return 0;
            });
        }
        return sortableItems;
    }, [filteredTasks, sortConfig, clients]);

    const requestSort = (key: SortConfig['key']) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleFilterSelectChange = (name: string, value: string) => setFilters(prev => ({ ...prev, [name]: value }));
    const resetFilters = () => setFilters({ elementoWbs: '', clientId: '', responsabileId: '' });

    const openModalForNew = () => { setEditingTask(emptyTask); setIsModalOpen(true); };
    const openModalForEdit = (task: WbsTask) => { setEditingTask(task); setIsModalOpen(true); };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingTask(null); };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingTask) {
            try {
                if ('id' in editingTask) await updateWbsTask(editingTask as WbsTask);
                else await addWbsTask(editingTask as Omit<WbsTask, 'id'>);
                handleCloseModal();
            } catch (e) {}
        }
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (editingTask) {
            const { name, value, type } = e.target;
            setEditingTask(prev => ({...prev!, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
        }
    };
    
    const handleSelectChange = (name: string, value: string) => {
        if (editingTask) setEditingTask(prev => ({ ...prev!, [name]: value }));
    };

    const getSortableHeader = (label: string, key: SortConfig['key']) => (
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            <button type="button" onClick={() => requestSort(key)} className="flex items-center space-x-1 hover:text-gray-900 dark:hover:text-white">
                <span className={sortConfig?.key === key ? 'font-bold text-primary-dark dark:text-primary-light' : ''}>{label}</span>
                <ArrowsUpDownIcon className="w-4 h-4 text-gray-400" />
            </button>
        </th>
    );
    
    // --- Calculated Fields ---
    const calculatedValues = useMemo(() => {
        if (!editingTask) return {};
        const p = editingTask;
        const totaleOre = (p.ore || 0) + (p.oreNetworkItalia || 0);
        const totaleProduzioneLorda = (p.produzioneLorda || 0) + (p.produzioneLordaNetworkItalia || 0);
        const produzioneNetta = (totaleProduzioneLorda + (p.perdite || 0)) * ((p.realisation || 100) / 100);
        const totaleSpese = (p.speseOnorariEsterni || 0) + (p.speseAltro || 0);
        const fattureOnorariESpese = (p.fattureOnorari || 0) + (p.fattureSpese || 0);
        const totaleFatture = fattureOnorariESpese + (p.iva || 0);
        const totaleWIP = produzioneNetta - fattureOnorariESpese;
        const credito = totaleFatture + totaleWIP - (p.incassi || 0);
        return { totaleOre, totaleProduzioneLorda, produzioneNetta, totaleSpese, fattureOnorariESpese, totaleFatture, totaleWIP, credito };
    }, [editingTask]);

    const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.name })), [clients]);
    const resourceOptions = useMemo(() => resources.map(r => ({ value: r.id!, label: r.name })), [resources]);
    
    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-primary-dark dark:text-primary-light self-start">Gestione Incarichi WBS</h1>
                <button onClick={openModalForNew} className="w-full md:w-auto px-4 py-2 bg-accent-teal text-primary-dark font-semibold rounded-md shadow-sm hover:opacity-90">Aggiungi Incarico</button>
            </div>
            
            <div className="mb-6 p-4 bg-primary-light dark:bg-primary-dark rounded-lg shadow">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <input type="text" name="elementoWbs" value={filters.elementoWbs} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per WBS..." />
                    <SearchableSelect name="clientId" value={filters.clientId} onChange={handleFilterSelectChange} options={clientOptions} placeholder="Tutti i clienti" />
                    <SearchableSelect name="responsabileId" value={filters.responsabileId} onChange={handleFilterSelectChange} options={resourceOptions} placeholder="Tutti i responsabili" />
                    <button onClick={resetFilters} className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 w-full md:w-auto">Reset</button>
                </div>
            </div>

            <div className="bg-primary-light dark:bg-primary-dark rounded-lg shadow overflow-x-auto">
                <table className="min-w-full">
                    <thead className="border-b border-gray-200 dark:border-white/20">
                        <tr>
                            {getSortableHeader('Elemento WBS', 'elementoWbs')}
                            {getSortableHeader('Descrizione', 'descrizioneWbe')}
                            {getSortableHeader('Cliente', 'clientName')}
                            {getSortableHeader('Produzione Netta', 'produzioneLorda')}
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-white/20">
                        {sortedTasks.map(task => {
                            const client = clients.find(c => c.id === task.clientId);
                            const totaleProduzioneLorda = task.produzioneLorda + task.produzioneLordaNetworkItalia;
                            const produzioneNetta = (totaleProduzioneLorda + task.perdite) * (task.realisation / 100);
                            return (
                                <tr key={task.id} className="hover:bg-accent-teal/5 dark:hover:bg-accent-teal/10">
                                    <td className="px-4 py-3 whitespace-nowrap"><div className="font-medium text-primary-dark dark:text-primary-light">{task.elementoWbs}</div></td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 truncate max-w-xs">{task.descrizioneWbe}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{client?.name || 'N/A'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{formatCurrency(produzioneNetta)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end space-x-3">
                                            <button onClick={() => openModalForEdit(task)} className="text-gray-500 hover:text-accent-teal" title="Modifica"><PencilIcon className="w-5 h-5"/></button>
                                            <button onClick={() => deleteWbsTask(task.id!)} className="text-gray-500 hover:text-accent-red" title="Elimina">
                                                {isActionLoading(`deleteWbsTask-${task.id}`) ? <SpinnerIcon className="w-5 h-5" /> : <TrashIcon className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                 {sortedTasks.length === 0 && <div className="text-center py-8 text-gray-500">Nessun incarico trovato.</div>}
            </div>

            {editingTask && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingTask ? 'Modifica Incarico' : 'Aggiungi Incarico'}>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Sezione Identificazione */}
                        <fieldset className="border p-4 rounded-md"><legend className="text-lg font-semibold px-2">Identificazione</legend>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Elemento WBS *</label><input type="text" name="elementoWbs" value={editingTask.elementoWbs} onChange={handleChange} required className="form-input"/></div>
                                <div><label className="block text-sm font-medium mb-1">Periodo</label><input type="text" name="periodo" value={editingTask.periodo} onChange={handleChange} className="form-input"/></div>
                                <div><label className="block text-sm font-medium mb-1">Cliente</label><SearchableSelect name="clientId" value={editingTask.clientId || ''} onChange={handleSelectChange} options={clientOptions} placeholder="Seleziona Cliente" /></div>
                                <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Descrizione WBE</label><textarea name="descrizioneWbe" value={editingTask.descrizioneWbe} onChange={handleChange} className="form-textarea" rows={2}/></div>
                            </div>
                        </fieldset>
                        {/* Sezione Dati Produzione */}
                         <fieldset className="border p-4 rounded-md"><legend className="text-lg font-semibold px-2">Produzione</legend>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 items-center">
                                <div><label className="block text-sm font-medium mb-1">Ore</label><input type="number" step="0.01" name="ore" value={editingTask.ore} onChange={handleChange} className="form-input"/></div>
                                <div><label className="block text-sm font-medium mb-1">Produzione Lorda (€)</label><input type="number" step="0.01" name="produzioneLorda" value={editingTask.produzioneLorda} onChange={handleChange} className="form-input"/></div>
                                <div><label className="block text-sm font-medium mb-1">Ore Network Italia</label><input type="number" step="0.01" name="oreNetworkItalia" value={editingTask.oreNetworkItalia} onChange={handleChange} className="form-input"/></div>
                                <div><label className="block text-sm font-medium mb-1">Produzione Lorda Network (€)</label><input type="number" step="0.01" name="produzioneLordaNetworkItalia" value={editingTask.produzioneLordaNetworkItalia} onChange={handleChange} className="form-input"/></div>
                                <div className="font-bold">Totale Ore: {calculatedValues.totaleOre?.toFixed(2)}</div>
                                <div className="font-bold">Totale Produzione Lorda: {formatCurrency(calculatedValues.totaleProduzioneLorda)}</div>
                            </div>
                        </fieldset>
                        {/* Sezione Marginalità */}
                        <fieldset className="border p-4 rounded-md"><legend className="text-lg font-semibold px-2">Marginalità</legend>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 items-center">
                                <div><label className="block text-sm font-medium mb-1">Perdite (€)</label><input type="number" step="0.01" name="perdite" value={editingTask.perdite} onChange={handleChange} className="form-input" placeholder="Valore negativo"/></div>
                                <div><label className="block text-sm font-medium mb-1">Realisation (%)</label><input type="number" step="0.01" name="realisation" value={editingTask.realisation} onChange={handleChange} className="form-input"/></div>
                                <div className="md:col-span-2 font-bold">Produzione Netta: {formatCurrency(calculatedValues.produzioneNetta)}</div>
                            </div>
                        </fieldset>
                         {/* Sezione Costi e Spese */}
                        <fieldset className="border p-4 rounded-md"><legend className="text-lg font-semibold px-2">Costi e Spese</legend>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 items-center">
                                <div><label className="block text-sm font-medium mb-1">Spese Onorari Esterni (€)</label><input type="number" step="0.01" name="speseOnorariEsterni" value={editingTask.speseOnorariEsterni} onChange={handleChange} className="form-input"/></div>
                                <div><label className="block text-sm font-medium mb-1">Spese Altro (€)</label><input type="number" step="0.01" name="speseAltro" value={editingTask.speseAltro} onChange={handleChange} className="form-input"/></div>
                                <div className="md:col-span-2 font-bold">Totale Spese: {formatCurrency(calculatedValues.totaleSpese)}</div>
                            </div>
                        </fieldset>
                        {/* Sezione Ciclo Attivo */}
                        <fieldset className="border p-4 rounded-md"><legend className="text-lg font-semibold px-2">Ciclo Attivo e Situazione Economica</legend>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 items-center">
                                <div><label className="block text-sm font-medium mb-1">Fatture Onorari (€)</label><input type="number" step="0.01" name="fattureOnorari" value={editingTask.fattureOnorari} onChange={handleChange} className="form-input"/></div>
                                <div><label className="block text-sm font-medium mb-1">Fatture Spese (€)</label><input type="number" step="0.01" name="fattureSpese" value={editingTask.fattureSpese} onChange={handleChange} className="form-input"/></div>
                                <div><span className="font-semibold">Fatture Onorari e Spese:</span> {formatCurrency(calculatedValues.fattureOnorariESpese)}</div>
                                <div><span className="font-semibold">Totale WIP:</span> {formatCurrency(calculatedValues.totaleWIP)}</div>
                                <div><label className="block text-sm font-medium mb-1">IVA (€)</label><input type="number" step="0.01" name="iva" value={editingTask.iva} onChange={handleChange} className="form-input"/></div>
                                <div><span className="font-semibold">TOTALE Fatture:</span> {formatCurrency(calculatedValues.totaleFatture)}</div>
                                <div><label className="block text-sm font-medium mb-1">Incassi (€)</label><input type="number" step="0.01" name="incassi" value={editingTask.incassi} onChange={handleChange} className="form-input"/></div>
                                <div><span className="font-semibold">Credito:</span> {formatCurrency(calculatedValues.credito)}</div>
                            </div>
                        </fieldset>
                        {/* Sezione Governance */}
                        <fieldset className="border p-4 rounded-md"><legend className="text-lg font-semibold px-2">Governance</legend>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div><label className="block text-sm font-medium mb-1">Primo Responsabile</label><SearchableSelect name="primoResponsabileId" value={editingTask.primoResponsabileId || ''} onChange={handleSelectChange} options={resourceOptions} placeholder="Seleziona Responsabile" /></div>
                                 <div><label className="block text-sm font-medium mb-1">Secondo Responsabile</label><SearchableSelect name="secondoResponsabileId" value={editingTask.secondoResponsabileId || ''} onChange={handleSelectChange} options={resourceOptions} placeholder="Seleziona Responsabile" /></div>
                            </div>
                        </fieldset>

                        <div className="flex justify-end space-x-3 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addWbsTask') || isActionLoading(`updateWbsTask-${'id' in editingTask ? editingTask.id : ''}`)} className="flex justify-center items-center px-4 py-2 bg-accent-teal text-primary-dark font-semibold rounded-md hover:opacity-90 disabled:opacity-50">
                               {(isActionLoading('addWbsTask') || isActionLoading(`updateWbsTask-${'id' in editingTask ? editingTask.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
            <style>{`
                .form-input, .form-select, .form-textarea {
                    border-color: #D1D5DB; 
                    background-color: #FDFFFC;
                }
                .dark .form-input, .dark .form-select, .dark .form-textarea {
                    border-color: #4B5563;
                    background-color: #011627;
                    color: #FDFFFC;
                }
                .form-input:focus, .form-select:focus, .form-textarea:focus {
                    --tw-ring-color: #2EC4B6;
                    border-color: #2EC4B6;
                }
            `}</style>
        </div>
    );
};

export default WbsPage;