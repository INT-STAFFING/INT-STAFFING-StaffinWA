import React, { useState, useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Interview, InterviewFeedback, InterviewHiringStatus, InterviewStatus } from '../types';
import { DataTable, ColumnDef } from '../components/DataTable';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { PencilIcon, TrashIcon, SpinnerIcon, UsersIcon, CheckCircleIcon, CalendarDaysIcon } from '../components/icons';
import ConfirmationModal from '../components/ConfirmationModal';
import MultiSelectDropdown from '../components/MultiSelectDropdown';

// --- Types ---
type EnrichedInterview = Interview & {
    resourceRequestLabel: string | null;
    roleName: string | null;
    interviewersNames: string[];
    age: number | null;
};

// --- Helper Functions ---
const calculateAge = (birthDate: string | null): number | null => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
};

const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr.split('T')[0]);
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
};

const getStatusBadgeClass = (status: InterviewStatus) => {
    switch (status) {
        case 'Aperto': return 'bg-blue-100 text-blue-800';
        case 'Chiuso': return 'bg-gray-100 text-gray-800';
        case 'StandBy': return 'bg-yellow-100 text-yellow-800';
        case 'Non Contattabile': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

const getHiringStatusBadgeClass = (status: InterviewHiringStatus | null) => {
    switch (status) {
        case 'SI': return 'bg-green-100 text-green-800';
        case 'NO': return 'bg-red-100 text-red-800';
        case 'No Rifiutato': return 'bg-orange-100 text-orange-800';
        case 'In Fase di Offerta': return 'bg-purple-100 text-purple-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};


const InterviewsPage: React.FC = () => {
    const { interviews, resources, roles, resourceRequests, projects, horizontals, addInterview, updateInterview, deleteInterview, isActionLoading } = useEntitiesContext();
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingInterview, setEditingInterview] = useState<Interview | Omit<Interview, 'id'> | null>(null);
    const [interviewToDelete, setInterviewToDelete] = useState<EnrichedInterview | null>(null);
    const [filters, setFilters] = useState({ name: '', roleId: '', feedback: '', status: '', hiringStatus: '' });

    const emptyInterview: Omit<Interview, 'id'> = {
        resourceRequestId: null, candidateName: '', candidateSurname: '', birthDate: null, horizontal: null, roleId: null,
        cvSummary: null, interviewersIds: [], interviewDate: new Date().toISOString().split('T')[0], feedback: null,
        notes: null, hiringStatus: null, entryDate: null, status: 'Aperto',
    };

    const dataForTable = useMemo<EnrichedInterview[]>(() => {
        return interviews
            .filter(i => 
                ((i.candidateName + ' ' + i.candidateSurname).toLowerCase().includes(filters.name.toLowerCase())) &&
                (!filters.roleId || i.roleId === filters.roleId) &&
                (!filters.feedback || i.feedback === filters.feedback) &&
                (!filters.status || i.status === filters.status) &&
                (!filters.hiringStatus || i.hiringStatus === filters.hiringStatus)
            )
            .map(i => {
                const request = resourceRequests.find(rr => rr.id === i.resourceRequestId);
                const project = projects.find(p => p.id === request?.projectId);
                const role = roles.find(r => r.id === i.roleId);
                const interviewers = resources.filter(r => i.interviewersIds?.includes(r.id!));
                return {
                    ...i,
                    resourceRequestLabel: request ? `${project?.name} - ${roles.find(r => r.id === request.roleId)?.name}` : null,
                    roleName: role?.name || null,
                    interviewersNames: interviewers.map(r => r.name),
                    age: calculateAge(i.birthDate),
                }
            });
    }, [interviews, resources, roles, resourceRequests, projects, filters]);

    const summaryCards = useMemo(() => {
        const activeCandidates = dataForTable.filter(i => i.status === 'Aperto').length;
        const positiveFeedback = dataForTable.filter(i => i.feedback === 'Positivo' || i.feedback === 'Positivo On Hold').length;
        const upcomingHires = dataForTable.filter(i => i.hiringStatus === 'SI' && i.entryDate && new Date(i.entryDate) >= new Date());
        return { activeCandidates, positiveFeedback, upcomingHires };
    }, [dataForTable]);
    
    // Options for selects
    const roleOptions = useMemo(() => roles.map(r => ({ value: r.id!, label: r.name })), [roles]);
    const horizontalOptions = useMemo(() => horizontals.map(h => ({ value: h.value, label: h.value })), [horizontals]);
    const resourceOptions = useMemo(() => resources.map(r => ({ value: r.id!, label: r.name })), [resources]);
    const requestOptions = useMemo(() => resourceRequests.map(rr => {
        const project = projects.find(p => p.id === rr.projectId);
        const role = roles.find(r => r.id === rr.roleId);
        return { value: rr.id!, label: `${project?.name} - ${role?.name}` };
    }), [resourceRequests, projects, roles]);

    const feedbackOptions: {value: InterviewFeedback, label: string}[] = [{value: 'Positivo', label: 'Positivo'}, {value: 'Positivo On Hold', label: 'Positivo On Hold'}, {value: 'Negativo', label: 'Negativo'}];
    const hiringStatusOptions: {value: InterviewHiringStatus, label: string}[] = [{value: 'SI', label: 'Sì'}, {value: 'NO', label: 'No'}, {value: 'No Rifiutato', label: 'No (Rifiutato)'}, {value: 'In Fase di Offerta', label: 'In Fase di Offerta'}];
    const statusOptions: {value: InterviewStatus, label: string}[] = [{value: 'Aperto', label: 'Aperto'}, {value: 'Chiuso', label: 'Chiuso'}, {value: 'StandBy', label: 'StandBy'}, {value: 'Non Contattabile', label: 'Non Contattabile'}];


    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleFilterSelectChange = (name: string, value: string) => setFilters(prev => ({ ...prev, [name]: value }));
    const resetFilters = () => setFilters({ name: '', roleId: '', feedback: '', status: '', hiringStatus: '' });

    const openModalForNew = () => { setEditingInterview(emptyInterview); setIsModalOpen(true); };
    const openModalForEdit = (interview: Interview) => {
        const formattedInterview = { ...interview, birthDate: interview.birthDate?.split('T')[0] || null, interviewDate: interview.interviewDate?.split('T')[0] || null, entryDate: interview.entryDate?.split('T')[0] || null };
        setEditingInterview(formattedInterview); setIsModalOpen(true);
    };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingInterview(null); };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingInterview) {
            try {
                if ('id' in editingInterview) await updateInterview(editingInterview as Interview);
                else await addInterview(editingInterview as Omit<Interview, 'id'>);
                handleCloseModal();
            } catch (err) {}
        }
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (editingInterview) setEditingInterview({ ...editingInterview, [e.target.name]: e.target.value });
    };
    const handleSelectChange = (name: string, value: string) => {
        if (editingInterview) setEditingInterview({ ...editingInterview, [name]: value });
    };
    const handleMultiSelectChange = (name: string, values: string[]) => {
        if (editingInterview) setEditingInterview({ ...editingInterview, [name]: values });
    };

    const handleDelete = async () => {
        if (interviewToDelete) {
            await deleteInterview(interviewToDelete.id!);
            setInterviewToDelete(null);
        }
    };
    
    const columns: ColumnDef<EnrichedInterview>[] = [
        { header: 'Candidato', sortKey: 'candidateSurname', cell: i => <div className="font-medium">{i.candidateName} {i.candidateSurname} <span className="text-gray-500">({i.age ?? 'N/A'})</span></div> },
        { header: 'Ruolo Proposto', sortKey: 'roleName', cell: i => i.roleName || 'N/A' },
        { header: 'Richiesta Collegata', sortKey: 'resourceRequestLabel', cell: i => <span className="text-xs">{i.resourceRequestLabel || 'Nessuna'}</span> },
        { header: 'Colloquiato Da', cell: i => <span className="text-xs">{i.interviewersNames.join(', ')}</span> },
        { header: 'Data Colloquio', sortKey: 'interviewDate', cell: i => formatDate(i.interviewDate) },
        { header: 'Feedback', sortKey: 'feedback', cell: i => i.feedback || 'N/A' },
        { header: 'Stato Assunzione', sortKey: 'hiringStatus', cell: i => <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getHiringStatusBadgeClass(i.hiringStatus)}`}>{i.hiringStatus || 'N/A'}</span> },
        { header: 'Data Ingresso', sortKey: 'entryDate', cell: i => formatDate(i.entryDate) },
        { header: 'Stato Processo', sortKey: 'status', cell: i => <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(i.status)}`}>{i.status}</span> },
    ];

    const renderRow = (interview: EnrichedInterview) => (
        <tr key={interview.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
            {columns.map((col, idx) => <td key={idx} className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{col.cell(interview)}</td>)}
            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end space-x-3">
                    <button onClick={() => openModalForEdit(interview)} className="text-gray-500 hover:text-blue-600" title="Modifica"><PencilIcon className="w-5 h-5"/></button>
                    <button onClick={() => setInterviewToDelete(interview)} className="text-gray-500 hover:text-red-600" title="Elimina">
                        {isActionLoading(`deleteInterview-${interview.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <TrashIcon className="w-5 h-5"/>}
                    </button>
                </div>
            </td>
        </tr>
    );

    const renderMobileCard = (interview: EnrichedInterview) => (
        <div key={interview.id} className="p-4 rounded-lg shadow-md bg-card dark:bg-dark-card">
             <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-lg">{interview.candidateName} {interview.candidateSurname}</p>
                    <p className="text-sm text-muted-foreground">{interview.roleName || 'Ruolo non specificato'}</p>
                </div>
                <div className="flex items-center space-x-1">
                    <button onClick={() => openModalForEdit(interview)} className="p-1 text-gray-500 hover:text-blue-600"><PencilIcon className="w-5 h-5"/></button>
                    <button onClick={() => setInterviewToDelete(interview)} className="p-1 text-gray-500 hover:text-red-600">
                        {isActionLoading(`deleteInterview-${interview.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <TrashIcon className="w-5 h-5"/>}
                    </button>
                </div>
            </div>
             <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground">Data Colloquio</p><p className="font-medium">{formatDate(interview.interviewDate)}</p></div>
                <div><p className="text-muted-foreground">Feedback</p><p className="font-medium">{interview.feedback || 'N/A'}</p></div>
                <div><p className="text-muted-foreground">Stato Assunzione</p><p><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getHiringStatusBadgeClass(interview.hiringStatus)}`}>{interview.hiringStatus || 'N/A'}</span></p></div>
                <div><p className="text-muted-foreground">Stato Processo</p><p><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(interview.status)}`}>{interview.status}</span></p></div>
            </div>
        </div>
    );
    
    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Fix: Replace div_ with div */}
                <div className="bg-card dark:bg-dark-card p-5 rounded-lg shadow flex items-start justify-between"><div> <h3 className="text-sm font-medium text-muted-foreground">Candidati Attivi</h3> <p className="text-3xl font-semibold">{summaryCards.activeCandidates}</p> </div><UsersIcon className="w-8 h-8 text-gray-300"/></div>
                <div className="bg-card dark:bg-dark-card p-5 rounded-lg shadow flex items-start justify-between"><div> <h3 className="text-sm font-medium text-muted-foreground">Feedback Positivi</h3> <p className="text-3xl font-semibold">{summaryCards.positiveFeedback}</p> </div><CheckCircleIcon className="w-8 h-8 text-gray-300"/></div>
                <div className="bg-card dark:bg-dark-card p-5 rounded-lg shadow flex items-start justify-between"><div> <h3 className="text-sm font-medium text-muted-foreground">Prossimi Ingressi</h3> <p className="text-3xl font-semibold">{summaryCards.upcomingHires.length}</p> </div><CalendarDaysIcon className="w-8 h-8 text-gray-300"/></div>
            </div>

            <DataTable<EnrichedInterview>
                title="Gestione Colloqui"
                addNewButtonLabel="Aggiungi Colloquio"
                data={dataForTable}
                columns={columns}
                filtersNode={
                     <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                        <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input md:col-span-2" placeholder="Cerca candidato..."/>
                        <SearchableSelect name="roleId" value={filters.roleId} onChange={handleFilterSelectChange} options={roleOptions} placeholder="Tutti i ruoli"/>
                        <SearchableSelect name="feedback" value={filters.feedback} onChange={handleFilterSelectChange} options={feedbackOptions} placeholder="Tutti i feedback"/>
                        <SearchableSelect name="hiringStatus" value={filters.hiringStatus} onChange={handleFilterSelectChange} options={hiringStatusOptions} placeholder="Tutti gli stati assunzione"/>
                        <button onClick={resetFilters} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full">Reset</button>
                    </div>
                }
                onAddNew={openModalForNew}
                renderRow={renderRow}
                renderMobileCard={renderMobileCard}
                initialSortKey="interviewDate"
            />
            
            {editingInterview && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingInterview ? 'Modifica Colloquio' : 'Nuovo Colloquio'}>
                     <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium mb-1">Nome Candidato *</label><input type="text" name="candidateName" value={editingInterview.candidateName} onChange={handleChange} required className="form-input"/></div>
                            <div><label className="block text-sm font-medium mb-1">Cognome Candidato *</label><input type="text" name="candidateSurname" value={editingInterview.candidateSurname} onChange={handleChange} required className="form-input"/></div>
                        </div>
                        <div><label className="block text-sm font-medium mb-1">Data di Nascita</label><input type="date" name="birthDate" value={editingInterview.birthDate || ''} onChange={handleChange} className="form-input"/></div>
                        <div><label className="block text-sm font-medium mb-1">Richiesta di Riferimento (Opzionale)</label><SearchableSelect name="resourceRequestId" value={editingInterview.resourceRequestId || ''} onChange={handleSelectChange} options={requestOptions} placeholder="Nessuna"/></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium mb-1">Horizontal</label><SearchableSelect name="horizontal" value={editingInterview.horizontal || ''} onChange={handleSelectChange} options={horizontalOptions} placeholder="Seleziona..."/></div>
                            <div><label className="block text-sm font-medium mb-1">Ruolo Proposto</label><SearchableSelect name="roleId" value={editingInterview.roleId || ''} onChange={handleSelectChange} options={roleOptions} placeholder="Seleziona..."/></div>
                        </div>
                        <div><label className="block text-sm font-medium mb-1">Riassunto CV</label><textarea name="cvSummary" value={editingInterview.cvSummary || ''} onChange={handleChange} rows={3} className="form-textarea"></textarea></div>
                        <div className="grid grid-cols-2 gap-4">
                             <div><label className="block text-sm font-medium mb-1">Data Colloquio</label><input type="date" name="interviewDate" value={editingInterview.interviewDate || ''} onChange={handleChange} className="form-input"/></div>
                             <div><label className="block text-sm font-medium mb-1">Feedback</label><SearchableSelect name="feedback" value={editingInterview.feedback || ''} onChange={handleSelectChange} options={feedbackOptions} placeholder="Seleziona..."/></div>
                        </div>
                        <div><label className="block text-sm font-medium mb-1">Colloquiato Da</label><MultiSelectDropdown name="interviewersIds" selectedValues={editingInterview.interviewersIds || []} onChange={handleMultiSelectChange} options={resourceOptions} placeholder="Seleziona una o più persone"/></div>
                        <div><label className="block text-sm font-medium mb-1">Note Colloquio</label><textarea name="notes" value={editingInterview.notes || ''} onChange={handleChange} rows={3} className="form-textarea"></textarea></div>
                        <div className="grid grid-cols-2 gap-4">
                             <div><label className="block text-sm font-medium mb-1">Stato Assunzione</label><SearchableSelect name="hiringStatus" value={editingInterview.hiringStatus || ''} onChange={handleSelectChange} options={hiringStatusOptions} placeholder="Seleziona..."/></div>
                            {editingInterview.hiringStatus === 'SI' && (
                                <div><label className="block text-sm font-medium mb-1">Data Ingresso *</label><input type="date" name="entryDate" value={editingInterview.entryDate || ''} onChange={handleChange} required className="form-input"/></div>
                            )}
                        </div>
                        <div><label className="block text-sm font-medium mb-1">Stato Processo *</label><SearchableSelect name="status" value={editingInterview.status} onChange={handleSelectChange} options={statusOptions} required/></div>
                        
                        <div className="flex justify-end space-x-3 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 rounded-md">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addInterview') || isActionLoading(`updateInterview-${'id' in editingInterview ? editingInterview.id : ''}`)} className="flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400">
                               {(isActionLoading('addInterview') || isActionLoading(`updateInterview-${'id' in editingInterview ? editingInterview.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {interviewToDelete && (
                <ConfirmationModal
                    isOpen={!!interviewToDelete}
                    onClose={() => setInterviewToDelete(null)}
                    onConfirm={handleDelete}
                    title="Conferma Eliminazione"
                    message={`Sei sicuro di voler eliminare il colloquio per ${interviewToDelete.candidateName} ${interviewToDelete.candidateSurname}?`}
                    isConfirming={isActionLoading(`deleteInterview-${interviewToDelete.id}`)}
                />
            )}
            <style>{`.form-input, .form-select, .form-textarea { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-input, .dark .form-select, .dark .form-textarea { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }`}</style>
        </div>
    );
};

export default InterviewsPage;