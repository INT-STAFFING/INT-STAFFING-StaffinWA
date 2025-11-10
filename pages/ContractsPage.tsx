/**
 * @file ContractsPage.tsx
 * @description Pagina per la gestione dei contratti (CRUD e visualizzazione).
 */

import React, { useState, useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Contract, Project } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { SpinnerIcon } from '../components/icons';
import { DataTable, ColumnDef } from '../components/DataTable';
import ConfirmationModal from '../components/ConfirmationModal';
import MultiSelectDropdown from '../components/MultiSelectDropdown';

// --- Types ---
type EnrichedContract = Contract & {
    managerNames: string[];
    associatedProjects: Project[];
};

// --- Helper Functions ---
const formatCurrency = (value: number) => (value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const formatDateForDisplay = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' });
};

// --- Component ---
// FIX: Changed to a named export to align with conventions and resolve import issues.
export const ContractsPage: React.FC = () => {
    const { contracts, contractProjects, contractManagers, projects, resources, addContract, updateContract, deleteContract, recalculateContractBacklog, isActionLoading, loading } = useEntitiesContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContract, setEditingContract] = useState<Contract | Omit<Contract, 'id'> | null>(null);
    const [contractToDelete, setContractToDelete] = useState<EnrichedContract | null>(null);
    const [relatedProjectIds, setRelatedProjectIds] = useState<string[]>([]);
    const [relatedManagerIds, setRelatedManagerIds] = useState<string[]>([]);
    const [filters, setFilters] = useState({ name: '', cig: '' });
    const [view, setView] = useState<'table' | 'card'>('table');


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
                
                // Find associated projects from both relationships
                const projectIdsFromContractProjects = contractProjects
                    .filter(cp => cp.contractId === contract.id)
                    .map(cp => cp.projectId);
                
                const projectIdsFromProjectsTable = projects
                    .filter(p => p.contractId === contract.id)
                    .map(p => p.id!);

                const allProjectIds = [...new Set([...projectIdsFromContractProjects, ...projectIdsFromProjectsTable])];
                const associatedProjects = projects.filter(p => allProjectIds.includes(p.id!));

                return {
                    ...contract,
                    managerNames: managers,
                    associatedProjects,
                };
            });
    }, [contracts, contractProjects, contractManagers, projects, resources, filters]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const resetFilters = () => setFilters({ name: '', cig: '' });

    const openModalForNew = () => {
        setEditingContract(emptyContract);
        setRelatedProjectIds([]);
        setRelatedManagerIds([]);
        setIsModalOpen(true);
    };

    const openModalForEdit = (contract: EnrichedContract) => {
        const associatedProjectIds = contract.associatedProjects.map(p => p.id!);
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
        { header: 'Nome Contratto', sortKey: 'name', cell: c => <span className="font-medium text-on-surface sticky left-0 bg-inherit pl-6">{c.name}</span> },
        { header: 'CIG / Derivato', sortKey: 'cig', cell: c => <div><div>{c.cig}</div><div className="text-xs text-on-surface-variant">{c.cigDerivato}</div></div> },
        { header: 'Periodo Validità', sortKey: 'startDate', cell: c => `${formatDateForDisplay(c.startDate)} - ${formatDateForDisplay(c.endDate)}` },
        { header: 'Responsabili', cell: c => <span className="text-xs">{c.managerNames.join(', ')}</span> },
        { header: 'Capienza', sortKey: 'capienza', cell: c => formatCurrency(c.capienza) },
        { header: 'Backlog', sortKey: 'backlog', cell: c => <span className={`font-semibold ${c.backlog < 0 ? 'text-error' : 'text-tertiary'}`}>{formatCurrency(c.backlog)}</span> },
    ];

    const renderRow = (contract: EnrichedContract) => (
        <tr key={contract.id} className="group h-16 hover:bg-surface-container">
            {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant bg-inherit">{col.cell(contract)}</td>)}
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 bg-inherit">
                <div className="flex items-center justify-end space-x-3">
                    <button onClick={() => openModalForEdit(contract)} className="text-on-surface-variant hover:text-primary" title="Modifica"><span className="material-symbols-outlined">edit_note</span></button>
                    <button 
                        onClick={() => recalculateContractBacklog(contract.id!)} 
                        className="text-on-surface-variant hover:text-primary" 
                        title="Ricalcola Backlog"
                        disabled={isActionLoading(`recalculateBacklog-${contract.id}`)}
                    >
                        {isActionLoading(`recalculateBacklog-${contract.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">refresh</span>}
                    </button>
                    <button onClick={() => setContractToDelete(contract)} className="text-on-surface-variant hover:text-error" title="Elimina">
                        {isActionLoading(`deleteContract-${contract.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">delete</span>}
                    </button>
                </div>
            </td>
        </tr>
    );
    
    const renderCard = (contract: EnrichedContract) => (
        <div key={contract.id} className="bg-surface-container rounded-2xl shadow p-5 flex flex-col gap-4">
            {/* Card Header */}
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-lg text-on-surface">{contract.name}</p>
                    <p className="text-sm text-on-surface-variant">CIG: {contract.cig}</p>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                    <button onClick={() => openModalForEdit(contract)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high" title="Modifica"><span className="material-symbols-outlined">edit_note</span></button>
                     <button 
                        onClick={() => recalculateContractBacklog(contract.id!)} 
                        className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high"
                        title="Ricalcola Backlog"
                        disabled={isActionLoading(`recalculateBacklog-${contract.id}`)}
                    >
                        {isActionLoading(`recalculateBacklog-${contract.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">refresh</span>}
                    </button>
                    <button onClick={() => setContractToDelete(contract)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high" title="Elimina">
                        {isActionLoading(`deleteContract-${contract.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">delete</span>}
                    </button>
                </div>
            </div>

            {/* Card Body with main stats */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm border-t border-b border-outline-variant py-4">
                <div><p className="text-on-surface-variant">Capienza</p><p className="font-medium text-on-surface">{formatCurrency(contract.capienza)}</p></div>
                <div><p className="text-on-surface-variant">Backlog</p><p className={`font-semibold ${contract.backlog < 0 ? 'text-error' : 'text-tertiary'}`}>{formatCurrency(contract.backlog)}</p></div>
                <div className="col-span-2"><p className="text-on-surface-variant">Responsabili</p><p className="font-medium text-xs text-on-surface">{contract.managerNames.join(', ') || 'N/A'}</p></div>
            </div>
            
            {/* Associated Projects section */}
            <div>
                 <h4 className="font-semibold text-on-surface mb-2 text-sm">Progetti Associati ({contract.associatedProjects.length})</h4>
                 {contract.associatedProjects.length > 0 ? (
                    <ul className="space-y-1.5 max-h-32 overflow-y-auto text-xs pr-2">
                        {contract.associatedProjects.map(p => (
                            <li key={p.id} className="flex justify-between items-center text-on-surface-variant hover:text-on-surface">
                                <span>{p.name}</span>
                                <span className="font-mono">{formatCurrency(p.budget)}</span>
                            </li>
                        ))}
                    </ul>
                 ) : (
                    <p className="text-xs text-on-surface-variant italic">Nessun progetto associato.</p>
                 )}
            </div>
        </div>
    );

    const filtersNode = (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="form-input" placeholder="Cerca per nome..."/>
            <input type="text" name="cig" value={filters.cig} onChange={handleFilterChange} className="form-input" placeholder="Cerca per CIG..."/>
            <button onClick={resetFilters} className="px-4 py-2 bg-surface-container-high text-on-surface-variant rounded-full hover:bg-surface-container-highest w-full md:w-auto">Reset</button>
        </div>
    );

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-on-surface self-start">Gestione Contratti</h1>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex items-center space-x-1 bg-surface-container p-1 rounded-full">
                        <button onClick={() => setView('table')} className={`px-4 py-2 text-sm font-medium rounded-full ${view === 'table' ? 'bg-secondary-container text-on-secondary-container shadow' : 'text-on-surface-variant'}`}><span className="material-symbols-outlined align-middle">table_rows</span></button>
                        <button onClick={() => setView('card')} className={`px-4 py-2 text-sm font-medium rounded-full ${view === 'card' ? 'bg-secondary-container text-on-secondary-container shadow' : 'text-on-surface-variant'}`}><span className="material-symbols-outlined align-middle">grid_view</span></button>
                    </div>
                    <button onClick={openModalForNew} className="flex-grow md:flex-grow-0 px-4 py-2 bg-primary text-on-primary font-semibold rounded-full shadow-sm hover:opacity-90">Aggiungi Contratto</button>
                </div>
            </div>

            <div className="mb-6 p-4 bg-surface-container rounded-2xl shadow">
                {filtersNode}
            </div>

            {view === 'table' ? (
                 <DataTable<EnrichedContract>
                    title=""
                    addNewButtonLabel=""
                    data={dataForTable}
                    columns={columns}
                    filtersNode={<></>}
                    onAddNew={() => {}}
                    renderRow={renderRow}
                    renderMobileCard={renderCard}
                    initialSortKey="name"
                    isLoading={loading}
                    tableLayout={{
                        dense: true,
                        striped: true,
                        headerSticky: true,
                        headerBackground: true,
                        headerBorder: true,
                        width: 'fixed',
                    }}
                    tableClassNames={{
                        base: 'w-full text-sm',
                    }}
                />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
                    {dataForTable.length > 0 
                        ? dataForTable.map(renderCard) 
                        : <p className="col-span-full text-center py-8 text-on-surface-variant">Nessun contratto trovato con i filtri correnti.</p>}
                </div>
            )}
            
            {editingContract && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingContract ? 'Modifica Contratto' : 'Aggiungi Contratto'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Nome Contratto *</label>
                            <input type="text" name="name" value={editingContract.name} onChange={handleChange} required className="form-input"/>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium text-on-surface-variant mb-1">CIG *</label><input type="text" name="cig" value={editingContract.cig} onChange={handleChange} required className="form-input"/></div>
                            <div><label className="block text-sm font-medium text-on-surface-variant mb-1">CIG Derivato</label><input type="text" name="cigDerivato" value={editingContract.cigDerivato || ''} onChange={handleChange} className="form-input"/></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium text-on-surface-variant mb-1">Data Inizio</label><input type="date" name="startDate" value={editingContract.startDate || ''} onChange={handleChange} className="form-input"/></div>
                            <div><label className="block text-sm font-medium text-on-surface-variant mb-1">Data Fine</label><input type="date" name="endDate" value={editingContract.endDate || ''} onChange={handleChange} className="form-input"/></div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Capienza (€) *</label>
                            <input type="number" step="0.01" name="capienza" value={editingContract.capienza} onChange={handleChange} required className="form-input"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Progetti Associati</label>
                            <MultiSelectDropdown name="projectIds" selectedValues={relatedProjectIds} onChange={(_, v) => setRelatedProjectIds(v)} options={projectOptions} placeholder="Seleziona progetti"/>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Responsabili</label>
                            <MultiSelectDropdown name="managerIds" selectedValues={relatedManagerIds} onChange={(_, v) => setRelatedManagerIds(v)} options={resourceOptions} placeholder="Seleziona responsabili"/>
                        </div>

                        <div className="flex justify-end space-x-3 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary">Annulla</button>
                             <button type="submit" disabled={isActionLoading('addContract') || isActionLoading(`updateContract-${'id' in editingContract ? editingContract.id : ''}`)} className="flex justify-center items-center px-6 py-2 bg-primary text-on-primary rounded-full hover:opacity-90 disabled:opacity-50">
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
                    message={`Sei sicuro di voler eliminare il contratto "${contractToDelete.name}"? L'associazione con i progetti verrà rimossa, ma i progetti non verranno eliminati.`}
                    isConfirming={isActionLoading(`deleteContract-${contractToDelete.id}`)}
                />
            )}
             <style>{`.form-input, .form-select { display: block; width: 100%; border-radius: 0.5rem; border: 1px solid var(--color-outline); background-color: var(--color-surface-container-highest); padding: 0.75rem 1rem; font-size: 0.875rem; line-height: 1.25rem; color: var(--color-on-surface); } .form-input:focus, .form-select:focus { outline: none; border-color: var(--color-primary); ring: 2px solid var(--color-primary); }`}</style>
        </div>
    );
};