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

const toISODate = (s?: string | null) => (!s ? '' : new Date(s.split('T')[0]).toISOString().split('T')[0]);
const normalizeInterviewPayload = <T extends Interview | Omit<Interview, 'id'>>(interview: T): T => ({
  ...interview,
  resourceRequestId: interview.resourceRequestId || null,
  roleId: interview.roleId || null,
  birthDate: interview.birthDate || null,
  interviewDate: interview.interviewDate || null,
  entryDate: interview.entryDate || null,
  feedback: interview.feedback || null,
  hiringStatus: interview.hiringStatus || null
});

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
    locations,
    loading
  } = useEntitiesContext();
  const { addToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInterview, setEditingInterview] = useState<Interview | Omit<Interview, 'id'> | null>(null);
  const [interviewToDelete, setInterviewToDelete] = useState<EnrichedInterview | null>(null);
  const [filters, setFilters] = useState({ name: '', roleId: '', feedback: '', status: '', hiringStatus: '' });
  
  // Inline editing state 
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingEntries = dataToSummarize
      .filter((i) => i.entryDate && new Date(i.entryDate) > today)
      .sort((a, b) => new Date(a.entryDate!).getTime() - new Date(b.entryDate!).getTime());

    return { activeCandidates, standByCandidates, positiveFeedback, positiveOnHoldFeedback, upcomingHires, upcomingEntries };
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
      const normalizedInterview = normalizeInterviewPayload(editingInterview);
      if ('id' in normalizedInterview) await updateInterview(normalizedInterview as Interview);
      else await addInterview(normalizedInterview as Omit<Interview, 'id'>);
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
    { header: 'Data', sortKey: 'interviewDate', cell: i => <span className="text-sm text-on-surface-variant">{formatDateFull(i.interviewDate)}</span> },
    { 
        header: 'Feedback', 
        sortKey: 'feedback', 
        cell: i => i.feedback ? <span className={`px-2 py-0.5 rounded text-xs font-semibold ${i.feedback === 'Positivo' ? 'bg-tertiary-container text-on-tertiary-container' : i.feedback === 'Negativo' ? 'bg-error-container text-on-error-container' : 'bg-yellow-container text-on-yellow-container'}`}>{i.feedback}</span> : '-'
    },
    { 
        header: 'Stato Hiring', 
        sortKey: 'hiringStatus', 
        cell: i => <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getHiringStatusBadgeClass(i.hiringStatus)}`}>{i.hiringStatus || '-'}</span> 
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
        <div className="text-sm text-on-surface-variant">
            <p>Data: {formatDateFull(i.interviewDate)}</p>
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
            initialSortKey="interviewDate"
            isLoading={loading}
            tableLayout={{ dense: true, striped: true, headerSticky: true }}
            numActions={2}
        />

        {/* Edit Modal */}
        {editingInterview && (
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingInterview ? 'Modifica Colloquio' : 'Nuovo Colloquio'}>
                <form onSubmit={handleSubmit} className="flex flex-col">
                    <div className="px-1 space-y-6">
                        
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
