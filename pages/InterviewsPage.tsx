import React, { useState, useMemo, useEffect } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Interview, InterviewFeedback, InterviewHiringStatus, InterviewStatus, Resource } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { SpinnerIcon } from '../components/icons';
import ConfirmationModal from '../components/ConfirmationModal';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { useToast } from '../context/ToastContext';

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

// FIX: Changed to a named export to resolve type error during lazy loading.
export const InterviewsPage: React.FC = () => {
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
    locations
  } = useEntitiesContext();
  const { addToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInterview, setEditingInterview] = useState<Interview | Omit<Interview, 'id'> | null>(null);
  const [interviewToDelete, setInterviewToDelete] = useState<EnrichedInterview | null>(null);
  const [filters, setFilters] = useState({ name: '', roleId: '', feedback: '', status: '', hiringStatus: '' });
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'interviewDate', direction: 'descending' });
  const [view, setView] = useState<'table' | 'card'>('table');

  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [resourceDraft, setResourceDraft] = useState<Omit<Resource, 'id'> | null>(null);

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

  const sortedAndFilteredData = useMemo(() => {
    const filtered = enrichedData.filter(
      (i) =>
        (i.candidateName + ' ' + i.candidateSurname).toLowerCase().includes(filters.name.toLowerCase()) &&
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
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortConfig.direction === 'ascending' ? aValue.getTime() - bValue.getTime() : bValue.getTime() - aValue.getTime();
      }
      return 0;
    });
  }, [enrichedData, filters, sortConfig]);

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

  const requestSort = (key: string) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

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

  const columns = [
    { header: 'Candidato', sortKey: 'candidateSurname' },
    { header: 'Ruolo Proposto', sortKey: 'roleName' },
    { header: 'Richiesta Collegata', sortKey: 'resourceRequestLabel' },
    { header: 'Colloquiato Da' },
    { header: 'Data Colloquio', sortKey: 'interviewDate' },
    { header: 'Feedback', sortKey: 'feedback' },
    { header: 'Stato Assunzione', sortKey: 'hiringStatus' },
    { header: 'Data Ingresso', sortKey: 'entryDate' },
    { header: 'Stato Processo', sortKey: 'status' }
  ];

  const renderCard = (interview: EnrichedInterview) => (
    <div key={interview.id} className="bg-surface-container-low rounded-2xl shadow p-5 flex flex-col gap-4">
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

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div
          onClick={() => setFilters({ name: '', roleId: '', feedback: '', status: 'Aperto', hiringStatus: '' })}
          className="bg-surface-container-low p-5 rounded-2xl shadow flex flex-col justify-between cursor-pointer hover:shadow-lg transition-shadow duration-200 min-h-[150px]"
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
          className="bg-surface-container-low p-5 rounded-2xl shadow flex flex-col justify-between cursor-pointer hover:shadow-lg transition-shadow duration-200 min-h-[150px]"
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
          className="bg-surface-container-low p-5 rounded-2xl shadow flex flex-col justify-between cursor-pointer hover:shadow-lg transition-shadow duration-200 min-h-[150px]"
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

      <div className="bg-surface-container rounded-2xl shadow p-6 mb-6">
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
                  <td className="px-4 py-2 text-center font-semibold--- START OF FILE pages/DbInspectorPage.tsx ---

import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { SpinnerIcon } from '../components/icons';
import ConfirmationModal from '../components/ConfirmationModal';

interface Column {
    column_name: string;
    data_type: string;
}

interface TableData {
    columns: Column[];
    rows: any[];
}

const DbInspectorPage: React.FC = () => {
    const [tables, setTables] = useState<string[]>([]);
    const [selectedTable, setSelectedTable] = useState<string>('');
    const [tableData, setTableData] = useState<TableData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    const [editingRowData, setEditingRowData] = useState<any | null>(null);
    const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
    const [isExportingPg, setIsExportingPg] = useState(false);
    const [isExportingMysql, setIsExportingMysql] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        const fetchTables = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('/api/resources?entity=db_inspector&action=list_tables');
                if (!response.ok) throw new Error('Failed to fetch table list');
                const data = await response.json();
                setTables(data);
                if (data.length > 0) {
                    setSelectedTable(data[0]);
                }
            } catch (error) {
                addToast((error as Error).message, 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchTables();
    }, [addToast]);

    useEffect(() => {
        if (!selectedTable) {
            setTableData(null);
            return;
        }
        const fetchTableData = async () => {
            setIsLoading(true);
            setTableData(null);
            setEditingRowId(null);
            try {
                const response = await fetch(`/api/resources?entity=db_inspector&action=get_table_data&table=${selectedTable}`);
                if (!response.ok) throw new Error(`Failed to fetch data for table ${selectedTable}`);
                const data = await response.json();
                setTableData(data);
            } catch (error) {
                addToast((error as Error).message, 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchTableData();
    }, [selectedTable, addToast]);
    
    const handleEdit = (row: any) => {
        setEditingRowId(row.id);
        setEditingRowData({ ...row });
    };

    const handleCancel = () => {
        setEditingRowId(null);
        setEditingRowData(null);
    };

    const handleSave = async () => {
        if (!editingRowData || !selectedTable) return;
        setIsSaving(true);
        try {
            const updates = { ...editingRowData };
            delete updates.id;

            const response = await fetch(`/api/resources?entity=db_inspector&action=update_row&table=${selectedTable}&id=${editingRowId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save changes');
            }
            addToast('Riga aggiornata con successo.', 'success');
            setTableData(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    rows: prev.rows.map(row => (row.id === editingRowId ? editingRowData : row)),
                };
            });
            handleCancel();
        } catch (error) {
            addToast((error as Error).message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAll = async () => {
        if (!selectedTable) return;
        setIsSaving(true);
        try {
            const response = await fetch(`/api/resources?entity=db_inspector&action=delete_all_rows&table=${selectedTable}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete all rows');
            }
            addToast(`Tutte le righe dalla tabella '${selectedTable}' sono state eliminate.`, 'success');
            setTableData(prev => prev ? { ...prev, rows: [] } : null); // Clear the data locally
            handleCancel(); // Close any inline editing
        } catch (error) {
            addToast((error as Error).message, 'error');
        } finally {
            setIsSaving(false);
            setIsDeleteAllModalOpen(false);
        }
    };

    const handleExport = async (dialect: 'postgres' | 'mysql') => {
        if (dialect === 'postgres') setIsExportingPg(true);
        else setIsExportingMysql(true);
    
        try {
            const response = await fetch(`/api/resources?entity=db_inspector&action=export_sql&dialect=${dialect}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to export ${dialect} SQL`);
            }
            const sql = await response.text();
            const blob = new Blob([sql], { type: 'application/sql' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `db_export_${dialect}.sql`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            addToast(`Export ${dialect.toUpperCase()} SQL completato.`, 'success');
        } catch (error) {
            addToast((error as Error).message, 'error');
        } finally {
            if (dialect === 'postgres') setIsExportingPg(false);
            else setIsExportingMysql(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>, colName: string, colType: string) => {
        if (!editingRowData) return;
        let value: any = e.target.value;
        
        if (colType.includes('boolean')) {
            value = value === 'true';
        } else if (colType.includes('int') || colType.includes('numeric')) {
            value = value === '' ? null : Number(value);
        }
        
        setEditingRowData({ ...editingRowData, [colName]: value });
    };

    const renderInputField = (col: Column, value: any) => {
        const colName = col.column_name;
        const colType = col.data_type;
    
        if (colType.includes('timestamp') || colType.includes('date')) {
            const dateValue = value ? new Date(value).toISOString().split('T')[0] : '';
            return (
                <input
                    type="date"
                    value={dateValue}
                    onChange={e => handleInputChange(e, colName, colType)}
                    className="form-input text-sm p-1"
                />
            );
        }
        if (colType.includes('int') || colType.includes('numeric')) {
            return (
                <input
                    type="number"
                    value={value ?? ''}
                    onChange={e => handleInputChange(e, colName, colType)}
                    className="form-input text-sm p-1"
                />
            );
        }
        if (colType.includes('boolean')) {
            return (
                <select
                    value={String(value ?? 'false')}
                    onChange={e => handleInputChange(e, colName, colType)}
                    className="form-select text-sm p-1"
                >
                    <option value="true">true</option>
                    <option value="false">false</option>
                </select>
            );
        }
        return (
            <input
                type="text"
                value={value ?? ''}
                onChange={e => handleInputChange(e, colName, colType)}
                className="form-input text-sm p-1"
            />
        );
    };

    const renderCellContent = (value: any, columnName: string) => {
        const currencyColumns = [
            'daily_cost', 'standard_cost', 'daily_expenses', 'budget', 'capienza', 'backlog',
            'produzione_lorda', 'produzione_lorda_network_italia', 'perdite', 'spese_onorari_esterni',
            'spese_altro', 'fatture_onorari', 'fatture_spese', 'iva', 'incassi'
        ];
    
        if (currencyColumns.includes(columnName) && (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value))))) {
            return (Number(value) || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
        }
        
        if (value === null || value === undefined) return <i className="text-on-surface-variant/70">NULL</i>;
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'object' && value !== null) return JSON.stringify(value);
        return String(value);
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-on-surface mb-6">Database Inspector</h1>
            
            <div className="mb-6 p-4 bg-surface rounded-2xl shadow">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="table-select" className="block text-sm font-medium text-on-surface-variant mb-2">Seleziona una Tabella</label>
                        <select
                            id="table-select"
                            value={selectedTable}
                            onChange={e => setSelectedTable(e.target.value)}
                            className="form-select w-full"
                            disabled={isLoading}
                        >
                            {tables.map(table => <option key={table} value={table}>{table}</option>)}
                        </select>
                    </div>
                     <div className="space-y-2">
                         <label className="block text-sm font-medium text-on-surface-variant mb-2">Azioni Globali</label>
                         <div className="flex items-center gap-2">
                             <button
                                onClick={() => handleExport('postgres')}
                                disabled={isLoading || isExportingPg || isExportingMysql}
                                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-primary text-on-primary font-semibold rounded-full hover:opacity-90 disabled:opacity-50"
                            >
                                {isExportingPg ? <SpinnerIcon className="w-5 h-5"/> : 'Export Neon (PG)'}
                            </button>
                            <button
                                onClick={() => handleExport('mysql')}
                                disabled={isLoading || isExportingPg || isExportingMysql}
                                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-tertiary text-on-tertiary font-semibold rounded-full hover:opacity-90 disabled:opacity-50"
                            >
                                {isExportingMysql ? <SpinnerIcon className="w-5 h-5"/> : 'Export MySQL'}
                            </button>
                            <button
                                onClick={() => setIsDeleteAllModalOpen(true)}
                                disabled={isLoading || !selectedTable || !tableData || tableData.rows.length === 0}
                                className="px-4 py-2 bg-error text-on-error font-semibold rounded-full hover:opacity-90 disabled:opacity-50"
                                title="Elimina Tutte le Righe dalla Tabella Selezionata"
                            >
                                Svuota
                            </button>
                         </div>
                    </div>
                </div>
            </div>

            {isLoading && !tableData && (
                <div className="flex justify-center items-center py-12">
                    <SpinnerIcon className="w-8 h-8 text-primary" />
                </div>
            )}
            
            {tableData && (
                <div className="bg-surface rounded-2xl shadow overflow-x-auto relative">
                    {(isLoading || isSaving) && (
                        <div className="absolute inset-0 bg-surface/50 flex justify-center items-center z-10">
                            <SpinnerIcon className="w-8 h-8 text-primary" />
                        </div>
                    )}
                    <table className="min-w-full divide-y divide-outline-variant">
                        <thead className="bg-surface-container-low">
                            <tr>
                                {tableData.columns.map(col => (
                                    <th key={col.column_name} className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                                        {col.column_name}
                                        <span className="block text-on-surface-variant/70 font-normal normal-case">{col.data_type}</span>
                                    </th>
                                ))}
                                <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant">
                            {tableData.rows.map(row => (
                                <tr key={row.id} className="hover:bg-surface-container">
                                    {tableData.columns.map(col => (
                                        <td key={col.column_name} className="px-4 py-3 whitespace-nowrap text-sm text-on-surface-variant align-top">
                                            {editingRowId === row.id && col.column_name !== 'id' ? (
                                                renderInputField(col, editingRowData[col.column_name])
                                            ) : (
                                                renderCellContent(row[col.column_name], col.column_name)
                                            )}
                                        </td>
                                    ))}
                                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                        {editingRowId === row.id ? (
                                            <div className="flex items-center justify-end space-x-2">
                                                <button onClick={handleSave} disabled={isSaving} className="p-1 text-tertiary hover:opacity-80 disabled:opacity-50">
                                                    {isSaving ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">check</span>}
                                                </button>
                                                <button onClick={handleCancel} disabled={isSaving} className="p-1 text-on-surface-variant hover:opacity-80 disabled:opacity-50"><span className="material-symbols-outlined">close</span></button>
                                            </div>
                                        ) : (
                                            <button onClick={() => handleEdit(row)} className="text-on-surface-variant hover:text-primary" title="Modifica"><span className="material-symbols-outlined">edit</span></button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {tableData.rows.length === 0 && (
                        <p className="text-center text-on-surface-variant py-8">La tabella è vuota.</p>
                    )}
                </div>
            )}
            
            <ConfirmationModal
                isOpen={isDeleteAllModalOpen}
                onClose={() => setIsDeleteAllModalOpen(false)}
                onConfirm={handleDeleteAll}
                title={`Conferma Eliminazione Totale`}
                message={
                    <>
                        Sei assolutamente sicuro di voler eliminare <strong>tutte le righe</strong> dalla tabella <strong>{selectedTable}</strong>?
                        <br />
                        <strong className="text-error">Questa azione è irreversibile.</strong>
                    </>
                }
                isConfirming={isSaving}
            />
        </div>
    );
};

export default DbInspectorPage;
```