
import React, { useState, useMemo, useEffect } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Interview, InterviewFeedback, InterviewHiringStatus, InterviewStatus, Resource } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { SpinnerIcon } from '../components/icons';
import ConfirmationModal from '../components/ConfirmationModal';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { useToast } from '../context/ToastContext';
import { DataTable, ColumnDef } from '../components/DataTable';
import { formatDateFull } from '../utils/dateUtils';
import { ExportButton } from '@/components/shared/ExportButton';

// --- Types ---
type EnrichedInterview = Interview & {
  resourceRequestLabel: string | null;
  roleName: string | null;
  interviewersNames: string[];
  age: number | null;
  averageRating: number | null;
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

const toISODate = (s?: string | null) => (!s ? '' : new Date(s.split('T')[0]).toISOString().split('T')[0]);

const buildInterviewPayload = (interview: Interview | Omit<Interview, 'id'>): Interview | Omit<Interview, 'id'> => {
  const basePayload: any = {
    resourceRequestId: interview.resourceRequestId || null,
    candidateName: interview.candidateName,
    candidateSurname: interview.candidateSurname,
    birthDate: interview.birthDate || null,
    horizontal: interview.horizontal || null,
    roleId: interview.roleId || null,
    cvSummary: interview.cvSummary || null,
    interviewersIds: interview.interviewersIds && interview.interviewersIds.length > 0 ? interview.interviewersIds : null,
    interviewDate: interview.interviewDate || null,
    feedback: interview.feedback || null,
    notes: interview.notes || null,
    hiringStatus: interview.hiringStatus || null,
    entryDate: interview.entryDate || null,
    status: interview.status,
    
    // Ratings
    ratingTechnicalMastery: interview.ratingTechnicalMastery || null,
    ratingProblemSolving: interview.ratingProblemSolving || null,
    ratingMethodQuality: interview.ratingMethodQuality || null,
    ratingDomainKnowledge: interview.ratingDomainKnowledge || null,
    ratingAutonomy: interview.ratingAutonomy || null,
    ratingCommunication: interview.ratingCommunication || null,
    ratingProactivity: interview.ratingProactivity || null,
    ratingTeamFit: interview.ratingTeamFit || null,
  };

  // Preserve version for optimistic locking
  if (interview.version !== undefined) {
    basePayload.version = interview.version;
  }

  if ('id' in interview) {
    return { id: interview.id, ...basePayload };
  }

  return basePayload;
};

const getStatusBadgeClass = (status: InterviewStatus) => {
  switch (status) {
    case 'Aperto':
      return 'bg-primary-container text-on-primary-container';
    case 'Chiuso':
      return 'bg-surface-variant text-on-surface-variant';
    case 'StandBy':
      return 'bg-yellow-container text-on-yellow-container';
    case 'Non Contattabile':
      return 'bg-error-container text-on-error-container';
    default:
      return 'bg-surface-variant text-on-surface-variant';
  }
};

const calculateAverageRating = (i: Interview): number | null => {
    const ratings = [
        i.ratingTechnicalMastery,
        i.ratingProblemSolving,
        i.ratingMethodQuality,
        i.ratingDomainKnowledge,
        i.ratingAutonomy,
        i.ratingCommunication,
        i.ratingProactivity,
        i.ratingTeamFit
    ].map(r => Number(r)).filter(r => !isNaN(r) && r > 0);

    if (ratings.length === 0) return null;
    const sum = ratings.reduce((a, b) => a + b, 0);
    return sum / ratings.length;
};

// --- Star Rating Component ---
interface StarRatingInputProps {
    value: number | null | undefined;
    onChange: (val: number) => void;
    label: string;
}

const StarRatingInput: React.FC<StarRatingInputProps> = ({ value, onChange, label }) => {
    const currentVal = value || 0;
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-outline-variant/30 last:border-0">
            <span className="text-sm font-medium text-on-surface mb-1 sm:mb-0">{label}</span>
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => onChange(star)}
                        className="focus:outline-none p-1 transition-transform hover:scale-110"
                    >
                         <span 
                            className={`material-symbols-outlined text-2xl ${star <= currentVal ? 'text-yellow-500' : 'text-outline-variant'}`}
                            style={{ fontVariationSettings: star <= currentVal ? "'FILL' 1" : "'FILL' 0" }}
                         >
                            star
                         </span>
                    </button>
                ))}
            </div>
        </div>
    );
};

