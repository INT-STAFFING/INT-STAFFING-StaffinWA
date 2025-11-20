/**
 * @file ContractsPage.tsx
 * @description Pagina per la gestione dei contratti (CRUD e visualizzazione).
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Contract } from '../types';
import { DataTable, ColumnDef } from '../components/DataTable';
import Modal from '../components/Modal';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { SpinnerIcon } from '../components/icons';
import ConfirmationModal from '../components/ConfirmationModal';

// --- Types ---
type EnrichedContract = Contract & {
    projectCount: number;
    managerCount: number;
    projectNames: string[];
    managerNames: string[];
};

// --- Helper Functions ---
const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr.split('T')[0]);
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
};

const formatCurrency = (value: number) => (value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

const toISODate = (s?: string | null) => (!s ? '' : new Date(s.split('T')[0]).toISOString().split('T')[0]);

// --- Component ---
export const ContractsPage: React.FC = () => {
    const {
        contracts, projects, resources, contractProjects, contractManagers,
        addContract, updateContract, deleteContract, recalculateContractBacklog, isActionLoading, loading
    } = useEntitiesContext();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContract, setEditingContract] = useState<Contract | Omit<Contract, 'id'> | null>(null);
    const [associatedProjectIds, setAssociatedProjectIds] = useState<string[]>([]);
    const [associatedManagerIds, setAssociatedManagerIds] = useState<string[]>([]);
    const [contractToDelete, setContractToDelete] = useState<EnrichedContract | null>(null);
    const [filters, setFilters] = useState({ name: '', cig: '' });

    const emptyContract: Omit<Contract, 'id'> = {
        name: '',
        startDate: null,
        endDate: null,
        cig: '',
        cigDerivato: null,
        capienza: 0,
        backlog: 0,
    };

    // KPI Calculations
    const kpis = useMemo(() => {
        const totalContracts = contracts.length;
        const totalCapienza = contracts.reduce((sum, c) => sum + (c.capienza || 0), 0);
        const totalBacklog = contracts.reduce((sum, c) => sum + (c.backlog || 0), 0);
        const backlogPercentage = totalCapienza > 0 ? (totalBacklog / totalCapienza) * 100 : 0;
    
        return { totalContracts, totalCapienza, totalBacklog, backlogPercentage };
    }, [contracts]);

    const dataForTable = useMemo<EnrichedContract[]>(() => {
        return contracts
            .filter(c =>
                c.name.toLowerCase().includes(filters.name.toLowerCase()) &&
                c.cig.toLowerCase().includes(filters.cig.toLowerCase())
            )
            .map(contract => {
                const pIds = contractProjects.filter(cp => cp.contractId === contract.id).map(cp => cp.projectId);
                const projectNames = pIds.map(pid => projects.find(p => p.id === pid)?.name || 'N/A');
                
                const mIds = contractManagers.filter(cm => cm.contractId === contract.id).map(cm => cm.resourceId);
                const managerNames = mIds.map(mid => resources.find(r => r.id === mid)?.name || 'N/A');

                return {
                    ...contract,
                    projectCount: pIds.length,
                    managerCount: mIds.length,
                    projectNames,
                    managerNames,
                };
            });
    }, [contracts, projects, resources, contractProjects, contractManagers, filters]);
    
    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const resetFilters = () => {
        setFilters({ name: '', cig: '' });
    };

    const openModalForNew = () => {
        setEditingContract(emptyContract);
        setAssociatedProjectIds([]);
        setAssociatedManagerIds([]);
        setIsModalOpen(true);
    };

    const openModalForEdit = (contract: EnrichedContract) => {
        const projectIds = contractProjects.filter(cp => cp.contractId === contract.id).map(cp => cp.projectId);
        const managerIds = contractManagers.filter(cm => cm.contractId === contract.id).map(cm => cm.resourceId);
        
        setEditingContract({ ...contract, startDate: toISODate(contract.startDate), endDate: toISODate(contract.endDate) });
        setAssociatedProjectIds(projectIds);
        setAssociatedManagerIds(managerIds);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingContract(null);
        setAssociatedProjectIds([]);
        setAssociatedManagerIds([]);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingContract) {
            try {
                if ('id' in editingContract) {
                    await updateContract(editingContract as Contract, associatedProjectIds, associatedManagerIds);
                } else {
                    await addContract(editingContract as Omit<Contract, 'id'>, associatedProjectIds, associatedManagerIds);
                }
                handleCloseModal();
            } catch (err) {
                // error is handled by context
            }
        }
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!editingContract) return;
        const { name, value } = e.target;
        const isNumeric = ['capienza'].includes(name);
        setEditingContract({ ...editingContract, [name]: isNumeric ? Number(value) : value });
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
        { header: 'Nome Contratto', sortKey: 'name', cell: c => <span className="font-medium">{c.name}</span> },
        { header: 'CIG', sortKey: 'cig', cell: c => <span className="font-mono text-xs">{c.cig}</span> },
        { header: 'Capienza', sortKey: 'capienza', cell: c => formatCurrency(c.capienza) },
        { header: 'Backlog', sortKey: 'backlog', cell: c => <span className={c.backlog < 0 ? 'text-error font-semibold' : ''}>{formatCurrency(c.backlog)}</span> },
        { header: 'Progetti Collegati', sortKey: 'projectCount', cell: c => c.projectCount },
    ];

    const renderRow = (contract: EnrichedContract) => (
        <tr key={contract.id} className="group hover:bg-surface-container">
            {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 bg-inherit">{col.cell(contract)}</td>)}
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium bg-inherit">
                <div className="flex items-center justify-end space-x-3">
                    <button onClick={() => recalculateContractBacklog(contract.id!)} className="text-gray-500 hover:text-blue-600 disabled:opacity-50" title="Ricalcola Backlog" disabled={isActionLoading(`recalculateBacklog-${contract.id}`)}>
                        {isActionLoading(`recalculateBacklog-${contract.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">refresh</span>}
                    </button>
                    <button onClick={() => openModalForEdit(contract)} className="text-gray-500 hover:text-blue-600" title="Modifica"><span className="material-symbols-outlined">edit</span></button>
                    <button onClick={() => setContractToDelete(contract)} className="text-gray-500 hover:text-red-600" title="Elimina">
                        {isActionLoading(`deleteContract-${contract.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">delete</span>}
                    </button>
                </div>
            </td>
        </tr>
    );

    const renderMobileCard = (contract: EnrichedContract) => (
         <div key={contract.id} className="p-4 rounded-lg shadow-md bg-surface-container border-l-4 border-primary">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-lg text-on-surface">{contract.name}</p>
                    <p className="text-sm text-on-surface-variant font-mono">{contract.cig}</p>
                </div>
                <div className="flex items-center space-x-1">
                    <button onClick={() => recalculateContractBacklog(contract.id!)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high" disabled={isActionLoading(`recalculateBacklog-${contract.id}`)}>
                        {isActionLoading(`recalculateBacklog-${contract.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">refresh</span>}
                    </button>
                    <button onClick={() => openModalForEdit(contract)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high"><span className="material-symbols-outlined">edit</span></button>
                    <button onClick={() => setContractToDelete(contract)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high">
                        {isActionLoading(`deleteContract-${contract.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">delete</span>}
                    </button>
                </div>
            </div>
            <div className="mt-4 pt-4 border-t border-outline-variant grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-on-surface-variant">Capienza</p><p className="font-medium text-on-surface">{formatCurrency(contract.capienza)}</p></div>
                <div><p className="text-on-surface-variant">Backlog</p><p className={`font-medium ${contract.backlog < 0 ? 'text-error' : 'text-on-surface'}`}>{formatCurrency(contract.backlog)}</p></div>
                <div className="col-span-2"><p className="text-on-surface-variant">Progetti</p><p className="font-medium text-on-surface">{contract.projectNames.join(', ') || 'Nessuno'}</p></div>
            </div>
        </div>
    );

    const filtersNode = (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per nome..."/>
            <input type="text" name="cig" value={filters.cig} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per CIG..."/>
            <button onClick={resetFilters} className="px-6 py-2 bg-secondary-container text-on-secondary-container font-semibold rounded-full hover:opacity-90 w-full">Reset</button>
        </div>
    );
    
    return (
        <div>
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-primary">
                    <p className="text-sm text-on-surface-variant">Contratti Totali</p>
                    <p className="text-2xl font-bold text-on-surface">{kpis.totalContracts}</p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-secondary">
                     <p className="text-sm text-on-surface-variant">Capienza Totale</p>
                     <p className="text-2xl font-bold text-on-surface">{formatCurrency(kpis.totalCapienza)}</p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-tertiary">
                     <p className="text-sm text-on-surface-variant">Backlog Residuo</p>
                     <p className="text-2xl font-bold text-on-surface">{formatCurrency(kpis.totalBacklog)} <span className="text-sm font-normal opacity-70">({kpis.backlogPercentage.toFixed(0)}%)</span></p>
                </div>
            </div>

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
                isLoading={loading}
                 tableLayout={{ dense: true, striped: true, headerSticky: true, headerBackground: true, headerBorder: true, width: 'fixed' }}
                tableClassNames={{ base: 'w-full text-sm' }}
            />
            {editingContract && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingContract ? 'Modifica Contratto' : 'Nuovo Contratto'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* form content here */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium mb-1">Nome Contratto *</label><input type="text" name="name" value={editingContract.name} onChange={handleChange} required className="form-input"/></div>
                            <div><label className="block text-sm font-medium mb-1">Capienza (€) *</label><input type="number" name="capienza" value={editingContract.capienza} onChange={handleChange} required className="form-input" step="0.01"/></div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium mb-1">CIG *</label><input type="text" name="cig" value={editingContract.cig} onChange={handleChange} required className="form-input"/></div>
                            <div><label className="block text-sm font-medium mb-1">CIG Derivato</label><input type="text" name="cigDerivato" value={editingContract.cigDerivato || ''} onChange={handleChange} className="form-input"/></div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div><label className="block text-sm font-medium mb-1">Data Inizio</label><input type="date" name="startDate" value={editingContract.startDate || ''} onChange={handleChange} className="form-input"/></div>
                             <div><label className="block text-sm font-medium mb-1">Data Fine</label><input type="date" name="endDate" value={editingContract.endDate || ''} onChange={handleChange} className="form-input"/></div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Progetti Associati</label>
                            <MultiSelectDropdown name="projectIds" selectedValues={associatedProjectIds} onChange={(_, v) => setAssociatedProjectIds(v)} options={projectOptions} placeholder="Seleziona progetti..."/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Manager di Contratto</label>
                            <MultiSelectDropdown name="managerIds" selectedValues={associatedManagerIds} onChange={(_, v) => setAssociatedManagerIds(v)} options={resourceOptions} placeholder="Seleziona manager..."/>
                        </div>
                        
                        <div className="flex justify-end space-x-3 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addContract') || isActionLoading(`updateContract-${'id' in editingContract ? editingContract.id : ''}`)} className="flex justify-center items-center px-6 py-2 bg-primary text-on-primary rounded-full disabled:opacity-50 font-semibold">
                               {isActionLoading('addContract') || isActionLoading(`updateContract-${'id' in editingContract ? editingContract.id : ''}`) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
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
                    message={`Sei sicuro di voler eliminare il contratto "${contractToDelete.name}"?`}
                    isConfirming={isActionLoading(`deleteContract-${contractToDelete.id}`)}
                />
            )}
        </div>
    );
};