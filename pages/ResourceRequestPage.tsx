/**
 * @file ResourceRequestPage.tsx
 * @description Pagina per la gestione delle richieste di risorse.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { ResourceRequest } from '../types';
import { DataTable, ColumnDef } from '../components/DataTable';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { PencilIcon, TrashIcon, SpinnerIcon, CheckIcon, XMarkIcon } from '../components/icons';

const emptyRequest: Omit<ResourceRequest, 'id'> = {
    projectId: '',
    roleId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    commitmentPercentage: 100,
    isUrgent: false,
    isLongTerm: false,
    isTechRequest: false,
    notes: '',
    status: 'APERTA'
};

const ResourceRequestPage: React.FC = () => {
    const { 
        resourceRequests, 
        projects, 
        roles,
        addResourceRequest,
        updateResourceRequest,
        deleteResourceRequest,
        isActionLoading 
    } = useEntitiesContext();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRequest, setEditingRequest] = useState<ResourceRequest | Omit<ResourceRequest, 'id'> | null>(null);

    // Calcolo per dashboard
    const openRequests = useMemo(() => resourceRequests.filter(r => r.status === 'APERTA'), [resourceRequests]);
    
    const requestsByRole = useMemo(() => {
        const counts: { [key: string]: number } = {};
        openRequests.forEach(req => {
            const roleName = roles.find(r => r.id === req.roleId)?.name || 'Sconosciuto';
            counts[roleName] = (counts[roleName] || 0) + 1;
        });
        return Object.entries(counts).sort(([, a], [, b]) => b - a);
    }, [openRequests, roles]);

    const requestsByProject = useMemo(() => {
        const counts: { [key: string]: number } = {};
        openRequests.forEach(req => {
            const projectName = projects.find(p => p.id === req.projectId)?.name || 'Sconosciuto';
            counts[projectName] = (counts[projectName] || 0) + 1;
        });
        return Object.entries(counts).sort(([, a], [, b]) => b - a);
    }, [openRequests, projects]);


    const openModalForNew = () => {
        setEditingRequest(emptyRequest);
        setIsModalOpen(true);
    };

    const openModalForEdit = (request: ResourceRequest) => {
        setEditingRequest(request);
        setIsModalOpen(true);
    };
    
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingRequest(null);
    };

    const projectOptions = useMemo(() => projects.map(p => ({ value: p.id!, label: p.name })), [projects]);
    const roleOptions = useMemo(() => roles.map(r => ({ value: r.id!, label: r.name })), [roles]);

    // Funzione per renderizzare i flag booleani
    const renderFlag = (value: boolean, text: string) => {
        return value ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {text}
            </span>
        ) : null;
    };
    
    const columns: ColumnDef<ResourceRequest>[] = [
        { header: 'Progetto', sortKey: 'projectId', cell: r => projects.find(p => p.id === r.projectId)?.name || 'N/A' },
        { header: 'Ruolo Richiesto', sortKey: 'roleId', cell: r => roles.find(role => role.id === r.roleId)?.name || 'N/A' },
        { header: 'Date', cell: r => `${new Date(r.startDate).toLocaleDateString()} - ${new Date(r.endDate).toLocaleDateString()}` },
        { header: '% Impegno', sortKey: 'commitmentPercentage', cell: r => `${r.commitmentPercentage}%` },
        { header: 'Flag', cell: r => (
            <div className="flex flex-col space-y-1 items-start">
                {renderFlag(r.isUrgent, "Urgente")}
                {renderFlag(r.isLongTerm, "Lunga Durata")}
                {renderFlag(r.isTechRequest, "TECH")}
            </div>
        ) },
        { header: 'Stato', sortKey: 'status', cell: r => r.status },
    ];
    
    const renderRow = (request: ResourceRequest) => (
        <tr key={request.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
            {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap text-sm">{col.cell(request)}</td>)}
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end space-x-3">
                    <button onClick={() => openModalForEdit(request)} className="text-gray-500 hover:text-blue-600" title="Modifica"><PencilIcon className="w-5 h-5"/></button>
                    <button onClick={() => deleteResourceRequest(request.id!)} className="text-gray-500 hover:text-red-600" title="Elimina">
                        {isActionLoading(`deleteResourceRequest-${request.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <TrashIcon className="w-5 h-5"/>}
                    </button>
                </div>
            </td>
        </tr>
    );

     const renderMobileCard = (request: ResourceRequest) => (
        <div key={request.id} className="p-4 rounded-lg shadow-md bg-gray-50 dark:bg-gray-900/50">
             <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-lg text-gray-900 dark:text-white">{projects.find(p => p.id === request.projectId)?.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{roles.find(r => r.id === request.roleId)?.name}</p>
                </div>
                <div className="flex items-center space-x-1 flex-shrink-0 ml-4">
                    <button onClick={() => openModalForEdit(request)} className="p-1 text-gray-500 hover:text-blue-600"><PencilIcon className="w-5 h-5"/></button>
                    <button onClick={() => deleteResourceRequest(request.id!)} className="p-1 text-gray-500 hover:text-red-600">
                        {isActionLoading(`deleteResourceRequest-${request.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <TrashIcon className="w-5 h-5"/>}
                    </button>
                </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-gray-500 dark:text-gray-400">Periodo</p><p className="font-medium text-gray-900 dark:text-white">{new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}</p></div>
                <div><p className="text-gray-500 dark:text-gray-400">Impegno</p><p className="font-medium text-gray-900 dark:text-white">{request.commitmentPercentage}%</p></div>
                <div><p className="text-gray-500 dark:text-gray-400">Stato</p><p className="font-medium text-gray-900 dark:text-white">{request.status}</p></div>
                 <div><p className="text-gray-500 dark:text-gray-400">Flag</p><div className="flex flex-col space-y-1 items-start mt-1">{renderFlag(request.isUrgent, "Urgente")}{renderFlag(request.isLongTerm, "Lunga Durata")}{renderFlag(request.isTechRequest, "TECH")}</div></div>
            </div>
        </div>
    );

    return (
        <div>
            {/* Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Richieste Aperte per Ruolo</h3>
                    <ul className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                        {requestsByRole.map(([role, count]) => (
                            <li key={role} className="flex justify-between items-center text-sm">
                                <span className="text-gray-600 dark:text-gray-300">{role}</span>
                                <span className="font-bold text-blue-600 dark:text-blue-400">{count}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                     <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Richieste Aperte per Progetto</h3>
                    <ul className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                        {requestsByProject.map(([project, count]) => (
                            <li key={project} className="flex justify-between items-center text-sm">
                                <span className="text-gray-600 dark:text-gray-300">{project}</span>
                                <span className="font-bold text-blue-600 dark:text-blue-400">{count}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <DataTable<ResourceRequest>
                title="Elenco Richieste Risorse"
                addNewButtonLabel="Crea Nuova Richiesta"
                data={resourceRequests}
                columns={columns}
                filtersNode={<></>}
                onAddNew={openModalForNew}
                renderRow={renderRow}
                renderMobileCard={renderMobileCard}
                initialSortKey="startDate"
            />
            {editingRequest && (
                <ModalForm
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    request={editingRequest}
                    projectOptions={projectOptions}
                    roleOptions={roleOptions}
                />
            )}
            <style>{`.form-input, .form-select, .form-textarea { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-input, .dark .form-select, .dark .form-textarea { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }`}</style>
        </div>
    );
};

interface ModalFormProps {
    isOpen: boolean;
    onClose: () => void;
    request: ResourceRequest | Omit<ResourceRequest, 'id'>;
    projectOptions: { value: string, label: string }[];
    roleOptions: { value: string, label: string }[];
}

const ModalForm: React.FC<ModalFormProps> = ({ isOpen, onClose, request, projectOptions, roleOptions }) => {
    const { addResourceRequest, updateResourceRequest, isActionLoading } = useEntitiesContext();
    const [formData, setFormData] = useState(request);

    useEffect(() => {
        const { startDate, endDate } = formData;
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setFormData(prev => ({...prev, isLongTerm: diffDays > 60}));
        }
    }, [formData.startDate, formData.endDate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setFormData({ ...formData, [name]: checked });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };
    
    const handleSelectChange = (name: string, value: string) => {
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if ('id' in formData) {
                await updateResourceRequest(formData);
            } else {
                await addResourceRequest(formData);
            }
            onClose();
        } catch (error) {}
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={'id' in request ? 'Modifica Richiesta' : 'Crea Richiesta'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Progetto *</label>
                        <SearchableSelect name="projectId" value={formData.projectId} onChange={handleSelectChange} options={projectOptions} required />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ruolo Richiesto *</label>
                        <SearchableSelect name="roleId" value={formData.roleId} onChange={handleSelectChange} options={roleOptions} required />
                    </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Inizio Attività *</label>
                        <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} required className="form-input"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Fine Attività *</label>
                        <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} required className="form-input"/>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">% Impegno ({formData.commitmentPercentage}%)</label>
                    <input type="range" min="5" max="100" step="5" name="commitmentPercentage" value={formData.commitmentPercentage} onChange={handleChange} className="w-full"/>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div className="flex items-center"><input type="checkbox" id="isUrgent" name="isUrgent" checked={formData.isUrgent} onChange={handleChange} className="h-4 w-4 rounded mr-2" /><label htmlFor="isUrgent">Urgente</label></div>
                    <div className="flex items-center"><input type="checkbox" id="isLongTerm" name="isLongTerm" checked={formData.isLongTerm} readOnly disabled className="h-4 w-4 rounded mr-2" /><label htmlFor="isLongTerm">Lunga Durata</label></div>
                    <div className="flex items-center"><input type="checkbox" id="isTechRequest" name="isTechRequest" checked={formData.isTechRequest} onChange={handleChange} className="h-4 w-4 rounded mr-2" /><label htmlFor="isTechRequest">Richiesta TECH</label></div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Note</label>
                    <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={2} className="form-textarea"></textarea>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md">Annulla</button>
                    <button type="submit" disabled={isActionLoading('addResourceRequest') || isActionLoading(`updateResourceRequest-${'id' in formData ? formData.id : ''}`)} className="flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400">
                       {(isActionLoading('addResourceRequest') || isActionLoading(`updateResourceRequest-${'id' in formData ? formData.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                    </button>
                </div>
            </form>
        </Modal>
    )
}

export default ResourceRequestPage;