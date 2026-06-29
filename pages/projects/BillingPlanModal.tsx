import React, { useState, useEffect } from 'react';
import { useAppState } from '../../context/AppContext';
import { useProjectsContext } from '../../context/ProjectsContext';
import { Project, BillingType, BillingMilestone, MilestoneStatus } from '../../types';
import Modal from '../../components/Modal';
import { formatCurrency } from '../../utils/formatters';
import { formatDateFull } from '../../utils/dateUtils';
import { useToast } from '../../context/ToastContext';

export const BillingPlanModal: React.FC<{
    project: Project;
    isOpen: boolean;
    onClose: () => void;
}> = ({ project, isOpen, onClose }) => {
    const { billingMilestones, addBillingMilestone, updateBillingMilestone, deleteBillingMilestone, updateProject, contracts, rateCards } = useProjectsContext();
    const { isActionLoading } = useAppState();
    const { addToast } = useToast();

    const [billingType, setBillingType] = useState<BillingType>(project.billingType || 'TIME_MATERIAL');
    const [milestones, setMilestones] = useState<BillingMilestone[]>([]);

    // New Milestone State
    const [newMilestone, setNewMilestone] = useState<Omit<BillingMilestone, 'id' | 'projectId'>>({
        name: '',
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        status: 'PLANNED'
    });

    useEffect(() => {
        setBillingType(project.billingType || 'TIME_MATERIAL');
    }, [project]);

    useEffect(() => {
        setMilestones(billingMilestones.filter(bm => bm.projectId === project.id).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    }, [billingMilestones, project.id]);

    const handleSaveType = async () => {
        try {
            await updateProject({ ...project, billingType });
            addToast('Tipo di fatturazione aggiornato', 'success');
        } catch (e) { addToast('Errore aggiornamento', 'error'); }
    };

    const handleAddMilestone = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addBillingMilestone({ ...newMilestone, projectId: project.id! });
            setNewMilestone({ name: '', date: new Date().toISOString().split('T')[0], amount: 0, status: 'PLANNED' });
            addToast('Milestone aggiunta', 'success');
        } catch (e) { addToast('Errore aggiunta milestone', 'error'); }
    };

    const handleDeleteMilestone = async (id: string) => {
        try {
            await deleteBillingMilestone(id);
            addToast('Milestone rimossa', 'success');
        } catch (e) { addToast('Errore rimozione', 'error'); }
    };

    const handleUpdateMilestoneStatus = async (ms: BillingMilestone, newStatus: MilestoneStatus) => {
        try {
            await updateBillingMilestone({ ...ms, status: newStatus });
        } catch (e) { addToast('Errore aggiornamento stato', 'error'); }
    };

    const totalMilestoneAmount = milestones.reduce((sum, m) => sum + Number(m.amount), 0);
    const contract = contracts.find(c => c.id === project.contractId);
    const rateCard = rateCards.find(rc => rc.id === contract?.rateCardId);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Piano Fatturazione: ${project.name}`}>
            <div className="flex flex-col h-[70vh] space-y-6">

                {/* Billing Type Selector */}
                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-outline-variant">
                    <div>
                        <h4 className="text-sm font-bold text-on-surface">Modalità Contratto</h4>
                        <p className="text-xs text-on-surface-variant">Definisce come viene calcolata la revenue.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={billingType}
                            onChange={(e) => setBillingType(e.target.value as BillingType)}
                            className="form-select text-sm py-1"
                        >
                            <option value="TIME_MATERIAL">Time & Material</option>
                            <option value="FIXED_PRICE">Fixed Price (A Corpo)</option>
                        </select>
                        {billingType !== project.billingType && (
                            <button aria-label="Salva tipologia" onClick={handleSaveType} className="p-2 bg-primary text-on-primary rounded-full hover:opacity-90">
                                <span className="material-symbols-outlined text-sm">save</span>
                            </button>
                        )}
                    </div>
                </div>

                {billingType === 'TIME_MATERIAL' ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-surface-container-lowest border border-dashed border-outline-variant rounded-xl">
                        <span className="material-symbols-outlined text-5xl text-primary/20 mb-4">schedule</span>
                        <h3 className="text-lg font-bold text-on-surface mb-2">Fatturazione a Consuntivo</h3>
                        <p className="text-sm text-on-surface-variant max-w-md">
                            La revenue viene calcolata moltiplicando i giorni lavorati per le tariffe di vendita definite nel listino.
                        </p>
                        {contract ? (
                            <div className="mt-6 p-4 bg-surface rounded border border-outline-variant text-left w-full max-w-sm">
                                <p className="text-xs text-on-surface-variant uppercase font-bold">Contratto Collegato</p>
                                <p className="text-sm font-medium">{contract.name}</p>
                                <p className="text-xs text-on-surface-variant mt-2 uppercase font-bold">Listino Applicato</p>
                                <p className="text-sm font-medium">{rateCard?.name || 'Standard (Costo + Markup)'}</p>
                            </div>
                        ) : (
                            <p className="mt-4 text-xs text-error font-bold bg-error-container/20 p-2 rounded">
                                Nessun contratto collegato. Assicurati di collegare un contratto al progetto.
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex justify-between items-center mb-2 px-1">
                            <h4 className="text-sm font-bold text-on-surface">Piano Rate (Milestones)</h4>
                            <div className="text-xs">
                                <span className="text-on-surface-variant">Totale: </span>
                                <span className={`font-bold ${totalMilestoneAmount > project.budget ? 'text-error' : 'text-primary'}`}>
                                    {formatCurrency(totalMilestoneAmount)}
                                </span>
                                <span className="text-on-surface-variant"> / {formatCurrency(project.budget)}</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4">
                            {milestones.length === 0 ? (
                                <p className="text-center text-xs text-on-surface-variant py-8 italic">Nessuna milestone definita.</p>
                            ) : (
                                milestones.map(ms => (
                                    <div key={ms.id} className="flex justify-between items-center p-3 bg-surface border border-outline-variant rounded-lg">
                                        <div>
                                            <p className="text-sm font-bold text-on-surface">{ms.name}</p>
                                            <p className="text-xs text-on-surface-variant">{formatDateFull(ms.date)}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono font-bold text-sm">{formatCurrency(ms.amount)}</span>
                                            <select
                                                value={ms.status}
                                                onChange={(e) => handleUpdateMilestoneStatus(ms, e.target.value as MilestoneStatus)}
                                                className={`text-xs rounded py-1 px-2 border-none font-bold ${
                                                    ms.status === 'PAID' ? 'bg-tertiary-container text-on-tertiary-container' :
                                                    ms.status === 'INVOICED' ? 'bg-secondary-container text-on-secondary-container' :
                                                    'bg-surface-container-high text-on-surface-variant'
                                                }`}
                                            >
                                                <option value="PLANNED">Pianificata</option>
                                                <option value="INVOICED">Fatturata</option>
                                                <option value="PAID">Pagata</option>
                                            </select>
                                            <button onClick={() => handleDeleteMilestone(ms.id!)} className="text-error hover:bg-error-container p-1 rounded">
                                                <span className="material-symbols-outlined text-sm">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <form onSubmit={handleAddMilestone} className="pt-4 border-t border-outline-variant grid grid-cols-12 gap-2 items-end bg-surface-container-low p-3 rounded-lg">
                            <div className="col-span-5">
                                <label className="text-[10px] font-bold text-on-surface-variant">Descrizione</label>
                                <input type="text" className="form-input text-xs p-2" required value={newMilestone.name} onChange={e => setNewMilestone({...newMilestone, name: e.target.value})} placeholder="es. Anticipo 20%"/>
                            </div>
                            <div className="col-span-3">
                                <label className="text-[10px] font-bold text-on-surface-variant">Data Prevista</label>
                                <input type="date" className="form-input text-xs p-2" required value={newMilestone.date} onChange={e => setNewMilestone({...newMilestone, date: e.target.value})}/>
                            </div>
                            <div className="col-span-3">
                                <label className="text-[10px] font-bold text-on-surface-variant">Importo</label>
                                <input type="number" step="0.01" className="form-input text-xs p-2" required value={newMilestone.amount || ''} onChange={e => setNewMilestone({...newMilestone, amount: parseFloat(e.target.value)})}/>
                            </div>
                            <div className="col-span-1">
                                <button aria-label="Aggiungi tipologia" type="submit" className="w-full bg-primary text-on-primary rounded-lg py-2 flex justify-center items-center hover:opacity-90 disabled:opacity-50" disabled={isActionLoading('addBillingMilestone')}>
                                    <span className="material-symbols-outlined text-sm">add</span>
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </Modal>
    );
};
