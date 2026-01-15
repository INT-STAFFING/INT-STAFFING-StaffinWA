
import React, { useState, useMemo } from 'react';
// FIX: Use relative import for custom zod implementation.
import { z } from '../libs/zod';
import { useEntitiesContext } from '../context/AppContext';
import { ResourceRequest, ResourceRequestStatus } from '../types';
import { DataTable, ColumnDef } from '../components/DataTable';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { SpinnerIcon } from '../components/icons';
import ConfirmationModal from '../components/ConfirmationModal';
import { formatDateFull } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';
import { FormFieldFeedback } from '../components/forms';

// --- Types ---
type EnrichedRequest = ResourceRequest & {
    projectName: string;
    roleName: string;
    requestorName: string | null;
};

export const resourceRequestSchema = z.object({
    projectId: z.string().min(1, 'Seleziona un progetto.'),
    roleId: z.string().min(1, 'Seleziona un ruolo.'),
    requestorId: z.string().min(1, 'Seleziona un richiedente.').nullable().optional(),
    startDate: z.string().min(1, 'Inserisci la data di inizio.'),
    endDate: z.string().min(1, 'Inserisci la data di fine.'),
    commitmentPercentage: z.coerce.number().min(0, 'L\'impegno deve essere almeno 0%.').max(100, 'L\'impegno non può superare il 100%.'),
    isUrgent: z.boolean(),
    isLongTerm: z.boolean(),
    isTechRequest: z.boolean(),
    isOsrOpen: z.boolean(),
    osrNumber: z.string().trim().optional().nullable(),
    notes: z.string().optional().nullable(),
    // FIX: Enforce tuple type for enum values to match BaseSchema requirements in libs/zod.ts.
    status: z.enum(['ATTIVA', 'STANDBY', 'CHIUSA'] as [string, string, string], { required_error: 'Seleziona lo stato della richiesta.' }),
}).refine(data => {
    if (!data.isOsrOpen) return true;
    return !!data.osrNumber && data.osrNumber.trim().length > 0;
}, {
    path: ['osrNumber'],
    message: 'Inserisci il numero OSR quando la richiesta è segnata come aperta.',
}).refine(data => {
    if (!data.startDate || !data.endDate) return true;
    return new Date(data.endDate) >= new Date(data.startDate);
}, {
    path: ['endDate'],
    message: 'La data di fine deve essere successiva o uguale alla data di inizio.',
});

const getStatusBadgeClass = (status: ResourceRequestStatus): string => {
    switch (status) {
        case 'ATTIVA': return 'bg-tertiary-container text-on-tertiary-container';
        case 'STANDBY': return 'bg-yellow-container text-on-yellow-container';
        case 'CHIUSA': return 'bg-surface-variant text-on-surface-variant';
        default: return 'bg-surface-variant text-on-surface-variant';
    }
};

