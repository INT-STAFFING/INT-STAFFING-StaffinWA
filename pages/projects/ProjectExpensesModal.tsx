import React, { useState, useMemo } from 'react';
import { useAppState } from '../../context/AppContext';
import { useProjectsContext } from '../../context/ProjectsContext';
import { Project, ProjectExpense } from '../../types';
import Modal from '../../components/Modal';
import { SpinnerIcon } from '../../components/icons';
import { formatCurrency } from '../../utils/formatters';
import { formatDateFull } from '../../utils/dateUtils';
import { useToast } from '../../context/ToastContext';
import ConfirmationModal from '../../components/ConfirmationModal';

export const ProjectExpensesModal: React.FC<{
    project: Project;
    isOpen: boolean;
    onClose: () => void;
}> = ({ project, isOpen, onClose }) => {
    const { projectExpenses, addProjectExpense, updateProjectExpense, deleteProjectExpense } = useProjectsContext();
    const { isActionLoading } = useAppState();
    const { addToast } = useToast();

    // Local state for the new expense form
    const [newExpense, setNewExpense] = useState<Omit<ProjectExpense, 'id' | 'projectId'>>({
        category: 'Altro',
        description: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        billable: false
    });

    const [expenseToDelete, setExpenseToDelete] = useState<ProjectExpense | null>(null);

    const projectSpecificExpenses = useMemo(() =>
        projectExpenses.filter(e => e.projectId === project.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [projectExpenses, project.id]);

    const totalExpenses = useMemo(() =>
        projectSpecificExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    [projectSpecificExpenses]);

    const categoryOptions = ['Licenze Software', 'Hardware', 'Viaggi & Trasferte', 'Consulenza Esterna', 'Marketing', 'Altro'];

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addProjectExpense({ ...newExpense, projectId: project.id! });
            addToast('Spesa aggiunta', 'success');
            setNewExpense({ category: 'Altro', description: '', amount: 0, date: new Date().toISOString().split('T')[0], billable: false });
        } catch (err) {
            addToast('Errore aggiunta spesa', 'error');
        }
    };

    const confirmDelete = async () => {
        if (expenseToDelete) {
            try {
                await deleteProjectExpense(expenseToDelete.id!);
                addToast('Spesa eliminata', 'success');
            } catch (err) {
                addToast('Errore eliminazione', 'error');
            } finally {
                setExpenseToDelete(null);
            }
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Spese Extra: ${project.name}`}>
            <div className="flex flex-col h-[70vh]">
                <div className="flex-shrink-0 bg-surface-container-low p-4 rounded-xl border border-outline-variant mb-4 flex justify-between items-center">
                    <div>
                        <p className="text-sm text-on-surface-variant font-medium">Totale Spese Extra</p>
                        <p className="text-2xl font-bold text-primary">{formatCurrency(totalExpenses)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-on-surface-variant">Budget Progetto: {formatCurrency(project.budget)}</p>
                        <p className="text-xs text-on-surface-variant">Incidenza: {project.budget > 0 ? ((totalExpenses / project.budget) * 100).toFixed(1) : 0}%</p>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto pr-1 space-y-2 mb-4">
                    {projectSpecificExpenses.length === 0 ? (
                        <p className="text-center text-sm text-on-surface-variant py-8">Nessuna spesa registrata.</p>
                    ) : (
                        projectSpecificExpenses.map(expense => (
                            <div key={expense.id} className="flex justify-between items-center p-3 bg-surface border border-outline-variant rounded-lg hover:bg-surface-container-low transition-colors group">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm text-on-surface">{expense.category}</span>
                                        {expense.billable && <span className="px-1.5 py-0.5 rounded text-[10px] bg-tertiary-container text-on-tertiary-container font-bold">Rifatturabile</span>}
                                    </div>
                                    <p className="text-xs text-on-surface-variant">{expense.description || '-'}</p>
                                    <p className="text-[10px] text-on-surface-variant">{formatDateFull(expense.date)}</p>
                                </div>
                                <div className="text-right flex items-center gap-2">
                                    <p className="font-mono font-bold text-sm text-on-surface">{formatCurrency(expense.amount)}</p>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setExpenseToDelete(expense); }}
                                        className="text-error hover:bg-error-container p-2 rounded transition-colors"
                                        disabled={isActionLoading(`deleteProjectExpense-${expense.id}`)}
                                        title="Elimina"
                                    >
                                        <span className="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <form onSubmit={handleAdd} className="flex-shrink-0 pt-4 border-t border-outline-variant grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-3">
                        <label className="text-[10px] font-bold uppercase text-on-surface-variant">Categoria</label>
                        <select
                            className="form-select text-xs p-2"
                            value={newExpense.category}
                            onChange={e => setNewExpense({...newExpense, category: e.target.value})}
                        >
                            {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="col-span-3">
                        <label className="text-[10px] font-bold uppercase text-on-surface-variant">Descrizione</label>
                        <input
                            type="text"
                            className="form-input text-xs p-2"
                            placeholder="Dettagli..."
                            value={newExpense.description}
                            onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                            required
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="text-[10px] font-bold uppercase text-on-surface-variant">Data</label>
                        <input
                            type="date"
                            className="form-input text-xs p-2"
                            value={newExpense.date}
                            onChange={e => setNewExpense({...newExpense, date: e.target.value})}
                            required
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="text-[10px] font-bold uppercase text-on-surface-variant">Importo</label>
                        <input
                            type="number"
                            step="0.01"
                            className="form-input text-xs p-2"
                            placeholder="€"
                            value={newExpense.amount || ''}
                            onChange={e => setNewExpense({...newExpense, amount: parseFloat(e.target.value)})}
                            required
                        />
                    </div>
                    <div className="col-span-2 flex justify-end">
                        <button type="submit" className="w-full bg-primary text-on-primary rounded-lg py-2 flex justify-center items-center hover:opacity-90 disabled:opacity-50" disabled={isActionLoading('addProjectExpense')}>
                            {isActionLoading('addProjectExpense') ? <SpinnerIcon className="w-4 h-4"/> : <span className="material-symbols-outlined text-sm">add</span>}
                        </button>
                    </div>
                    <div className="col-span-12 flex items-center gap-2 mt-1">
                         <input
                            type="checkbox"
                            id="billable"
                            className="form-checkbox h-4 w-4"
                            checked={newExpense.billable}
                            onChange={e => setNewExpense({...newExpense, billable: e.target.checked})}
                        />
                        <label htmlFor="billable" className="text-xs text-on-surface cursor-pointer select-none">Spesa rifatturabile al cliente</label>
                    </div>
                </form>
            </div>

            {expenseToDelete && (
                <ConfirmationModal
                    isOpen={!!expenseToDelete}
                    onClose={() => setExpenseToDelete(null)}
                    onConfirm={confirmDelete}
                    title="Elimina Spesa"
                    message="Sei sicuro di voler eliminare questa spesa dal progetto? L'operazione è irreversibile."
                    isConfirming={isActionLoading(`deleteProjectExpense-${expenseToDelete.id}`)}
                />
            )}
        </Modal>
    );
};
