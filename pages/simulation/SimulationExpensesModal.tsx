/**
 * @file pages/simulation/SimulationExpensesModal.tsx
 * @description Modale per la gestione delle spese simulate di un progetto.
 * Estratto da SimulationPage.tsx (logica invariata).
 */
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '../../context/ToastContext';
import { SimulationProject, ProjectExpense } from '../../types';
import Modal from '../../components/Modal';
import { formatDateFull } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/formatters';
import { Action } from './simulationReducer';

export const SimulationExpensesModal: React.FC<{
    project: SimulationProject;
    projectExpenses: ProjectExpense[];
    dispatch: React.Dispatch<Action>;
    onClose: () => void;
}> = ({ project, projectExpenses, dispatch, onClose }) => {
    const [newExpense, setNewExpense] = useState<Partial<ProjectExpense>>({ category: 'Altro', date: new Date().toISOString().split('T')[0], amount: 0, billable: false });
    const { addToast } = useToast();

    const filteredExpenses = projectExpenses.filter(e => e.projectId === project.id);
    const total = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);

    const handleAdd = () => {
        if (!newExpense.amount) {
            addToast('Inserisci un importo valido.', 'warning');
            return;
        }
        dispatch({
            type: 'ADD_EXPENSE',
            payload: {
                id: uuidv4(),
                projectId: project.id!,
                category: newExpense.category || 'Altro',
                description: newExpense.description || '',
                amount: Number(newExpense.amount),
                date: newExpense.date || new Date().toISOString().split('T')[0],
                billable: !!newExpense.billable
            }
        });
        setNewExpense({ category: 'Altro', date: new Date().toISOString().split('T')[0], amount: 0, billable: false });
        addToast('Spesa aggiunta.', 'success');
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={`Spese Simulate: ${project.name}`}>
            <div className="space-y-4">
                <div className="bg-surface-container-low p-3 rounded-lg flex justify-between items-center border border-outline-variant">
                    <span className="text-sm font-bold">Totale Spese</span>
                    <span className="text-lg font-mono text-primary">{formatCurrency(total)}</span>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 border border-outline-variant rounded-lg p-2 bg-surface">
                    {filteredExpenses.length === 0 && <p className="text-center text-xs text-on-surface-variant p-4">Nessuna spesa inserita.</p>}
                    {filteredExpenses.map(exp => (
                        <div key={exp.id} className="flex justify-between items-center p-2 bg-surface-container-low rounded border border-outline-variant text-sm">
                            <div>
                                <div className="font-bold">{exp.category}</div>
                                <div className="text-xs text-on-surface-variant">{formatDateFull(exp.date)} - {exp.description}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono">{formatCurrency(exp.amount)}</span>
                                <button onClick={() => dispatch({ type: 'DELETE_EXPENSE', payload: exp.id! })} className="text-error hover:bg-error-container p-1 rounded">
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-4 gap-2 items-end pt-2 border-t border-outline-variant">
                    <div className="col-span-2">
                        <label className="text-[10px] uppercase font-bold text-on-surface-variant">Descrizione</label>
                        <input type="text" className="form-input text-xs p-1" value={newExpense.description || ''} onChange={e => setNewExpense({...newExpense, description: e.target.value})} />
                    </div>
                     <div>
                        <label className="text-[10px] uppercase font-bold text-on-surface-variant">Data</label>
                        <input type="date" className="form-input text-xs p-1" value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-bold text-on-surface-variant">Importo</label>
                        <input type="number" className="form-input text-xs p-1" value={newExpense.amount || ''} onChange={e => setNewExpense({...newExpense, amount: Number(e.target.value)})} />
                    </div>
                    <button onClick={handleAdd} className="col-span-4 bg-primary text-on-primary text-xs font-bold py-2 rounded">Aggiungi Spesa</button>
                </div>
            </div>
        </Modal>
    );
};
