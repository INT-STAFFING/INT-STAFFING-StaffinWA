
import React, { useState, useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { ResourceRequest, ResourceRequestStatus } from '../types';
import { DataTable, ColumnDef } from '../components/DataTable';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { SpinnerIcon } from '../components/icons';
import ConfirmationModal from '../components/ConfirmationModal';
import { formatDateFull } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';

// --- Types ---
type EnrichedRequest = ResourceRequest & {
    projectName: string;
    roleName: string;
    requestorName: string | null;
};

const getStatusBadgeClass = (status: ResourceRequestStatus): string => {
    switch (status) {
        case 'ATTIVA': return 'bg-tertiary-container text-on-tertiary-container';
        case 'STANDBY': return 'bg-yellow-container text-on-yellow-container';
        case 'CHIUSA': return 'bg-surface-variant text-on-surface-variant';
        default: return 'bg-surface-variant text-on-surface-variant';
    }
};

export const ResourceRequestPage: React.FC = () => {
    const { 
        resourceRequests, projects, roles, resources, 
        addResourceRequest, updateResourceRequest, deleteResourceRequest, isActionLoading, loading
    } = useEntitiesContext();
    const { addToast } = useToast();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRequest, setEditingRequest] = useState<ResourceRequest | Omit<ResourceRequest, 'id'> | null>(null);
    const [requestToDelete, setRequestToDelete] = useState<EnrichedRequest | null>(null);
    const [filters, setFilters] = useState({ projectId: '', roleId: '', status: '', requestorId: '' });
    const [view, setView] = useState<'table' | 'card'>('table');

    const emptyRequest: Omit<ResourceRequest, 'id'> = {
        projectId: '',
        roleId: '',
        requestorId: null,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
        commitmentPercentage: 100,
        isUrgent: false,
        isLongTerm: false,
        isTechRequest: false,
        isOsrOpen: false,
        osrNumber: '',
        notes: '',
        status: 'ATTIVA',
    };

    const dataForTable = useMemo<EnrichedRequest[]>(() => {
        return resourceRequests
            .filter(req => 
                (!filters.projectId || req.projectId === filters.projectId) &&
                (!filters.roleId || req.roleId === filters.roleId) &&
                (!filters.status || req.status === filters.status) &&
                (!filters.requestorId || req.requestorId === filters.requestorId)
            )
            .map(req => ({
                ...req,
                projectName: projects.find(p => p.id === req.projectId)?.name || 'N/A',
                roleName: roles.find(r => r.id === req.roleId)?.name || 'N/A',
                requestorName: resources.find(r => r.id === req.requestorId)?.name || null,
            }));
    }, [resourceRequests, projects, roles, resources, filters]);

     const summaryData = useMemo(() => {
        const fteByRole: { [roleName: string]: number } = {};
        const requestsByProject: { [projectName: string]: { roleName: string; commitmentPercentage: number }[] } = {};

        // Escludi le richieste in standby da entrambi i riepiloghi
        const relevantRequests = dataForTable.filter(req => req.status !== 'STANDBY');

        relevantRequests.forEach(req => {
            // Calcolo FTE per ruolo
            if (!fteByRole[req.roleName]) {
                fteByRole[req.roleName] = 0;
            }
            fteByRole[req.roleName] += req.commitmentPercentage / 100;

            // Raggruppamento per progetto
            if (!requestsByProject[req.projectName]) {
                requestsByProject[req.projectName] = [];
            }
            requestsByProject[req.projectName].push({
                roleName: req.roleName,
                commitmentPercentage: req.commitmentPercentage,
            });
        });

        const fteArray = Object.entries(fteByRole)
            .map(([roleName, fte]) => ({ roleName, fte }))
            .sort((a, b) => b.fte - a.fte);

        const projectArray = Object.entries(requestsByProject)
            .map(([projectName, requests]) => ({ projectName, requests }))
            .sort((a, b) => a.projectName.localeCompare(b.projectName));

        return { fteArray, projectArray };
    }, [dataForTable]);


    const handleFilterChange = (name: string, value: string) => {
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const resetFilters = () => {
        setFilters({ projectId: '', roleId: '', status: '', requestorId: '' });
    };

    const openModalForNew = () => {
        setEditingRequest(emptyRequest);
        setIsModalOpen(true);
    };

    const openModalForEdit = (request: ResourceRequest) => {
        const formattedRequest = {
            ...request,
            startDate: request.startDate ? request.startDate.split('T')[0] : '',
            endDate: request.endDate ? request.endDate.split('T')[0] : '',
        };
        setEditingRequest(formattedRequest);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingRequest(null);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingRequest) {
            
            // Validazione manuale dei campi obbligatori (dato che i required su input hidden non sempre bloccano il submit)
            if (!editingRequest.projectId || !editingRequest.roleId) {
                addToast('Compila tutti i campi obbligatori (Progetto, Ruolo).', 'error');
                return;
            }

            // Calculate isLongTerm
            const startDate = new Date(editingRequest.startDate);
            const endDate = new Date(editingRequest.endDate);
            const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            // Clean up OSR number if flag is false
            const osrNumber = editingRequest.isOsrOpen ? editingRequest.osrNumber : null;

            const requestToSave = { 
                ...editingRequest, 
                isLongTerm: diffDays > 60,
                osrNumber 
            };

            try {
                if ('id' in requestToSave) {
                    await updateResourceRequest(requestToSave as ResourceRequest);
                    addToast('Richiesta aggiornata con successo.', 'success');
                } else {
                    await addResourceRequest(requestToSave as Omit<ResourceRequest, 'id'>);
                    addToast('Richiesta creata con successo.', 'success');
                }
                handleCloseModal();
            } catch (err) {
                console.error(err);
                addToast('Errore durante il salvataggio della richiesta.', 'error');
            }
        }
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        if (!editingRequest) return;
        const { name, value, type } = e.target;
        
        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setEditingRequest({ ...editingRequest, [name]: checked });
        } else {
            setEditingRequest({ ...editingRequest, [name]: name === 'commitmentPercentage' ? Number(value) : value });
        }
    };

    const handleSelectChange = (name: string, value: string) => {
        if (editingRequest) {
            setEditingRequest({ ...editingRequest, [name]: value });
        }
    };

    const handleDelete = async () => {
        if (requestToDelete) {
            try {
                await deleteResourceRequest(requestToDelete.id!);
                addToast('Richiesta eliminata con successo.', 'success');
                setRequestToDelete(null);
            } catch (e) {
                addToast('Errore durante l\'eliminazione.', 'error');
            }
        }
    };

    const projectOptions = useMemo(() => projects.map(p => ({ value: p.id!, label: p.name })), [projects]);
    const roleOptions = useMemo(() => roles.map(r => ({ value: r.id!, label: r.name })), [roles]);
    const resourceOptions = useMemo(() => resources.map(r => ({ value: r.id!, label: r.name })), [resources]);
    const statusOptions: { value: ResourceRequestStatus, label: string }[] = [
        { value: 'ATTIVA', label: 'Attiva' },
        { value: 'STANDBY', label: 'Standby' },
        { value: 'CHIUSA', label: 'Chiusa' },
    ];

    const columns: ColumnDef<EnrichedRequest>[] = [
        { header: 'ID Richiesta', sortKey: 'requestCode', cell: r => <span className="font-mono text-xs font-semibold">{r.requestCode}</span> },
        { header: 'Progetto', sortKey: 'projectName', cell: r => <span className="font-medium text-on-surface">{r.projectName}</span> },
        { header: 'Ruolo Richiesto', sortKey: 'roleName', cell: r => r.roleName },
        { header: 'Richiedente', sortKey: 'requestorName', cell: r => r.requestorName || 'N/A' },
        { header: 'Periodo', sortKey: 'startDate', cell: r => `${formatDateFull(r.startDate)} - ${formatDateFull(r.endDate)}` },
        { header: 'Impegno', sortKey: 'commitmentPercentage', cell: r => `${r.commitmentPercentage}%` },
        { header: 'Stato', sortKey: 'status', cell: r => <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(r.status)}`}>{r.status}</span> },
        { header: 'OSR', cell: r => r.isOsrOpen ? <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary-container text-on-primary-container" title={`OSR: ${r.osrNumber || 'N/D'}`}>OSR {r.osrNumber}</span> : '-' },
    ];

    const renderRow = (request: EnrichedRequest) => (
        <tr key={request.id} className="group hover:bg-surface-container">
            {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant bg-inherit">{col.cell(request)}</td>)}
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium bg-inherit">
                <div className="flex items-center justify-end space-x-2">
                    <button onClick={() => openModalForEdit(request)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary" title="Modifica"><span className="material-symbols-outlined">edit</span></button>
                    <button onClick={() => setRequestToDelete(request)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-error" title="Elimina">
                        {isActionLoading(`deleteResourceRequest-${request.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">delete</span>}
                    </button>
                </div>
            </td>
        </tr>
    );
    
    const renderCard = (request: EnrichedRequest) => (
        <div key={request.id} className="p-4 rounded-2xl shadow-md bg-surface-container-low flex flex-col md:flex-row gap-4 justify-between border-l-4 border-primary">
            <div className="flex-grow">
                <div className="flex items-baseline gap-3">
                    <p className="font-bold text-lg text-on-surface">{request.projectName}</p>
                    <span className="font-mono text-sm text-on-surface-variant">{request.requestCode}</span>
                </div>
                <p className="text-sm text-on-surface-variant">{request.roleName}</p>
                <div className="mt-4 pt-4 border-t border-outline-variant grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div><p className="text-on-surface-variant">Periodo</p><p className="font-medium text-on-surface">{formatDateFull(request.startDate)} - {formatDateFull(request.endDate)}</p></div>
                    <div><p className="text-on-surface-variant">Impegno</p><p className="font-medium text-on-surface">{request.commitmentPercentage}%</p></div>
                    <div className="col-span-2"><p className="text-on-surface-variant">Richiedente</p><p className="font-medium text-on-surface">{request.requestorName || 'N/A'}</p></div>
                    {request.isOsrOpen && (
                        <div className="col-span-2 mt-2">
                            <span className="px-2 py-1 rounded text-xs font-semibold bg-primary-container text-on-primary-container">
                                OSR Aperta: {request.osrNumber || 'N/D'}
                            </span>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex flex-col items-start md:items-end justify-between flex-shrink-0 md:pl-4 md:border-l border-outline-variant md:w-48">
                <div className="flex flex-col md:items-end gap-2 w-full">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(request.status)}`}>{request.status}</span>
                    <div className="flex gap-2 mt-1 flex-wrap justify-end">
                        {request.isUrgent && <span className="px-2 py-0.5 text-xs font-semibold text-on-error-container bg-error-container rounded-full">URGENTE</span>}
                        {request.isTechRequest && <span className="px-2 py-0.5 text-xs font-semibold text-on-secondary-container bg-secondary-container rounded-full">TECH</span>}
                    </div>
                </div>
                <div className="flex items-center space-x-2 mt-4 md:mt-0 self-end">
                    <button onClick={() => openModalForEdit(request)} className="p-2 text-on-surface-variant hover:text-primary rounded-full hover:bg-surface-container" title="Modifica"><span className="material-symbols-outlined">edit</span></button>
                    <button onClick={() => setRequestToDelete(request)} className="p-2 text-on-surface-variant hover:text-error rounded-full hover:bg-surface-container" title="Elimina">
                         {isActionLoading(`deleteResourceRequest-${request.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">delete</span>}
                    </button>
                </div>
            </div>
        </div>
    );
    

    const filtersNode = (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <SearchableSelect name="projectId" value={filters.projectId} onChange={handleFilterChange} options={projectOptions} placeholder="Tutti i Progetti"/>
            <SearchableSelect name="roleId" value={filters.roleId} onChange={handleFilterChange} options={roleOptions} placeholder="Tutti i Ruoli"/>
            <SearchableSelect name="requestorId" value={filters.requestorId} onChange={handleFilterChange} options={resourceOptions} placeholder="Tutti i Richiedenti"/>
            <SearchableSelect name="status" value={filters.status} onChange={handleFilterChange} options={statusOptions.map(s => ({ value: s.value, label: s.label }))} placeholder="Tutti gli Stati"/>
            <button onClick={resetFilters} className="px-6 py-2 bg-secondary-container text-on-secondary-container font-semibold rounded-full hover:opacity-90 w-full md:w-auto">Reset</button>
        </div>
    );
    
    return (
        <div>
             <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                 <div className="flex items-center gap-4 w-full md:w-auto">
                     <div className="flex items-center space-x-1 bg-surface-container p-1 rounded-full">
                        <button onClick={() => setView('table')} className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${view === 'table' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}>Tabella</button>
                        <button onClick={() => setView('card')} className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${view === 'card' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}>Card</button>
                    </div>
                </div>
            </div>
            

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-surface-container-low rounded-2xl shadow p-6 border-l-4 border-primary">
                    <h2 className="text-lg font-semibold text-on-surface mb-4">Riepilogo Risorse Richieste (FTE)</h2>
                    {summaryData.fteArray.length > 0 ? (
                        <ul className="space-y-2 max-h-48 overflow-y-auto">
                            {summaryData.fteArray.map(({ roleName, fte }) => (
                                <li key={roleName} className="flex justify-between items-center text-sm">
                                    <span className="text-on-surface-variant">{roleName}</span>
                                    <span className="font-bold text-primary">{fte.toFixed(2)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-on-surface-variant">Nessun dato da aggregare in base ai filtri correnti.</p>
                    )}
                </div>

                <div className="bg-surface-container-low rounded-2xl shadow p-6 border-l-4 border-secondary">
                    <h2 className="text-lg font-semibold text-on-surface mb-4">Dettaglio Richieste per Progetto</h2>
                     {summaryData.projectArray.length > 0 ? (
                        <div className="space-y-4 max-h-48 overflow-y-auto">
                            {summaryData.projectArray.map(({ projectName, requests }) => (
                                <div key={projectName}>
                                    <h3 className="font-semibold text-on-surface text-sm">{projectName}</h3>
                                    <ul className="list-disc list-inside pl-2 mt-1 space-y-1">
                                        {requests.map((req, index) => (
                                            <li key={index} className="text-sm text-on-surface-variant">
                                                {req.roleName} <span className="font-medium text-on-surface">({req.commitmentPercentage}%)</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    ) : (
                         <p className="text-sm text-on-surface-variant">Nessun dato da aggregare in base ai filtri correnti.</p>
                    )}
                </div>
            </div>


            {view === 'table' ? (
                   
                    <div
                        className="
                            overflow-y-auto  // scroll verticale SOLO sul contenuto della tabella
                            overflow-x-auto  // scroll orizzontale quando necessario
                        "
                    >
                        <DataTable<EnrichedRequest>
                            title="Richiesta Risorse"
                            addNewButtonLabel="Nuova Richiesta"
                            data={dataForTable}
                            columns={columns}
                            filtersNode={filtersNode}
                            onAddNew={openModalForNew}
                            renderRow={renderRow}
                            renderMobileCard={renderCard}
                            initialSortKey="startDate"
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
                            numActions={2} // MODIFICA, ELIMINA
                        />
                    </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                    {dataForTable.length > 0 ? (
                        dataForTable.map(renderCard)
                    ) : (
                        <p className="col-span-full text-center py-8 text-on-surface-variant">Nessuna richiesta trovata.</p>
                    )}
                </div>
            )}

            {/* Modals */}
            {editingRequest && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingRequest ? 'Modifica Richiesta' : 'Nuova Richiesta'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Progetto *</label>
                                <SearchableSelect name="projectId" value={editingRequest.projectId} onChange={handleSelectChange} options={projectOptions} placeholder="Seleziona progetto..." required/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Ruolo Richiesto *</label>
                                <SearchableSelect name="roleId" value={editingRequest.roleId} onChange={handleSelectChange} options={roleOptions} placeholder="Seleziona ruolo..." required/>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Richiedente (Opzionale)</label>
                            <SearchableSelect name="requestorId" value={editingRequest.requestorId || ''} onChange={handleSelectChange} options={resourceOptions} placeholder="Seleziona richiedente..." />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium mb-1">Data Inizio *</label><input type="date" name="startDate" value={editingRequest.startDate} onChange={handleChange} required className="form-input"/></div>
                            <div><label className="block text-sm font-medium mb-1">Data Fine *</label><input type="date" name="endDate" value={editingRequest.endDate} onChange={handleChange} required className="form-input"/></div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Impegno % ({editingRequest.commitmentPercentage}%)</label>
                            <input type="range" min="0" max="100" step="10" name="commitmentPercentage" value={editingRequest.commitmentPercentage} onChange={handleChange} className="w-full"/>
                        </div>
                        
                        {/* OSR Fields */}
                        <div className="bg-surface-container-low p-3 rounded border border-outline-variant">
                            <div className="flex items-center gap-2 mb-2">
                                <input type="checkbox" name="isOsrOpen" checked={editingRequest.isOsrOpen || false} onChange={handleChange} className="form-checkbox"/>
                                <label className="text-sm font-semibold">OSR Aperta</label>
                            </div>
                            {editingRequest.isOsrOpen && (
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-on-surface-variant">Numero OSR</label>
                                    <input 
                                        type="text" 
                                        name="osrNumber" 
                                        value={editingRequest.osrNumber || ''} 
                                        onChange={handleChange} 
                                        className="form-input text-sm py-1"
                                        placeholder="Inserisci numero OSR..."
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <div className="flex items-center gap-2">
                                <input type="checkbox" name="isUrgent" checked={editingRequest.isUrgent} onChange={handleChange} className="form-checkbox"/>
                                <label className="text-sm">Urgente</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" name="isTechRequest" checked={editingRequest.isTechRequest} onChange={handleChange} className="form-checkbox"/>
                                <label className="text-sm">Richiesta TECH</label>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Stato</label>
                            <select name="status" value={editingRequest.status} onChange={handleChange} className="form-select">
                                {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Note</label>
                            <textarea name="notes" value={editingRequest.notes || ''} onChange={handleChange} className="form-textarea" rows={3}></textarea>
                        </div>
                        <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 border border-outline rounded-full text-primary font-semibold">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addResourceRequest') || isActionLoading(`updateResourceRequest-${'id' in editingRequest ? editingRequest.id : ''}`)} className="px-4 py-2 bg-primary text-on-primary rounded-full font-semibold disabled:opacity-50">
                                {isActionLoading('addResourceRequest') || isActionLoading(`updateResourceRequest-${'id' in editingRequest ? editingRequest.id : ''}`) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {requestToDelete && (
                <ConfirmationModal
                    isOpen={!!requestToDelete}
                    onClose={() => setRequestToDelete(null)}
                    onConfirm={handleDelete}
                    title="Elimina Richiesta"
                    message="Sei sicuro di voler eliminare questa richiesta? L'azione è irreversibile."
                    isConfirming={isActionLoading(`deleteResourceRequest-${requestToDelete.id}`)}
                />
            )}
        </div>
    );
};
