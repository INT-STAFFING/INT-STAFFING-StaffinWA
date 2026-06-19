/**
 * @file pages/KnowledgeBasePage.tsx
 * @description Pagina della sezione "Knowledge Base".
 * Gestisce l'elenco, la ricerca, i filtri (formato / tipo entità collegata) e il CRUD
 * delle schede KB, con editor WYSIWYG per il formato HTML e textarea monospace per Plain.
 */

import React, { useMemo, useState } from 'react';
import { useKnowledgeBaseContext } from '../context/KnowledgeBaseContext';
import { useEntitiesContext } from '../context/AppContext';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import EmptyState from '../components/EmptyState';
import { SpinnerIcon } from '../components/icons';
import LinkedEntityChips from '../components/knowledgeBase/LinkedEntityChips';
import EntityLinkPicker from '../components/knowledgeBase/EntityLinkPicker';
import RichTextEditor from '../components/knowledgeBase/RichTextEditor';
import type { KBArticle, ContentFormat, LinkedEntity, LinkedEntityType } from '../types/knowledgeBase';
import type { Option } from '../components/forms/types';
import {
    searchArticles,
    filterArticles,
    formatBadgeLabel,
    ENTITY_TYPES,
    ENTITY_TYPE_META,
} from '../utils/knowledgeBaseFilters';

const newEmptyArticle = (): KBArticle => ({
    id: '',
    title: '',
    content: '',
    format: 'html',
    tags: [],
    createdAt: '',
    updatedAt: '',
    linkedEntities: [],
});

const formatDate = (iso: string): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('it-IT');
};

