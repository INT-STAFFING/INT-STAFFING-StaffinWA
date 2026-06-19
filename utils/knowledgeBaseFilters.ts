/**
 * @file utils/knowledgeBaseFilters.ts
 * @description Funzioni pure per la ricerca, il filtro e la navigazione delle schede
 * della Knowledge Base. Mantenute prive di dipendenze da React per essere facilmente testabili.
 */

import type { KBArticle, ContentFormat, LinkedEntity, LinkedEntityType } from '../types/knowledgeBase';

/** Rimuove i tag HTML da una stringa, restituendo il solo testo (per la ricerca testuale). */
export const stripHtml = (html: string): string =>
    html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Ricerca testuale lato client su titolo e contenuto.
 * Per il contenuto HTML viene effettuato lo strip dei tag prima del confronto.
 */
export const searchArticles = (articles: KBArticle[], query: string): KBArticle[] => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(article => {
        const titleMatch = article.title.toLowerCase().includes(q);
        const contentText = (article.format === 'html' ? stripHtml(article.content) : article.content).toLowerCase();
        return titleMatch || contentText.includes(q);
    });
};

export interface KBFilters {
    format?: ContentFormat | '';
    entityType?: LinkedEntityType | '';
}

/** Filtra le schede per formato e/o per tipo di entità collegata. */
export const filterArticles = (articles: KBArticle[], filters: KBFilters): KBArticle[] => {
    return articles.filter(article => {
        const formatMatch = filters.format ? article.format === filters.format : true;
        const entityMatch = filters.entityType
            ? article.linkedEntities.some(e => e.entityType === filters.entityType)
            : true;
        return formatMatch && entityMatch;
    });
};

/** Etichetta del badge per il formato del contenuto. */
export const formatBadgeLabel = (format: ContentFormat): string =>
    format === 'html' ? 'HTML' : 'Plain';

/** Metadati di presentazione (etichetta + icona Material Symbols) per ciascun tipo di entità. */
export const ENTITY_TYPE_META: Record<LinkedEntityType, { label: string; plural: string; icon: string; basePath: string; deepLink: boolean }> = {
    risorsa:    { label: 'Risorsa',    plural: 'Risorse',    icon: 'person',      basePath: '/resources', deepLink: true },
    competenza: { label: 'Competenza', plural: 'Competenze', icon: 'school',      basePath: '/skills',    deepLink: false },
    progetto:   { label: 'Progetto',   plural: 'Progetti',   icon: 'folder',      basePath: '/projects',  deepLink: true },
    contratto:  { label: 'Contratto',  plural: 'Contratti',  icon: 'description', basePath: '/contracts', deepLink: false },
    cliente:    { label: 'Cliente',    plural: 'Clienti',    icon: 'domain',      basePath: '/clients',   deepLink: true },
};

/** Tutti i tipi di entità collegabili, in ordine di visualizzazione. */
export const ENTITY_TYPES: LinkedEntityType[] = ['risorsa', 'competenza', 'progetto', 'contratto', 'cliente'];

/**
 * Costruisce la rotta (hash router relativa) verso la sezione dell'entità collegata.
 * Per le entità che supportano il deep-link viene aggiunto `?editId=<id>`.
 */
export const getEntityRoute = (entity: LinkedEntity): string => {
    const meta = ENTITY_TYPE_META[entity.entityType];
    return meta.deepLink ? `${meta.basePath}?editId=${entity.entityId}` : meta.basePath;
};