const StarDisplay: React.FC<{ rating: number | null }> = ({ rating }) => {
    if (rating === null || rating === undefined) return <span className="text-xs text-on-surface-variant">-</span>;
    
    // Arrotonda al mezzo punto più vicino
    const rounded = Math.round(rating * 2) / 2; 
    const fullStars = Math.floor(rounded);
    const hasHalfStar = rounded % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
        <div className="flex items-center text-yellow-500" title={`Media: ${rating.toFixed(1)}`}>
            {[...Array(fullStars)].map((_, i) => (
                <span key={`f-${i}`} className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            ))}
            {hasHalfStar && (
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star_half</span>
            )}
            {[...Array(emptyStars > 0 ? emptyStars : 0)].map((_, i) => (
                <span key={`e-${i}`} className="material-symbols-outlined text-sm text-outline-variant">star</span>
            ))}
        </div>
    );
};

// --- Main Page Component ---

const InterviewsPage: React.FC = () => {
  const {
    interviews,
    resources,
    roles,
    resourceRequests,
    projects,
    horizontals,
    addInterview,
    updateInterview,
    deleteInterview,
    isActionLoading,
    loading
  } = useEntitiesContext();
  const { addToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInterview, setEditingInterview] = useState<Interview | Omit<Interview, 'id'> | null>(null);
  const [interviewToDelete, setInterviewToDelete] = useState<EnrichedInterview | null>(null);
  const [filters, setFilters] = useState({ name: '', roleId: '', feedback: '', status: '', hiringStatus: '' });
  
  // Modal Tab State
  const [activeModalTab, setActiveModalTab] = useState<'details' | 'ratings'>('details');

  const emptyInterview: Omit<Interview, 'id'> = {
    resourceRequestId: null,
    candidateName: '',
    candidateSurname: '',
    birthDate: null,
    horizontal: null,
    roleId: null,
    cvSummary: null,
    interviewersIds: [],
    interviewDate: new Date().toISOString().split('T')[0],
    feedback: null,
    notes: null,
    hiringStatus: null,
    entryDate: null,
    status: 'Aperto',
    // Ratings defaults
    ratingTechnicalMastery: 0,
    ratingProblemSolving: 0,
    ratingMethodQuality: 0,
    ratingDomainKnowledge: 0,
    ratingAutonomy: 0,
    ratingCommunication: 0,
    ratingProactivity: 0,
    ratingTeamFit: 0
  };

  const enrichedData = useMemo<EnrichedInterview[]>(() => {
    return interviews.map((i) => {
      const request = resourceRequests.find((rr) => rr.id === i.resourceRequestId);
      const project = projects.find((p) => p.id === request?.projectId);
      const requestRole = roles.find((r) => r.id === request?.roleId);
      const role = roles.find((r) => r.id === i.roleId);
      const interviewers = resources.filter((r) => i.interviewersIds?.includes(r.id!));
      return {
        ...i,
        resourceRequestLabel: request ? `${request.requestCode} - ${project?.name} - ${requestRole?.name}` : null,
        roleName: role?.name || null,
        interviewersNames: interviewers.map((r) => r.name),
        age: calculateAge(i.birthDate),
        averageRating: calculateAverageRating(i)
      };
    });
  }, [interviews, resources, roles, resourceRequests, projects]);

  const filteredData = useMemo(() => {
    return enrichedData.filter(
      (i) =>
        (i.candidateName + ' ' + i.candidateSurname).toLowerCase().includes(filters.name.toLowerCase()) &&
        (!filters.roleId || i.roleId === filters.roleId) &&
        (!filters.feedback || i.feedback === filters.feedback) &&
        (!filters.status || i.status === filters.status) &&
        (!filters.hiringStatus || i.hiringStatus === filters.hiringStatus)
    );
  }, [enrichedData, filters]);

  const exportData = useMemo(() => {
    return filteredData.map(i => ({
      'Nome': i.candidateName,
      'Cognome': i.candidateSurname,
      'Data Nascita': formatDateFull(i.birthDate),
      'Età': i.age ?? '',
      'Horizontal': i.horizontal || '',
      'Ruolo Proposto': i.roleName || '',
      'Richiesta Collegata': i.resourceRequestLabel || '',
      'Intervistatori': i.interviewersNames.join(', '),
      'Data Colloquio': formatDateFull(i.interviewDate),
      'Feedback': i.feedback || '',
      'Stato Hiring': i.hiringStatus || '',
      'Data Ingresso': formatDateFull(i.entryDate),
      'Stato': i.status,
      'Media Valutazione': i.averageRating ? i.averageRating.toFixed(1) : '',
      'Note': i.notes || '',
      'CV Summary': i.cvSummary || ''
    }));
  }, [filteredData]);

  const summaryCards = useMemo(() => {
    const dataToSummarize = enrichedData;
    const activeCandidates = dataToSummarize.filter((i) => i.status === 'Aperto').length;
    const standByCandidates = dataToSummarize.filter((i) => i.status === 'StandBy').length;
    const positiveFeedback = dataToSummarize.filter((i) => i.feedback === 'Positivo').length;
    const upcomingHires = dataToSummarize
      .filter((i) => i.hiringStatus === 'SI' && i.entryDate && new Date(i.entryDate) >= new Date())
      .sort((a, b) => new Date(a.entryDate!).getTime() - new Date(b.entryDate!).getTime());
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingEntries = dataToSummarize
      .filter((i) => i.entryDate && new Date(i.entryDate) > today)
      .sort((a, b) => new Date(a.entryDate!).getTime() - new Date(b.entryDate!).getTime());

    return { activeCandidates, standByCandidates, positiveFeedback, upcomingHires, upcomingEntries };
  }, [enrichedData]);

  // Options for selects
  const roleOptions = useMemo(() => roles.map((r) => ({ value: r.id!, label: r.name })), [roles]);
  const horizontalOptions = useMemo(() => horizontals.map((h) => ({ value: h.value, label: h.value })), [horizontals]);
  const resourceOptions = useMemo(() => resources.map((r) => ({ value: r.id!, label: r.name })), [resources]);
  const requestOptions = useMemo(
    () =>
      resourceRequests
        .filter((rr) => rr.status === 'ATTIVA')
        .map((rr) => {
          const project = projects.find((p) => p.id === rr.projectId);
          const role = roles.find((r) => r.id === rr.roleId);
          return { value: rr.id!, label: `${rr.requestCode || 'N/A'} - ${project?.name} - ${role?.name}` };
        }),
    [resourceRequests, projects, roles]
  );

  const feedbackOptions = [
    { value: 'Positivo', label: 'Positivo' },
    { value: 'Positivo On Hold', label: 'Positivo On Hold' },
    { value: 'Negativo', label: 'Negativo' }
  ];
  const hiringStatusOptions = [
    { value: 'SI', label: 'Sì' },
    { value: 'NO', label: 'No' },
    { value: 'No Rifiutato', label: 'No Rifiutato' },
    { value: 'In Fase di Offerta', label: 'In Fase di Offerta' }
  ];
  const statusOptions = [
    { value: 'Aperto', label: 'Aperto' },
    { value: 'Chiuso', label: 'Chiuso' },
    { value: 'StandBy', label: 'StandBy' },
    { value: 'Non Contattabile', label: 'Non Contattabile' }
  ];

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  const handleFilterSelectChange = (name: string, value: string) => setFilters((prev) => ({ ...prev, [name]: value }));
  const resetFilters = () => setFilters({ name: '', roleId: '', feedback: '', status: '', hiringStatus: '' });

  const openModalForNew = () => {
    setEditingInterview(emptyInterview);
    setActiveModalTab('details');
    setIsModalOpen(true);
  };

  const openModalForEdit = (interview: Interview) => {
    const formattedInterview = {
      ...interview,
      birthDate: interview.birthDate ? toISODate(interview.birthDate) : null,
      interviewDate: interview.interviewDate ? toISODate(interview.interviewDate) : null,
      entryDate: interview.entryDate ? toISODate(interview.entryDate) : null
    };
    setEditingInterview(formattedInterview);
    setActiveModalTab('details');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingInterview(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingInterview) return;
    try {
      const payload = buildInterviewPayload(editingInterview);
      if ('id' in payload) await updateInterview(payload as Interview);
      else await addInterview(payload as Omit<Interview, 'id'>);
      addToast('Colloquio salvato correttamente.', 'success');
      handleCloseModal();
    } catch (err) {
      addToast('Errore nel salvataggio del colloquio.', 'error');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (editingInterview) setEditingInterview({ ...editingInterview, [e.target.name]: e.target.value });
  };
  const handleSelectChange = (name: string, value: string) => {
    if (editingInterview) setEditingInterview({ ...editingInterview, [name]: value });
  };
  const handleMultiSelectChange = (name: string, values: string[]) => {
    if (editingInterview) setEditingInterview({ ...editingInterview, [name]: values });
  };
  const handleRatingChange = (name: string, value: number) => {
      if (editingInterview) setEditingInterview({ ...editingInterview, [name]: value });
  }

  const handleDelete = async () => {
    if (interviewToDelete) {
      try {
        await deleteInterview(interviewToDelete.id!);
        setInterviewToDelete(null);
        addToast('Colloquio eliminato.', 'success');
      } catch {
        addToast('Errore durante l\'eliminazione.', 'error');
      }
    }
  };

  const columns: ColumnDef<EnrichedInterview>[] = [
    { 
        header: 'Candidato', 
        sortKey: 'candidateSurname',
        cell: (interview) => (
            <div className="font-medium text-on-surface sticky left-0 bg-inherit pl-6">
                {interview.candidateName} {interview.candidateSurname}{' '}
                <span className="text-on-surface-variant font-normal text-sm">({interview.age ?? 'N/A'})</span>
            </div>
        )
    },
    { header: 'Ruolo Proposto', sortKey: 'roleName', cell: i => <span className="text-sm text-on-surface-variant">{i.roleName || 'N/A'}</span> },
    { header: 'Colloquiato Da', cell: i => <span className="text-xs text-on-surface-variant">{i.interviewersNames.join(', ')}</span> },
    { 
        header: 'Valutazione', 
        sortKey: 'averageRating', 
        cell: i => <StarDisplay rating={i.averageRating} />
    },
    { header: 'Data', sortKey: 'interviewDate', cell: i => <span className="text-sm text-on-surface-variant">{formatDateFull(i.interviewDate)}</span> },
    { 
        header: 'Feedback', 
        sortKey: 'feedback', 
        cell: i => i.feedback ? <span className={`px-2 py-0.5 rounded text-xs font-semibold ${i.feedback === 'Positivo' ? 'bg-tertiary-container text-on-tertiary-container' : i.feedback === 'Negativo' ? 'bg-error-container text-on-error-container' : 'bg-yellow-container text-on-yellow-container'}`}>{i.feedback}</span> : '-'
    },
    { 
        header: 'Stato', 
        sortKey: 'status', 
        cell: i => <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStatusBadgeClass(i.status)}`}>{i.status}</span> 
    },
  ];

  const renderRow = (interview: EnrichedInterview) => (
    <tr key={interview.id} className="group hover:bg-surface-container">
        {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap bg-inherit">{col.cell(interview)}</td>)}
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium bg-inherit">
            <div className="flex items-center justify-end space-x-2">
                <button onClick={() => openModalForEdit(interview)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors" title="Modifica">
                    <span className="material-symbols-outlined">edit_note</span>
                </button>
                <button onClick={() => setInterviewToDelete(interview)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-error transition-colors" title="Elimina">
                    {isActionLoading(`deleteInterview-${interview.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">delete</span>}
                </button>
            </div>
        </td>
    </tr>
  );

  const renderMobileCard = (i: EnrichedInterview) => (
    <div className={`p-4 rounded-lg shadow-md bg-surface-container border-l-4 mb-4 flex flex-col gap-2 ${i.status === 'Aperto' ? 'border-primary' : 'border-outline'}`}>
        <div className="flex justify-between items-start">
            <div>
                <h3 className="font-bold text-lg text-on-surface">{i.candidateName} {i.candidateSurname}</h3>
                <p className="text-sm text-on-surface-variant">{i.roleName}</p>
            </div>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusBadgeClass(i.status)}`}>{i.status}</span>
        </div>
        <div className="text-sm text-on-surface-variant space-y-1">
            <p>Data: {formatDateFull(i.interviewDate)}</p>
            <div className="flex items-center gap-2">
                <span>Rating:</span>
                <StarDisplay rating={i.averageRating} />
            </div>
            <p>Feedback: {i.feedback || '-'}</p>
            {i.hiringStatus && <p className="mt-1 font-semibold">Hiring: {i.hiringStatus}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-outline-variant">
            <button onClick={() => openModalForEdit(i)} className="text-primary font-medium text-sm">Modifica</button>
            <button onClick={() => setInterviewToDelete(i)} className="text-error font-medium text-sm">Elimina</button>
        </div>
    </div>
  );

  const filtersNode = (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
        <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="form-input" placeholder="Cerca candidato..." />
        <SearchableSelect name="roleId" value={filters.roleId} onChange={handleFilterSelectChange} options={roleOptions} placeholder="Ruolo" />
        <SearchableSelect name="status" value={filters.status} onChange={handleFilterSelectChange} options={statusOptions} placeholder="Stato Processo" />
        <SearchableSelect name="feedback" value={filters.feedback} onChange={handleFilterSelectChange} options={feedbackOptions} placeholder="Feedback" />
        <button onClick={resetFilters} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full hover:opacity-90 w-full">Reset</button>
    </div>
  );

  return (
    <div>
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-primary">
                <p className="text-sm text-on-surface-variant">Candidati Attivi</p>
                <p className="text-2xl font-bold text-on-surface">{summaryCards.activeCandidates}</p>
            </div>
            <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-tertiary">
                <p className="text-sm text-on-surface-variant">Feedback Positivi</p>
                <p className="text-2xl font-bold text-on-surface">{summaryCards.positiveFeedback}</p>
            </div>
            <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-secondary">
                <p className="text-sm text-on-surface-variant">In Offerta / Assunti</p>
                <p className="text-2xl font-bold text-on-surface">{summaryCards.upcomingHires.length}</p>
            </div>
            <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-yellow-500">
                <p className="text-sm text-on-surface-variant">StandBy</p>
                <p className="text-2xl font-bold text-on-surface">{summaryCards.standByCandidates}</p>
            </div>
            <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-primary">
                <p className="text-sm text-on-surface-variant">Ingressi Previsti</p>
                {summaryCards.upcomingEntries.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {summaryCards.upcomingEntries.map((entry) => (
                      <li key={entry.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-on-surface">{entry.candidateName} {entry.candidateSurname}</span>
                        <span className="text-xs text-on-surface-variant">{formatDateFull(entry.entryDate!)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-on-surface-variant">Nessun ingresso previsto.</p>
                )}
            </div>
        </div>

        <DataTable<EnrichedInterview>
            title="Gestione Colloqui"
            addNewButtonLabel="Nuovo Colloquio"
            data={filteredData}
            columns={columns}
            filtersNode={filtersNode}
            onAddNew={openModalForNew}
            renderRow={renderRow}
            renderMobileCard={renderMobileCard}
            headerActions={<ExportButton data={exportData} title="Gestione Colloqui" />}
            initialSortKey="interviewDate"
            isLoading={loading}
            tableLayout={{ dense: true, striped: true, headerSticky: true }}
            numActions={2}
        />

        {/* Edit Modal */}
        {editingInterview && (
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingInterview ? 'Modifica Colloquio' : 'Nuovo Colloquio'}>
                <form onSubmit={handleSubmit} className="flex flex-col h-[75vh]">
                    
                    {/* Tabs Header */}
                    <div className="flex border-b border-outline-variant mb-4">
                        <button
                            type="button"
                            onClick={() => setActiveModalTab('details')}
                            className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${activeModalTab === 'details' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}
                        >
                            Dettagli Candidato
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveModalTab('ratings')}
                            className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${activeModalTab === 'ratings' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}
                        >
                            Valutazione Skills
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-1 space-y-6">
                        
                        {activeModalTab === 'details' && (
                            <>
                                {/* Dati Candidato */}
                                <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                                    <h4 className="text-sm font-bold text-primary mb-3 uppercase tracking-wider flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">person</span> Dati Candidato
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium mb-1">Nome *</label><input type="text" name="candidateName" value={editingInterview.candidateName} onChange={handleChange} required className="form-input"/></div>
                                        <div><label className="block text-sm font-medium mb-1">Cognome *</label><input type="text" name="candidateSurname" value={editingInterview.candidateSurname} onChange={handleChange} required className="form-input"/></div>
                                        <div><label className="block text-sm font-medium mb-1">Data Nascita</label><input type="date" name="birthDate" value={editingInterview.birthDate || ''} onChange={handleChange} className="form-input"/></div>
                                    </div>
                                </div>

                                {/* Posizione e Contesto */}
                                <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                                    <h4 className="text-sm font-bold text-primary mb-3 uppercase tracking-wider flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">work</span> Posizione & Contesto
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Richiesta Collegata (Opzionale)</label>
                                            <SearchableSelect name="resourceRequestId" value={editingInterview.resourceRequestId || ''} onChange={handleSelectChange} options={requestOptions} placeholder="Seleziona richiesta..." />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Ruolo Proposto</label>
                                            <SearchableSelect name="roleId" value={editingInterview.roleId || ''} onChange={handleSelectChange} options={roleOptions} placeholder="Seleziona ruolo..." />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Horizontal</label>
                                            <SearchableSelect name="horizontal" value={editingInterview.horizontal || ''} onChange={handleSelectChange} options={horizontalOptions} placeholder="Seleziona horizontal..." />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">CV Summary</label>
                                        <textarea name="cvSummary" value={editingInterview.cvSummary || ''} onChange={handleChange} className="form-textarea" rows={2} placeholder="Breve riepilogo competenze..."></textarea>
                                    </div>
                                </div>

                                {/* Dettagli Colloquio */}
                                <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                                    <h4 className="text-sm font-bold text-primary mb-3 uppercase tracking-wider flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">event</span> Dettagli Colloquio
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div><label className="block text-sm font-medium mb-1">Data Colloquio</label><input type="date" name="interviewDate" value={editingInterview.interviewDate || ''} onChange={handleChange} className="form-input"/></div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Intervistatori</label>
                                            <MultiSelectDropdown name="interviewersIds" selectedValues={editingInterview.interviewersIds || []} onChange={handleMultiSelectChange} options={resourceOptions} placeholder="Seleziona intervistatori..." />
                                        </div>
                                    </div>
                                </div>

                                {/* Esito e Stato */}
                                <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                                    <h4 className="text-sm font-bold text-primary mb-3 uppercase tracking-wider flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">assignment_turned_in</span> Esito
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Feedback</label>
                                            <select name="feedback" value={editingInterview.feedback || ''} onChange={handleChange} className="form-select">
                                                <option value="">-</option>
                                                {feedbackOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Stato Processo</label>
                                            <select name="status" value={editingInterview.status} onChange={handleChange} className="form-select" required>
                                                {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Stato Hiring</label>
                                            <select name="hiringStatus" value={editingInterview.hiringStatus || ''} onChange={handleChange} className="form-select">
                                                <option value="">-</option>
                                                {hiringStatusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                        </div>
                                        <div><label className="block text-sm font-medium mb-1">Data Ingresso Prevista</label><input type="date" name="entryDate" value={editingInterview.entryDate || ''} onChange={handleChange} className="form-input"/></div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Note</label>
                                        <textarea name="notes" value={editingInterview.notes || ''} onChange={handleChange} className="form-textarea" rows={2} placeholder="Note aggiuntive..."></textarea>
                                    </div>
                                </div>
                            </>
                        )}

                        {activeModalTab === 'ratings' && (
                            <div className="space-y-6">
                                <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                                    <h4 className="text-sm font-bold text-tertiary mb-3 uppercase tracking-wider flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">code</span> Hard Skills
                                    </h4>
                                    <div className="space-y-1">
                                        <StarRatingInput label="Padronanza Tecnica" value={editingInterview.ratingTechnicalMastery} onChange={(v) => handleRatingChange('ratingTechnicalMastery', v)} />
                                        <StarRatingInput label="Problem Solving Tecnico" value={editingInterview.ratingProblemSolving} onChange={(v) => handleRatingChange('ratingProblemSolving', v)} />
                                        <StarRatingInput label="Qualità del Metodo" value={editingInterview.ratingMethodQuality} onChange={(v) => handleRatingChange('ratingMethodQuality', v)} />
                                    </div>
                                </div>

                                <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                                    <h4 className="text-sm font-bold text-secondary mb-3 uppercase tracking-wider flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">psychology</span> Soft Skills
                                    </h4>
                                    <div className="space-y-1">
                                        <StarRatingInput label="Comprensione del Dominio" value={editingInterview.ratingDomainKnowledge} onChange={(v) => handleRatingChange('ratingDomainKnowledge', v)} />
                                        <StarRatingInput label="Autonomia" value={editingInterview.ratingAutonomy} onChange={(v) => handleRatingChange('ratingAutonomy', v)} />
                                        <StarRatingInput label="Comunicazione" value={editingInterview.ratingCommunication} onChange={(v) => handleRatingChange('ratingCommunication', v)} />
                                        <StarRatingInput label="Proattività e Attitudine" value={editingInterview.ratingProactivity} onChange={(v) => handleRatingChange('ratingProactivity', v)} />
                                        <StarRatingInput label="Team Fit" value={editingInterview.ratingTeamFit} onChange={(v) => handleRatingChange('ratingTeamFit', v)} />
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                    
                    <div className="flex justify-end space-x-3 pt-4 border-t border-outline-variant mt-4">
                        <button type="button" onClick={handleCloseModal} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold">Annulla</button>
                        <button type="submit" disabled={isActionLoading('addInterview') || isActionLoading('updateInterview')} className="flex justify-center items-center px-6 py-2 bg-primary text-on-primary rounded-full font-semibold hover:opacity-90 disabled:opacity-50">
                            {isActionLoading('addInterview') || isActionLoading('updateInterview') ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
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
                title="Elimina Colloquio"
                message={`Sei sicuro di voler eliminare il colloquio di ${interviewToDelete.candidateName} ${interviewToDelete.candidateSurname}?`}
                isConfirming={isActionLoading(`deleteInterview-${interviewToDelete.id}`)}
            />
        )}
    </div>
  );
};

export default InterviewsPage;