const KnowledgeBasePage: React.FC = () => {
    const { articles, loading, addArticle, updateArticle, deleteArticle, isMutating } = useKnowledgeBaseContext();
    const { resources, skills, projects, contracts, clients } = useEntitiesContext();

    const [search, setSearch] = useState('');
    const [formatFilter, setFormatFilter] = useState<ContentFormat | ''>('');
    const [entityFilter, setEntityFilter] = useState<LinkedEntityType | ''>('');

    const [draft, setDraft] = useState<KBArticle | null>(null);
    const [tagsText, setTagsText] = useState('');
    const [deleting, setDeleting] = useState<KBArticle | null>(null);

    // Opzioni per i selettori di collegamento, ricavate dagli store di dominio esistenti.
    const optionsByType = useMemo<Record<LinkedEntityType, Option[]>>(() => {
        const toOptions = <T extends { id?: string; name: string }>(items: T[]): Option[] =>
            items.filter(i => !!i.id).map(i => ({ value: i.id as string, label: i.name }));
        return {
            risorsa: toOptions((resources || []).filter(r => !r.resigned)),
            competenza: toOptions(skills || []),
            progetto: toOptions(projects || []),
            contratto: toOptions(contracts || []),
            cliente: toOptions(clients || []),
        };
    }, [resources, skills, projects, contracts, clients]);

    const visibleArticles = useMemo(() => {
        const byFilter = filterArticles(articles, { format: formatFilter, entityType: entityFilter });
        return searchArticles(byFilter, search)
            .slice()
            .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    }, [articles, formatFilter, entityFilter, search]);

    const openForNew = () => { setDraft(newEmptyArticle()); setTagsText(''); };
    const openForEdit = (article: KBArticle) => { setDraft({ ...article }); setTagsText(article.tags.join(', ')); };
    const closeForm = () => { setDraft(null); setTagsText(''); };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!draft) return;
        const tags = tagsText.split(',').map(t => t.trim()).filter(Boolean);
        try {
            if (draft.id) {
                await updateArticle({ ...draft, tags });
            } else {
                await addArticle({
                    title: draft.title,
                    content: draft.content,
                    format: draft.format,
                    tags,
                    linkedEntities: draft.linkedEntities,
                });
            }
            closeForm();
        } catch {
            /* errore già gestito dal contesto via toast */
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleting) return;
        try {
            await deleteArticle(deleting.id);
        } finally {
            setDeleting(null);
        }
    };

    const setDraftField = <K extends keyof KBArticle>(key: K, value: KBArticle[K]) => {
        setDraft(prev => (prev ? { ...prev, [key]: value } : prev));
    };

    const resetFilters = () => { setSearch(''); setFormatFilter(''); setEntityFilter(''); };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">library_books</span>
                        Knowledge Base
                    </h1>
                    <p className="text-sm text-on-surface-variant mt-1">
                        Schede informative collegabili a risorse, competenze, progetti, contratti e clienti.
                    </p>
                </div>
                <button
                    onClick={openForNew}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-full font-semibold hover:opacity-90 shadow-sm"
                >
                    <span className="material-symbols-outlined" aria-hidden="true">add</span>
                    Nuova scheda
                </button>
            </div>

            {/* Filtri */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center bg-surface-container-low p-4 rounded-2xl border border-outline-variant">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="form-input md:col-span-2"
                    placeholder="Cerca per titolo o contenuto..."
                    aria-label="Cerca schede"
                />
                <select
                    value={formatFilter}
                    onChange={(e) => setFormatFilter(e.target.value as ContentFormat | '')}
                    className="form-input"
                    aria-label="Filtra per formato"
                >
                    <option value="">Tutti i formati</option>
                    <option value="html">Solo HTML</option>
                    <option value="plain">Solo Plain</option>
                </select>
                <select
                    value={entityFilter}
                    onChange={(e) => setEntityFilter(e.target.value as LinkedEntityType | '')}
                    className="form-input"
                    aria-label="Filtra per entità collegata"
                >
                    <option value="">Tutte le entità</option>
                    {ENTITY_TYPES.map(t => (
                        <option key={t} value={t}>{ENTITY_TYPE_META[t].plural}</option>
                    ))}
                </select>
            </div>

            {/* Contenuto */}
            {loading ? (
                <div className="flex justify-center py-16"><SpinnerIcon className="w-8 h-8 text-primary" /></div>
            ) : visibleArticles.length === 0 ? (
                <EmptyState
                    icon="library_books"
                    title="Nessuna scheda trovata"
                    description={articles.length === 0
                        ? 'Crea la prima scheda della Knowledge Base.'
                        : 'Nessun risultato per i filtri correnti.'}
                    actionLabel={articles.length === 0 ? 'Nuova scheda' : 'Reimposta filtri'}
                    onAction={articles.length === 0 ? openForNew : resetFilters}
                />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {visibleArticles.map(article => (
                        <article key={article.id} className="flex flex-col bg-surface-container-low rounded-2xl border border-outline-variant p-5 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                                <h3 className="font-semibold text-on-surface text-lg leading-snug">{article.title}</h3>
                                <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                                    article.format === 'html'
                                        ? 'bg-primary-container text-on-primary-container border-transparent'
                                        : 'bg-surface-container-high text-on-surface-variant border-outline-variant'
                                }`}>
                                    {formatBadgeLabel(article.format)}
                                </span>
                            </div>

                            {article.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-3">
                                    {article.tags.map(tag => (
                                        <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-surface-container text-on-surface-variant">{tag}</span>
                                    ))}
                                </div>
                            )}

                            {article.linkedEntities.length > 0 && (
                                <div className="mt-3">
                                    <LinkedEntityChips entities={article.linkedEntities} />
                                </div>
                            )}

                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-outline-variant mt-4">
                                <span className="text-xs text-on-surface-variant">Aggiornata il {formatDate(article.updatedAt)}</span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => openForEdit(article)}
                                        aria-label="Modifica scheda"
                                        className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-primary"
                                    >
                                        <span className="material-symbols-outlined" aria-hidden="true">edit</span>
                                    </button>
                                    <button
                                        onClick={() => setDeleting(article)}
                                        aria-label="Elimina scheda"
                                        className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-error"
                                    >
                                        <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {/* Form creazione / modifica */}
            {draft && (
                <Modal isOpen={!!draft} onClose={closeForm} title={draft.id ? 'Modifica Scheda KB' : 'Nuova Scheda KB'}>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="kb-title" className="block text-sm font-medium text-on-surface-variant mb-1">Titolo *</label>
                            <input
                                id="kb-title"
                                type="text"
                                required
                                value={draft.title}
                                onChange={(e) => setDraftField('title', e.target.value)}
                                className="form-input"
                                placeholder="es. Processo di onboarding"
                            />
                        </div>

                        <div>
                            <span className="block text-sm font-medium text-on-surface-variant mb-1">Formato</span>
                            <div className="inline-flex rounded-full border border-outline-variant overflow-hidden" role="group" aria-label="Selettore formato">
                                {(['html', 'plain'] as ContentFormat[]).map(fmt => (
                                    <button
                                        key={fmt}
                                        type="button"
                                        onClick={() => setDraftField('format', fmt)}
                                        aria-pressed={draft.format === fmt}
                                        className={`px-4 py-1.5 text-sm font-medium ${
                                            draft.format === fmt
                                                ? 'bg-primary text-on-primary'
                                                : 'bg-surface text-on-surface-variant hover:bg-surface-container'
                                        }`}
                                    >
                                        {formatBadgeLabel(fmt)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="kb-content" className="block text-sm font-medium text-on-surface-variant mb-1">Contenuto</label>
                            {draft.format === 'html' ? (
                                <RichTextEditor
                                    value={draft.content}
                                    onChange={(html) => setDraftField('content', html)}
                                    ariaLabel="Contenuto"
                                />
                            ) : (
                                <textarea
                                    id="kb-content"
                                    value={draft.content}
                                    onChange={(e) => setDraftField('content', e.target.value)}
                                    rows={8}
                                    className="form-input font-mono text-sm w-full"
                                    placeholder="Testo semplice senza formattazione..."
                                />
                            )}
                        </div>

                        <div>
                            <label htmlFor="kb-tags" className="block text-sm font-medium text-on-surface-variant mb-1">Tag</label>
                            <input
                                id="kb-tags"
                                type="text"
                                value={tagsText}
                                onChange={(e) => setTagsText(e.target.value)}
                                className="form-input"
                                placeholder="Separati da virgola, es. hr, onboarding"
                            />
                        </div>

                        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                            <h4 className="text-sm font-bold text-primary mb-3 uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg" aria-hidden="true">link</span> Collega a
                            </h4>
                            <EntityLinkPicker
                                value={draft.linkedEntities}
                                onChange={(next: LinkedEntity[]) => setDraftField('linkedEntities', next)}
                                optionsByType={optionsByType}
                            />
                        </div>

                        <div className="flex justify-end space-x-3 pt-4 border-t border-outline-variant">
                            <button type="button" onClick={closeForm} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold">Annulla</button>
                            <button type="submit" disabled={isMutating} className="flex justify-center items-center px-6 py-2 bg-primary text-on-primary rounded-full disabled:opacity-50 font-semibold hover:opacity-90">
                                {isMutating ? <SpinnerIcon className="w-5 h-5" /> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            <ConfirmationModal
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                onConfirm={handleConfirmDelete}
                title="Elimina scheda"
                message={`Eliminare la scheda «${deleting?.title ?? ''}»? L'operazione è irreversibile.`}
                confirmButtonText="Elimina"
                isConfirming={isMutating}
            />
        </div>
    );
};

export default KnowledgeBasePage;
