/**
 * @file RecruitmentPage.tsx
 * @description Pagina per la gestione del processo di assunzione e dei candidati (Kanban board).
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Candidate, PipelineStatus, InterviewFeedback } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { PlusCircleIcon, PencilIcon, TrashIcon, SpinnerIcon, UserPlusIcon } from '../components/icons';
import { useNavigate } from 'react-router-dom';
import ConfirmationModal from '../components/ConfirmationModal';


const PIPELINE_STAGES: PipelineStatus[] = [
    'Candidature Ricevute e screening CV',
    'Colloquio HR',
    'Colloquio Tecnico',
    'Proposta Inviata',
    'Assunto',
    'Scartato'
];

const INTERVIEW_FEEDBACK_OPTIONS: InterviewFeedback[] = ['Positivo', 'Positivo On Hold', 'Negativo'];

const getStatusColor = (status: PipelineStatus) => {
    switch (status) {
        case 'Assunto': return 'bg-green-100 dark:bg-green-900/50 border-green-500';
        case 'Scartato': return 'bg-red-100 dark:bg-red-900/50 border-red-500';
        case 'Proposta Inviata': return 'bg-blue-100 dark:bg-blue-900/50 border-blue-500';
        default: return 'bg-gray-100 dark:bg-gray-900/50 border-gray-400';
    }
}

// --- CandidateCard Component ---
const CandidateCard: React.FC<{ candidate: Candidate; onEdit: (c: Candidate) => void; onDelete: (c: Candidate) => void; }> = ({ candidate, onEdit, onDelete }) => {
    const { roles } = useEntitiesContext();
    const navigate = useNavigate();
    const role = roles.find(r => r.id === candidate.roleId);

    const handleConvertToResource = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigate('/resources', { state: { candidateToConvert: candidate } });
    }

    return (
        <div 
            draggable 
            onDragStart={(e) => e.dataTransfer.setData("candidateId", candidate.id!)}
            onClick={() => onEdit(candidate)}
            className="p-3 mb-3 bg-white dark:bg-gray-800 rounded-lg shadow-md border-l-4 cursor-pointer hover:shadow-lg transition-shadow"
            style={{ borderLeftColor: getStatusColor(candidate.pipelineStatus).split(' ')[2] }}
        >
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-gray-900 dark:text-white">{candidate.firstName} {candidate.lastName}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{role?.name || 'Ruolo non specificato'}</p>
                </div>
                <div className="flex space-x-1">
                     {candidate.pipelineStatus === 'Assunto' && (
                        <button onClick={handleConvertToResource} title="Converti in Risorsa" className="p-1 text-green-600 hover:text-green-500"><UserPlusIcon className="w-5 h-5"/></button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); onEdit(candidate); }} title="Modifica" className="p-1 text-gray-500 hover:text-blue-600"><PencilIcon className="w-4 h-4"/></button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(candidate); }} title="Elimina" className="p-1 text-gray-500 hover:text-red-600"><TrashIcon className="w-4 h-4"/></button>
                </div>
            </div>
            {candidate.nextInterviewDate && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Prossimo colloquio: {new Date(candidate.nextInterviewDate).toLocaleDateString('it-IT')}</p>
            )}
        </div>
    );
};


// --- RecruitmentPage Component ---
const RecruitmentPage: React.FC = () => {
    const { candidates, roles, resources, horizontals, addCandidate, updateCandidate, deleteCandidate, isActionLoading } = useEntitiesContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCandidate, setEditingCandidate] = useState<Candidate | Omit<Candidate, 'id'> | null>(null);
    const [dragOverStatus, setDragOverStatus] = useState<PipelineStatus | null>(null);
    const [candidateToDelete, setCandidateToDelete] = useState<Candidate | null>(null);

    const emptyCandidate: Omit<Candidate, 'id'> = {
        firstName: '', lastName: '', birthYear: null, horizontal: '', roleId: null,
        cvSummary: '', interviewers: [], nextInterviewDate: null, interviewFeedback: null,
        notes: '', entryDate: null, status: 'Aperto', pipelineStatus: 'Candidature Ricevute e screening CV',
    };

    const handleOpenModal = (candidate: Candidate | null = null) => {
        setEditingCandidate(candidate || emptyCandidate);
        setIsModalOpen(true);
    };
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCandidate(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingCandidate) {
            try {
                if ('id' in editingCandidate) await updateCandidate(editingCandidate as Candidate);
                else await addCandidate(editingCandidate as Omit<Candidate, 'id'>);
                handleCloseModal();
            } catch (error) {}
        }
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        if (!editingCandidate) return;
        const { name, value } = e.target;
        setEditingCandidate(prev => ({ ...prev!, [name]: name === 'birthYear' ? (value ? parseInt(value) : null) : value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        if (editingCandidate) setEditingCandidate(prev => ({ ...prev!, [name]: value }));
    };

    const handleMultiSelectChange = (name: string, values: string[]) => {
        if (editingCandidate) setEditingCandidate(prev => ({ ...prev!, [name]: values }));
    };

    const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>, status: PipelineStatus) => {
        e.preventDefault();
        const candidateId = e.dataTransfer.getData("candidateId");
        const candidate = candidates.find(c => c.id === candidateId);
        if (candidate && candidate.pipelineStatus !== status) {
            await updateCandidate({ ...candidate, pipelineStatus: status });
        }
        setDragOverStatus(null);
    }, [candidates, updateCandidate]);

    const roleOptions = useMemo(() => roles.map(r => ({ value: r.id!, label: r.name })), [roles]);
    const resourceOptions = useMemo(() => resources.map(r => ({ value: r.id!, label: r.name })), [resources]);
    const horizontalOptions = useMemo(() => horizontals.map(h => ({ value: h.value, label: h.value })), [horizontals]);

    return (
        <div>
             <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Pipeline Assunzioni</h1>
                <button onClick={() => handleOpenModal()} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700">
                    <PlusCircleIcon className="w-5 h-5 mr-2"/> Aggiungi Candidato
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 overflow-x-auto pb-4">
                {PIPELINE_STAGES.map(status => (
                    <div 
                        key={status}
                        onDragOver={(e) => { e.preventDefault(); setDragOverStatus(status); }}
                        onDragLeave={() => setDragOverStatus(null)}
                        onDrop={(e) => handleDrop(e, status)}
                        className={`p-4 rounded-lg bg-gray-50 dark:bg-gray-900 transition-colors ${dragOverStatus === status ? 'bg-blue-100 dark:bg-blue-900/50' : ''}`}
                    >
                        <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-4 text-center">{status} ({candidates.filter(c => c.pipelineStatus === status).length})</h2>
                        <div className="min-h-[200px]">
                        {candidates.filter(c => c.pipelineStatus === status).map(candidate => (
                            <CandidateCard key={candidate.id} candidate={candidate} onEdit={handleOpenModal} onDelete={setCandidateToDelete} />
                        ))}
                        </div>
                    </div>
                ))}
            </div>

            {editingCandidate && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingCandidate ? 'Modifica Candidato' : 'Nuovo Candidato'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="label">Nome *</label><input type="text" name="firstName" value={editingCandidate.firstName} onChange={handleChange} required className="form-input"/></div>
                            <div><label className="label">Cognome *</label><input type="text" name="lastName" value={editingCandidate.lastName} onChange={handleChange} required className="form-input"/></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="label">Anno di Nascita</label><input type="number" name="birthYear" value={editingCandidate.birthYear || ''} onChange={handleChange} className="form-input"/></div>
                             <div><label className="label">Horizontal</label><SearchableSelect name="horizontal" value={editingCandidate.horizontal} onChange={handleSelectChange} options={horizontalOptions} placeholder="Seleziona horizontal"/></div>
                        </div>
                        <div><label className="label">Ruolo Candidatura</label><SearchableSelect name="roleId" value={editingCandidate.roleId || ''} onChange={handleSelectChange} options={roleOptions} placeholder="Seleziona ruolo"/></div>
                        <div><label className="label">Riassunto CV</label><textarea name="cvSummary" value={editingCandidate.cvSummary || ''} onChange={handleChange} rows={3} className="form-textarea"/></div>
                        <div><label className="label">Colloquiato da</label><MultiSelectDropdown name="interviewers" selectedValues={editingCandidate.interviewers} onChange={handleMultiSelectChange} options={resourceOptions} placeholder="Seleziona risorse"/></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="label">Data Prossimo Colloquio</label><input type="date" name="nextInterviewDate" value={editingCandidate.nextInterviewDate || ''} onChange={handleChange} className="form-input"/></div>
                            <div><label className="label">Feedback Colloquio</label><select name="interviewFeedback" value={editingCandidate.interviewFeedback || ''} onChange={handleChange} className="form-select"><option value="">Seleziona</option>{INTERVIEW_FEEDBACK_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="label">Data Ingresso Prevista</label><input type="date" name="entryDate" value={editingCandidate.entryDate || ''} onChange={handleChange} className="form-input"/></div>
                            <div><label className="label">Stato Iter</label><select name="status" value={editingCandidate.status} onChange={handleChange} className="form-select"><option value="Aperto">Aperto</option><option value="Chiuso">Chiuso</option></select></div>
                        </div>
                         <div><label className="label">Pipeline</label><select name="pipelineStatus" value={editingCandidate.pipelineStatus} onChange={handleChange} className="form-select">{PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                        <div><label className="label">Note</label><textarea name="notes" value={editingCandidate.notes || ''} onChange={handleChange} rows={3} className="form-textarea"/></div>

                        <div className="flex justify-end space-x-3 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 rounded-md">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addCandidate') || isActionLoading(`updateCandidate-${'id' in editingCandidate ? editingCandidate.id : ''}`)} className="flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400">
                                {isActionLoading('addCandidate') || isActionLoading(`updateCandidate-${'id' in editingCandidate ? editingCandidate.id : ''}`) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {candidateToDelete && (
                <ConfirmationModal
                    isOpen={!!candidateToDelete}
                    onClose={() => setCandidateToDelete(null)}
                    onConfirm={() => {
                        deleteCandidate(candidateToDelete.id!);
                        setCandidateToDelete(null);
                    }}
                    title="Conferma Eliminazione Candidato"
                    message={<>Sei sicuro di voler eliminare il candidato <strong>{candidateToDelete.firstName} {candidateToDelete.lastName}</strong>?</>}
                    isConfirming={isActionLoading(`deleteCandidate-${candidateToDelete.id}`)}
                />
            )}

             <style>{`
                .label { display: block; text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 }
                .form-input, .form-select, .form-textarea { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } 
                .dark .form-input, .dark .form-select, .dark .form-textarea { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }
            `}</style>
        </div>
    );
};

export default RecruitmentPage;
