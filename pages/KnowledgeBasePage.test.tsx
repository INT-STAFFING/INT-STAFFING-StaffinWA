/* @vitest-environment jsdom */
/**
 * @file pages/KnowledgeBasePage.test.tsx
 * @description Test unitari per la pagina Knowledge Base: lista, ricerca, filtri, creazione ed eliminazione.
 */
import React from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';

vi.mock('../context/KnowledgeBaseContext');
vi.mock('../context/AppContext');

import { useKnowledgeBaseContext } from '../context/KnowledgeBaseContext';
import { useEntitiesContext } from '../context/AppContext';
import KnowledgeBasePage from './KnowledgeBasePage';
import type { KBArticle } from '../types/knowledgeBase';

beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

const article = (o: Partial<KBArticle> = {}): KBArticle => ({
    id: 'a1',
    title: 'Onboarding Risorse',
    content: '<p>guida</p>',
    format: 'html',
    tags: ['hr'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    linkedEntities: [{ entityType: 'risorsa', entityId: 'r1', label: 'Mario Rossi' }],
    ...o,
});

const setupContext = (overrides: Partial<ReturnType<typeof useKnowledgeBaseContext>> = {}) => {
    const ctx = {
        articles: [article()],
        loading: false,
        error: null,
        isMutating: false,
        fetchArticles: vi.fn(),
        addArticle: vi.fn().mockResolvedValue(undefined),
        updateArticle: vi.fn().mockResolvedValue(undefined),
        deleteArticle: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
    vi.mocked(useKnowledgeBaseContext).mockReturnValue(ctx);
    return ctx;
};

const setupEntities = () => {
    vi.mocked(useEntitiesContext).mockReturnValue({
        resources: [{ id: 'r1', name: 'Mario Rossi', resigned: false }],
        skills: [{ id: 's1', name: 'React' }],
        projects: [{ id: 'p1', name: 'Progetto Alpha' }],
        contracts: [{ id: 'ct1', name: 'Contratto Beta' }],
        clients: [{ id: 'c1', name: 'Acme' }],
    } as unknown as ReturnType<typeof useEntitiesContext>);
};

const renderPage = (initialEntries: string[] = ['/knowledge-base']) =>
    render(<MemoryRouter initialEntries={initialEntries}><KnowledgeBasePage /></MemoryRouter>);

describe('KnowledgeBasePage - lista e ricerca', () => {
    it('mostra le schede esistenti con titolo, badge formato e tag', () => {
        setupContext();
        setupEntities();
        renderPage();
        expect(screen.getByText('Onboarding Risorse')).toBeDefined();
        expect(screen.getByText('HTML')).toBeDefined();
        expect(screen.getByText('hr')).toBeDefined();
    });

    it('filtra le schede tramite la ricerca testuale', () => {
        setupContext({ articles: [article(), article({ id: 'a2', title: 'Politiche Ferie', tags: [] })] });
        setupEntities();
        renderPage();
        const search = screen.getByPlaceholderText(/Cerca/i);
        fireEvent.change(search, { target: { value: 'ferie' } });
        expect(screen.queryByText('Onboarding Risorse')).toBeNull();
        expect(screen.getByText('Politiche Ferie')).toBeDefined();
    });

    it('filtra per formato', () => {
        setupContext({ articles: [article(), article({ id: 'a2', title: 'Nota Plain', format: 'plain' })] });
        setupEntities();
        renderPage();
        const formatFilterButton = screen.getByRole('button', { name: /Tutti i formati/i });
        fireEvent.click(formatFilterButton);
        fireEvent.click(screen.getByRole('option', { name: 'Plain' }));
        expect(screen.getByText('Nota Plain')).toBeDefined();
        expect(screen.queryByText('Onboarding Risorse')).toBeNull();
    });

    it('mostra lo stato vuoto quando non ci sono schede', () => {
        setupContext({ articles: [] });
        setupEntities();
        renderPage();
        expect(screen.getByText(/Nessuna scheda/i)).toBeDefined();
    });
});

describe('KnowledgeBasePage - creazione', () => {
    it('apre la form di creazione cliccando su Nuova scheda', () => {
        setupContext();
        setupEntities();
        renderPage();
        fireEvent.click(screen.getByText('Nuova scheda'));
        expect(screen.getByText('Nuova Scheda KB')).toBeDefined();
        expect(screen.getByLabelText(/Titolo/i)).toBeDefined();
    });

    it('crea una scheda compilando titolo e contenuto plain', () => {
        const ctx = setupContext();
        setupEntities();
        renderPage();
        fireEvent.click(screen.getByText('Nuova scheda'));

        const dialog = screen.getByRole('dialog');
        fireEvent.change(within(dialog).getByLabelText(/Titolo/i), { target: { value: 'Nuova Guida' } });
        // Passa al formato Plain per usare la textarea.
        fireEvent.click(within(dialog).getByRole('button', { name: 'Plain' }));
        fireEvent.change(within(dialog).getByLabelText(/Contenuto/i), { target: { value: 'testo semplice' } });
        fireEvent.submit(dialog.querySelector('form')!);

        expect(ctx.addArticle).toHaveBeenCalledTimes(1);
        const payload = ctx.addArticle.mock.calls[0][0];
        expect(payload.title).toBe('Nuova Guida');
        expect(payload.format).toBe('plain');
        expect(payload.content).toBe('testo semplice');
    });
});

describe('KnowledgeBasePage - deep link', () => {
    it('apre automaticamente la scheda indicata da ?openId (es. da ricerca globale)', () => {
        setupContext();
        setupEntities();
        renderPage(['/knowledge-base?openId=a1']);
        expect(screen.getByText('Modifica Scheda KB')).toBeDefined();
        expect((screen.getByLabelText(/Titolo/i) as HTMLInputElement).value).toBe('Onboarding Risorse');
    });
});

describe('KnowledgeBasePage - eliminazione', () => {
    it('chiede conferma ed elimina la scheda', () => {
        const ctx = setupContext();
        setupEntities();
        renderPage();
        fireEvent.click(screen.getByLabelText('Elimina scheda'));
        // Modale di conferma
        expect(screen.getByText(/Eliminare la scheda/i)).toBeDefined();
        fireEvent.click(screen.getByRole('button', { name: 'Elimina' }));
        expect(ctx.deleteArticle).toHaveBeenCalledWith('a1');
    });
});
