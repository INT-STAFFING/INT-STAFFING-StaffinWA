import React, { useState, useMemo, useEffect } from 'react';
import { useAppState } from '../context/AppContext';
import { useResourcesContext } from '../context/ResourcesContext';
import { useAuth } from '../context/AuthContext';
import { ResourceEvaluation, EvaluationMetric, EvaluationStatus, Resource } from '../types';
import SearchableSelect from '../components/SearchableSelect';
import { SpinnerIcon } from '../components/icons';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import { formatDateFull } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';

// --- Constants ---
const EVALUATION_STATUSES: { value: EvaluationStatus; label: string; color: string }[] = [
    { value: 'DRAFT', label: 'Bozza', color: 'bg-surface-container-highest text-on-surface-variant' },
    { value: 'COMPLETED', label: 'Completata', color: 'bg-primary-container text-on-primary-container' },
    { value: 'ARCHIVED', label: 'Archiviata', color: 'bg-surface-variant text-on-surface-variant opacity-60' }
];

const METRIC_CATEGORIES = ['Obiettivi', 'Competenze', 'Soft Skills', 'Feedback'];

// --- Helper Components ---

const TimelineItem: React.FC<{ 
    evalData: ResourceEvaluation; 
    isLast: boolean; 
    onEdit: (e: ResourceEvaluation) => void; 
    onDelete: (id: string) => void;
    canEdit: boolean;
    evaluatorResource?: Resource;
}> = ({ evalData, isLast, onEdit, onDelete, canEdit, evaluatorResource }) => {
    const statusConfig = EVALUATION_STATUSES.find(s => s.value === evalData.status) || EVALUATION_STATUSES[0];
    const metrics = evalData.metrics || [];

    return (
        <div className="relative pl-8 pb-8 group">
            {/* Connector Line */}
            {!isLast && (
                <div className="absolute top-4 left-[11px] bottom-0 w-0.5 bg-outline-variant group-hover:bg-primary/30 transition-colors"></div>
            )}
            
            {/* Dot */}
            <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-surface ${evalData.status === 'COMPLETED' ? 'bg-primary' : 'bg-outline'} z-10 shadow-sm`}></div>

            {/* Card */}
            <div className="bg-surface rounded-2xl border border-outline-variant shadow-sm p-5 hover:shadow-md transition-shadow relative">
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <h3 className="text-lg font-bold text-on-surface">Anno Fiscale {evalData.fiscalYear}</h3>
                        <div className="flex items-center gap-2 mt-1">
                             <span className="material-symbols-outlined text-sm text-primary">person_edit</span>
                             <p className="text-xs font-bold text-primary truncate">
                                Valutatore: {evaluatorResource?.name || 'Sistema / Non specificato'}
                             </p>
                        </div>
                        <p className="text-[10px] text-on-surface-variant mt-1">Aggiornato: {formatDateFull(evalData.updatedAt)}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${statusConfig.color}`}>
                        {statusConfig.label}
                    </span>
                </div>

                {evalData.summary && (
                    <div className="mb-4 text-sm text-on-surface bg-surface-container-low p-3 rounded-lg border-l-2 border-primary">
                        {evalData.summary}
                    </div>
                )}

                {metrics.length > 0 && (
                    <div className="space-y-2 mb-4">
                        {metrics.map((m, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm border-b border-outline-variant/30 pb-1 last:border-0">
                                <span className="text-on-surface-variant">{m.metricKey}</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-on-surface">{m.metricValue || '-'}</span>
                                    {m.score !== undefined && m.score !== null && (
                                        <span className="bg-primary/10 text-primary px-1.5 rounded text-xs font-bold">{m.score}/5</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex justify-between items-center pt-2 mt-2 border-t border-outline-variant">
                    <div className="flex items-center gap-2">
                         {evalData.overallRating && (
                             <div className="flex items-center gap-1 text-tertiary font-bold text-sm">
                                 <span className="material-symbols-outlined text-base">star</span>
                                 Rating: {evalData.overallRating}/100
                             </div>
                         )}
                    </div>
                    {canEdit && (
                        <div className="flex gap-2">
                             <button onClick={() => onEdit(evalData)} className="p-2 rounded-full hover:bg-surface-container text-primary transition-colors" title="Modifica">
                                <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                             <button onClick={() => onDelete(evalData.id!)} className="p-2 rounded-full hover:bg-surface-container text-error transition-colors" title="Elimina">
                                <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Main Page ---

export const PerformanceTimelinePage: React.FC = () => {
    const { 
        resources, evaluations, fetchEvaluations,
        addEvaluation, updateEvaluation, deleteEvaluation,
    } = useResourcesContext();
    const { isActionLoading } = useAppState();
    const { user, isAdmin } = useAuth();
    const { addToast } = useToast();

    const [selectedResourceId, setSelectedResourceId] = useState<string>('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEval, setEditingEval] = useState<Partial<ResourceEvaluation>>({});
    const [metricsState, setMetricsState] = useState<Partial<EvaluationMetric>[]>([]);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Initial fetch based on user role
    useEffect(() => {
        if (user && user.role === 'SIMPLE' && user.resourceId) {
            setSelectedResourceId(user.resourceId);
            fetchEvaluations(user.resourceId);
        } else {
            fetchEvaluations(); 
        }
    }, [user, fetchEvaluations]);

    // Derived State
    const canManage = useMemo(() => {
        if (!user) return true;
        return isAdmin || user.role.includes('MANAGER');
    }, [isAdmin, user]);

    const activeResource = useMemo(() => resources.find(r => r.id === selectedResourceId), [resources, selectedResourceId]);
    
    const resourceEvaluations = useMemo(() => 
        evaluations
            .filter(e => e.resourceId === selectedResourceId)
            .sort((a,b) => b.fiscalYear - a.fiscalYear), 
    [evaluations, selectedResourceId]);

    const resourceOptions = useMemo(() => resources.filter(r => !r.resigned).map(r => ({ value: r.id!, label: r.name })), [resources]);

    const handleSelectResource = (id: string) => {
        setSelectedResourceId(id);
        fetchEvaluations(id);
    };

    // Modal Handlers
    const openNewModal = () => {
        setEditingEval({
            resourceId: selectedResourceId,
            evaluatorId: user?.resourceId || '', // Default to current user
            fiscalYear: new Date().getFullYear(),
            status: 'DRAFT',
            overallRating: 0
        });
        setMetricsState([
            { category: 'Obiettivi', metricKey: 'Obiettivo Principale', metricValue: '' },
            { category: 'Soft Skills', metricKey: 'Teamwork', score: 3 }
        ]);
        setIsModalOpen(true);
    };

    const openEditModal = (evalData: ResourceEvaluation) => {
        setEditingEval({ ...evalData });
        setMetricsState(evalData.metrics ? [...evalData.metrics] : []);
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingEval.fiscalYear || !editingEval.evaluatorId) {
            addToast('Compila tutti i campi obbligatori compreso il valutatore.', 'warning');
            return;
        }

        const payload = {
            ...editingEval,
            resourceId: selectedResourceId,
            metrics: metricsState.filter(m => m.metricKey)
        } as ResourceEvaluation;

        try {
            if (payload.id) {
                await updateEvaluation(payload);
            } else {
                await addEvaluation(payload);
            }
            setIsModalOpen(false);
        } catch (e) {
            // Error handled by context
        }
    };

    const handleAddMetric = () => {
        setMetricsState([...metricsState, { category: 'Obiettivi', metricKey: '', metricValue: '' }]);
    };

    const handleRemoveMetric = (index: number) => {
        setMetricsState(metricsState.filter((_, i) => i !== index));
    };

    const handleMetricChange = (index: number, field: keyof EvaluationMetric, value: any) => {
        const newMetrics = [...metricsState];
        newMetrics[index] = { ...newMetrics[index], [field]: value };
        setMetricsState(newMetrics);
    };

    const handleDelete = async () => {
        if (deleteId) {
            try {
                await deleteEvaluation(deleteId);
                setDeleteId(null);
            } catch (e) {
                // Il context ha già mostrato il toast di errore
            }
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            {/* Header & Selection */}
            <div className="bg-surface rounded-3xl p-6 shadow-sm border border-outline-variant flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-on-surface flex items-center gap-3">
                        <span className="material-symbols-outlined text-4xl text-primary">history_edu</span>
                        Performance Timeline
                    </h1>
                    <p className="text-sm text-on-surface-variant mt-1">
                        Percorso di crescita e valutazioni annuali.
                    </p>
                </div>
                
                {canManage && (
                    <div className="w-full md:w-72">
                        <SearchableSelect 
                            name="resourceSelector" 
                            value={selectedResourceId} 
                            onChange={(_, v) => handleSelectResource(v)} 
                            options={resourceOptions} 
                            placeholder="Seleziona Risorsa..." 
                        />
                    </div>
                )}
            </div>

            {/* Main Content */}
            {selectedResourceId ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Resource Profile Card */}
                    <div className="space-y-6">
                        <div className="bg-surface rounded-2xl shadow border border-outline-variant p-6 text-center sticky top-6">
                            <div className="w-24 h-24 rounded-full bg-primary/10 mx-auto flex items-center justify-center text-3xl font-bold text-primary mb-4">
                                {activeResource?.name.charAt(0)}
                            </div>
                            <h2 className="text-xl font-bold text-on-surface">{activeResource?.name}</h2>
                            {/* FIX: horizontal -> function */}
                            <p className="text-sm text-on-surface-variant mb-4">{activeResource?.function}</p>
                            
                            <div className="grid grid-cols-2 gap-2 text-left bg-surface-container-low p-4 rounded-xl mb-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-on-surface-variant">Seniority</p>
                                    <p className="font-medium text-primary">{activeResource?.seniorityCode || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-on-surface-variant">Talent</p>
                                    <p className="font-medium text-primary">{activeResource?.isTalent ? 'Sì ⭐' : 'No'}</p>
                                </div>
                            </div>

                            {canManage && (
                                <button 
                                    onClick={openNewModal}
                                    className="w-full py-2 px-4 bg-primary text-on-primary rounded-full font-bold shadow-lg hover:opacity-90 flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined">add</span> Nuova Valutazione
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Timeline */}
                    <div className="lg:col-span-2">
                        {resourceEvaluations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant opacity-60 bg-surface rounded-2xl border border-dashed border-outline-variant">
                                <span className="material-symbols-outlined text-6xl mb-4">timeline</span>
                                <p>Nessuna valutazione registrata.</p>
                            </div>
                        ) : (
                            <div className="relative pl-2 pt-4">
                                {/* Vertical Line Background */}
                                <div className="absolute top-0 bottom-0 left-[19px] w-0.5 bg-outline-variant/30 -z-10"></div>
                                
                                {resourceEvaluations.map((ev, idx) => (
                                    <TimelineItem 
                                        key={ev.id} 
                                        evalData={ev} 
                                        isLast={idx === resourceEvaluations.length - 1} 
                                        onEdit={openEditModal} 
                                        onDelete={setDeleteId}
                                        canEdit={canManage}
                                        evaluatorResource={resources.find(r => r.id === ev.evaluatorId)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="text-center py-20 bg-surface rounded-2xl border border-dashed border-outline-variant m-4">
                    <span className="material-symbols-outlined text-6xl text-primary/20 mb-4">person_search</span>
                    <p className="text-xl text-on-surface font-bold">Nessuna risorsa selezionata</p>
                    <p className="text-on-surface-variant mt-2">Utilizza il menu a tendina in alto per selezionare una risorsa e visualizzare la sua timeline.</p>
                </div>
            )}

            {/* Edit Modal */}
            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEval.id ? "Modifica Valutazione" : "Nuova Valutazione"}>
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-black uppercase text-on-surface-variant mb-1">Valutatore *</label>
                                <SearchableSelect 
                                    name="evaluatorId" 
                                    value={editingEval.evaluatorId || ''} 
                                    onChange={(_, v) => setEditingEval({...editingEval, evaluatorId: v})} 
                                    options={resourceOptions} 
                                    placeholder="Chi ha effettuato la valutazione?" 
                                    required 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase text-on-surface-variant mb-1">Anno Fiscale *</label>
                                <input 
                                    type="number" 
                                    value={editingEval.fiscalYear} 
                                    onChange={e => setEditingEval({...editingEval, fiscalYear: parseInt(e.target.value)})} 
                                    className="form-input font-bold"
                                    min="2020" max="2030"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase text-on-surface-variant mb-1">Stato</label>
                                <select 
                                    value={editingEval.status} 
                                    onChange={e => setEditingEval({...editingEval, status: e.target.value as any})}
                                    className="form-select"
                                >
                                    {EVALUATION_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-black uppercase text-on-surface-variant mb-1">Sommario / Feedback Generale</label>
                                <textarea 
                                    value={editingEval.summary || ''} 
                                    onChange={e => setEditingEval({...editingEval, summary: e.target.value})}
                                    className="form-textarea h-24"
                                    placeholder="Sintesi della performance..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase text-on-surface-variant mb-1">Rating Complessivo (0-100)</label>
                                <input 
                                    type="number" 
                                    value={editingEval.overallRating || 0} 
                                    onChange={e => setEditingEval({...editingEval, overallRating: parseInt(e.target.value)})} 
                                    className="form-input"
                                    min="0" max="100"
                                />
                            </div>
                        </div>

                        {/* Metrics Section */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-sm font-bold text-primary">Metriche & Obiettivi</h4>
                                <button type="button" onClick={handleAddMetric} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-bold hover:bg-primary/20">+ Aggiungi Riga</button>
                            </div>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {metricsState.map((m, idx) => (
                                    <div key={idx} className="flex gap-2 items-start p-2 bg-surface border border-outline-variant rounded-lg">
                                        <div className="flex-1 space-y-2">
                                            <div className="flex gap-2">
                                                 <select 
                                                    value={m.category} 
                                                    onChange={e => handleMetricChange(idx, 'category', e.target.value)}
                                                    className="form-select text-xs w-1/3 py-1"
                                                >
                                                    {METRIC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                                <input 
                                                    type="text" 
                                                    value={m.metricKey || ''} 
                                                    onChange={e => handleMetricChange(idx, 'metricKey', e.target.value)}
                                                    className="form-input text-xs w-2/3 py-1" 
                                                    placeholder="Nome Metrica (es. Fatturato, Certificazione)"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    value={m.metricValue || ''} 
                                                    onChange={e => handleMetricChange(idx, 'metricValue', e.target.value)}
                                                    className="form-input text-xs w-2/3 py-1" 
                                                    placeholder="Valore / Descrizione"
                                                />
                                                <input 
                                                    type="number" 
                                                    value={m.score || ''} 
                                                    onChange={e => handleMetricChange(idx, 'score', parseInt(e.target.value))}
                                                    className="form-input text-xs w-1/3 py-1" 
                                                    placeholder="Score (1-5)"
                                                    min="1" max="5"
                                                />
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => handleRemoveMetric(idx)} className="text-error hover:bg-error-container p-1 rounded mt-1">
                                            <span className="material-symbols-outlined text-base">delete</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-full text-sm font-bold">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addEvaluation') || isActionLoading(`updateEvaluation-${editingEval.id}`)} className="px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-bold shadow-lg flex items-center gap-2">
                                {(isActionLoading('addEvaluation') || isActionLoading(`updateEvaluation-${editingEval.id}`)) ? <SpinnerIcon className="w-4 h-4"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Delete Modal */}
            {deleteId && (
                <ConfirmationModal 
                    isOpen={!!deleteId} 
                    onClose={() => setDeleteId(null)} 
                    onConfirm={handleDelete} 
                    title="Elimina Valutazione" 
                    message="Sei sicuro di voler eliminare questa valutazione? L'azione è irreversibile." 
                    isConfirming={isActionLoading(`deleteEvaluation-${deleteId}`)}
                />
            )}
        </div>
    );
};
export default PerformanceTimelinePage;