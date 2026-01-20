
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
import ExportButton from '../components/ExportButton';

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
  hiringStatus: interview.hiringStatus || null,
  interviewersIds: interview.interviewersIds && interview.interviewersIds.length > 0 ? interview.interviewersIds : null
});

const buildInterviewPayload = (interview: Interview | Omit<Interview, 'id'>): Interview | Omit<Interview, 'id'> => {
  const basePayload: Omit<Interview, 'id'> = {
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
    status: interview.status
  };

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

// FIX: Added missing export keyword and closed the React component properly.
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
    // FIX: Completed dependencies and added missing JSX return.
  }, [enrichedData]);

  if (loading) return <div className="flex justify-center py-12"><SpinnerIcon className="w-10 h-10 text-primary" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-on-surface">Gestione Colloqui</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-primary">
              <p className="text-sm text-on-surface-variant">Candidati Attivi</p>
              <p className="text-2xl font-bold text-on-surface">{summaryCards.activeCandidates}</p>
          </div>
          <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-tertiary">
              <p className="text-sm text-on-surface-variant">Feedback Positivi</p>
              <p className="text-2xl font-bold text-on-surface">{summaryCards.positiveFeedback}</p>
          </div>
      </div>
      <p className="text-on-surface-variant italic">Sezione in fase di completamento...</p>
    </div>
  );
};

export default InterviewsPage;
