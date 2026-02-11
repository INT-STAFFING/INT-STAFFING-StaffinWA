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
import { useSearchParams } from 'react-router-dom';

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
    case 'Aperto': return 'bg-primary-container text-on-primary-container';
    case 'Chiuso': return 'bg-surface-variant text-on-surface-variant';
    case 'StandBy': return 'bg-yellow-container text-on-yellow-container';
    default: return 'bg-surface-variant text-on-surface-variant';
  }
};

const InterviewsPage: React.FC = () => {
    const { 
        interviews, resourceRequests, roles, resources, projects, functions,
        addInterview, updateInterview, deleteInterview, isActionLoading, loading 
    } = useEntitiesContext();
    
    const { addToast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();

    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingInterview, setEditingInterview] = useState<Interview | Omit<Interview, 'id'> | null>(null);
    const [interviewToDelete, setInterviewToDelete] = useState<EnrichedInterview | null>(null);
    const [filters, setFilters] = useState({ name: '', roleId: '', status: '', feedback: '' });
    const [activeTab, setActiveTab] = useState<'table' | 'card'>('table');

    // Deep Linking
    useEffect(() => {
        const editId = searchParams.get('editId');
        if (editId && !isModalOpen && interviews.length > 0) {
            const target = interviews.find(i => i.id === editId);
            if (target) {
                openModalForEdit(target);
                setSearchParams({});
            }
        }
    }, [searchParams, setSearchParams, interviews, isModalOpen]);

    const dataForTable = useMemo<EnrichedInterview[]>(() => {
        return interviews
            .filter(i => 
                (`${i.candidateName} ${i.candidateSurname}`).toLowerCase().includes(filters.name.toLowerCase()) &&
                (!filters.roleId || i.roleId === filters.roleId) &&
                (!filters.status || i.status === filters.status) &&
                (!filters.feedback || i.feedback === filters.feedback)
            )
            .map(i => {
                const req = resourceRequests.find(r => r.id === i.resourceRequestId);
                const proj = req ? projects.find(p => p.id === req.projectId) : null;
                const role = roles.find(r => r.id === i.roleId);
                const interviewers = i.interviewersIds ? resources.filter(r => i.interviewersIds?.includes(r.id!)).map(r => r.name) : [];
                
                // Average Rating Calculation
                const ratings = [
                    i.ratingTechnicalMastery, i.ratingProblemSolving, i.ratingMethodQuality,
                    i.ratingDomainKnowledge, i.ratingAutonomy, i.ratingCommunication,
                    i.ratingProactivity, i.ratingTeamFit
                ].filter(r => r !== null && r !== undefined && r > 0) as number[];
                
                const averageRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

                return {
                    ...i,
                    resourceRequestLabel: req ? `${proj?.name || 'N/D'} - ${req.requestCode}` : null,
                    roleName: role?.name || 'N/A',
                    interviewersNames: interviewers,
                    age: calculateAge(i.birthDate),
                    averageRating
                };
            });
    }, [interviews, resourceRequests, projects, roles, resources, filters]);

    const kpis = useMemo(() => {
        const active = interviews.filter(i => i.status === 'Aperto').length;
        const positive = interviews.filter(i => i.feedback === 'Positivo').length;
        const hired = interviews.filter(i => i.hiringStatus === 'SI').length;
        return { active, positive, hired };
    }, [interviews]);

    const exportData = useMemo(() => {
        return dataForTable.map(i => ({
            'Candidato': `${i.candidateName} ${i.candidateSurname}`,
            'Ruolo Proposto': i.roleName,
            'Function': i.horizontal || '-',
            'Stato Processo': i.status,
            'Esito Colloquio': i.feedback || '-',
            'Stato Assunzione': i.hiringStatus || '-',
            'Data Colloquio': formatDateFull(i.interviewDate),
            'Data Ingresso': formatDateFull(i.entryDate),
            'Media Valutazione': i.averageRating?.toFixed(1) || '-',
            'Intervistatori': i.interviewersNames.join(', '),
            'Note': i.notes || ''
        }));
    }, [dataForTable]);

    const openModalForNew = () => {
        setEditingInterview({
            candidateName: '', candidateSurname: '', birthDate: null, horizontal: functions[0]?.value || '', 
            roleId: '', cvSummary: '', interviewersIds: [], interviewDate: new Date().toISOString().split('T')[0],
            feedback: null, notes: '', hiringStatus: null, entryDate: null, status: 'Aperto',
            resourceRequestId: null
        });
        setIsModalOpen(true);
    };

    const openModalForEdit = (interview: Interview) => {
        setEditingInterview({
            ...interview,
            birthDate: toISODate(interview.birthDate),
            interviewDate: toISODate(interview.interviewDate),
            entryDate: toISODate(interview.entryDate)
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingInterview) return;
        try {
            const payload = buildInterviewPayload(editingInterview);
            if ('id' in payload) await updateInterview(payload as Interview);
            else await addInterview(payload as Omit<Interview, 'id'>);
            setIsModalOpen(false);
            addToast('Colloquio salvato con successo', 'success');
        } catch (e) {}
    };

    // FIX: Added missing handleDelete handler
    const handleDelete = async () => {
        if (interviewToDelete) {
            try {
                await deleteInterview(interviewToDelete.id!);
                addToast('Colloquio eliminato con successo.', 'success');
                setInterviewToDelete(null);
            } catch (e) {
                addToast('Errore durante l\'eliminazione.', 'error');
            }
        }
    };

    const handleRatingChange = (field: keyof Interview, value: number) => {
        if (editingInterview) setEditingInterview({ ...editingInterview, [field]: value });
    };

    const RatingStars: React.FC<{ value: number | null | undefined, onChange?: (v: number) => void, label: string }> = ({ value, onChange, label }) => (
        <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{label}</span>
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                    <button 
                        key={star} 
                        type="button"
                        onClick={() => onChange?.(star)}
                        className={`material-symbols-outlined text-xl transition-colors ${star <= (value || 0) ? 'text-tertiary fill-1' : 'text-outline-variant'}`}
                        style={{ fontVariationSettings: star <= (value || 0) ? "'FILL' 1" : "'FILL' 0" }}
                    >
                        star
                    </button>
                ))}
            </div>
        </div>
    );

    const columns: ColumnDef<EnrichedInterview>[] = [
        { header: 'Candidato', sortKey: 'candidateSurname', cell: i => (
            <div className="flex flex-col sticky left-0 bg-inherit pl-6">
                <span className="font-bold text-on-surface">{i.candidateName} {i.candidateSurname}</span>
                <span className="text-[10px] text-on-surface-variant">{i.age ? `${i.age} anni` : '-'}</span>
            </div>
        )},
        { header: 'Ruolo / Function', cell: i => (
            <div className="flex flex-col">
                <span className="text-sm font-medium">{i.roleName}</span>
                <span className="text-[10px] text-primary font-bold uppercase">{i.horizontal}</span>
            </div>
        )},
        { header: 'Rating', sortKey: 'averageRating', cell: i => i.averageRating ? (
            <div className="flex items-center gap-1">
                <span className="font-mono font-bold text-tertiary">{i.averageRating.toFixed(1)}</span>
                <span className="material-symbols-outlined text-tertiary text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            </div>
        ) : '-' },
        { header: 'Feedback', sortKey: 'feedback', cell: i => i.feedback ? (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${i.feedback === 'Positivo' ? 'bg-tertiary-container text-on-tertiary-container' : i.feedback === 'Negativo' ? 'bg-error-container text-on-error-container' : 'bg-yellow-container text-on-yellow-container'}`}>
                {i.feedback}
            </span>
        ) : '-' },
        { header: 'Stato Processo', sortKey: 'status', cell: i => <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${getStatusBadgeClass(i.status)}`}>{i.status}</span> },
        { header: 'Hiring', sortKey: 'hiringStatus', cell: i => i.hiringStatus === 'SI' ? <span className="text-tertiary font-black text-xs flex items-center gap-1"><span className="material-symbols-outlined text-sm">check_circle</span> ASSUNTO</span> : i.hiringStatus || '-' },
    ];

    const renderRow = (i: EnrichedInterview) => (
        <tr key={i.id} className="hover:bg-surface-container-low group transition-colors">
            {columns.map((col, idx) => <td key={idx} className="px-6 py-4 whitespace-nowrap bg-inherit">{col.cell(i)}</td>)}
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium bg-inherit">
                 <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openModalForEdit(i)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors" title="Modifica"><span className="material-symbols-outlined text-xl">edit</span></button>
                    <button onClick={() => setInterviewToDelete(i)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-error transition-colors" title="Elimina"><span className="material-symbols-outlined text-xl">delete</span></button>
                </div>
            </td>
        </tr>
    );

    const renderCard = (i: EnrichedInterview) => (
        <div key={i.id} className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant shadow-sm hover:shadow-md transition-all flex flex-col gap-4">
             <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                        {i.candidateSurname.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 className="font-bold text-on-surface">{i.candidateName} {i.candidateSurname}</h3>
                        <p className="text-[10px] text-primary font-bold uppercase tracking-widest">{i.horizontal} • {i.roleName}</p>
                    </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-tighter ${getStatusBadgeClass(i.status)}`}>{i.status}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 py-3 border-y border-outline-variant/50">
                 <div>
                    <p className="text-[9px] uppercase font-black text-on-surface-variant opacity-60">Feedback</p>
                    <p className={`text-xs font-bold ${i.feedback === 'Positivo' ? 'text-tertiary' : 'text-on-surface'}`}>{i.feedback || 'Non inserito'}</p>
                 </div>
                 <div>
                    <p className="text-[9px] uppercase font-black text-on-surface-variant opacity-60">Rating Media</p>
                    <div className="flex items-center gap-1 font-bold text-tertiary">
                        {i.averageRating?.toFixed(1) || '-'}
                        {i.averageRating && <span className="material-symbols-outlined text-xs" style={{fontVariationSettings: "'FILL' 1"}}>star</span>}
                    </div>
                 </div>
            </div>

            <div className="flex justify-between items-center mt-auto">
                 <span className="text-[10px] text-on-surface-variant italic">{i.interviewDate ? `Colloquio il ${formatDateFull(i.interviewDate)}` : 'Data non fissata'}</span>
                 <div className="flex gap-2">
                     <button onClick={() => openModalForEdit(i)} className="p-2 text-on-surface-variant hover:text-primary rounded-full hover:bg-surface-container transition-colors"><span className="material-symbols-outlined text-lg">edit</span></button>
                     <button onClick={() => setInterviewToDelete(i)} className="p-2 text-on-surface-variant hover:text-error rounded-full hover:bg-surface-container transition-colors"><span className="material-symbols-outlined text-lg">delete</span></button>
                 </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="bg-primary-container/10 p-5 rounded-3xl border border-primary/20 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black text-primary uppercase tracking-widest mb-1">Processi Aperti</p>
                        <p className="text-3xl font-black text-on-surface">{kpis.active}</p>
                    </div>
                    <span className="material-symbols-outlined text-4xl text-primary/30">pending_actions</span>
                 </div>
                 <div className="bg-tertiary-container/10 p-5 rounded-3xl border border-tertiary/20 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black text-tertiary uppercase tracking-widest mb-1">Feedback Positivi</p>
                        <p className="text-3xl font-black text-on-surface">{kpis.positive}</p>
                    </div>
                    <span className="material-symbols-outlined text-4xl text-tertiary/30">thumb_up</span>
                 </div>
                 <div className="bg-surface-container-high p-5 rounded-3xl border border-outline-variant flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black text-on-surface-variant uppercase tracking-widest mb-1">Totale Assunzioni</p>
                        <p className="text-3xl font-black text-on-surface">{kpis.hired}</p>
                    </div>
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant/20">person_add</span>
                 </div>
            </div>

            <DataTable<EnrichedInterview>
                title="Gestione Colloqui"
                addNewButtonLabel="Nuovo Colloquio"
                onAddNew={openModalForNew}
                data={dataForTable}
                columns={columns}
                filtersNode={
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <input type="text" className="form-input" placeholder="Cerca candidato..." value={filters.name} onChange={e => setFilters({...filters, name: e.target.value})} />
                        <SearchableSelect name="roleId" value={filters.roleId} onChange={(_, v) => setFilters({...filters, roleId: v})} options={roles.map(r => ({ value: r.id!, label: r.name }))} placeholder="Filtra per Ruolo" />
                        <div className="flex items-center gap-2">
                            <div className="flex-grow">
                                <SearchableSelect name="status" value={filters.status} onChange={(_, v) => setFilters({...filters, status: v})} options={[{value: 'Aperto', label: 'Aperti'}, {value: 'Chiuso', label: 'Chiusi'}, {value: 'StandBy', label: 'StandBy'}]} placeholder="Stato Processo" />
                            </div>
                            <div className="flex bg-surface-container p-1 rounded-full shrink-0">
                                <button onClick={() => setActiveTab('table')} className={`p-1.5 rounded-full transition-all ${activeTab === 'table' ? 'bg-surface shadow text-primary' : 'text-on-surface-variant'}`}><span className="material-symbols-outlined text-sm block">table_rows</span></button>
                                <button onClick={() => setActiveTab('card')} className={`p-1.5 rounded-full transition-all ${activeTab === 'card' ? 'bg-surface shadow text-primary' : 'text-on-surface-variant'}`}><span className="material-symbols-outlined text-sm block">grid_view</span></button>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => setFilters({ name: '', roleId: '', status: '', feedback: '' })} className="flex-1 bg-secondary-container text-on-secondary-container py-2 rounded-full font-bold text-sm">Reset</button>
                             <ExportButton data={exportData} title="Report Colloqui" />
                        </div>
                    </div>
                }
                renderRow={renderRow}
                renderMobileCard={renderCard}
                isLoading={loading}
                initialSortKey="candidateSurname"
                numActions={2}
            />

            {/* Main Edit Modal */}
            {isModalOpen && editingInterview && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingInterview && 'id' in editingInterview ? "Dettagli Colloquio" : "Nuovo Inserimento"}>
                    <form onSubmit={handleSave} className="space-y-6">
                        {/* Sezione Anagrafica */}
                        <div className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant">
                            <h4 className="text-sm font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">person</span> Anagrafica Candidato
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase ml-1 mb-1">Nome *</label>
                                    <input type="text" required value={editingInterview.candidateName} onChange={e => setEditingInterview({...editingInterview, candidateName: e.target.value})} className="form-input" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase ml-1 mb-1">Cognome *</label>
                                    <input type="text" required value={editingInterview.candidateSurname} onChange={e => setEditingInterview({...editingInterview, candidateSurname: e.target.value})} className="form-input" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase ml-1 mb-1">Data di Nascita</label>
                                    <input type="date" value={editingInterview.birthDate || ''} onChange={e => setEditingInterview({...editingInterview, birthDate: e.target.value})} className="form-input" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase ml-1 mb-1">Data Colloquio *</label>
                                    <input type="date" required value={editingInterview.interviewDate || ''} onChange={e => setEditingInterview({...editingInterview, interviewDate: e.target.value})} className="form-input" />
                                </div>
                            </div>
                        </div>

                        {/* Sezione Inquadramento */}
                        <div className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant">
                            <h4 className="text-sm font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">work</span> Proposta & Target
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase ml-1 mb-1">Richiesta Correlata</label>
                                    <SearchableSelect name="resourceRequestId" value={editingInterview.resourceRequestId || ''} onChange={(_, v) => setEditingInterview({...editingInterview, resourceRequestId: v})} options={resourceRequests.map(r => ({ value: r.id!, label: `${r.requestCode} - ${roles.find(ro => ro.id === r.roleId)?.name}` }))} placeholder="Seleziona richiesta aperta (opzionale)" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase ml-1 mb-1">Ruolo Proposto</label>
                                        <SearchableSelect name="roleId" value={editingInterview.roleId || ''} onChange={(_, v) => setEditingInterview({...editingInterview, roleId: v})} options={roles.map(r => ({ value: r.id!, label: r.name }))} placeholder="Scegli ruolo..." />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase ml-1 mb-1">Function Target</label>
                                        <SearchableSelect name="horizontal" value={editingInterview.horizontal || ''} onChange={(_, v) => setEditingInterview({...editingInterview, horizontal: v})} options={functions.map(h => ({ value: h.value, label: h.value }))} placeholder="Scegli Function..." />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sezione Valutazione Tecnica (Ratings) */}
                        <div className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant">
                             <h4 className="text-sm font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">star</span> Valutazione Hard & Soft Skills
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <RatingStars label="Technical Mastery" value={editingInterview.ratingTechnicalMastery} onChange={v => handleRatingChange('ratingTechnicalMastery', v)} />
                                    <RatingStars label="Problem Solving" value={editingInterview.ratingProblemSolving} onChange={v => handleRatingChange('ratingProblemSolving', v)} />
                                    <RatingStars label="Method & Quality" value={editingInterview.ratingMethodQuality} onChange={v => handleRatingChange('ratingMethodQuality', v)} />
                                    <RatingStars label="Domain Knowledge" value={editingInterview.ratingDomainKnowledge} onChange={v => handleRatingChange('ratingDomainKnowledge', v)} />
                                </div>
                                <div className="space-y-3">
                                    <RatingStars label="Autonomia" value={editingInterview.ratingAutonomy} onChange={v => handleRatingChange('ratingAutonomy', v)} />
                                    <RatingStars label="Comunicazione" value={editingInterview.ratingCommunication} onChange={v => handleRatingChange('ratingCommunication', v)} />
                                    <RatingStars label="Proattività" value={editingInterview.ratingProactivity} onChange={v => handleRatingChange('ratingProactivity', v)} />
                                    <RatingStars label="Team Fit" value={editingInterview.ratingTeamFit} onChange={v => handleRatingChange('ratingTeamFit', v)} />
                                </div>
                            </div>
                        </div>

                        {/* Sezione Feedback & Outcome */}
                        <div className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant">
                            <h4 className="text-sm font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">assignment_turned_in</span> Esito & Decisione
                            </h4>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase ml-1 mb-1">Feedback Colloquio</label>
                                        <select value={editingInterview.feedback || ''} onChange={e => setEditingInterview({...editingInterview, feedback: e.target.value as InterviewFeedback})} className="form-select">
                                            <option value="">Nessuno</option>
                                            <option value="Positivo">Positivo</option>
                                            <option value="Positivo On Hold">Positivo On Hold</option>
                                            <option value="Negativo">Negativo</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase ml-1 mb-1">Stato Assunzione</label>
                                        <select value={editingInterview.hiringStatus || ''} onChange={e => setEditingInterview({...editingInterview, hiringStatus: e.target.value as InterviewHiringStatus})} className="form-select">
                                            <option value="">In corso</option>
                                            <option value="SI">SI (Assunto)</option>
                                            <option value="In Fase di Offerta">In Fase di Offerta</option>
                                            <option value="No Rifiutato">No (Candidato Rifiutato)</option>
                                            <option value="NO">NO (Scartato)</option>
                                        </select>
                                    </div>
                                </div>

                                {editingInterview.hiringStatus === 'SI' && (
                                    <div className="animate-fade-in">
                                        <label className="block text-[10px] font-bold text-tertiary uppercase ml-1 mb-1">Data Ingresso Prevista</label>
                                        <input type="date" value={editingInterview.entryDate || ''} onChange={e => setEditingInterview({...editingInterview, entryDate: e.target.value})} className="form-input border-tertiary/30" />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase ml-1 mb-1">Intervistatori</label>
                                    <MultiSelectDropdown name="interviewersIds" selectedValues={editingInterview.interviewersIds || []} onChange={(_, v) => setEditingInterview({...editingInterview, interviewersIds: v})} options={resources.filter(r => !r.resigned).map(r => ({ value: r.id!, label: r.name }))} placeholder="Chi ha fatto il colloquio?" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase ml-1 mb-1">Note & Sintesi CV</label>
                                    <textarea value={editingInterview.notes || ''} onChange={e => setEditingInterview({...editingInterview, notes: e.target.value})} className="form-textarea" rows={3} placeholder="Sintesi valutazione, aspettative economiche, preavviso..."></textarea>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase ml-1 mb-1">Stato Processo *</label>
                                    <select required value={editingInterview.status} onChange={e => setEditingInterview({...editingInterview, status: e.target.value as InterviewStatus})} className="form-select">
                                        <option value="Aperto">Aperto</option>
                                        <option value="StandBy">StandBy</option>
                                        <option value="Chiuso">Chiuso</option>
                                        <option value="Non Contattabile">Non Contattabile</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant mt-4">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold transition-colors">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addInterview') || isActionLoading(`updateInterview-${'id' in editingInterview ? editingInterview.id : ''}`)} className="flex justify-center items-center px-8 py-2 bg-primary text-on-primary rounded-full disabled:opacity-50 font-bold shadow-lg hover:opacity-90 transition-all">
                                {(isActionLoading('addInterview') || isActionLoading(`updateInterview-${'id' in editingInterview ? editingInterview.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva Colloquio'}
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
                    title="Elimina Candidato" 
                    message={<>Sei sicuro di voler eliminare permanentemente <strong>{interviewToDelete.candidateName} {interviewToDelete.candidateSurname}</strong>? Tutti i feedback e le valutazioni andranno persi.</>}
                    isConfirming={isActionLoading(`deleteInterview-${interviewToDelete.id}`)}
                />
            )}
        </div>
    );
};

export default InterviewsPage;