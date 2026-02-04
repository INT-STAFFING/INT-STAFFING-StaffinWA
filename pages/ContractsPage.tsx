
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Contract, BillingType } from '../types';
import { DataTable, ColumnDef } from '../components/DataTable';
import Modal from '../components/Modal';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import SearchableSelect from '../components/SearchableSelect';
import { SpinnerIcon } from '../components/icons';
import ConfirmationModal from '../components/ConfirmationModal';
import { formatCurrency } from '../utils/formatters';
import { formatDateFull } from '../utils/dateUtils';
import ExportButton from '../components/ExportButton';
import { useSearchParams } from 'react-router-dom';

// --- Types ---
type EnrichedContract = Contract & {
    projectCount: number;
    managerCount: number;
    projectNames: string[];
    managerNames: string[];
    rateCardName?: string;
};

// --- Helper Functions ---
const toISODate = (s?: string | null) => (!s ? '' : new Date(s.split('T')[0]).toISOString().split('T')[0]);
const buildContractPayload = (contract: Contract | Omit<Contract, 'id'>): Contract | Omit<Contract, 'id'> => {
    const basePayload: Omit<Contract, 'id'> = {
        name: contract.name,
        startDate: contract.startDate || null,
        endDate: contract.endDate || null,
        cig: contract.cig,
        cigDerivato: contract.cigDerivato || null,
        wbs: contract.wbs || null,
        capienza: contract.capienza,
        backlog: contract.backlog,
        rateCardId: contract.rateCardId || null,
        billingType: contract.billingType || 'TIME_MATERIAL'
    };

    if ('id' in contract) {
        return { id: contract.id, ...basePayload };
    }

    return basePayload;
};

