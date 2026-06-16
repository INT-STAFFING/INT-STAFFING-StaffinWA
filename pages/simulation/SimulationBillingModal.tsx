/**
 * @file pages/simulation/SimulationBillingModal.tsx
 * @description Modale per la gestione del piano di fatturazione simulato di un progetto.
 * Estratto da SimulationPage.tsx (logica invariata).
 */
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '../../context/ToastContext';
import { SimulationProject, BillingMilestone, BillingType, MilestoneStatus } from '../../types';
import Modal from '../../components/Modal';
import { formatDateFull } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/formatters';
import { Action } from './simulationReducer';

export const SimulationBillingModal: React.FC<{
    project: SimulationProject;
    billingMilestones: BillingMilestone[];
    dispatch: React.Dispatch<Action>;
    onClose: () => void;
}> = ({ project, billingMilestones, dispatch, onClose }) => {
    const [newMilestone, setNewMilestone] = useState<Partial<BillingMilestone>>({ name: '', date: new Date().toISOString().split('T')[0], amount: 0, status: 'PLANNED' });
    const { addToast } = useToast();

    const filteredMilestones = billingMilestones.filter(m => m.projectId === project.id).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const total = filteredMilestones.reduce((s, m) => s + Number(m.amount), 0);

    const handleAdd = () => {
         if (!newMilestone.name?.trim()) {
             addToast('Inserisci un nome per la rata.', 'warning');
             return;
         }
         if (!newMilestone.amount || Number(newMilestone.amount) <= 0) {
             addToast('Inserisci un importo valido.', 'warning');
             return;
         }

         dispatch({
             type: 'ADD_MILESTONE',
             payload: {
                 id: uuidv4(),
                 projectId: project.id!,
                 name: newMilestone.name,
                 date: newMilestone.date || new Date().toISOString().split('T')[0],
                 amount: Number(newMilestone.amount),
                 status: newMilestone.status as MilestoneStatus || 'PLANNED'
             }
         });
         setNewMilestone({ name: '', date: new Date().toISOString().split('T')[0], amount: 0, status: 'PLANNED' });
         addToast('Rata aggiunta con successo.', 'success');
    };

    const handleBillingTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        dispatch({
            type: 'UPDATE_PROJECT_BILLING_TYPE',
            payload: { projectId: project.id!, billingType: e.target.value as BillingType }
        });
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={`Piano Fatturazione Simulato: ${project.name}`}>
            <div className="space-y-4">
                 <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant flex justify-between items-center">
                    <div>
                        <label className="text-[10px] uppercase font-bold text-on-surface-variant block">Tipo Contratto</label>
                        <select
                            className="bg-transparent border-none font-bold text-sm focus:ring-0 p-0 cursor-pointer text-primary"
                            value={project.billingType || 'TIME_MATERIAL'}
                            onChange={handleBillingTypeChange}
                        >
                            <option value="TIME_MATERIAL">Time & Material</option>
                            <option value="FIXED_PRICE">Fixed Price</option>
                        </select>
                    </div>
                    <div className="text-right">
                         <div className="text-[10px] uppercase font-bold text-on-surface-variant">Totale Piano</div>
                         <div className={`text-lg font-mono ${total > (project.budget || 0) ? 'text-error' : 'text-primary'}`}>{formatCurrency(total)}</div>
                    </div>
                </div>

                {project.billingType === 'FIXED_PRICE' ? (
                    <>
                        <div className="max-h-60 overflow-y-auto space-y-2 border border-outline-variant rounded-lg p-2 bg-surface">
                            {filteredMilestones.length === 0 && <p className="text-center text-xs text-on-surface-variant p-4">Nessuna milestone pianificata.</p>}
                            {filteredMilestones.map(ms => (
                                <div key={ms.id} className="flex justify-between items-center p-2 bg-surface-container-low rounded border border-outline-variant text-sm">
                                    <div>
                                        <div className="font-bold">{ms.name}</div>
                                        <div className="text-xs text-on-surface-variant">{formatDateFull(ms.date)} - {ms.status}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono">{formatCurrency(ms.amount)}</span>
                                        <button onClick={() => dispatch({ type: 'DELETE_MILESTONE', payload: ms.id! })} className="text-error hover:bg-error-container p-1 rounded">
                                            <span className="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-4 gap-2 items-end pt-2 border-t border-outline-variant">
                            <div className="col-span-2">
                                <label className="text-[10px] uppercase font-bold text-on-surface-variant">Nome Rata</label>
                                <input type="text" className="form-input text-xs p-1" value={newMilestone.name} onChange={e => setNewMilestone({...newMilestone, name: e.target.value})} placeholder="es. Anticipo"/>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-on-surface-variant">Data</label>
                                <input type="date" className="form-input text-xs p-1" value={newMilestone.date} onChange={e => setNewMilestone({...newMilestone, date: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-on-surface-variant">Importo</label>
                                <input type="number" className="form-input text-xs p-1" value={newMilestone.amount || ''} onChange={e => setNewMilestone({...newMilestone, amount: Number(e.target.value)})} />
                            </div>
                            {/* // FIX: Removed out-of-place Cost G. input from SimulationBillingModal */}
                            <button onClick={handleAdd} className="col-span-4 bg-primary text-on-primary text-xs font-bold py-2 rounded hover:opacity-90">Aggiungi Rata</button>
                        </div>
                    </>
                ) : (
                    <div className="p-6 text-center text-sm text-on-surface-variant border border-dashed border-outline-variant rounded-lg bg-surface-container-lowest">
                        In modalità <strong>Time & Material</strong>, i ricavi sono calcolati automaticamente in base alle allocazioni e alle tariffe del listino.
                    </div>
                )}
            </div>
        </Modal>
    );
};
