
/**
 * @file pages/NotificationSettingsPage.tsx
 * @description Gestione integrazioni Webhook con Builder Drag & Drop avanzato.
 *
 * Due tab:
 *  - "Webhook Semplici": tabella CRUD classica sulle notification_configs (legacy).
 *  - "Builder Avanzato": editor drag-and-drop per le notification_rules (nuovo sistema).
 */

import React, { useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useEntitiesContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { DataTable, ColumnDef } from '../components/DataTable';
import Modal from '../components/Modal';
import { SpinnerIcon } from '../components/icons';
import ConfirmationModal from '../components/ConfirmationModal';
import { NotificationConfig, NotificationRule, NotificationBlock, NotificationBlockType } from '../types';
import { formatDateFull } from '../utils/dateUtils';

// ---------------------------------------------------------------------------
// Costanti condivise
// ---------------------------------------------------------------------------

const EVENT_TYPES = [
    { value: 'ASSIGNMENT_CREATED', label: 'Nuova Assegnazione' },
    { value: 'ASSIGNMENT_DELETED', label: 'Assegnazione Rimossa' },
    { value: 'ALLOCATION_CHANGED', label: 'Modifica Allocazione (Massiva)' },
    { value: 'RESOURCE_CREATED', label: 'Nuova Risorsa' },
    { value: 'RESOURCE_UPDATED', label: 'Modifica Anagrafica Risorsa' },
    { value: 'RESOURCE_RESIGNED', label: 'Dimissioni Risorsa' },
    { value: 'SKILL_ADDED', label: 'Nuova Competenza Acquisita' },
    { value: 'PROJECT_CREATED', label: 'Nuovo Progetto' },
    { value: 'PROJECT_STATUS_CHANGED', label: 'Cambio Stato Progetto' },
    { value: 'BUDGET_UPDATED', label: 'Revisione Budget Progetto' },
    { value: 'CONTRACT_CREATED', label: 'Nuovo Contratto' },
    { value: 'RESOURCE_REQUEST_CREATED', label: 'Nuova Richiesta Risorsa' },
    { value: 'RESOURCE_REQUEST_STATUS_CHANGED', label: 'Cambio Stato Richiesta' },
    { value: 'INTERVIEW_SCHEDULED', label: 'Colloquio Pianificato' },
    { value: 'INTERVIEW_FEEDBACK', label: 'Feedback Colloquio Inserito' },
    { value: 'CANDIDATE_HIRED', label: 'Candidato Assunto' },
    { value: 'LEAVE_REQUEST_CREATED', label: 'Nuova Richiesta Assenza' },
    { value: 'LEAVE_APPROVED', label: 'Assenza Approvata' },
    { value: 'LEAVE_REJECTED', label: 'Assenza Rifiutata' },
    { value: 'USER_CREATED', label: 'Nuovo Utente Sistema' },
    { value: 'PASSWORD_RESET', label: 'Reset Password' },
    { value: 'LOGIN_FAILED', label: 'Login Fallito' },
];

const COLORS = [
    { value: 'Default', label: 'Predefinito', dot: 'bg-on-surface-variant' },
    { value: 'Good', label: 'Successo', dot: 'bg-tertiary' },
    { value: 'Warning', label: 'Avviso', dot: 'bg-yellow-500' },
    { value: 'Attention', label: 'Errore', dot: 'bg-error' },
    { value: 'Accent', label: 'Primario', dot: 'bg-primary' },
];

// ---------------------------------------------------------------------------
// Palette blocchi
// ---------------------------------------------------------------------------

interface PaletteItem {
    type: NotificationBlockType;
    label: string;
    icon: string;
    description: string;
    colorClass: string;
}

const PALETTE: PaletteItem[] = [
    { type: 'header',         label: 'Intestazione',       icon: 'title',           description: 'Titolo e sottotitolo del messaggio',         colorClass: 'bg-primary-container text-on-primary-container' },
    { type: 'facts',          label: 'Fatti',              icon: 'list_alt',        description: 'Lista chiave-valore visibile',                colorClass: 'bg-secondary-container text-on-secondary-container' },
    { type: 'detailed_facts', label: 'Dettagli',           icon: 'expand_circle_down', description: 'Fatti espandibili (ShowCard)',             colorClass: 'bg-tertiary-container text-on-tertiary-container' },
    { type: 'text',           label: 'Testo Libero',       icon: 'notes',           description: 'Paragrafo di testo',                         colorClass: 'bg-surface-container-high text-on-surface' },
    { type: 'image',          label: 'Immagine / Grafico', icon: 'image',           description: 'URL immagine — supporta QuickChart.io',       colorClass: 'bg-error-container text-on-error-container' },
    { type: 'table',          label: 'Tabella',            icon: 'table_chart',     description: 'Intestazioni colonne tabella',               colorClass: 'bg-surface-variant text-on-surface-variant' },
    { type: 'divider',        label: 'Separatore',         icon: 'horizontal_rule', description: 'Linea divisoria orizzontale',                colorClass: 'bg-surface-container text-on-surface-variant' },
];

function blockLabel(type: NotificationBlockType): string {
    return PALETTE.find(p => p.type === type)?.label ?? type;
}
function blockIcon(type: NotificationBlockType): string {
    return PALETTE.find(p => p.type === type)?.icon ?? 'widgets';
}
function blockColor(type: NotificationBlockType): string {
    return PALETTE.find(p => p.type === type)?.colorClass ?? 'bg-surface text-on-surface';
}

function makeBlock(type: NotificationBlockType): NotificationBlock {
    const base: NotificationBlock = { id: uuidv4(), type, config: {} };
    if (type === 'header')         base.config = { titleTemplate: '{{context.title}}', subtitleTemplate: '' };
    if (type === 'facts')          base.config = { facts: [{ nameTemplate: 'Etichetta', valueTemplate: '{{context.value}}' }] };
    if (type === 'detailed_facts') base.config = { facts: [{ nameTemplate: 'Dettaglio', valueTemplate: '{{context.value}}' }] };
    if (type === 'text')           base.config = { textTemplate: 'Testo libero con {{context.title}}' };
    if (type === 'image')          base.config = { imageUrlTemplate: 'https://quickchart.io/chart?c=...', imageCaption: '' };
    if (type === 'table')          base.config = { tableTitle: 'Report', headers: ['Colonna 1', 'Colonna 2'] };
    return base;
}

// ---------------------------------------------------------------------------
// Suggerimenti variabili di contesto per evento
// ---------------------------------------------------------------------------

const CONTEXT_HINTS: Record<string, string[]> = {
    ASSIGNMENT_CREATED:  ['context.title', 'context.Risorsa', 'context.Progetto', 'context.Data'],
    ASSIGNMENT_DELETED:  ['context.title', 'context.Risorsa', 'context.Progetto'],
    ALLOCATION_CHANGED:  ['context.title', 'context.Risorsa', 'context.Progetto', 'context.Giorni'],
    RESOURCE_CREATED:    ['context.title', 'context.Nome', 'context.Ruolo', 'context.Funzione'],
    PROJECT_CREATED:     ['context.title', 'context.Nome', 'context.Cliente', 'context.Budget'],
    LEAVE_REQUEST_CREATED: ['context.title', 'context.Risorsa', 'context.Dal', 'context.Al'],
    LEAVE_APPROVED:      ['context.title', 'context.Risorsa', 'context.Dal', 'context.Al'],
    LOGIN_FAILED:        ['context.title', 'context.username', 'context.ip'],
};

// ---------------------------------------------------------------------------
// Componente editor configurazione di un blocco
// ---------------------------------------------------------------------------

interface BlockConfigEditorProps {
    block: NotificationBlock;
    onChange: (updated: NotificationBlock) => void;
    hints: string[];
}

const BlockConfigEditor: React.FC<BlockConfigEditorProps> = ({ block, onChange, hints }) => {
    const cfg = block.config;

    const set = (patch: Partial<NotificationBlock['config']>) =>
        onChange({ ...block, config: { ...cfg, ...patch } });

    const HintChips = () => (
        hints.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-1">
                {hints.map(h => (
                    <span key={h} className="px-2 py-0.5 text-[10px] font-mono rounded bg-surface-container text-on-surface-variant cursor-pointer hover:bg-primary hover:text-on-primary transition-colors"
                          onClick={() => navigator.clipboard?.writeText(`{{${h}}}`)} title="Copia negli appunti">
                        {`{{${h}}}`}
                    </span>
                ))}
            </div>
        ) : null
    );

    if (block.type === 'header') return (
        <div className="space-y-3">
            <div>
                <label className="block text-xs font-bold mb-1 text-on-surface-variant">Titolo (template)</label>
                <input className="form-input w-full text-sm font-mono" value={cfg.titleTemplate || ''} onChange={e => set({ titleTemplate: e.target.value })} placeholder="{{context.title}}" />
                <HintChips />
            </div>
            <div>
                <label className="block text-xs font-bold mb-1 text-on-surface-variant">Sottotitolo (template)</label>
                <input className="form-input w-full text-sm font-mono" value={cfg.subtitleTemplate || ''} onChange={e => set({ subtitleTemplate: e.target.value })} placeholder="es. Progetto: {{context.Progetto}}" />
            </div>
        </div>
    );

    if (block.type === 'text') return (
        <div>
            <label className="block text-xs font-bold mb-1 text-on-surface-variant">Testo (template)</label>
            <textarea rows={3} className="form-input w-full text-sm font-mono" value={cfg.textTemplate || ''} onChange={e => set({ textTemplate: e.target.value })} placeholder="Testo con {{context.variabile}}" />
            <HintChips />
        </div>
    );

    if (block.type === 'facts' || block.type === 'detailed_facts') {
        const facts = cfg.facts || [];
        const updateFact = (i: number, key: 'nameTemplate' | 'valueTemplate', val: string) => {
            const updated = facts.map((f, idx) => idx === i ? { ...f, [key]: val } : f);
            set({ facts: updated });
        };
        const addFact = () => set({ facts: [...facts, { nameTemplate: 'Etichetta', valueTemplate: '{{context.value}}' }] });
        const removeFact = (i: number) => set({ facts: facts.filter((_, idx) => idx !== i) });

        return (
            <div className="space-y-2">
                <label className="block text-xs font-bold text-on-surface-variant">
                    Coppie Chiave / Valore
                    {block.type === 'detailed_facts' && <span className="ml-2 text-primary font-normal">(espandibili con ShowCard)</span>}
                </label>
                {facts.map((f, i) => (
                    <div key={i} className="flex items-center gap-1">
                        <input className="form-input flex-1 text-xs" value={f.nameTemplate} onChange={e => updateFact(i, 'nameTemplate', e.target.value)} placeholder="Etichetta" />
                        <span className="text-on-surface-variant text-xs">→</span>
                        <input className="form-input flex-1 text-xs font-mono" value={f.valueTemplate} onChange={e => updateFact(i, 'valueTemplate', e.target.value)} placeholder="{{context.x}}" />
                        <button onClick={() => removeFact(i)} className="p-1 rounded hover:bg-error-container text-on-surface-variant hover:text-error transition-colors">
                            <span className="material-symbols-outlined text-base">close</span>
                        </button>
                    </div>
                ))}
                <button onClick={addFact} className="flex items-center gap-1 text-xs text-primary font-bold hover:underline">
                    <span className="material-symbols-outlined text-base">add</span> Aggiungi riga
                </button>
                <HintChips />
            </div>
        );
    }

    if (block.type === 'image') return (
        <div className="space-y-3">
            <div>
                <label className="block text-xs font-bold mb-1 text-on-surface-variant">URL Immagine (template)</label>
                <input className="form-input w-full text-xs font-mono" value={cfg.imageUrlTemplate || ''} onChange={e => set({ imageUrlTemplate: e.target.value })} placeholder="https://quickchart.io/chart?c=..." />
                <p className="text-[10px] text-on-surface-variant mt-1">Supporta QuickChart.io e URL dinamici con <code>{'{{context.xxx}}'}</code></p>
                <HintChips />
            </div>
            <div>
                <label className="block text-xs font-bold mb-1 text-on-surface-variant">Didascalia</label>
                <input className="form-input w-full text-sm" value={cfg.imageCaption || ''} onChange={e => set({ imageCaption: e.target.value })} placeholder="Grafico budget progetto" />
            </div>
        </div>
    );

    if (block.type === 'table') return (
        <div className="space-y-3">
            <div>
                <label className="block text-xs font-bold mb-1 text-on-surface-variant">Titolo Tabella</label>
                <input className="form-input w-full text-sm" value={cfg.tableTitle || ''} onChange={e => set({ tableTitle: e.target.value })} placeholder="Report Dati" />
            </div>
            <div>
                <label className="block text-xs font-bold mb-1 text-on-surface-variant">Intestazioni Colonne (una per riga)</label>
                <textarea rows={3} className="form-input w-full text-sm" value={(cfg.headers || []).join('\n')} onChange={e => set({ headers: e.target.value.split('\n').filter(Boolean) })} placeholder={'Colonna 1\nColonna 2\nColonna 3'} />
            </div>
        </div>
    );

    if (block.type === 'divider') return (
        <p className="text-xs text-on-surface-variant italic">Nessuna configurazione necessaria per il separatore.</p>
    );

    return null;
};

