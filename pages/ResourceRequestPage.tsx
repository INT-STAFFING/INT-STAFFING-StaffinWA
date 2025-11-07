import React, { useState, useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { ResourceRequest, ResourceRequestStatus } from '../types';
import { DataTable, ColumnDef } from '../components/DataTable';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { SpinnerIcon } from '../components/icons';
import ConfirmationModal from '../components/ConfirmationModal';

// --- Types ---
type EnrichedRequest = ResourceRequest & {
    projectName: string;
    roleName: string;
    requestorName: string | null;
};

// --- Helper Functions ---
const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    // Le date dal DB possono avere l'orario, lo togliamo per sicurezza
    const date = new Date(dateStr.split('T')[0]);
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}


const getStatusBadgeClass = (status: ResourceRequestStatus): string => {
    switch (status) {
        case 'ATTIVA': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
        case 'STANDBY': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
        case 'CHIUSA': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
};

// FIX: Changed to a named export.
export const ResourceRequestPage: React.FC = () => {
    const { 
        resourceRequests, projects, roles, resources, 
        addResourceRequest, updateResourceRequest, deleteResourceRequest, isActionLoading 
    } = useEntitiesContext();

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
        // Fix: Format dates to YYYY-MM-DD for the date input
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
            // Calculate isLongTerm
            const startDate = new Date(editingRequest.startDate);
            const endDate = new Date(editingRequest.endDate);
            const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const requestToSave = { ...editingRequest, isLongTerm: diffDays > 60 };

            try {
                if ('id' in requestToSave) {
                    await updateResourceRequest(requestToSave as ResourceRequest);
                } else {
                    await addResourceRequest(requestToSave as Omit<ResourceRequest, 'id'>);
                }
                handleCloseModal();
            } catch (err) {
                // error is handled by context
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
            await deleteResourceRequest(requestToDelete.id!);
            setRequestToDelete(null);
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
        { header: 'Progetto', sortKey: 'projectName', cell: r => <span className="font-medium text-gray-900 dark:text-white">{r.projectName}</span> },
        { header: 'Ruolo Richiesto', sortKey: 'roleName', cell: r => r.roleName },
        { header: 'Richiedente', sortKey: 'requestorName', cell: r => r.requestorName || 'N/A' },
        { header: 'Periodo', sortKey: 'startDate', cell: r => `${formatDate(r.startDate)} - ${formatDate(r.endDate)}` },
        { header: 'Impegno', sortKey: 'commitmentPercentage', cell: r => `${r.commitmentPercentage}%` },
        { header: 'Stato', sortKey: 'status', cell: r => <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(r.status)}`}>{r.status}</span> },
        { header: 'Urgenza', sortKey: 'isUrgent', cell: r => r.isUrgent ? <span className="text-red-500 font-bold">Sì</span> : 'No' },
    ];

    const renderRow = (request: EnrichedRequest) => (
        <tr key={request.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
            {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{col.cell(request)}</td>)}
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end space-x-3">
                    <button onClick={() => openModalForEdit(request)} className="text-gray-500 hover:text-blue-600" title="Modifica"><span className="text-xl">✏️</span></button>
                    <button onClick={() => setRequestToDelete(request)} className="text-gray-500 hover:text-red-600" title="Elimina">
                        {isActionLoading(`deleteResourceRequest-${request.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="text-xl">🗑️</span>}
                    </button>
                </div>
            </td>
        </tr>
    );
    
    // Vista Card per mobile e per la nuova visualizzazione a card
    const renderCard = (request: EnrichedRequest) => (
        <div key={request.id} className="p-4 rounded-lg shadow-md bg-card dark:bg-dark-card flex flex-col md:flex-row gap-4 justify-between">
            <div className="flex-grow">
                <div className="flex items-baseline gap-3">
                    <p className="font-bold text-lg text-foreground dark:text-dark-foreground">{request.projectName}</p>
                    <span className="font-mono text-sm text-muted-foreground">{request.requestCode}</span>
                </div>
                <p className="text-sm text-muted-foreground">{request.roleName}</p>
                <div className="mt-4 pt-4 border-t border-border dark:border-dark-border grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div><p className="text-muted-foreground">Periodo</p><p className="font-medium text-foreground dark:text-dark-foreground">{formatDate(request.startDate)} - {formatDate(request.endDate)}</p></div>
                    <div><p className="text-muted-foreground">Impegno</p><p className="font-medium text-foreground dark:text-dark-foreground">{request.commitmentPercentage}%</p></div>
                    <div className="col-span-2"><p className="text-muted-foreground">Richiedente</p><p className="font-medium text-foreground dark:text-dark-foreground">{request.requestorName || 'N/A'}</p></div>
                </div>
            </div>
            <div className="flex flex-col items-start md:items-end justify-between flex-shrink-0 md:pl-4 md:border-l border-border dark:border-dark-border md:w-48">
                <div className="flex flex-col md:items-end gap-2 w-full">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(request.status)}`}>{request.status}</span>
                    <div className="flex gap-2 mt-1">
                        {request.isUrgent && <span className="px-2 py-0.5 text-xs font-semibold text-red-800 bg-red-100 dark:text-red-100 dark:bg-red-800 rounded-full">URGENTE</span>}
                        {request.isTechRequest && <span className="px-2 py-0.5 text-xs font-semibold text-purple-800 bg-purple-100 dark:text-purple-100 dark:bg-purple-800 rounded-full">TECH</span>}
                    </div>
                </div>
                <div className="flex items-center space-x-2 mt-4 md:mt-0 self-end">
                    <button onClick={() => openModalForEdit(request)} className="p-2 text-muted-foreground hover:text-primary rounded-full hover:bg-muted dark:hover:bg-dark-muted" title="Modifica"><span className="text-xl">✏️</span></button>
                    <button onClick={() => setRequestToDelete(request)} className="p-2 text-muted-foreground hover:text-destructive rounded-full hover:bg-muted dark:hover:bg-dark-muted" title="Elimina">
                         {isActionLoading(`deleteResourceRequest-${request.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="text-xl">🗑️</span>}
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
            <button onClick={resetFilters} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full md:w-auto">Reset</button>
        </div>
    );
    
    return (
        <div>
             <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-foreground dark:text-dark-foreground self-start">Richieste Risorse</h1>
                 <div className="flex items-center gap-4 w-full md:w-auto">
                     <div className="flex items-center space-x-1 bg-gray-200 dark:bg-gray-700 p-1 rounded-md">
                        <button onClick={() => setView('table')} className={`px-3 py-1 text-sm font-medium rounded-md capitalize ${view === 'table' ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow' : 'text-gray-600 dark:text-gray-300'}`}>Tabella</button>
                        <button onClick={() => setView('card')} className={`px-3 py-1 text-sm font-medium rounded-md capitalize ${view === 'card' ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow' : 'text-gray-600 dark:text-gray-300'}`}>Card</button>
                    </div>
                    <button onClick={openModalForNew} className="flex-grow md:flex-grow-0 px-4 py-2 bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-darker">Nuova Richiesta</button>
                </div>
            </div>
            
             <div className="mb-6 p-4 bg-card dark:bg-dark-card rounded-lg shadow">
                {filtersNode}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-card dark:bg-dark-card rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-foreground dark:text-dark-foreground mb-4">Riepilogo Risorse Richieste (FTE)</h2>
                    {summaryData.fteArray.length > 0 ? (
                        <ul className="space-y-2 max-h-48 overflow-y-auto">
                            {summaryData.fteArray.map(({ roleName, fte }) => (
                                <li key={roleName} className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">{roleName}</span>
                                    <span className="font-bold text-primary">{fte.toFixed(2)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground">Nessun dato da aggregare in base ai filtri correnti.</p>
                    )}
                </div>

                <div className="bg-card dark:bg-dark-card rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-foreground dark:text-dark-foreground mb-4">Dettaglio Richieste per Progetto</h2>
                     {summaryData.projectArray.length > 0 ? (
                        <div className="space-y-4 max-h-48 overflow-y-auto">
                            {summaryData.projectArray.map(({ projectName, requests }) => (
                                <div key={projectName}>
                                    <h3 className="font-semibold text-foreground dark:text-dark-foreground text-sm">{projectName}</h3>
                                    <ul className="list-disc list-inside pl-2 mt-1 space-y-1">
                                        {requests.map((req, index) => (
                                            <li key={index} className="text-sm text-muted-foreground">
                                                {req.roleName} <span className="font-medium text-foreground dark:text-dark-foreground">({req.commitmentPercentage}%)</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    ) : (
                         <p className="text-sm text-muted-foreground">Nessun dato da aggregare in base ai filtri correnti.</p>
                    )}
                </div>
            </div>

            {view === 'table' ? (
                <div className="bg-card dark:bg-dark-card rounded-lg shadow">
                   
                    <div
                        className="
                            max-h-[640px]    // ≈ 20 righe se la riga è ~32px (h-8)
                            overflow-y-auto  // scroll verticale SOLO sul contenuto della tabella
                            overflow-x-auto  // scroll orizzontale quando necessario
                        "
                    >
                        <DataTable<EnrichedRequest>
                            title=""
                            addNewButtonLabel=""
                            data={dataForTable}
                            columns={columns}
                            filtersNode={<></>}
                            onAddNew={() => {}}
                            renderRow={renderRow}
                            renderMobileCard={renderCard}
                            initialSortKey="startDate"
                        />
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                    {dataForTable.length > 0 ? (
                        dataForTable.map(renderCard)
                    ) : (
                        <p className="col-span-full text-center py-8 text-muted-foreground">
                            Nessuna richiesta trovata.
                        </p>
                    )}
                </div>
            )}



            {editingRequest && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingRequest ? 'Modifica Richiesta' : 'Nuova Richiesta'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {'id' in editingRequest && editingRequest.id && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ID Richiesta</label>
                                <input type="text" value={(editingRequest as ResourceRequest).requestCode || ''} readOnly disabled className="form-input bg-gray-100 dark:bg-gray-700"/>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Progetto *</label>
                                <SearchableSelect name="projectId" value={editingRequest.projectId} onChange={handleSelectChange} options={projectOptions} required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ruolo Richiesto *</label>
                                <SearchableSelect name="roleId" value={editingRequest.roleId} onChange={handleSelectChange} options={roleOptions} required />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Richiedente</label>
                            <SearchableSelect name="requestorId" value={editingRequest.requestorId || ''} onChange={handleSelectChange} options={resourceOptions} placeholder="Nessun richiedente (opzionale)" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Inizio *</label>
                                <input type="date" name="startDate" value={editingRequest.startDate} onChange={handleChange} required className="form-input"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Fine *</label>
                                <input type="date" name="endDate" value={editingRequest.endDate} onChange={handleChange} required className="form-input"/>
                            </div>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Percentuale Impegno ({editingRequest.commitmentPercentage}%)</label>
                            <input type="range" min="0" max="100" step="5" name="commitmentPercentage" value={editingRequest.commitmentPercentage} onChange={handleChange} className="w-full"/>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center">
                                <input id="isUrgent" name="isUrgent" type="checkbox" checked={editingRequest.isUrgent} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
                                <label htmlFor="isUrgent" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">Richiesta Urgente</label>
                            </div>
                            <div className="flex items-center">
                                <input id="isTechRequest" name="isTechRequest" type="checkbox" checked={editingRequest.isTechRequest} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
                                <label htmlFor="isTechRequest" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">Richiesta TECH</label>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stato *</label>
                            <select name="status" value={editingRequest.status} onChange={handleChange} required className="form-select">
                                {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Note</label>
                            <textarea name="notes" value={editingRequest.notes || ''} onChange={handleChange} rows={3} className="form-textarea"></textarea>
                        </div>
                        <div className="flex justify-end space-x-3 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 rounded-md">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addResourceRequest') || isActionLoading(`updateResourceRequest-${'id' in editingRequest ? editingRequest.id : ''}`)} className="flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400">
                               {(isActionLoading('addResourceRequest') || isActionLoading(`updateResourceRequest-${'id' in editingRequest ? editingRequest.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
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
                    title="Conferma Eliminazione"
                    message={`Sei sicuro di voler eliminare la richiesta ${requestToDelete.requestCode || ''} per ${requestToDelete.roleName} sul progetto ${requestToDelete.projectName}?`}
                    isConfirming={isActionLoading(`deleteResourceRequest-${requestToDelete.id}`)}
                />
            )}
             <style>{`.form-input, .form-select, .form-textarea { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-input, .dark .form-select, .dark .form-textarea { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }`}</style>
        </div>
    );
};