const buildResourceRequestPayload = (
    request: ResourceRequest | Omit<ResourceRequest, 'id'>
): ResourceRequest | Omit<ResourceRequest, 'id'> => {
    const basePayload: Omit<ResourceRequest, 'id'> = {
        projectId: request.projectId,
        roleId: request.roleId,
        requestorId: request.requestorId ?? null,
        startDate: request.startDate,
        endDate: request.endDate,
        commitmentPercentage: request.commitmentPercentage,
        isUrgent: request.isUrgent,
        isLongTerm: request.isLongTerm,
        isTechRequest: request.isTechRequest,
        isOsrOpen: !!request.isOsrOpen,
        osrNumber: request.osrNumber ?? null,
        notes: request.notes ?? '',
        status: request.status,
    };

    if ('id' in request) {
        return { id: request.id, ...basePayload };
    }

    return basePayload;
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
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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

        const relevantRequests = dataForTable.filter(req => req.status !== 'STANDBY' && req.status !== 'CHIUSA');

        relevantRequests.forEach(req => {
            if (!fteByRole[req.roleName]) {
                fteByRole[req.roleName] = 0;
            }
            fteByRole[req.roleName] += req.commitmentPercentage / 100;

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
        const sanitizedRequest = buildResourceRequestPayload(request);
        const formattedRequest = {
            ...sanitizedRequest,
            startDate: sanitizedRequest.startDate ? sanitizedRequest.startDate.split('T')[0] : '',
            endDate: sanitizedRequest.endDate ? sanitizedRequest.endDate.split('T')[0] : '',
            isOsrOpen: !!sanitizedRequest.isOsrOpen,
            osrNumber: sanitizedRequest.osrNumber ?? '',
            requestorId: sanitizedRequest.requestorId ?? null,
        };
        setEditingRequest(formattedRequest);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingRequest(null);
        setFormErrors({});
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingRequest) return;

        const validationResult = resourceRequestSchema.safeParse(editingRequest);

        // FIX: Using explicit type assertion for (validationResult as any) to bypass failing discriminant narrowing in this environment.
        if (!validationResult.success) {
            const fieldErrors = (validationResult as any).error.flatten().fieldErrors;
            setFormErrors({
                projectId: fieldErrors.projectId?.[0] ?? '',
                roleId: fieldErrors.roleId?.[0] ?? '',
                requestorId: fieldErrors.requestorId?.[0] ?? '',
                startDate: fieldErrors.startDate?.[0] ?? '',
                endDate: fieldErrors.endDate?.[0] ?? '',
                commitmentPercentage: fieldErrors.commitmentPercentage?.[0] ?? '',
                osrNumber: fieldErrors.osrNumber?.[0] ?? '',
                status: fieldErrors.status?.[0] ?? '',
            });
            addToast('Correggi gli errori evidenziati prima di continuare.', 'error');
            return;
        }

        const validRequest = validationResult.data as ResourceRequest;

        const startDate = new Date(validRequest.startDate);
        const endDate = new Date(validRequest.endDate);
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const osrNumber = validRequest.isOsrOpen ? validRequest.osrNumber : null;

        const requestToSave = buildResourceRequestPayload({
            ...validRequest,
            id: 'id' in editingRequest ? editingRequest.id : undefined,
            isLongTerm: diffDays > 60,
            osrNumber,
        });

        setFormErrors({});

        try {
            if ('id' in editingRequest) {
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
        setFormErrors(prev => ({ ...prev, [name]: '' }));
    };

    const handleSelectChange = (name: string, value: string) => {
        if (editingRequest) {
            const normalizedValue = value === '' ? null : value;
            setEditingRequest({ ...editingRequest, [name]: normalizedValue as string | null });
            setFormErrors(prev => ({ ...prev, [name]: '' }));
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
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-3">
                <SearchableSelect name="projectId" value={filters.projectId} onChange={handleFilterChange} options={projectOptions} placeholder="Tutti i Progetti"/>
            </div>
            <div className="md:col-span-3">
                <SearchableSelect name="roleId" value={filters.roleId} onChange={handleFilterChange} options={roleOptions} placeholder="Tutti i Ruoli"/>
            </div>
            <div className="md:col-span-3">
                <SearchableSelect name="requestorId" value={filters.requestorId} onChange={handleFilterChange} options={resourceOptions} placeholder="Tutti i Richiedenti"/>
            </div>
            <div className="md:col-span-3">
                <SearchableSelect name="status" value={filters.status} onChange={handleFilterChange} options={statusOptions} placeholder="Tutti gli Stati"/>
            </div>
        </div>
    );

    return (
        <div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-surface-container-low p-5 rounded-2xl shadow">
                    <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide">FTE Totali per Figura Professionale</h3>
                    {summaryData.fteArray.length > 0 ? (
                        <ul className="mt-4 space-y-2">
                            {summaryData.fteArray.map(({ roleName, fte }) => (
                                <li key={roleName} className="flex items-center justify-between text-sm">
                                    <span className="font-medium text-on-surface">{roleName}</span>
                                    <span className="text-on-surface-variant">{fte.toFixed(2)} FTE</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-4 text-sm text-on-surface-variant">Nessun dato disponibile.</p>
                    )}
                </div>
                <div className="bg-surface-container-low p-5 rounded-2xl shadow">
                    <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide">FTE per Progetto e Figura Professionale</h3>
                    {summaryData.projectArray.length > 0 ? (
                        <div className="mt-4 space-y-4">
                            {summaryData.projectArray.map(({ projectName, requests }) => (
                                <div key={projectName}>
                                    <p className="text-sm font-semibold text-on-surface">{projectName}</p>
                                    <ul className="mt-2 space-y-1">
                                        {requests.map((req, index) => (
                                            <li key={`${projectName}-${req.roleName}-${index}`} className="flex items-center justify-between text-sm text-on-surface-variant">
                                                <span>{req.roleName}</span>
                                                <span>{(req.commitmentPercentage / 100).toFixed(2)} FTE</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="mt-4 text-sm text-on-surface-variant">Nessun dato disponibile.</p>
                    )}
                </div>
            </div>
            <DataTable<EnrichedRequest>
                title="Richieste di Risorse"
                addNewButtonLabel="Aggiungi Richiesta"
                data={dataForTable}
                columns={columns}
                filtersNode={filtersNode}
                onAddNew={openModalForNew}
                renderRow={renderRow}
                renderMobileCard={renderCard}
                initialSortKey="startDate"
                isLoading={loading}
                tableLayout={{ dense: true, striped: true, headerSticky: true }}
                numActions={2}
            />

            {editingRequest && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingRequest ? 'Modifica Richiesta' : 'Nuova Richiesta'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Progetto *</label>
                            <SearchableSelect name="projectId" value={editingRequest.projectId} onChange={handleSelectChange} options={projectOptions} placeholder="Seleziona progetto" />
                            {formErrors.projectId && <FormFieldFeedback error={formErrors.projectId} />}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Ruolo Richiesto *</label>
                            <SearchableSelect name="roleId" value={editingRequest.roleId} onChange={handleSelectChange} options={roleOptions} placeholder="Seleziona ruolo" />
                            {formErrors.roleId && <FormFieldFeedback error={formErrors.roleId} />}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Richiedente</label>
                            <SearchableSelect name="requestorId" value={editingRequest.requestorId || ''} onChange={handleSelectChange} options={resourceOptions} placeholder="Seleziona richiedente" />
                            {formErrors.requestorId && <FormFieldFeedback error={formErrors.requestorId} />}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-1">Data Inizio *</label>
                                <input type="date" name="startDate" value={editingRequest.startDate} onChange={handleChange} required className="form-input" />
                                {formErrors.startDate && <FormFieldFeedback error={formErrors.startDate} />}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-1">Data Fine *</label>
                                <input type="date" name="endDate" value={editingRequest.endDate} onChange={handleChange} required className="form-input" />
                                {formErrors.endDate && <FormFieldFeedback error={formErrors.endDate} />}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Impegno (%) *</label>
                            <input type="number" name="commitmentPercentage" value={editingRequest.commitmentPercentage} onChange={handleChange} required className="form-input" />
                            {formErrors.commitmentPercentage && <FormFieldFeedback error={formErrors.commitmentPercentage} />}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Stato *</label>
                            <select name="status" value={editingRequest.status} onChange={handleChange} required className="form-select">
                                {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                            {formErrors.status && <FormFieldFeedback error={formErrors.status} />}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Note</label>
                            <textarea name="notes" value={editingRequest.notes || ''} onChange={handleChange} className="form-textarea" rows={3}></textarea>
                        </div>
                        <div className="flex items-center space-x-3">
                            <input type="checkbox" id="isUrgent" name="isUrgent" checked={editingRequest.isUrgent} onChange={handleChange} className="form-checkbox" />
                            <label htmlFor="isUrgent" className="text-sm text-on-surface">Urgente</label>
                        </div>
                        <div className="flex items-center space-x-3">
                            <input type="checkbox" id="isTechRequest" name="isTechRequest" checked={editingRequest.isTechRequest} onChange={handleChange} className="form-checkbox" />
                            <label htmlFor="isTechRequest" className="text-sm text-on-surface">Richiesta TECH</label>
                        </div>
                        <div className="flex items-center space-x-3">
                            <input type="checkbox" id="isOsrOpen" name="isOsrOpen" checked={editingRequest.isOsrOpen} onChange={handleChange} className="form-checkbox" />
                            <label htmlFor="isOsrOpen" className="text-sm text-on-surface">OSR Aperta</label>
                        </div>
                        {editingRequest.isOsrOpen && (
                            <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-1">Numero OSR *</label>
                                <input type="text" name="osrNumber" value={editingRequest.osrNumber || ''} onChange={handleChange} className="form-input" />
                                {formErrors.osrNumber && <FormFieldFeedback error={formErrors.osrNumber} />}
                            </div>
                        )}
                        <div className="flex justify-end space-x-3 pt-4 border-t border-outline-variant mt-4">
                            <button type="button" onClick={handleCloseModal} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold transition-colors">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addResourceRequest') || isActionLoading(`updateResourceRequest-${'id' in editingRequest ? editingRequest.id : ''}`)} className="flex justify-center items-center px-6 py-2 bg-primary text-on-primary rounded-full disabled:opacity-50 font-semibold hover:opacity-90 shadow-sm transition-all">
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
                    title="Elimina Richiesta"
                    message={`Sei sicuro di voler eliminare la richiesta ${requestToDelete.requestCode}?`}
                    isConfirming={isActionLoading(`deleteResourceRequest-${requestToDelete.id}`)}
                />
            )}
        </div>
    );
};

export default ResourceRequestPage;
