/**
 * @file ContractsPage.tsx
 * @description Pagina per la gestione dei contratti (CRUD e visualizzazione).
 */

import React, { useState, useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Contract } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { PencilIcon, TrashIcon, SpinnerIcon } from '../components/icons';
import { DataTable, ColumnDef } from '../components/DataTable';
import ConfirmationModal from '../components/ConfirmationModal';
import MultiSelectDropdown from '../components/MultiSelectDropdown';

// --- Types ---
type EnrichedContract = Contract & {
    managerNames: string[];
};

// --- Helper Functions ---
const formatCurrency = (value: number) => (value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const formatDateForDisplay = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' });
};

// --- Component ---
const ContractsPage: React.FC = () => {
    const { contracts, contractProjects, contractManagers, projects, resources, addContract, updateContract, deleteContract, isActionLoading } = useEntitiesContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContract, setEditingContract] = useState<Contract | Omit<Contract, 'id'> | null>(null);
    const [contractToDelete, setContractToDelete] = useState<EnrichedContract | null>(null);
    const [relatedProjectIds, setRelatedProjectIds] = useState<string[]>([]);
    const [relatedManagerIds, setRelatedManagerIds] = useState<string[]>([]);
    const [filters, setFilters] = useState({ name: '', cig: '' });

    // Fix: Add backlog property to emptyContract and update its type to Omit<Contract, 'id'>.
    const emptyContract: Omit<Contract, 'id'> = {
        name: '', startDate: '', endDate: '', cig: '', cigDerivato: '', capienza: 0, backlog: 0,
    };

    const dataForTable = useMemo<EnrichedContract[]>(() => {
        return contracts
            .filter(contract => 
                contract.name.toLowerCase().includes(filters.name.toLowerCase()) &&
                contract.cig.toLowerCase().includes(filters.cig.toLowerCase())
            )
            .map(contract => {
                const managers = contractManagers
                    .filter(cm => cm.contractId === contract.id)
                    .map(cm => resources.find(r => r.id === cm.resourceId)?.name || 'N/A');
                
                return {
                    ...contract,
                    managerNames: managers,
                };
            });
    }, [contracts, contractManagers, resources, filters]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const resetFilters = () => setFilters({ name: '', cig: '' });

    const openModalForNew = () => {
        setEditingContract(emptyContract);
        setRelatedProjectIds([]);
        setRelatedManagerIds([]);
        setIsModalOpen(true);
    };

    const openModalForEdit = (contract: EnrichedContract) => {
        const associatedProjectIds = contractProjects.filter(cp => cp.contractId === contract.id).map(cp => cp.projectId);
        const associatedManagerIds = contractManagers.filter(cm => cm.contractId === contract.id).map(cm => cm.resourceId);
        setEditingContract(contract);
        setRelatedProjectIds(associatedProjectIds);
        setRelatedManagerIds(associatedManagerIds);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingContract(null);
        setRelatedProjectIds([]);
        setRelatedManagerIds([]);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingContract) {
            try {
                if ('id' in editingContract) {
                    await updateContract(editingContract, relatedProjectIds, relatedManagerIds);
                } else {
                    // Fix: Update type assertion to Omit<Contract, 'id'>.
                    await addContract(editingContract as Omit<Contract, 'id'>, relatedProjectIds, relatedManagerIds);
                }
                handleCloseModal();
            } catch (e) {}
        }
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (editingContract) {
            const { name, value } = e.target;
            const isNumeric = name === 'capienza';
            setEditingContract({ ...editingContract, [name]: isNumeric ? parseFloat(value) || 0 : value });
        }
    };

    const handleDelete = async () => {
        if (contractToDelete) {
            await deleteContract(contractToDelete.id!);
            setContractToDelete(null);
        }
    };
    
    const projectOptions = useMemo(() => projects.map(p => ({ value: p.id!, label: p.name })), [projects]);
    const resourceOptions = useMemo(() => resources.map(r => ({ value: r.id!, label: r.name })), [resources]);

    const columns: ColumnDef<EnrichedContract>[] = [
        { header: 'Nome Contratto', sortKey: 'name', cell: c => <span className="font-medium text-gray-900 dark:text-white">{c.name}</span> },
        { header: 'CIG / Derivato', sortKey: 'cig', cell: c => <div><div>{c.cig}</div><div className="text-xs text-gray-500">{c.cigDerivato}</div></div> },
        { header: 'Periodo Validità', sortKey: 'startDate', cell: c => `${formatDateForDisplay(c.startDate)} - ${formatDateForDisplay(c.endDate)}` },
        { header: 'Responsabili', cell: c => <span className="text-xs">{c.managerNames.join(', ')}</span> },
        { header: 'Capienza', sortKey: 'capienza', cell: c => formatCurrency(c.capienza) },
        { header: 'Backlog', sortKey: 'backlog', cell: c => <span className={`font-semibold ${c.backlog < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(c.backlog)}</span> },
    ];

    const renderRow = (contract: EnrichedContract) => (
        <tr key={contract.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
            {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{col.cell(contract)}</td>)}
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end space-x-3">
                    <button onClick={() => openModalForEdit(contract)} className="text-gray-500 hover:text-blue-600" title="Modifica"><PencilIcon className="w-5 h-5"/></button>
                    <button onClick={() => setContractToDelete(contract)} className="text-gray-500 hover:text-red-600" title="Elimina">
                        {isActionLoading(`deleteContract-${contract.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <TrashIcon className="w-5 h-5"/>}
                    </button>
                </div>
            </td>
        </tr>
    );
    
    const renderMobileCard = (contract: EnrichedContract) => (
        <div key={contract.id} className="p-4 rounded-lg shadow-md bg-gray-50 dark:bg-gray-900/50">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-lg text-gray-900 dark:text-white">{contract.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">CIG: {contract.cig}</p>
                </div>
                <div className="flex items-center space-x-1 flex-shrink-0 ml-4">
                    <button onClick={() => openModalForEdit(contract)} className="p-1 text-gray-500 hover:text-blue-600"><PencilIcon className="w-5 h-5"/></button>
                    <button onClick={() => setContractToDelete(contract)} className="p-1 text-gray-500 hover:text-red-600">
                        {isActionLoading(`deleteContract-${contract.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <TrashIcon className="w-5 h-5"/>}
                    </button>
                </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-gray-500">Capienza</p><p className="font-medium">{formatCurrency(contract.capienza)}</p></div>
                <div><p className="text-gray-500">Backlog</p><p className={`font-semibold ${contract.backlog < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(contract.backlog)}</p></div>
                <div className="col-span-2"><p className="text-gray-500">Responsabili</p><p className="font-medium text-xs">{contract.managerNames.join(', ')}</p></div>
            </div>
        </div>
    );

    const filtersNode = (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per nome..."/>
            <input type="text" name="cig" value={filters.cig} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per CIG..."/>
            <button onClick={resetFilters} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full md:w-auto">Reset</button>
        </div>
    );

    return (
        <div>
            <DataTable<EnrichedContract>
                title="Gestione Contratti"
                addNewButtonLabel="Aggiungi Contratto"
                data={dataForTable}
                columns={columns}
                filtersNode={filtersNode}
                onAddNew={openModalForNew}
                renderRow={renderRow}
                renderMobileCard={renderMobileCard}
                initialSortKey="name"
            />
            
            {editingContract && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingContract ? 'Modifica Contratto' : 'Aggiungi Contratto'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input type="text" name="name" value={editingContract.name} onChange={handleChange} required className="form-input" placeholder="Nome Contratto *"/>
                        <div className="grid grid-cols-2 gap-4">
                            <input type="text" name="cig" value={editingContract.cig} onChange={handleChange} required className="form-input" placeholder="CIG *"/>
                            <input type="text" name="cigDerivato" value={editingContract.cigDerivato || ''} onChange={handleChange} className="form-input" placeholder="CIG Derivato"/>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <input type="date" name="startDate" value={editingContract.startDate || ''} onChange={handleChange} className="form-input" placeholder="Data Inizio"/>
                            <input type="date" name="endDate" value={editingContract.endDate || ''} onChange={handleChange} className="form-input" placeholder="Data Fine"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Capienza (€)</label>
                            <input type="number" step="0.01" name="capienza" value={editingContract.capienza} onChange={handleChange} required className="form-input"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Progetti Associati</label>
                            <MultiSelectDropdown name="projectIds" selectedValues={relatedProjectIds} onChange={(_, v) => setRelatedProjectIds(v)} options={projectOptions} placeholder="Seleziona progetti"/>
                        </div>
                         <div>
                            <label className="block text-sm font-medium">Responsabili</label>
                            <MultiSelectDropdown name="managerIds" selectedValues={relatedManagerIds} onChange={(_, v) => setRelatedManagerIds(v)} options={resourceOptions} placeholder="Seleziona responsabili"/>
                        </div>

                        <div className="flex justify-end space-x-3 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 rounded-md">Annulla</button>
                             <button type="submit" disabled={isActionLoading('addContract') || isActionLoading(`updateContract-${'id' in editingContract ? editingContract.id : ''}`)} className="flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400">
                               {(isActionLoading('addContract') || isActionLoading(`updateContract-${'id' in editingContract ? editingContract.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {contractToDelete && (
                 <ConfirmationModal
                    isOpen={!!contractToDelete}
                    onClose={() => setContractToDelete(null)}
                    onConfirm={handleDelete}
                    title="Conferma Eliminazione"
                    message={`Sei sicuro di voler eliminare il contratto '${contractToDelete.name}'?`}
                    isConfirming={isActionLoading(`deleteContract-${contractToDelete.id}`)}
                />
            )}
            <style>{`.form-input, .form-select, .form-textarea { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-input, .dark .form-select, .dark .form-textarea { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }`}</style>
        </div>
    );
};

export default ContractsPage;