// ---------------------------------------------------------------------------
// Preview schematica del blocco nel canvas
// ---------------------------------------------------------------------------

const BlockPreview: React.FC<{ block: NotificationBlock }> = ({ block }) => {
    const cfg = block.config;
    if (block.type === 'header') return (
        <div>
            <p className="font-bold text-on-surface text-sm truncate">{cfg.titleTemplate || '(nessun titolo)'}</p>
            {cfg.subtitleTemplate && <p className="text-xs text-on-surface-variant truncate">{cfg.subtitleTemplate}</p>}
        </div>
    );
    if (block.type === 'text') return (
        <p className="text-xs text-on-surface-variant truncate">{cfg.textTemplate || '(testo vuoto)'}</p>
    );
    if (block.type === 'facts' || block.type === 'detailed_facts') return (
        <div className="flex gap-2 flex-wrap">
            {(cfg.facts || []).slice(0, 3).map((f, i) => (
                <span key={i} className="text-[10px] bg-surface-container px-1.5 py-0.5 rounded">{f.nameTemplate}: <span className="font-mono text-primary">{f.valueTemplate}</span></span>
            ))}
            {(cfg.facts?.length ?? 0) > 3 && <span className="text-[10px] text-on-surface-variant">+{(cfg.facts?.length ?? 0) - 3} altri</span>}
        </div>
    );
    if (block.type === 'image') return (
        <p className="text-[10px] font-mono text-on-surface-variant truncate">{cfg.imageUrlTemplate || '(nessun URL)'}</p>
    );
    if (block.type === 'table') return (
        <div className="flex gap-1">
            {(cfg.headers || []).slice(0, 4).map((h, i) => (
                <span key={i} className="text-[10px] bg-surface-container px-1.5 py-0.5 rounded font-bold">{h}</span>
            ))}
        </div>
    );
    if (block.type === 'divider') return <div className="h-px bg-outline-variant w-full mt-1" />;
    return null;
};

