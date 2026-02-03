
import React, { useState, useMemo } from 'react';
import { useConfigContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { DataTable, ColumnDef } from '../components/DataTable';
import Modal from '../components/Modal';
import { SpinnerIcon } from '../components/icons';
import ConfirmationModal from '../components/ConfirmationModal';
import { NotificationConfig } from '../types';
import { formatDateFull } from '../utils/dateUtils';

const EVENT_TYPES = [
    // Staffing
    { value: 'ASSIGNMENT_CREATED', label: 'Nuova Assegnazione' },
    { value: 'ASSIGNMENT_DELETED', label: 'Assegnazione Rimossa' },
    { value: 'ALLOCATION_CHANGED', label: 'Modifica Allocazione (Massiva)' },
    // HR & Resources
    { value: 'RESOURCE_CREATED', label: 'Nuova Risorsa' },
    { value: 'RESOURCE_UPDATED', label: 'Modifica Anagrafica Risorsa' },
    { value: 'RESOURCE_RESIGNED', label: 'Dimissioni Risorsa' },
    { value: 'SKILL_ADDED', label: 'Nuova Competenza Acquisita' },
    // Projects & Contracts
    { value: 'PROJECT_CREATED', label: 'Nuovo Progetto' },
    { value: 'PROJECT_STATUS_CHANGED', label: 'Cambio Stato Progetto' },
    { value: 'BUDGET_UPDATED', label: 'Revisione Budget Progetto' },
    { value: 'CONTRACT_CREATED', label: 'Nuovo Contratto' },
    // Recruitment
    { value: 'RESOURCE_REQUEST_CREATED', label: 'Nuova Richiesta Risorsa' },
    { value: 'RESOURCE_REQUEST_STATUS_CHANGED', label: 'Cambio Stato Richiesta' },
    { value: 'INTERVIEW_SCHEDULED', label: 'Colloquio Pianificato' },
    { value: 'INTERVIEW_FEEDBACK', label: 'Feedback Colloquio Inserito' },
    { value: 'CANDIDATE_HIRED', label: 'Candidato Assunto' },
    // Leaves
    { value: 'LEAVE_REQUEST_CREATED', label: 'Nuova Richiesta Assenza' },
    { value: 'LEAVE_APPROVED', label: 'Assenza Approvata' },
    { value: 'LEAVE_REJECTED', label: 'Assenza Rifiutata' },
    // Security
    { value: 'USER_CREATED', label: 'Nuovo Utente Sistema' },
    { value: 'PASSWORD_RESET', label: 'Reset Password' },
    { value: 'LOGIN_FAILED', label: 'Login Fallito' },
];

const NotificationSettingsPage: React.FC = () => {
    const { notificationConfigs, addNotificationConfig, updateNotificationConfig, deleteNotificationConfig } = useConfigContext();
    const { addToast } = useToast();
    
    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingConfig, setEditingConfig] = useState<Partial<NotificationConfig> | null>(null);
    const [configToDelete, setConfigToDelete] = useState<NotificationConfig | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingConfig) return;

        if (!editingConfig.eventType || !editingConfig.webhookUrl) {
            addToast('Compila tutti i campi obbligatori.', 'warning');
            return;
        }

        setIsSaving(true);
        try {
            if (editingConfig.id) {
                await updateNotificationConfig(editingConfig as NotificationConfig);
            } else {
                await addNotificationConfig(editingConfig as Omit<NotificationConfig, 'id'>);
            }
            setIsModalOpen(false);
            setEditingConfig(null);
        } catch (error) {
            // Error handling is managed in context
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!configToDelete) return;
        setIsSaving(true);
        try {
            await deleteNotificationConfig(configToDelete.id!);
            setConfigToDelete(null);
        } catch (error) {
            // Managed in context
        } finally {
            setIsSaving(false);
        }
    };

    const columns: ColumnDef<NotificationConfig>[] = [
        { 
            header: 'Evento', 
            sortKey: 'eventType', 
            cell: c => (
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-sm">bolt</span>
                    <span className="font-bold text-on-surface">{EVENT_TYPES.find(e => e.value === c.eventType)?.label || c.eventType}</span>
                </div>
            ) 
        },
        { 
            header: 'Descrizione', 
            sortKey: 'description', 
            cell: c => <span className="text-sm text-on-surface-variant truncate max-w-xs block">{c.description || '-'}</span> 
        },
        { 
            header: 'Webhook URL', 
            sortKey: 'webhookUrl', 
            cell: c => <span className="text-xs font-mono text-on-surface-variant truncate max-w-[150px] block" title={c.webhookUrl}>{c.webhookUrl}</span> 
        },
        { 
            header: 'Stato', 
            sortKey: 'isActive', 
            cell: c => (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${c.isActive ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-surface-variant text-on-surface-variant'}`}>
                    {c.isActive ? 'ATTIVO' : 'INATTIVO'}
                </span>
            ) 
        },
        { 
            header: 'Creato il', 
            sortKey: 'createdAt', 
            cell: c => <span className="text-xs text-on-surface-variant">{formatDateFull(c.createdAt)}</span> 
        },
    ];

    const renderRow = (config: NotificationConfig) => (
        <tr key={config.id} className="hover:bg-surface-container group transition-colors">
            {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap bg-inherit">{col.cell(config)}</td>)}
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium bg-inherit">
                <div className="flex items-center justify-end space-x-2">
                    <button 
                        onClick={() => { setEditingConfig(config); setIsModalOpen(true); }} 
                        className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors"
                        title="Modifica"
                    >
                        <span className="material-symbols-outlined">edit</span>
                    </button>
                    <button 
                        onClick={() => setConfigToDelete(config)} 
                        className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-error transition-colors"
                        title="Elimina"
                    >
                        <span className="material-symbols-outlined">delete</span>
                    </button>
                </div>
            </td>
        </tr>
    );

    const renderMobileCard = (c: NotificationConfig) => (
        <div className="bg-surface rounded-xl p-4 shadow-sm border border-outline-variant mb-3">
             <div className="flex justify-between items-start mb-2">
                 <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">bolt</span>
                    <span className="font-bold text-sm text-on-surface">{EVENT_TYPES.find(e => e.value === c.eventType)?.label || c.eventType}</span>
                 </div>
                 <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${c.isActive ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-surface-variant text-on-surface-variant'}`}>
                    {c.isActive ? 'ON' : 'OFF'}
                </span>
             </div>
             <p className="text-xs text-on-surface-variant mb-2">{c.description}</p>
             <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant">
                 <button onClick={() => { setEditingConfig(c); setIsModalOpen(true); }} className="text-primary text-xs font-bold uppercase">Modifica</button>
                 <button onClick={() => setConfigToDelete(c)} className="text-error text-xs font-bold uppercase">Elimina</button>
             </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-surface p-6 rounded-3xl shadow-sm border border-outline-variant">
                <div>
                    <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                        <span className="material-symbols-outlined text-tertiary">hub</span>
                        Integrazioni Webhook
                    </h1>
                    <p className="text-sm text-on-surface-variant">Configura le notifiche automatiche verso Microsoft Teams.</p>
                </div>
                <button 
                    onClick={() => { setEditingConfig({ isActive: true, eventType: EVENT_TYPES[0].value }); setIsModalOpen(true); }}
                    className="px-6 py-2 bg-primary text-on-primary rounded-full font-bold shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                >
                    <span className="material-symbols-outlined">add</span> Nuova Regola
                </button>
            </div>

            <DataTable<NotificationConfig>
                title=""
                addNewButtonLabel=""
                data={notificationConfigs}
                columns={columns}
                filtersNode={null}
                onAddNew={() => {}}
                renderRow={renderRow}
                renderMobileCard={renderMobileCard}
                isLoading={false}
                tableLayout={{ dense: true, striped: true, headerSticky: true }}
            />

            {/* Modal */}
            {isModalOpen && editingConfig && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingConfig.id ? "Modifica Regola" : "Nuova Regola Webhook"}>
                    <form onSubmit={handleSave} className="space-y-5">
                         <div>
                            <label className="block text-sm font-bold mb-1 text-on-surface-variant">Tipo Evento</label>
                            <select 
                                value={editingConfig.eventType} 
                                onChange={e => setEditingConfig({...editingConfig, eventType: e.target.value})}
                                className="form-select w-full"
                                required
                            >
                                {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1 text-on-surface-variant">Descrizione</label>
                            <input 
                                type="text" 
                                value={editingConfig.description || ''} 
                                onChange={e => setEditingConfig({...editingConfig, description: e.target.value})}
                                className="form-input w-full" 
                                placeholder="es. Canale HR - Nuove Assunzioni"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1 text-on-surface-variant">Webhook URL (MS Teams)</label>
                            <input 
                                type="url" 
                                value={editingConfig.webhookUrl || ''} 
                                onChange={e => setEditingConfig({...editingConfig, webhookUrl: e.target.value})}
                                className="form-input w-full font-mono text-xs" 
                                required
                                placeholder="https://outlook.office.com/webhook/..."
                            />
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-surface-container rounded-xl border border-outline-variant">
                            <input 
                                type="checkbox" 
                                checked={editingConfig.isActive} 
                                onChange={e => setEditingConfig({...editingConfig, isActive: e.target.checked})}
                                className="form-checkbox h-5 w-5 text-primary rounded"
                                id="active-check"
                            />
                            <label htmlFor="active-check" className="text-sm font-bold text-on-surface cursor-pointer select-none">Regola Attiva</label>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-outline rounded-full text-sm font-bold hover:bg-surface-container">Annulla</button>
                            <button type="submit" disabled={isSaving} className="px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-bold shadow-lg flex items-center gap-2">
                                {isSaving ? <SpinnerIcon className="w-4 h-4"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Delete Modal */}
            {configToDelete && (
                <ConfirmationModal 
                    isOpen={!!configToDelete}
                    onClose={() => setConfigToDelete(null)}
                    onConfirm={handleDelete}
                    title="Elimina Regola"
                    message="Sei sicuro di voler eliminare questa configurazione webhook? L'azione è irreversibile."
                    isConfirming={isSaving}
                />
            )}
        </div>
    );
};

export default NotificationSettingsPage;
