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

const toISODate = (s?: string | null) => (!s ? '' : new Date(s.split('T')[0]).toISOString().split('T')[0]);

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

const getHiringStatusBadgeClass = (status: InterviewHiringStatus | null) => {
  switch (status) {
    case 'SI':
      return 'bg-tertiary-container text-on-tertiary-container';
    case 'NO':
      return 'bg-error-container text-on-error-container';
    case 'No Rifiutato':
      return 'bg-yellow-container text-on-yellow-container';
    case 'In Fase di Offerta':
      return 'bg-secondary-container text-on-secondary-container';
    default:
      return 'bg-surface-variant text-on-surface-variant';
  }
};

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
    addResource,
    locations,
    loading
  } = useEntitiesContext();
  const { addToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInterview, setEditingInterview] = useState<Interview | Omit<Interview, 'id'> | null>(null);
  const [interviewToDelete, setInterviewToDelete] = useState<EnrichedInterview | null>(null);
  const [filters, setFilters] = useState({ name: '', roleId: '', feedback: '', status: '', hiringStatus: '' });
  
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [resourceDraft, setResourceDraft] = useState<Omit<Resource, 'id'> | null>(null);

  // Inline editing state (can be expanded later if needed, currently unused but good for DataTable pattern)
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);

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
    status: 'Aperto'
  };

  const buildResourceDraftFromInterview = (i: Interview): Omit<Resource, 'id'> => {
    const fullName = `${i.candidateName} ${i.candidateSurname}`.trim();
    const hireDate = toISODate(i.entryDate) || '';
    const defaultLocation = locations?.[0]?.value || 'N/A';
    const local = fullName.toLowerCase().replace(/\s+/g, '.').replace(/[^\w.-]/g, '') || 'candidate';
    const email = `${local}.${hireDate || 'pending'}@example.local`;

    return {
      name: fullName,
      email,
      roleId: i.roleId || '',
      horizontal: i.horizontal || '',
      location: defaultLocation,
      hireDate,
      workSeniority: 0,
      notes: `Creato da Interview ID=${i.id ?? 'N/A'}; feedback=${i.feedback ?? 'N/A'}.`,
      maxStaffingPercentage: 100,
      resigned: false,
      lastDayOfWork: null
    };
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
        age: calculateAge(i.birthDate)
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

  const summaryCards = useMemo(() => {
    const dataToSummarize = enrichedData;
    const activeCandidates = dataToSummarize.filter((i) => i.status === 'Aperto').length;
    const standByCandidates = dataToSummarize.filter((i) => i.status === 'StandBy').length;
    const positiveFeedback = dataToSummarize.filter((i) => i.feedback === 'Positivo').length;
    const positiveOnHoldFeedback = dataToSummarize.filter((i) => i.feedback === 'Positivo On Hold').length;
    const upcomingHires = dataToSummarize
      .filter((i) => i.hiringStatus === 'SI' && i.entryDate && new Date(i.entryDate) >= new Date())
      .sort((a, b) => new Date(a.entryDate!).getTime() - new Date(b.entryDate!).getTime());

    return { activeCandidates, standByCandidates, positiveFeedback, positiveOnHoldFeedback, upcomingHires };
  }, [enrichedData]);

  const pipelineData = useMemo(() => {
    const activeRequests = resourceRequests.filter((req) => req.status === 'ATTIVA');

    return activeRequests
      .map((req) => {
        const linkedInterviews = enrichedData.filter((i) => i.resourceRequestId === req.id);
        const project = projects.find((p) => p.id === req.projectId);
        const role = roles.find((r) => r.id === req.roleId);
        return {
          request: req,
          projectName: project?.name || 'N/A',
          roleName: role?.name || 'N/A',
          interviewCount: linkedInterviews.length,
          candidates: linkedInterviews.map((i) => `${i.candidateName} ${i.candidateSurname}`)
        };
      })
      .sort((a, b) => {
        if (a.interviewCount === 0 && b.interviewCount > 0) return -1;
        if (a.interviewCount > 0 && b.interviewCount === 0) return 1;
        return a.projectName.localeCompare(b.projectName);
      });
  }, [resourceRequests, enrichedData, projects, roles]);

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
          return { value: rr.id!, label: `${rr.requestCode} - ${project?.name} - ${role?.name}` };
        }),
    [resourceRequests, projects, roles]
  );

  const feedbackOptions: { value: InterviewFeedback; label: string }[] = [
    { value: 'Positivo', label: 'Positivo' },
    { value: 'Positivo On Hold', label: 'Positivo On Hold' },
    { value: 'Negativo', label: 'Negativo' }
  ];
  const hiringStatusOptions: { value: InterviewHiringStatus; label: string }[] = [
    { value: 'SI', label: 'Sì' },
    { value: 'NO', label: 'No' },
    { value: 'No Rifiutato', label: 'No (Rifiutato)' },
    { value: 'In Fase di Offerta', label: 'In Fase di Offerta' }
  ];
  const statusOptions: { value: InterviewStatus; label: string }[] = [
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
    setIsModalOpen(true);
  };

  const openModalForEdit = (interview: Interview) => {
    const formattedInterview = {
      ...interview,
      birthDate: interview.birthDate?.split('T')[0] || null,
      interviewDate: interview.interviewDate?.split('T')[0] || null,
      entryDate: interview.entryDate?.split('T')[0] || null
    };
    setEditingInterview(formattedInterview);
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
      if ('id' in editingInterview) await updateInterview(editingInterview as Interview);
      else await addInterview(editingInterview as Omit<Interview, 'id'>);
      addToast('Colloquio salvato correttamente.', 'success');
      handleCloseModal();
    } catch (err) {
      addToast('Errore nel salvataggio del colloquio.', 'error');
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
    { header: 'Richiesta', sortKey: 'resourceRequestLabel', cell: i => <span className="text-xs text-on-surface-variant">{i.resourceRequestLabel || 'Nessuna'}</span> },
    { header: 'Colloquiato Da', cell: i => <span className="text-xs text-on-surface-variant">{i.interviewersNames.join(', ')}</span> },
    { header: 'Data', sortKey: 'interviewDate', cell: i => <span className="text-sm text-on-surface-variant">{formatDate(i.interviewDate)}</span> },
    { header: 'Feedback', sortKey: 'feedback', cell: i => <span className="text-sm text-on-surface-variant">{i.feedback || 'N/A'}</span> },
    { header: 'Stato Assunzione', sortKey: 'hiringStatus', cell: i => <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getHiringStatusBadgeClass(i.hiringStatus)}`}>{i.hiringStatus || 'N/A'}</span> },
    { header: 'Stato Processo', sortKey: 'status', cell: i => <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(i.status)}`}>{i.status}</span> },
  ];

  const renderRow = (interview: EnrichedInterview) => (
    <tr key={interview.id} className="h-16 hover:bg-surface-container group">
        {columns.map((col, i) => (
            <td key={i} className="px-6 py-4 whitespace-nowrap overflow-hidden text-ellipsis bg-inherit" title={col.sortKey ? String((interview as any)[col.sortKey]) : undefined}>
                {col.cell(interview)}
            </td>
        ))}
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 bg-inherit">
            <div className="flex items-center justify-end space-x-3">
                <button onClick={() => openModalForEdit(interview)} className="text-on-surface-variant hover:text-primary" title="Modifica">
                    <span className="material-symbols-outlined">edit</span>
                </button>
                <button onClick={() => setInterviewToDelete(interview)} className="text-on-surface-variant hover:text-error" title="Elimina">
                    {isActionLoading(`deleteInterview-${interview.id}`) ? <SpinnerIcon className="w-5 h-5" /> : <span className="material-symbols-outlined">delete</span>}
                </button>
            </div>
        </td>
    </tr>
  );

  const renderMobileCard = (interview: EnrichedInterview) => (
    <div key={interview.id} className="bg-surface-container-low rounded-lg shadow p-4 mb-4 flex flex-col gap-3 border-l-4 border-primary">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold text-lg text-on-surface">
            {interview.candidateName} {interview.candidateSurname}{' '}
            <span className="text-on-surface-variant font-normal text-base">({interview.age ?? 'N/A'})</span>
          </p>
          <p className="text-sm text-primary font-medium">{interview.roleName || 'N/A'}</p>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0">
          <button onClick={() => openModalForEdit(interview)} className="text-on-surface-variant hover:text-primary" title="Modifica">
            <span className="material-symbols-outlined">edit</span>
          </button>
          <button onClick={() => setInterviewToDelete(interview)} className="text-on-surface-variant hover:text-error" title="Elimina">
            {isActionLoading(`deleteInterview-${interview.id}`) ? <SpinnerIcon className="w-5 h-5" /> : <span className="material-symbols-outlined">delete</span>}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(interview.status)}`}>{interview.status}</span>
        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getHiringStatusBadgeClass(interview.hiringStatus)}`}>{interview.hiringStatus || 'Da definire'}</span>
        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-secondary-container/70 text-on-secondary-container">{interview.feedback || 'N/A'}</span>
      </div>

      <div className="text-sm space-y-3 pt-3 border-t border-outline-variant">
        {interview.cvSummary || interview.notes ? (
          <>
            {interview.cvSummary && (
              <div>
                <h4 className="font-semibold text-on-surface mb-1">Riassunto CV</h4>
                <p className="text-on-surface-variant text-xs whitespace-pre-wrap max-h-24 overflow-y-auto">{interview.cvSummary}</p>
              </div>
            )}
            {interview.notes && (
              <div>
                <h4 className="font-semibold text-on-surface mb-1">Note Colloquio</h4>
                <p className="text-on-surface-variant text-xs whitespace-pre-wrap max-h-24 overflow-y-auto">{interview.notes}</p>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-on-surface-variant italic">Nessun riassunto CV o note disponibili.</p>
        )}
      </div>

      <div className="text-xs text-on-surface-variant mt-auto pt-3 border-t border-outline-variant space-y-1">
        {interview.resourceRequestLabel && (
          <p>
            Richiesta: <span className="font-medium text-on-surface">{interview.resourceRequestLabel}</span>
          </p>
        )}
        <p>
          Colloquio del: <span className="font-medium text-on-surface">{formatDate(interview.interviewDate)}</span>
        </p>
        <p>
          Intervistatori: <span className="font-medium text-on-surface">{interview.interviewersNames.join(', ') || 'N/A'}</span>
        </p>
        {interview.hiringStatus === 'SI' && (
          <p>
            Ingresso previsto: <span className="font-medium text-on-surface">{formatDate(interview.entryDate)}</span>
          </p>
        )}
      </div>
    </div>
  );

  const filtersNode = (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
        <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca candidato..." />
        <SearchableSelect name="roleId" value={filters.roleId} onChange={handleFilterSelectChange} options={roleOptions} placeholder="Tutti i ruoli" />
        <SearchableSelect name="feedback" value={filters.feedback} onChange={handleFilterSelectChange} options={feedbackOptions} placeholder="Tutti i feedback" />
        <SearchableSelect name="hiringStatus" value={filters.hiringStatus} onChange={handleFilterSelectChange} options={hiringStatusOptions} placeholder="Tutti gli stati assunzione" />
        <button onClick={resetFilters} className="px-4 py-2 bg-secondary-container text-on-secondary-container font-semibold rounded-full hover:opacity-90 w-full">
        Reset
        </button>
    </div>
  );

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div
          onClick={() => setFilters({ name: '', roleId: '', feedback: '', status: 'Aperto', hiringStatus: '' })}
          className="bg-surface-container-low p-5 rounded-2xl shadow flex flex-col justify-between cursor-pointer hover:shadow-lg transition-shadow duration-200 min-h-[150px] border-l-4 border-primary"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-medium text-on-surface-variant">Candidati Attivi</h3>
              <p className="text-3xl font-semibold text-on-surface">{summaryCards.activeCandidates}</p>
            </div>
            <span className="material-symbols-outlined text-3xl text-on-surface-variant/50">groups</span>
          </div>
          <p className="text-xs text-on-surface-variant mt-2">{summaryCards.standByCandidates} in Stand-by</p>
        </div>
        <div
          onClick={() => setFilters({ name: '', roleId: '', feedback: 'Positivo', status: '', hiringStatus: '' })}
          className="bg-surface-container-low p-5 rounded-2xl shadow flex flex-col justify-between cursor-pointer hover:shadow-lg transition-shadow duration-200 min-h-[150px] border-l-4 border-tertiary"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-medium text-on-surface-variant">Feedback Positivi</h3>
              <p className="text-3xl font-semibold text-on-surface">{summaryCards.positiveFeedback}</p>
            </div>
            <span className="material-symbols-outlined text-3xl text-on-surface-variant/50">thumb_up</span>
          </div>
          <p className="text-xs text-on-surface-variant mt-2">{summaryCards.positiveOnHoldFeedback} Positivi On Hold</p>
        </div>
        <div
          onClick={() => setFilters({ name: '', roleId: '', feedback: '', status: '', hiringStatus: 'SI' })}
          className="bg-surface-container-low p-5 rounded-2xl shadow flex flex-col justify-between cursor-pointer hover:shadow-lg transition-shadow duration-200 min-h-[150px] border-l-4 border-secondary"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-medium text-on-surface-variant">Prossimi Ingressi</h3>
              <p className="text-3xl font-semibold text-on-surface">{summaryCards.upcomingHires.length}</p>
            </div>
            <span className="material-symbols-outlined text-3xl text-on-surface-variant/50">calendar_month</span>
          </div>
          {summaryCards.upcomingHires.length > 0 ? (
            <div className="mt-2 text-xs text-on-surface-variant space-y-1 overflow-y-auto max-h-20 pr-2">
              {summaryCards.upcomingHires.slice(0, 3).map((hire) => (
                <div key={hire.id} className="flex justify-between items-center">
                  <span className="truncate pr-2">
                    {hire.candidateName} {hire.candidateSurname}
                  </span>
                  <span className="font-medium text-on-surface flex-shrink-0">{formatDate(hire.entryDate)}</span>
                </div>
              ))}
              {summaryCards.upcomingHires.length > 3 && <p className="text-center mt-1">... e altri {summaryCards.upcomingHires.length - 3}</p>}
            </div>
          ) : (
            <div className="mt-2 text-xs text-on-surface-variant">Nessun ingresso pianificato.</div>
          )}
        </div>
      </div>

      <div className="bg-surface-container rounded-2xl shadow p-6 mb-6 border-l-4 border-primary">
        <h2 className="text-xl font-semibold text-on-surface mb-4">Pipeline per Richiesta Attiva</h2>
        <div className="overflow-x-auto max-h-60">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-surface-container-high">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-on-surface-variant">Richiesta</th>
                <th className="px-4 py-2 text-center font-medium text-on-surface-variant">N. Colloqui</th>
                <th className="px-4 py-2 text-left font-medium text-on-surface-variant">Candidati in Pipeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {pipelineData.map(({ request, projectName, roleName, interviewCount, candidates }) => (
                <tr key={request.id} className={interviewCount === 0 ? 'bg-error-container/30' : ''}>
                  <td className="px-4 py-2">
                    <div className="font-semibold text-on-surface">
                      {projectName} - {roleName}
                    </div>
                    <div className="text-xs text-on-surface-variant font-mono">{request.requestCode}</div>
                  </td>
                  <td className="px-4 py-2 text-center font-semibold text-on-surface">{interviewCount}</td>
                  <td className="px-4 py-2 text-xs text-on-surface-variant">{candidates.join(', ') || <span className="italic">Nessun candidato</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DataTable<EnrichedInterview>
        title="Gestione Colloqui"
        addNewButtonLabel="Aggiungi Colloquio"
        data={filteredData}
        columns={columns}
        filtersNode={filtersNode}
        onAddNew={openModalForNew}
        renderRow={renderRow}
        renderMobileCard={renderMobileCard}
        initialSortKey="interviewDate"
        isLoading={loading}
        tableLayout={{ dense: true, striped: true, headerSticky: true, headerBackground: true, headerBorder: true }}
        tableClassNames={{ base: 'w-full text-sm' }}
      />

      {/* Modale INTERVIEW */}
      {editingInterview && (
        <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingInterview ? 'Modifica Colloquio' : 'Nuovo Colloquio'}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-on-surface-variant">Nome Candidato *</label>
                <input type="text" name="candidateName" value={editingInterview.candidateName} onChange={handleChange} required className="form-input" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-on-surface-variant">Cognome Candidato *</label>
                <input type="text" name="candidateSurname" value={editingInterview.candidateSurname} onChange={handleChange} required className="form-input" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-on-surface-variant">Data di Nascita</label>
              <input type="date" name="birthDate" value={editingInterview.birthDate || ''} onChange={handleChange} className="form-input" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-on-surface-variant">Collega a Richiesta Risorsa</label>
              <SearchableSelect name="resourceRequestId" value={editingInterview.resourceRequestId || ''} onChange={handleSelectChange} options={requestOptions} placeholder="Nessuna (Opzionale)" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-on-surface-variant">Horizontal</label>
                <SearchableSelect name="horizontal" value={editingInterview.horizontal || ''} onChange={handleSelectChange} options={horizontalOptions} placeholder="Seleziona..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-on-surface-variant">Ruolo Proposto</label>
                <SearchableSelect name="roleId" value={editingInterview.roleId || ''} onChange={handleSelectChange} options={roleOptions} placeholder="Seleziona..." />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-on-surface-variant">Riassunto CV</label>
              <textarea name="cvSummary" value={editingInterview.cvSummary || ''} onChange={handleChange} rows={3} className="form-textarea"></textarea>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-on-surface-variant">Data Colloquio</label>
                <input type="date" name="interviewDate" value={editingInterview.interviewDate || ''} onChange={handleChange} className="form-input" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-on-surface-variant">Feedback</label>
                <SearchableSelect name="feedback" value={editingInterview.feedback || ''} onChange={handleSelectChange} options={feedbackOptions} placeholder="Seleziona..." />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-on-surface-variant">Colloquiato Da</label>
              <MultiSelectDropdown name="interviewersIds" selectedValues={editingInterview.interviewersIds || []} onChange={handleMultiSelectChange} options={resourceOptions} placeholder="Seleziona una o più persone" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-on-surface-variant">Note Colloquio</label>
              <textarea name="notes" value={editingInterview.notes || ''} onChange={handleChange} rows={3} className="form-textarea"></textarea>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-on-surface-variant">Stato Assunzione</label>
                <SearchableSelect name="hiringStatus" value={editingInterview.hiringStatus || ''} onChange={handleSelectChange} options={hiringStatusOptions} placeholder="Seleziona..." />
              </div>
              {editingInterview.hiringStatus === 'SI' && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-on-surface-variant">Data Ingresso *</label>
                  <input type="date" name="entryDate" value={editingInterview.entryDate || ''} onChange={handleChange} required className="form-input" />
                </div>
              )}
            </div>

            {editingInterview.hiringStatus === 'SI' && editingInterview.entryDate && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const draft = buildResourceDraftFromInterview(editingInterview as Interview);
                    setResourceDraft(draft);
                    setIsResourceModalOpen(true);
                  }}
                  className="px-4 py-2 bg-tertiary-container text-on-tertiary-container font-semibold rounded-full hover:opacity-90"
                >
                  Crea nuova Risorsa
                </button>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={handleCloseModal} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold">
                Annulla
              </button>
              <button
                type="submit"
                disabled={isActionLoading('addInterview') || isActionLoading(`updateInterview-${'id' in editingInterview ? editingInterview.id : ''}`)}
                className="flex justify-center items-center px-6 py-2 bg-primary text-on-primary font-semibold rounded-full hover:opacity-90 disabled:opacity-50"
              >
                {isActionLoading('addInterview') || isActionLoading(`updateInterview-${'id' in editingInterview ? editingInterview.id : ''}`) ? (
                  <SpinnerIcon className="w-5 h-5" />
                ) : (
                  'Salva'
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {isResourceModalOpen && resourceDraft && (
        <Modal isOpen={isResourceModalOpen} onClose={() => setIsResourceModalOpen(false)} title="Aggiungi Risorsa (da Interview)">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!resourceDraft) return;
              try {
                await addResource(resourceDraft);
                addToast('Risorsa creata con successo.', 'success');
                setIsResourceModalOpen(false);
                setIsModalOpen(false);
                setEditingInterview(null);
              } catch (err) {
                addToast('Errore nella creazione della risorsa.', 'error');
              }
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-on-surface-variant">Nome e Cognome *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={resourceDraft.name}
                  onChange={(e) => setResourceDraft({ ...resourceDraft, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-on-surface-variant">Email *</label>
                <input
                  type="email"
                  required
                  className="form-input"
                  value={resourceDraft.email}
                  onChange={(e) => setResourceDraft({ ...resourceDraft, email: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-on-surface-variant">Ruolo *</label>
                <SearchableSelect
                  name="roleId"
                  value={resourceDraft.roleId}
                  onChange={(_, v) => setResourceDraft({ ...resourceDraft, roleId: v })}
                  options={roles.sort((a, b) => a.name.localeCompare(b.name)).map((r) => ({ value: r.id!, label: r.name }))}
                  placeholder="Seleziona un ruolo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-on-surface-variant">Horizontal *</label>
                <SearchableSelect
                  name="horizontal"
                  value={resourceDraft.horizontal}
                  onChange={(_, v) => setResourceDraft({ ...resourceDraft, horizontal: v })}
                  options={horizontals.sort((a, b) => a.value.localeCompare(b.value)).map((h) => ({ value: h.value, label: h.value }))}
                  placeholder="Seleziona un horizontal"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-on-surface-variant">Sede *</label>
                <SearchableSelect
                  name="location"
                  value={resourceDraft.location}
                  onChange={(_, v) => setResourceDraft({ ...resourceDraft, location: v })}
                  options={locations.sort((a, b) => a.value.localeCompare(b.value)).map((l) => ({ value: l.value, label: l.value }))}
                  placeholder="Seleziona una sede"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-on-surface-variant">Data Assunzione</label>
                <input
                  type="date"
                  className="form-input"
                  value={resourceDraft.hireDate || ''}
                  onChange={(e) => setResourceDraft({ ...resourceDraft, hireDate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-on-surface-variant">Max Staffing ({resourceDraft.maxStaffingPercentage}%)</label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={resourceDraft.maxStaffingPercentage}
                onChange={(e) => setResourceDraft({ ...resourceDraft, maxStaffingPercentage: parseInt(e.target.value, 10) })}
                className="w-full accent-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-on-surface-variant">Note</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={resourceDraft.notes || ''}
                onChange={(e) => setResourceDraft({ ...resourceDraft, notes: e.target.value })}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={() => setIsResourceModalOpen(false)} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold">
                Annulla
              </button>
              <button
                type="submit"
                disabled={isActionLoading('addResource')}
                className="flex items-center px-6 py-2 bg-primary text-on-primary font-semibold rounded-full hover:opacity-90 disabled:opacity-50"
              >
                {isActionLoading('addResource') ? <SpinnerIcon className="w-5 h-5" /> : 'Crea Risorsa'}
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
    </div>
  );
};

export default InterviewsPage;