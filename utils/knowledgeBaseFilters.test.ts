/**
 * @file utils/knowledgeBaseFilters.test.ts
 * @description Test unitari per le funzioni pure di ricerca/filtro/navigazione della Knowledge Base.
 */
import { describe, it, expect } from 'vitest';
import {
    stripHtml,
    searchArticles,
    filterArticles,
    formatBadgeLabel,
    getEntityRoute,
    ENTITY_TYPE_META,
} from './knowledgeBaseFilters';
import type { KBArticle, LinkedEntity } from '../types/knowledgeBase';

const makeArticle = (overrides: Partial<KBArticle> = {}): KBArticle => ({
    id: 'a1',
    title: 'Onboarding Risorse',
    content: '<p>Guida <strong>completa</strong> al processo</p>',
    format: 'html',
    tags: ['hr', 'onboarding'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    linkedEntities: [],
    ...overrides,
});

describe('stripHtml', () => {
    it('rimuove i tag HTML lasciando il testo', () => {
        expect(stripHtml('<p>Ciao <strong>mondo</strong></p>')).toBe('Ciao mondo');
    });

    it('restituisce la stringa invariata se non ci sono tag', () => {
        expect(stripHtml('testo semplice')).toBe('testo semplice');
    });

    it('gestisce stringa vuota', () => {
        expect(stripHtml('')).toBe('');
    });
});

describe('searchArticles', () => {
    const articles = [
        makeArticle({ id: 'a1', title: 'Onboarding Risorse', content: '<p>processo di inserimento</p>' }),
        makeArticle({ id: 'a2', title: 'Politiche Ferie', content: '<p>come richiedere le assenze</p>', format: 'plain' }),
    ];

    it('restituisce tutte le schede per query vuota', () => {
        expect(searchArticles(articles, '')).toHaveLength(2);
        expect(searchArticles(articles, '   ')).toHaveLength(2);
    });

    it('trova per titolo (case-insensitive)', () => {
        const res = searchArticles(articles, 'onboarding');
        expect(res).toHaveLength(1);
        expect(res[0].id).toBe('a1');
    });

    it('trova per contenuto ignorando i tag HTML', () => {
        const res = searchArticles(articles, 'inserimento');
        expect(res).toHaveLength(1);
        expect(res[0].id).toBe('a1');
    });

    it('restituisce array vuoto se nessuna corrispondenza', () => {
        expect(searchArticles(articles, 'inesistente')).toHaveLength(0);
    });
});

describe('filterArticles', () => {
    const articles = [
        makeArticle({ id: 'a1', format: 'html', linkedEntities: [{ entityType: 'risorsa', entityId: 'r1', label: 'Mario' }] }),
        makeArticle({ id: 'a2', format: 'plain', linkedEntities: [{ entityType: 'progetto', entityId: 'p1', label: 'Alpha' }] }),
        makeArticle({ id: 'a3', format: 'html', linkedEntities: [] }),
    ];

    it('senza filtri restituisce tutto', () => {
        expect(filterArticles(articles, {})).toHaveLength(3);
    });

    it('filtra per formato', () => {
        const res = filterArticles(articles, { format: 'html' });
        expect(res.map(a => a.id)).toEqual(['a1', 'a3']);
    });

    it('filtra per tipo di entità collegata', () => {
        const res = filterArticles(articles, { entityType: 'progetto' });
        expect(res).toHaveLength(1);
        expect(res[0].id).toBe('a2');
    });

    it('combina formato ed entità collegata', () => {
        const res = filterArticles(articles, { format: 'html', entityType: 'risorsa' });
        expect(res).toHaveLength(1);
        expect(res[0].id).toBe('a1');
    });

    it('ignora i filtri impostati a stringa vuota', () => {
        expect(filterArticles(articles, { format: '', entityType: '' })).toHaveLength(3);
    });
});

describe('formatBadgeLabel', () => {
    it('mappa i formati alle etichette di badge', () => {
        expect(formatBadgeLabel('html')).toBe('HTML');
        expect(formatBadgeLabel('plain')).toBe('Plain');
    });
});

describe('ENTITY_TYPE_META', () => {
    it('contiene metadati per tutti i tipi di entità', () => {
        const types: LinkedEntity['entityType'][] = ['risorsa', 'competenza', 'progetto', 'contratto', 'cliente'];
        types.forEach(t => {
            expect(ENTITY_TYPE_META[t]).toBeDefined();
            expect(ENTITY_TYPE_META[t].label.length).toBeGreaterThan(0);
            expect(ENTITY_TYPE_META[t].icon.length).toBeGreaterThan(0);
        });
    });
});

describe('getEntityRoute', () => {
    it('genera la rotta con editId per le risorse', () => {
        const link: LinkedEntity = { entityType: 'risorsa', entityId: 'r1', label: 'Mario' };
        expect(getEntityRoute(link)).toBe('/resources?editId=r1');
    });

    it('genera la rotta con editId per i clienti', () => {
        const link: LinkedEntity = { entityType: 'cliente', entityId: 'c1', label: 'Acme' };
        expect(getEntityRoute(link)).toBe('/clients?editId=c1');
    });

    it('genera la rotta con editId per i progetti', () => {
        const link: LinkedEntity = { entityType: 'progetto', entityId: 'p1', label: 'Alpha' };
        expect(getEntityRoute(link)).toBe('/projects?editId=p1');
    });

    it('genera la rotta base per competenze e contratti', () => {
        expect(getEntityRoute({ entityType: 'competenza', entityId: 's1', label: 'React' })).toBe('/skills');
        expect(getEntityRoute({ entityType: 'contratto', entityId: 'ct1', label: 'C-1' })).toBe('/contracts');
    });
});