// --- Component ---
export const ContractsPage: React.FC = () => {
    const {
        contracts, projects, resources, contractProjects, contractManagers, rateCards,
        addContract, updateContract, deleteContract, recalculateContractBacklog, isActionLoading, loading
    } = useEntitiesContext();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContract, setEditingContract] = useState<Contract | Omit<Contract, 'id'> | null>(null);
    const [associatedProjectIds, setAssociatedProjectIds] = useState<string[]>([]);
    const [associatedManagerIds, setAssociatedManagerIds] = useState<string[]>([]);
    const [contractToDelete, setContractToDelete] = useState<EnrichedContract | null>(null);
    const [filters, setFilters] = useState({ name: '', cig: '', wbs: '' });
    const [searchParams, setSearchParams] = useSearchParams();

    const emptyContract: Omit<Contract, 'id'> = {
        name: '',
        startDate: null,
        endDate: null,
        cig: '',
        cigDerivato: null,
        wbs: '',
        capienza: 0,
        backlog: 0,
        rateCardId: null,
        billingType: 'TIME_MATERIAL'
    };

    // Deep Linking
    useEffect(() => {
        const editId = searchParams.get('editId');
        if (editId && !isModalOpen && contracts.length > 0) {
            const target = contracts.find(c => c.id === editId);
            if (target) {
                // Must reconstruct enriched object for edit modal
                const enrichedTarget = dataForTable.find(c => c.id === editId);
                if (enrichedTarget) {
                    openModalForEdit(enrichedTarget);
                    setSearchParams({});
                }
            }
        }
    }, [searchParams, setSearchParams, contracts, isModalOpen]);

    // KPI Calculations
    const kpis = useMemo(() => {
        const totalContracts = contracts.length;
        // Ensure numeric values are parsed correctly to avoid string concatenation
        const totalCapienza = contracts.reduce((sum, c) => sum + Number(c.capienza || 0), 0);
        const totalBacklog = contracts.reduce((sum, c) => sum + Number(c.backlog || 0), 0);
        const backlogPercentage = totalCapienza > 0 ? (totalBacklog / totalCapienza) * 100 : 0;
    
        return { totalContracts, totalCapienza, totalBacklog, backlogPercentage };
    }, [contracts]);

    const dataForTable = useMemo<EnrichedContract[]>(() => {
        return contracts
            .filter(c =>
                c.name.toLowerCase().includes(filters.name.toLowerCase()) &&
                c.cig.toLowerCase().includes(filters.cig.toLowerCase()) &&
                (c.wbs || '').toLowerCase().includes(filters.wbs.toLowerCase())
            )
            .map(contract => {
                const pIds = contractProjects.filter(cp => cp.contractId === contract.id).map(cp => cp.projectId);
                const projectNames = pIds.map(pid => projects.find(p => p.id === pid)?.name || 'N/A');
                
                const mIds = contractManagers.filter(cm => cm.contractId === contract.id).map(cm => cm.resourceId);
                const managerNames = mIds.map(mid => resources.find(r => r.id === mid)?.name || 'N/A');
                
                const rc = rateCards.find(r => r.id === contract.rateCardId);

                return {
                    ...contract,
                    projectCount: pIds.length,
                    managerCount: mIds.length,
                    projectNames,
                    managerNames,
                    rateCardName: rc?.name
                };
            });
    }, [contracts, projects, resources, contractProjects, contractManagers, rateCards, filters]);

    const exportData = useMemo(() => {
        return dataForTable.map(c => ({
            'Nome Contratto': c.name,
            'CIG': c.cig,
            'CIG Derivato': c.cigDerivato || '',
            'WBS': c.wbs || '',
            'Tipo Fatturazione': c.billingType === 'FIXED_PRICE' ? 'Fixed Price' : 'Time & Material',
            'Capienza': formatCurrency(c.capienza),
            'Backlog': formatCurrency(c.backlog),
            'Listino': c.rateCardName || 'Standard',
            'Progetti Collegati': c.projectNames.join(', '),
            'Manager Responsabili': c.managerNames.join(', '),
            'Data Inizio': formatDateFull(c.startDate),
            'Data Fine': formatDateFull(c.endDate)
        }));
    }, [dataForTable]);
    
    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const resetFilters = () => {
        setFilters({ name: '', cig: '', wbs: '' });
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
        
        setEditingContract({ 
            ...contract, 
            startDate: toISODate(contract.startDate), 
            endDate: toISODate(contract.endDate),
            billingType: contract.billingType || 'TIME_MATERIAL'
        });
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
                const contractPayload = buildContractPayload(editingContract);
                if ('id' in contractPayload) {
                    await updateContract(contractPayload as Contract, associatedProjectIds, associatedManagerIds);
                } else {
                    await addContract(contractPayload as Omit<Contract, 'id'>, associatedProjectIds, associatedManagerIds);
                }
                handleCloseModal();
            } catch (err) {
                // error is handled by context
            }
        }
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        if (!editingContract) return;
        const { name, value } = e.target;
        const isNumeric = ['capienza'].includes(name);
        setEditingContract({ ...editingContract, [name]: isNumeric ? Number(value) : value });
    };

    const handleSelectChange = (name: string, value: string) => {
        if (editingContract) {
             // If empty string, set to null
             const val = value === '' ? null : value;
             setEditingContract({ ...editingContract, [name]: val });
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
    const rateCardOptions = useMemo(() => rateCards.map(r => ({ value: r.id!, label: r.name })), [rateCards]);

    const columns: ColumnDef<EnrichedContract>[] = [
        { header: 'Nome Contratto', sortKey: 'name', cell: c => (
            <div>
                <span className="font-medium block">{c.name}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.billingType === 'FIXED_PRICE' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-variant text-on-surface-variant'}`}>
                    {c.billingType === 'FIXED_PRICE' ? 'Fixed Price' : 'Time & Material'}
                </span>
            </div>
        ) },
        { header: 'CIG', sortKey: 'cig', cell: c => <span className="font-mono text-xs">{c.cig}</span> },
        { header: 'WBS', sortKey: 'wbs', cell: c => <span className="font-mono text-xs text-on-surface-variant">{c.wbs || '-'}</span> },
        { header: 'Listino', sortKey: 'rateCardName', cell: c => <span className="text-xs">{c.rateCardName || '-'}</span> },
        { header: 'Capienza', sortKey: 'capienza', cell: c => formatCurrency(c.capienza) },
        { header: 'Backlog', sortKey: 'backlog', cell: c => <span className={c.backlog < 0 ? 'text-error font-semibold' : ''}>{formatCurrency(c.backlog)}</span> },
        { header: 'Progetti Collegati', sortKey: 'projectCount', cell: c => c.projectCount },
        { header: 'Data Inizio', sortKey: 'startDate', cell: c => <span className="text-sm text-on-surface-variant">{formatDateFull(c.startDate)}</span> },
        { header: 'Data Fine', sortKey: 'endDate', cell: c => <span className="text-sm text-on-surface-variant">{formatDateFull(c.endDate)}</span> },
    ];

    const renderRow = (contract: EnrichedContract) => (
        <tr key={contract.id} className="group hover:bg-surface-container">
            {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 bg-inherit">{col.cell(contract)}</td>)}
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium bg-inherit">
                <div className="flex items-center justify-end space-x-3">
                    <button onClick={() => recalculateContractBacklog(contract.id!)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors" title="Ricalcola Backlog" disabled={isActionLoading(`recalculateBacklog-${contract.id}`)}>
                        {isActionLoading(`recalculateBacklog-${contract.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">refresh</span>}
                    </button>
                    <button onClick={() => openModalForEdit(contract)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors" title="Modifica"><span className="material-symbols-outlined">edit</span></button>
                    <button onClick={() => setContractToDelete(contract)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-error transition-colors" title="Elimina">
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
                    <p className="text-sm text-on-surface-variant font-mono">{contract.cig} {contract.wbs ? `/ ${contract.wbs}` : ''}</p>
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
            <div className="mt-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${contract.billingType === 'FIXED_PRICE' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-variant text-on-surface-variant'}`}>
                    {contract.billingType === 'FIXED_PRICE' ? 'Fixed Price' : 'Time & Material'}
                </span>
            </div>
            <div className="mt-4 pt-4 border-t border-outline-variant grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-on-surface-variant">Capienza</p><p className="font-medium text-on-surface">{formatCurrency(contract.capienza)}</p></div>
                <div><p className="text-on-surface-variant">Backlog</p><p className={`font-medium ${contract.backlog < 0 ? 'text-error' : 'text-on-surface'}`}>{formatCurrency(contract.backlog)}</p></div>
                <div className="col-span-2"><p className="text-on-surface-variant">Listino</p><p className="font-medium text-on-surface">{contract.rateCardName || 'Standard'}</p></div>
                <div className="col-span-2"><p className="text-on-surface-variant">Periodo</p><p className="font-medium text-on-surface">{formatDateFull(contract.startDate)} - {formatDateFull(contract.endDate)}</p></div>
            </div>
        </div>
    );

    const filtersNode = (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per nome..."/>
            <input type="text" name="cig" value={filters.cig} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per CIG..."/>
            <input type="text" name="wbs" value={filters.wbs} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per WBS..."/>
            <button onClick={resetFilters} className="px-6 py-2 bg-secondary-container text-on-secondary-container rounded-full hover:opacity-90 w-full">Reset</button>
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
                headerActions={<ExportButton data={exportData} title="Gestione Contratti" />}
                initialSortKey="name"
                isLoading={loading}
                tableLayout={{ dense: true, striped: true, headerSticky: true, headerBackground: true, headerBorder: true }}
                tableClassNames={{ base: 'w-full text-sm' }}
                numActions={3} // RICALCOLA, MODIFICA, ELIMINA
            />

            {editingContract && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingContract ? 'Modifica Contratto' : 'Aggiungi Contratto'}>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        
                        {/* Sezione Identità Contratto */}
                        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                            <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">description</span> Definizione Contratto
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Nome Contratto *</label>
                                    <input type="text" name="name" value={editingContract.name} onChange={handleChange} required className="form-input" placeholder="es. Accordo Quadro 2024" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-on-surface-variant mb-1">CIG *</label>
                                        <input type="text" name="cig" value={editingContract.cig} onChange={handleChange} required className="form-input" placeholder="Codice CIG" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-on-surface-variant mb-1">CIG Derivato</label>
                                        <input type="text" name="cigDerivato" value={editingContract.cigDerivato || ''} onChange={handleChange} className="form-input" placeholder="Opzionale" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-on-surface-variant mb-1">WBS</label>
                                        <input type="text" name="wbs" value={editingContract.wbs || ''} onChange={handleChange} className="form-input" placeholder="Opzionale" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sezione Economica e Temporale */}
                        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                            <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">payments</span> Parametri Economici & Tempi
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Capienza (€) *</label>
                                    <input type="number" name="capienza" value={editingContract.capienza} onChange={handleChange} required className="form-input" step="0.01" />
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-on-surface-variant mb-1">Listino Vendita (Rate Card)</label>
                                        <SearchableSelect 
                                            name="rateCardId" 
                                            value={editingContract.rateCardId || ''} 
                                            onChange={handleSelectChange} 
                                            options={rateCardOptions} 
                                            placeholder="Seleziona listino (opzionale)" 
                                        />
                                        <p className="text-[10px] text-on-surface-variant mt-1">Se non selezionato, usa costo standard.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-on-surface-variant mb-1">Tipo Fatturazione</label>
                                        <select 
                                            name="billingType" 
                                            value={editingContract.billingType || 'TIME_MATERIAL'} 
                                            onChange={handleChange} 
                                            className="form-select"
                                        >
                                            <option value="TIME_MATERIAL">Time & Material</option>
                                            <option value="FIXED_PRICE">Fixed Price (A Corpo)</option>
                                        </select>
                                        <p className="text-[10px] text-on-surface-variant mt-1">Questa impostazione sarà ereditata dai progetti associati.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-on-surface-variant mb-1">Data Inizio</label>
                                        <input type="date" name="startDate" value={editingContract.startDate || ''} onChange={handleChange} className="form-input"/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-on-surface-variant mb-1">Data Fine</label>
                                        <input type="date" name="endDate" value={editingContract.endDate || ''} onChange={handleChange} className="form-input"/>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sezione Associazioni */}
                        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                            <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">group_add</span> Associazioni & Team
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Progetti Collegati</label>
                                    <MultiSelectDropdown name="projects" selectedValues={associatedProjectIds} onChange={(_, values) => setAssociatedProjectIds(values)} options={projectOptions} placeholder="Seleziona progetti..." />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Manager Responsabili</label>
                                    <MultiSelectDropdown name="managers" selectedValues={associatedManagerIds} onChange={(_, values) => setAssociatedManagerIds(values)} options={resourceOptions} placeholder="Seleziona manager..." />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 pt-4 border-t border-outline-variant mt-4">
                            <button type="button" onClick={handleCloseModal} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold transition-colors">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addContract') || isActionLoading(`updateContract-${'id' in editingContract ? editingContract.id : ''}`)} className="flex justify-center items-center px-6 py-2 bg-primary text-on-primary rounded-full disabled:opacity-50 font-semibold hover:opacity-90 shadow-sm transition-all">
                                {(isActionLoading('addContract') || isActionLoading(`updateContract-${'id' in editingContract ? editingContract.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva Contratto'}
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
                    title="Elimina Contratto"
                    message={`Sei sicuro di voler eliminare il contratto ${contractToDelete.name}? Questa azione non eliminerà i progetti associati, ma rimuoverà il loro collegamento finanziario.`}
                    isConfirming={isActionLoading(`deleteContract-${contractToDelete.id}`)}
                />
            )}
        </div>
    );
};

export default ContractsPage;