// ---------------------------------------------------------------------------
// Tab 1 — Webhook Semplici (legacy, invariato nella logica)
// ---------------------------------------------------------------------------

const WebhookSempliciTab: React.FC = () => {
    const { notificationConfigs, addNotificationConfig, updateNotificationConfig, deleteNotificationConfig } = useEntitiesContext();
    const { addToast } = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingConfig, setEditingConfig] = useState<Partial<NotificationConfig> | null>(null);
    const [configToDelete, setConfigToDelete] = useState<NotificationConfig | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingConfig?.eventType || !editingConfig?.webhookUrl) {
            addToast('Compila tutti i campi obbligatori.', 'warning');
            return;
        }
        setIsSaving(true);
        try {
            if (editingConfig.id) await updateNotificationConfig(editingConfig as NotificationConfig);
            else await addNotificationConfig(editingConfig as Omit<NotificationConfig, 'id'>);
            setIsModalOpen(false);
            setEditingConfig(null);
        } finally { setIsSaving(false); }
    };

    const handleDelete = async () => {
        if (!configToDelete) return;
        setIsSaving(true);
        try { await deleteNotificationConfig(configToDelete.id!); setConfigToDelete(null); }
        finally { setIsSaving(false); }
    };

    const columns: ColumnDef<NotificationConfig>[] = [
        { header: 'Evento', sortKey: 'eventType', cell: c => (
            <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-sm">bolt</span>
                <span className="font-bold text-on-surface">{EVENT_TYPES.find(e => e.value === c.eventType)?.label || c.eventType}</span>
            </div>
        )},
        { header: 'Descrizione', sortKey: 'description', cell: c => <span className="text-sm text-on-surface-variant truncate max-w-xs block">{c.description || '-'}</span> },
        { header: 'Webhook URL', sortKey: 'webhookUrl', cell: c => <span className="text-xs font-mono text-on-surface-variant truncate max-w-[150px] block" title={c.webhookUrl}>{c.webhookUrl}</span> },
        { header: 'Stato', sortKey: 'isActive', cell: c => (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${c.isActive ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-surface-variant text-on-surface-variant'}`}>
                {c.isActive ? 'ATTIVO' : 'INATTIVO'}
            </span>
        )},
        { header: 'Creato il', sortKey: 'createdAt', cell: c => <span className="text-xs text-on-surface-variant">{formatDateFull(c.createdAt)}</span> },
    ];

    const renderRow = (config: NotificationConfig) => (
        <tr key={config.id} className="hover:bg-surface-container group transition-colors">
            {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap bg-inherit">{col.cell(config)}</td>)}
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium bg-inherit">
                <div className="flex items-center justify-end space-x-2">
                    <button onClick={() => { setEditingConfig(config); setIsModalOpen(true); }} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors" title="Modifica"><span className="material-symbols-outlined">edit</span></button>
                    <button onClick={() => setConfigToDelete(config)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-error transition-colors" title="Elimina"><span className="material-symbols-outlined">delete</span></button>
                </div>
            </td>
        </tr>
    );

    const renderMobileCard = (c: NotificationConfig) => (
        <div key={c.id} className="bg-surface rounded-xl p-4 shadow-sm border border-outline-variant mb-3">
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">bolt</span>
                    <span className="font-bold text-sm text-on-surface">{EVENT_TYPES.find(e => e.value === c.eventType)?.label || c.eventType}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${c.isActive ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-surface-variant text-on-surface-variant'}`}>{c.isActive ? 'ON' : 'OFF'}</span>
            </div>
            <p className="text-xs text-on-surface-variant mb-2">{c.description}</p>
            <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant">
                <button onClick={() => { setEditingConfig(c); setIsModalOpen(true); }} className="text-primary text-xs font-bold uppercase">Modifica</button>
                <button onClick={() => setConfigToDelete(c)} className="text-error text-xs font-bold uppercase">Elimina</button>
            </div>
        </div>
    );

    return (
        <>
            <div className="flex justify-end mb-4">
                <button onClick={() => { setEditingConfig({ isActive: true, eventType: EVENT_TYPES[0].value }); setIsModalOpen(true); }}
                    className="px-5 py-2 bg-primary text-on-primary rounded-full font-bold shadow hover:shadow-lg transition-all flex items-center gap-2 text-sm">
                    <span className="material-symbols-outlined text-base">add</span> Nuova Regola
                </button>
            </div>
            <DataTable<NotificationConfig>
                title="" addNewButtonLabel="" data={notificationConfigs} columns={columns} filtersNode={null}
                onAddNew={() => {}} renderRow={renderRow} renderMobileCard={renderMobileCard}
                isLoading={false} tableLayout={{ dense: true, striped: true, headerSticky: true }}
            />
            {isModalOpen && editingConfig && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingConfig.id ? 'Modifica Regola' : 'Nuova Regola Webhook'}>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold mb-1 text-on-surface-variant">Tipo Evento</label>
                            <select value={editingConfig.eventType} onChange={e => setEditingConfig({ ...editingConfig, eventType: e.target.value })} className="form-select w-full" required>
                                {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1 text-on-surface-variant">Descrizione</label>
                            <input type="text" value={editingConfig.description || ''} onChange={e => setEditingConfig({ ...editingConfig, description: e.target.value })} className="form-input w-full" placeholder="es. Canale HR - Nuove Assunzioni" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1 text-on-surface-variant">Webhook URL (MS Teams)</label>
                            <input type="url" value={editingConfig.webhookUrl || ''} onChange={e => setEditingConfig({ ...editingConfig, webhookUrl: e.target.value })} className="form-input w-full font-mono text-xs" required placeholder="https://outlook.office.com/webhook/..." />
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-surface-container rounded-xl border border-outline-variant">
                            <input type="checkbox" checked={editingConfig.isActive} onChange={e => setEditingConfig({ ...editingConfig, isActive: e.target.checked })} className="form-checkbox h-5 w-5 text-primary rounded" id="active-check" />
                            <label htmlFor="active-check" className="text-sm font-bold text-on-surface cursor-pointer select-none">Regola Attiva</label>
                        </div>
                        <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-outline rounded-full text-sm font-bold hover:bg-surface-container">Annulla</button>
                            <button type="submit" disabled={isSaving} className="px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-bold shadow flex items-center gap-2">
                                {isSaving ? <SpinnerIcon className="w-4 h-4" /> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
            {configToDelete && (
                <ConfirmationModal isOpen={!!configToDelete} onClose={() => setConfigToDelete(null)} onConfirm={handleDelete}
                    title="Elimina Regola" message="Sei sicuro di voler eliminare questa configurazione webhook?" isConfirming={isSaving} />
            )}
        </>
    );
};

// ---------------------------------------------------------------------------
// Tab 2 — Builder Avanzato (drag-and-drop per NotificationRule)
// ---------------------------------------------------------------------------

/** Stato del drag: da palette o da canvas */
type DragSource =
    | { from: 'palette'; blockType: NotificationBlockType }
    | { from: 'canvas'; blockIndex: number };

const BuilderTab: React.FC = () => {
    const { notificationRules, addNotificationRule, updateNotificationRule, deleteNotificationRule } = useEntitiesContext();
    const { addToast } = useToast();

    // Vista: lista regole | editor regola
    const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
    const [ruleToDelete, setRuleToDelete] = useState<NotificationRule | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Stato DnD
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const dragSourceRef = useRef<DragSource | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // ---- Helpers editing rule ----
    const openNew = () => setEditingRule({
        name: 'Nuova Regola',
        eventType: EVENT_TYPES[0].value,
        webhookUrl: '',
        isActive: true,
        templateBlocks: [],
        color: 'Default',
    });

    const patchRule = (patch: Partial<NotificationRule>) =>
        setEditingRule(prev => prev ? { ...prev, ...patch } : prev);

    const patchBlock = useCallback((blockId: string, updated: NotificationBlock) => {
        setEditingRule(prev => {
            if (!prev) return prev;
            return { ...prev, templateBlocks: prev.templateBlocks.map(b => b.id === blockId ? updated : b) };
        });
    }, []);

    const removeBlock = (blockId: string) => {
        setEditingRule(prev => {
            if (!prev) return prev;
            return { ...prev, templateBlocks: prev.templateBlocks.filter(b => b.id !== blockId) };
        });
        if (selectedBlockId === blockId) setSelectedBlockId(null);
    };

    // ---- Drag-and-drop handlers ----
    const handlePaletteDragStart = (blockType: NotificationBlockType) => {
        dragSourceRef.current = { from: 'palette', blockType };
    };

    const handleCanvasDragStart = (e: React.DragEvent, blockIndex: number) => {
        dragSourceRef.current = { from: 'canvas', blockIndex };
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverIndex(targetIndex);
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        setDragOverIndex(null);
        const src = dragSourceRef.current;
        if (!src || !editingRule) return;

        if (src.from === 'palette') {
            const newBlock = makeBlock(src.blockType);
            const blocks = [...editingRule.templateBlocks];
            blocks.splice(targetIndex, 0, newBlock);
            patchRule({ templateBlocks: blocks });
            setSelectedBlockId(newBlock.id);
        } else if (src.from === 'canvas') {
            if (src.blockIndex === targetIndex) return;
            const blocks = [...editingRule.templateBlocks];
            const [moved] = blocks.splice(src.blockIndex, 1);
            const insertAt = src.blockIndex < targetIndex ? targetIndex - 1 : targetIndex;
            blocks.splice(insertAt, 0, moved);
            patchRule({ templateBlocks: blocks });
        }
        dragSourceRef.current = null;
    };

    const handleCanvasDropEnd = (e: React.DragEvent) => {
        // Drop on canvas bottom (append)
        e.preventDefault();
        setDragOverIndex(null);
        const src = dragSourceRef.current;
        if (!src || !editingRule) return;
        if (src.from === 'palette') {
            const newBlock = makeBlock(src.blockType);
            patchRule({ templateBlocks: [...editingRule.templateBlocks, newBlock] });
            setSelectedBlockId(newBlock.id);
        }
        dragSourceRef.current = null;
    };

    // ---- Salva / Elimina ----
    const handleSave = async () => {
        if (!editingRule) return;
        if (!editingRule.webhookUrl || !editingRule.name) {
            addToast('Nome e Webhook URL sono obbligatori.', 'warning');
            return;
        }
        setIsSaving(true);
        try {
            if (editingRule.id) await updateNotificationRule(editingRule);
            else await addNotificationRule(editingRule);
            setEditingRule(null);
            addToast('Regola salvata con successo.', 'success');
        } finally { setIsSaving(false); }
    };

    const handleDelete = async () => {
        if (!ruleToDelete?.id) return;
        setIsSaving(true);
        try {
            await deleteNotificationRule(ruleToDelete.id);
            setRuleToDelete(null);
            if (editingRule?.id === ruleToDelete.id) setEditingRule(null);
        } finally { setIsSaving(false); }
    };

    // ---- Blocco selezionato ----
    const selectedBlock = editingRule?.templateBlocks.find(b => b.id === selectedBlockId) ?? null;
    const hints = CONTEXT_HINTS[editingRule?.eventType ?? ''] ?? [];

    // ======================================================================
    // VISTA LISTA REGOLE
    // ======================================================================
    if (!editingRule) {
        return (
            <>
                <div className="flex justify-end mb-4">
                    <button onClick={openNew} className="px-5 py-2 bg-secondary text-on-secondary rounded-full font-bold shadow hover:shadow-lg transition-all flex items-center gap-2 text-sm">
                        <span className="material-symbols-outlined text-base">add</span> Nuova Regola Builder
                    </button>
                </div>
                {notificationRules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center bg-surface rounded-2xl border border-outline-variant">
                        <span className="material-symbols-outlined text-6xl text-on-surface-variant mb-4">drag_indicator</span>
                        <p className="text-lg font-bold text-on-surface">Nessuna regola avanzata</p>
                        <p className="text-sm text-on-surface-variant mt-1">Crea la tua prima regola con il Builder per comporre messaggi Teams drag-and-drop.</p>
                        <button onClick={openNew} className="mt-6 px-6 py-2 bg-secondary text-on-secondary rounded-full font-bold shadow text-sm">Inizia ora</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {notificationRules.map(rule => (
                            <div key={rule.id} className="bg-surface rounded-2xl border border-outline-variant p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="font-bold text-on-surface">{rule.name}</p>
                                        <p className="text-xs text-on-surface-variant mt-0.5">{EVENT_TYPES.find(e => e.value === rule.eventType)?.label || rule.eventType}</p>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${rule.isActive ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-surface-variant text-on-surface-variant'}`}>
                                        {rule.isActive ? 'ATTIVA' : 'OFF'}
                                    </span>
                                </div>
                                {/* Mini anteprima blocchi */}
                                <div className="flex flex-wrap gap-1.5">
                                    {rule.templateBlocks.slice(0, 6).map(b => (
                                        <span key={b.id} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${blockColor(b.type)}`}>
                                            <span className="material-symbols-outlined text-xs">{blockIcon(b.type)}</span>
                                            {blockLabel(b.type)}
                                        </span>
                                    ))}
                                    {rule.templateBlocks.length > 6 && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-surface-container text-on-surface-variant">
                                            +{rule.templateBlocks.length - 6}
                                        </span>
                                    )}
                                    {rule.templateBlocks.length === 0 && (
                                        <span className="text-xs text-on-surface-variant italic">Nessun blocco</span>
                                    )}
                                </div>
                                <p className="text-[10px] font-mono text-on-surface-variant truncate" title={rule.webhookUrl}>{rule.webhookUrl || '(nessun URL)'}</p>
                                <div className="flex gap-2 pt-2 border-t border-outline-variant">
                                    <button onClick={() => setEditingRule(rule)} className="flex-1 py-1.5 text-xs font-bold text-primary border border-primary rounded-full hover:bg-primary hover:text-on-primary transition-colors">
                                        <span className="material-symbols-outlined text-sm align-middle mr-1">edit</span>Modifica
                                    </button>
                                    <button onClick={() => setRuleToDelete(rule)} className="py-1.5 px-3 text-xs font-bold text-error border border-error rounded-full hover:bg-error hover:text-on-error transition-colors">
                                        <span className="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {ruleToDelete && (
                    <ConfirmationModal isOpen={!!ruleToDelete} onClose={() => setRuleToDelete(null)} onConfirm={handleDelete}
                        title="Elimina Regola Builder" message={`Sei sicuro di voler eliminare la regola "${ruleToDelete.name}"?`} isConfirming={isSaving} />
                )}
            </>
        );
    }

    // ======================================================================
    // VISTA EDITOR REGOLA (Drag & Drop)
    // ======================================================================
    return (
        <div className="flex flex-col gap-4 min-h-0">
            {/* Top bar */}
            <div className="flex flex-col md:flex-row gap-3 bg-surface p-4 rounded-2xl border border-outline-variant">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                        <label className="block text-xs font-bold mb-1 text-on-surface-variant">Nome Regola</label>
                        <input className="form-input w-full text-sm" value={editingRule.name} onChange={e => patchRule({ name: e.target.value })} placeholder="Nome regola..." />
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1 text-on-surface-variant">Evento</label>
                        <select className="form-select w-full text-sm" value={editingRule.eventType} onChange={e => patchRule({ eventType: e.target.value })}>
                            {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1 text-on-surface-variant">Webhook URL</label>
                        <input className="form-input w-full text-xs font-mono" value={editingRule.webhookUrl} onChange={e => patchRule({ webhookUrl: e.target.value })} placeholder="https://outlook.office.com/webhook/..." />
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1 text-on-surface-variant">Colore Header</label>
                        <select className="form-select w-full text-sm" value={editingRule.color || 'Default'} onChange={e => patchRule({ color: e.target.value })}>
                            {COLORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex items-end gap-2 flex-shrink-0">
                    <div className="flex items-center gap-2 px-3 py-2 bg-surface-container rounded-xl border border-outline-variant self-end h-[42px]">
                        <input type="checkbox" id="rule-active" checked={editingRule.isActive} onChange={e => patchRule({ isActive: e.target.checked })} className="form-checkbox h-4 w-4 text-primary rounded" />
                        <label htmlFor="rule-active" className="text-xs font-bold text-on-surface cursor-pointer select-none whitespace-nowrap">Attiva</label>
                    </div>
                    <button onClick={() => setEditingRule(null)} className="h-[42px] px-4 border border-outline rounded-full text-sm font-bold hover:bg-surface-container whitespace-nowrap">Annulla</button>
                    <button onClick={handleSave} disabled={isSaving} className="h-[42px] px-5 bg-primary text-on-primary rounded-full text-sm font-bold shadow flex items-center gap-2 whitespace-nowrap">
                        {isSaving ? <SpinnerIcon className="w-4 h-4" /> : <><span className="material-symbols-outlined text-base">save</span> Salva</>}
                    </button>
                </div>
            </div>

            {/* Descrizione */}
            {editingRule.description !== undefined && (
                <div>
                    <input className="form-input w-full text-sm" value={editingRule.description || ''} onChange={e => patchRule({ description: e.target.value })} placeholder="Descrizione opzionale della regola..." />
                </div>
            )}

            {/* Workspace a 3 colonne */}
            <div className="grid grid-cols-[200px_1fr_280px] gap-4 min-h-[500px]">

                {/* PALETTE (sinistra) */}
                <aside className="bg-surface rounded-2xl border border-outline-variant p-3 flex flex-col gap-2 overflow-y-auto">
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1">Blocchi Disponibili</p>
                    <p className="text-[10px] text-on-surface-variant mb-2">Trascina un blocco nel canvas →</p>
                    {PALETTE.map(item => (
                        <div
                            key={item.type}
                            draggable
                            onDragStart={() => handlePaletteDragStart(item.type)}
                            className={`flex items-center gap-2 p-2.5 rounded-xl cursor-grab active:cursor-grabbing border border-transparent hover:border-outline-variant transition-all select-none ${item.colorClass}`}
                            title={item.description}
                        >
                            <span className="material-symbols-outlined text-lg flex-shrink-0">{item.icon}</span>
                            <span className="text-xs font-bold leading-tight">{item.label}</span>
                        </div>
                    ))}
                </aside>

                {/* CANVAS (centro) */}
                <section
                    className="bg-surface-container-low rounded-2xl border-2 border-dashed border-outline-variant flex flex-col gap-0 overflow-y-auto"
                    onDragOver={e => { e.preventDefault(); }}
                    onDrop={handleCanvasDropEnd}
                >
                    <div className="p-3">
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-3">
                            Canvas Template <span className="font-normal normal-case ml-1">({editingRule.templateBlocks.length} blocchi)</span>
                        </p>

                        {editingRule.templateBlocks.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 text-center text-on-surface-variant gap-2">
                                <span className="material-symbols-outlined text-4xl">drag_indicator</span>
                                <p className="text-sm">Trascina qui i blocchi dalla palette</p>
                            </div>
                        )}

                        {editingRule.templateBlocks.map((block, idx) => (
                            <React.Fragment key={block.id}>
                                {/* Drop zone sopra ogni blocco */}
                                <div
                                    className={`h-1.5 rounded-full mx-2 transition-all ${dragOverIndex === idx ? 'bg-primary h-2' : 'bg-transparent'}`}
                                    onDragOver={e => handleDragOver(e, idx)}
                                    onDrop={e => handleDrop(e, idx)}
                                />
                                {/* Blocco */}
                                <div
                                    draggable
                                    onDragStart={e => handleCanvasDragStart(e, idx)}
                                    onDragEnd={() => setDragOverIndex(null)}
                                    onClick={() => setSelectedBlockId(block.id === selectedBlockId ? null : block.id)}
                                    className={`mx-2 mb-1 p-3 rounded-xl border cursor-grab active:cursor-grabbing transition-all select-none
                                        ${selectedBlockId === block.id
                                            ? 'border-primary ring-2 ring-primary/30 bg-surface shadow-md'
                                            : 'border-outline-variant bg-surface hover:border-outline hover:shadow-sm'}`}
                                >
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${blockColor(block.type)}`}>
                                            <span className="material-symbols-outlined text-xs">{blockIcon(block.type)}</span>
                                            {blockLabel(block.type)}
                                        </span>
                                        <div className="flex-1" />
                                        <span className="material-symbols-outlined text-sm text-on-surface-variant cursor-grab">drag_indicator</span>
                                        <button onClick={e => { e.stopPropagation(); removeBlock(block.id); }} className="p-0.5 rounded hover:bg-error-container text-on-surface-variant hover:text-error transition-colors">
                                            <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                    </div>
                                    <BlockPreview block={block} />
                                </div>
                            </React.Fragment>
                        ))}

                        {/* Drop zone in fondo */}
                        <div
                            className={`h-2 rounded-full mx-2 mt-1 transition-all ${dragOverIndex === editingRule.templateBlocks.length ? 'bg-primary' : 'bg-transparent'}`}
                            onDragOver={e => handleDragOver(e, editingRule.templateBlocks.length)}
                            onDrop={e => handleDrop(e, editingRule.templateBlocks.length)}
                        />
                    </div>
                </section>

                {/* PANNELLO CONFIG BLOCCO (destra) */}
                <aside className="bg-surface rounded-2xl border border-outline-variant p-4 flex flex-col gap-4 overflow-y-auto">
                    {selectedBlock ? (
                        <>
                            <div className="flex items-center gap-2">
                                <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${blockColor(selectedBlock.type)}`}>
                                    <span className="material-symbols-outlined text-sm">{blockIcon(selectedBlock.type)}</span>
                                    {blockLabel(selectedBlock.type)}
                                </span>
                            </div>
                            <BlockConfigEditor
                                block={selectedBlock}
                                onChange={updated => patchBlock(selectedBlock.id, updated)}
                                hints={hints}
                            />

                            {hints.length > 0 && (
                                <div className="mt-auto pt-3 border-t border-outline-variant">
                                    <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">Variabili disponibili</p>
                                    <p className="text-[10px] text-on-surface-variant mb-1">Clicca per copiare:</p>
                                    <div className="flex flex-wrap gap-1">
                                        {hints.map(h => (
                                            <span key={h} onClick={() => navigator.clipboard?.writeText(`{{${h}}}`)} title="Copia"
                                                className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-surface-container text-primary cursor-pointer hover:bg-primary hover:text-on-primary transition-colors">
                                                {`{{${h}}}`}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center text-on-surface-variant gap-2 py-8">
                            <span className="material-symbols-outlined text-4xl">touch_app</span>
                            <p className="text-sm font-bold">Seleziona un blocco</p>
                            <p className="text-xs">Clicca su un blocco nel canvas per configurarlo</p>
                        </div>
                    )}
                </aside>
            </div>

            {/* Anteprima struttura (collassabile) */}
            <details className="bg-surface rounded-2xl border border-outline-variant">
                <summary className="p-4 cursor-pointer text-sm font-bold text-on-surface-variant flex items-center gap-2 select-none">
                    <span className="material-symbols-outlined text-base">preview</span>
                    Anteprima struttura JSON template
                </summary>
                <div className="px-4 pb-4">
                    <pre className="text-[10px] font-mono bg-surface-container p-3 rounded-xl overflow-auto max-h-48 text-on-surface-variant whitespace-pre-wrap">
                        {JSON.stringify(editingRule.templateBlocks, null, 2)}
                    </pre>
                </div>
            </details>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Root Component
// ---------------------------------------------------------------------------

const NotificationSettingsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'semplici' | 'builder'>('semplici');

    const tabs = [
        { id: 'semplici' as const, label: 'Webhook Semplici', icon: 'bolt', description: 'Regole semplici: evento → URL' },
        { id: 'builder' as const, label: 'Builder Avanzato', icon: 'drag_indicator', description: 'Template drag & drop con blocchi' },
    ];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 bg-surface p-6 rounded-3xl shadow-sm border border-outline-variant">
                <div>
                    <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                        <span className="material-symbols-outlined text-tertiary">hub</span>
                        Integrazioni Webhook
                    </h1>
                    <p className="text-sm text-on-surface-variant mt-1">
                        Configura notifiche automatiche verso Microsoft Teams — modalità semplice o builder avanzato drag & drop.
                    </p>
                </div>
                {/* Info badge sistema ibrido */}
                <div className="flex items-start gap-2 bg-secondary-container text-on-secondary-container rounded-2xl px-4 py-3 text-sm max-w-xs flex-shrink-0">
                    <span className="material-symbols-outlined text-base mt-0.5 flex-shrink-0">info</span>
                    <div>
                        <p className="font-bold text-xs">Modalità Ibrida Attiva</p>
                        <p className="text-xs mt-0.5 opacity-80">Entrambi i sistemi operano in parallelo. Le regole Builder coesistono con quelle semplici.</p>
                    </div>
                </div>
            </div>

            {/* Tab navigation */}
            <div className="flex gap-2 bg-surface-container p-1 rounded-2xl w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                            activeTab === tab.id
                                ? 'bg-surface shadow text-on-surface'
                                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface/60'
                        }`}
                    >
                        <span className="material-symbols-outlined text-base">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div>
                {activeTab === 'semplici' && <WebhookSempliciTab />}
                {activeTab === 'builder' && <BuilderTab />}
            </div>
        </div>
    );
};

export default NotificationSettingsPage;
