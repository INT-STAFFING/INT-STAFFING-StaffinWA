import React, { useState, useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Interview, InterviewFeedback, InterviewHiringStatus, InterviewStatus } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { SpinnerIcon } from '../components/icons';
import ConfirmationModal from '../components/ConfirmationModal';
import MultiSelectDropdown from '../components/MultiSelectDropdown';

// --- Types ---
type EnrichedInterview = Interview & {
    resourceRequestLabel: string | null;
    roleName: string | null;
    interviewersNames: string[];
    age: number | null;
};
type SortDirection = 'ascending' | 'descending';
type SortConfig = { key: keyof EnrichedInterview | string; direction: SortDirection } | null;


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
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'interviewDate', direction: 'descending' });
    const [view, setView] = useState<'table' | 'card'>('table');


    const emptyInterview: Omit<Interview, 'id'> = {
        resourceRequestId: null, candidateName: '', candidateSurname: '', birthDate: null, horizontal: null, roleId: null,
        cvSummary: null, interviewersIds: [], interviewDate: new Date().toISOString().split('T')[0], feedback: null,
        notes: null, hiringStatus: null, entryDate: null, status: 'Aperto',
    };

    const enrichedData = useMemo<EnrichedInterview[]>(() => {
        return interviews.map(i => {
                const request = resourceRequests.find(rr => rr.id === i.resourceRequestId);
                const project = projects.find(p => p.id === request?.projectId);
                const requestRole = roles.find(r => r.id === request?.roleId);
                const role = roles.find(r => r.id === i.roleId);
                const interviewers = resources.filter(r => i.interviewersIds?.includes(r.id!));
                return {
                    ...i,
                    resourceRequestLabel: request ? `${request.requestCode} - ${project?.name} - ${requestRole?.name}` : null,
                    roleName: role?.name || null,
                    interviewersNames: interviewers.map(r => r.name),
                    age: calculateAge(i.birthDate),
                }
            });
    }, [interviews, resources, roles, resourceRequests, projects]);

    const sortedAndFilteredData = useMemo(() => {
        const filtered = enrichedData.filter(i => 
                ((i.candidateName + ' ' + i.candidateSurname).toLowerCase().includes(filters.name.toLowerCase())) &&
                (!filters.roleId || i.roleId === filters.roleId) &&
                (!filters.feedback || i.feedback === filters.feedback) &&
                (!filters.status || i.status === filters.status) &&
                (!filters.hiringStatus || i.hiringStatus === filters.hiringStatus)
            );
        
        if (!sortConfig) return filtered;
        
        return [...filtered].sort((a, b) => {
            const aValue = (a as any)[sortConfig.key];
            const bValue = (b as any)[sortConfig.key];

            if (aValue == null) return 1;
            if (bValue == null) return -1;
            
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
            }
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            }
             // Date sorting
            if (aValue instanceof Date && bValue instanceof Date) {
                 return sortConfig.direction === 'ascending' ? aValue.getTime() - bValue.getTime() : bValue.getTime() - aValue.getTime();
            }
            return 0;
        });
    }, [enrichedData, filters, sortConfig]);

    const summaryCards = useMemo(() => {
        const dataToSummarize = enrichedData;
        const activeCandidates = dataToSummarize.filter(i => i.status === 'Aperto').length;
        const standByCandidates = dataToSummarize.filter(i => i.status === 'StandBy').length;
        const positiveFeedback = dataToSummarize.filter(i => i.feedback === 'Positivo').length;
        const positiveOnHoldFeedback = dataToSummarize.filter(i => i.feedback === 'Positivo On Hold').length;
        const upcomingHires = dataToSummarize
            .filter(i => i.hiringStatus === 'SI' && i.entryDate && new Date(i.entryDate) >= new Date())
            .sort((a,b) => new Date(a.entryDate!).getTime() - new Date(b.entryDate!).getTime());

        return { activeCandidates, standByCandidates, positiveFeedback, positiveOnHoldFeedback, upcomingHires };
    }, [enrichedData]);

    const pipelineData = useMemo(() => {
        const activeRequests = resourceRequests.filter(req => req.status === 'ATTIVA');
        
        return activeRequests.map(req => {
            const linkedInterviews = enrichedData.filter(i => i.resourceRequestId === req.id);
            const project = projects.find(p => p.id === req.projectId);
            const role = roles.find(r => r.id === req.roleId);
            return {
                request: req,
                projectName: project?.name || 'N/A',
                roleName: role?.name || 'N/A',
                interviewCount: linkedInterviews.length,
                candidates: linkedInterviews.map(i => `${i.candidateName} ${i.candidateSurname}`),
            };
        }).sort((a,b) => {
            if (a.interviewCount === 0 && b.interviewCount > 0) return -1;
            if (a.interviewCount > 0 && b.interviewCount === 0) return 1;
            return a.projectName.localeCompare(b.projectName);
        });
    }, [resourceRequests, enrichedData, projects, roles]);

    
    // Options for selects
    const roleOptions = useMemo(() => roles.map(r => ({ value: r.id!, label: r.name })), [roles]);
    const horizontalOptions = useMemo(() => horizontals.map(h => ({ value: h.value, label: h.value })), [horizontals]);
    const resourceOptions = useMemo(() => resources.map(r => ({ value: r.id!, label: r.name })), [resources]);
    const requestOptions = useMemo(() => resourceRequests
        .filter(rr => rr.status === 'ATTIVA')
        .map(rr => {
            const project = projects.find(p => p.id === rr.projectId);
            const role = roles.find(r => r.id === rr.roleId);
            return { value: rr.id!, label: `${rr.requestCode} - ${project?.name} - ${role?.name}` };
        }), [resourceRequests, projects, roles]);

    const feedbackOptions: {value: InterviewFeedback, label: string}[] = [{value: 'Positivo', label: 'Positivo'}, {value: 'Positivo On Hold', label: 'Positivo On Hold'}, {value: 'Negativo', label: 'Negativo'}];
    const hiringStatusOptions: {value: InterviewHiringStatus, label: string}[] = [{value: 'SI', label: 'Sì'}, {value: 'NO', label: 'No'}, {value: 'No Rifiutato', label: 'No (Rifiutato)'}, {value: 'In Fase di Offerta', label: 'In Fase di Offerta'}];
    const statusOptions: {value: InterviewStatus, label: string}[] = [{value: 'Aperto', label: 'Aperto'}, {value: 'Chiuso', label: 'Chiuso'}, {value: 'StandBy', label: 'StandBy'}, {value: 'Non Contattabile', label: 'Non Contattabile'}];

    const requestSort = (key: string) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

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
    
    const columns = [
        { header: 'Candidato', sortKey: 'candidateSurname' },
        { header: 'Ruolo Proposto', sortKey: 'roleName' },
        { header: 'Richiesta Collegata', sortKey: 'resourceRequestLabel' },
        { header: 'Colloquiato Da' },
        { header: 'Data Colloquio', sortKey: 'interviewDate' },
        { header: 'Feedback', sortKey: 'feedback' },
        { header: 'Stato Assunzione', sortKey: 'hiringStatus' },
        { header: 'Data Ingresso', sortKey: 'entryDate' },
        { header: 'Stato Processo', sortKey: 'status' },
    ];
    
    const renderCard = (interview: EnrichedInterview) => (
        <div key={interview.id} className="bg-card dark:bg-dark-card rounded-lg shadow-md border border-border dark:border-dark-border p-5 flex flex-col gap-4">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-lg text-foreground dark:text-dark-foreground">{interview.candidateName} {interview.candidateSurname} <span className="text-muted-foreground font-normal text-base">({interview.age ?? 'N/A'})</span></p>
                    <p className="text-sm text-primary font-medium">{interview.roleName || 'N/A'}</p>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                    <button onClick={() => openModalForEdit(interview)} className="text-gray-500 hover:text-blue-600" title="Modifica"><span className="text-xl">✏️</span></button>
                    <button onClick={() => setInterviewToDelete(interview)} className="text-gray-500 hover:text-red-600" title="Elimina">
                        {isActionLoading(`deleteInterview-${interview.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="text-xl">🗑️</span>}
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                 <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(interview.status)}`}>{interview.status}</span>
                 <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getHiringStatusBadgeClass(interview.hiringStatus)}`}>{interview.hiringStatus || 'Da definire'}</span>
                 <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100/70 text-blue-800">{interview.feedback || 'N/A'}</span>
            </div>

            <div className="text-sm space-y-3 pt-3 border-t border-border dark:border-dark-border">
               {(interview.cvSummary || interview.notes) ? (
                   <>
                    {interview.cvSummary && (
                        <div>
                            <h4 className="font-semibold text-foreground dark:text-dark-foreground mb-1">Riassunto CV</h4>
                            <p className="text-muted-foreground text-xs whitespace-pre-wrap max-h-24 overflow-y-auto">{interview.cvSummary}</p>
                        </div>
                    )}
                    {interview.notes && (
                        <div>
                            <h4 className="font-semibold text-foreground dark:text-dark-foreground mb-1">Note Colloquio</h4>
                            <p className="text-muted-foreground text-xs whitespace-pre-wrap max-h-24 overflow-y-auto">{interview.notes}</p>
                        </div>
                    )}
                   </>
               ) : <p className="text-xs text-muted-foreground italic">Nessun riassunto CV o note disponibili.</p>}
            </div>

            <div className="text-xs text-muted-foreground mt-auto pt-3 border-t border-border dark:border-dark-border space-y-1">
                 {interview.resourceRequestLabel && <p>Richiesta: <span className="font-medium text-foreground dark:text-dark-foreground">{interview.resourceRequestLabel}</span></p>}
                <p>Colloquio del: <span className="font-medium text-foreground dark:text-dark-foreground">{formatDate(interview.interviewDate)}</span></p>
                <p>Intervistatori: <span className="font-medium text-foreground dark:text-dark-foreground">{interview.interviewersNames.join(', ') || 'N/A'}</span></p>
                {interview.hiringStatus === 'SI' && <p>Ingresso previsto: <span className="font-medium text-foreground dark:text-dark-foreground">{formatDate(interview.entryDate)}</span></p>}
            </div>
        </div>
    );

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div
                    onClick={() => setFilters({ name: '', roleId: '', feedback: '', status: 'Aperto', hiringStatus: '' })}
                    className="bg-card dark:bg-dark-card p-5 rounded-lg shadow flex flex-col justify-between cursor-pointer hover:shadow-lg transition-shadow duration-200 min-h-[150px]"
                >
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground">Candidati Attivi</h3>
                            <p className="text-3xl font-semibold">{summaryCards.activeCandidates}</p>
                        </div>
                        <span className="text-3xl text-gray-300">👥</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{summaryCards.standByCandidates} in Stand-by</p>
                </div>
                <div
                    onClick={() => setFilters({ name: '', roleId: '', feedback: 'Positivo', status: '', hiringStatus: '' })}
                    className="bg-card dark:bg-dark-card p-5 rounded-lg shadow flex flex-col justify-between cursor-pointer hover:shadow-lg transition-shadow duration-200 min-h-[150px]"
                >
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground">Feedback Positivi</h3>
                            <p className="text-3xl font-semibold">{summaryCards.positiveFeedback}</p>
                        </div>
                        <span className="text-3xl text-gray-300">✅</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{summaryCards.positiveOnHoldFeedback} Positivi On Hold</p>
                </div>
                <div
                    onClick={() => setFilters({ name: '', roleId: '', feedback: '', status: '', hiringStatus: 'SI' })}
                    className="bg-card dark:bg-dark-card p-5 rounded-lg shadow flex flex-col justify-between cursor-pointer hover:shadow-lg transition-shadow duration-200 min-h-[150px]"
                >
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground">Prossimi Ingressi</h3>
                            <p className="text-3xl font-semibold">{summaryCards.upcomingHires.length}</p>
                        </div>
                        <span className="text-3xl text-gray-300">📅</span>
                    </div>
                    {summaryCards.upcomingHires.length > 0 ? (
                        <div className="mt-2 text-xs text-muted-foreground space-y-1 overflow-y-auto max-h-20 pr-2">
                            {summaryCards.upcomingHires.slice(0, 3).map(hire => (
                                <div key={hire.id} className="flex justify-between items-center">
                                    <span className="truncate pr-2">{hire.candidateName} {hire.candidateSurname}</span>
                                    <span className="font-medium text-foreground dark:text-dark-foreground flex-shrink-0">{formatDate(hire.entryDate)}</span>
                                </div>
                            ))}
                            {summaryCards.upcomingHires.length > 3 && <p className="text-center mt-1">... e altri {summaryCards.upcomingHires.length - 3}</p>}
                        </div>
                    ) : (
                        <div className="mt-2 text-xs text-muted-foreground">Nessun ingresso pianificato.</div>
                    )}
                </div>
            </div>

            <div className="bg-card dark:bg-dark-card rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold text-foreground dark:text-dark-foreground mb-4">Pipeline per Richiesta Attiva</h2>
                <div className="overflow-x-auto max-h-60">
                    <table className="min-w-full text-sm">
                        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Richiesta</th>
                                <th className="px-4 py-2 text-center font-medium text-muted-foreground">N. Colloqui</th>
                                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Candidati in Pipeline</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border dark:divide-dark-border">
                            {pipelineData.map(({ request, projectName, roleName, interviewCount, candidates }) => (
                                <tr key={request.id} className={interviewCount === 0 ? 'bg-red-50 dark:bg-red-900/20' : ''}>
                                    <td className="px-4 py-2">
                                        <div className="font-semibold">{projectName} - {roleName}</div>
                                        <div className="text-xs text-muted-foreground font-mono">{request.requestCode}</div>
                                    </td>
                                    <td className="px-4 py-2 text-center font-semibold">{interviewCount}</td>
                                    <td className="px-4 py-2 text-xs text-muted-foreground">{candidates.join(', ') || <span className="italic">Nessun candidato</span>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>


            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-foreground dark:text-dark-foreground self-start">Gestione Colloqui</h1>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex items-center space-x-1 bg-gray-200 dark:bg-gray-700 p-1 rounded-md">
                        <button onClick={() => setView('table')} className={`px-3 py-1 text-sm font-medium rounded-md capitalize ${view === 'table' ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow' : 'text-gray-600 dark:text-gray-300'}`}>Tabella</button>
                        <button onClick={() => setView('card')} className={`px-3 py-1 text-sm font-medium rounded-md capitalize ${view === 'card' ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow' : 'text-gray-600 dark:text-gray-300'}`}>Card</button>
                    </div>
                    <button onClick={openModalForNew} className="flex-grow md:flex-grow-0 px-4 py-2 bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-darker">Aggiungi Colloquio</button>
                </div>
            </div>
            <div className="mb-6 p-4 bg-card dark:bg-dark-card rounded-lg shadow relative z-20">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                    <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input md:col-span-2" placeholder="Cerca candidato..."/>
                    <SearchableSelect name="roleId" value={filters.roleId} onChange={handleFilterSelectChange} options={roleOptions} placeholder="Tutti i ruoli"/>
                    <SearchableSelect name="feedback" value={filters.feedback} onChange={handleFilterSelectChange} options={feedbackOptions} placeholder="Tutti i feedback"/>
                    <SearchableSelect name="hiringStatus" value={filters.hiringStatus} onChange={handleFilterSelectChange} options={hiringStatusOptions} placeholder="Tutti gli stati assunzione"/>
                    <button onClick={resetFilters} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full">Reset</button>
                </div>
            </div>

            {view === 'table' ? (
    <div className="bg-card dark:bg-dark-card rounded-lg shadow">
        {/* Contenitore scrollabile della tabella */}
        <div
            className="
                max-h-[640px]    
                overflow-y-auto  
                overflow-x-auto  
            "
        >
            // ≈ 20 righe se la riga è h-8 
            // scroll verticale SOLO sulle righe 
            // scroll orizzontale quando necessario
            <table className="min-w-full table-fixed">
                <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-700 border-b border-border dark:border-dark-border">
                    <tr>
                        {columns.map(col => (
                            <th
                                key={col.header}
                                className="px-4 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider"
                            >
                                {col.sortKey ? (
                                    <button
                                        type="button"
                                        onClick={() => requestSort(col.sortKey!)}
                                        className="flex items-center space-x-1 hover:text-foreground dark:hover:text-dark-foreground"
                                    >
                                        <span
                                            className={
                                                sortConfig?.key === col.sortKey
                                                    ? 'font-bold text-foreground dark:text-dark-foreground'
                                                    : ''
                                            }
                                        >
                                            {col.header}
                                        </span>
                                        <span className="text-gray-400">↕️</span>
                                    </button>
                                ) : (
                                    <span>{col.header}</span>
                                )}
                            </th>
                        ))}
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">
                            Azioni
                        </th>
                    </tr>
                </thead>

                <tbody className="divide-y divide-border dark:divide-dark-border">
                    {sortedAndFilteredData.map(interview => (
                        <tr
                            key={interview.id}
                            className="h-8 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        >
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                                <div className="font-medium">
                                    {interview.candidateName} {interview.candidateSurname}{' '}
                                    <span className="text-gray-500">({interview.age ?? 'N/A'})</span>
                                </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                {interview.roleName || 'N/A'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                <span className="text-xs">
                                    {interview.resourceRequestLabel || 'Nessuna'}
                                </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                <span className="text-xs">
                                    {interview.interviewersNames.join(', ')}
                                </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                {formatDate(interview.interviewDate)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                {interview.feedback || 'N/A'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                <span
                                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getHiringStatusBadgeClass(
                                        interview.hiringStatus
                                    )}`}
                                >
                                    {interview.hiringStatus || 'N/A'}
                                </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                {formatDate(interview.entryDate)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                <span
                                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                                        interview.status
                                    )}`}
                                >
                                    {interview.status}
                                </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end space-x-3">
                                    <button
                                        onClick={() => openModalForEdit(interview)}
                                        className="text-gray-500 hover:text-blue-600"
                                        title="Modifica"
                                    >
                                        <span className="text-xl">✏️</span>
                                    </button>
                                    <button
                                        onClick={() => setInterviewToDelete(interview)}
                                        className="text-gray-500 hover:text-red-600"
                                        title="Elimina"
                                    >
                                        {isActionLoading(`deleteInterview-${interview.id}`) ? (
                                            <SpinnerIcon className="w-5 h-5" />
                                        ) : (
                                            <span className="text-xl">🗑️</span>
                                        )}
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {sortedAndFilteredData.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">Nessun dato trovato.</p>
        )}
    </div>
) : (
                <div className="p-4 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                    {sortedAndFilteredData.length > 0 ? sortedAndFilteredData.map(renderCard) : <div className="col-span-full text-center py-8 text-muted-foreground bg-card dark:bg-dark-card rounded-lg shadow">Nessun colloquio trovato con i filtri correnti.</div>}
                </div>
            )}
            
            {editingInterview && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingInterview ? 'Modifica Colloquio' : 'Nuovo Colloquio'}>
                     <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium mb-1">Nome Candidato *</label><input type="text" name="candidateName" value={editingInterview.candidateName} onChange={handleChange} required className="form-input"/></div>
                            <div><label className="block text-sm font-medium mb-1">Cognome Candidato *</label><input type="text" name="candidateSurname" value={editingInterview.candidateSurname} onChange={handleChange} required className="form-input"/></div>
                        </div>
                        <div><label className="block text-sm font-medium mb-1">Data di Nascita</label><input type="date" name="birthDate" value={editingInterview.birthDate || ''} onChange={handleChange} className="form-input"/></div>
                        
                        <div><label className="block text-sm font-medium mb-1">Collega a Richiesta Risorsa</label>
                            <SearchableSelect 
                                name="resourceRequestId" 
                                value={editingInterview.resourceRequestId || ''} 
                                onChange={handleSelectChange} 
                                options={requestOptions} 
                                placeholder="Nessuna (Opzionale)"
                            />
                        </div>

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