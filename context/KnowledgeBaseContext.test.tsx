/* @vitest-environment jsdom */
/**
 * @file context/KnowledgeBaseContext.test.tsx
 * @description Test unitari per KnowledgeBaseContext: fetch iniziale e CRUD schede.
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock del client API e del Toast per isolare il contesto.
vi.mock('../services/apiClient', () => ({
    apiFetch: vi.fn(),
}));
vi.mock('./ToastContext', () => ({
    useToast: () => ({ addToast: vi.fn() }),
}));

import { apiFetch } from '../services/apiClient';
import { KnowledgeBaseProvider, useKnowledgeBaseContext } from './KnowledgeBaseContext';
import type { KBArticle } from '../types/knowledgeBase';

const mockedApiFetch = vi.mocked(apiFetch);

const sampleArticle = (overrides: Partial<KBArticle> = {}): KBArticle => ({
    id: 'a1',
    title: 'Scheda 1',
    content: '<p>contenuto</p>',
    format: 'html',
    tags: ['t1'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    linkedEntities: [],
    version: 1,
    ...overrides,
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <KnowledgeBaseProvider>{children}</KnowledgeBaseProvider>
);

beforeEach(() => {
    mockedApiFetch.mockReset();
});

describe('KnowledgeBaseContext - fetch iniziale', () => {
    it('carica le schede al montaggio', async () => {
        mockedApiFetch.mockResolvedValueOnce([sampleArticle()]);
        const { result } = renderHook(() => useKnowledgeBaseContext(), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.articles).toHaveLength(1);
        expect(mockedApiFetch).toHaveBeenCalledWith('/api/resources?entity=knowledge_base_articles');
    });

    it('gestisce un fetch fallito senza crashare', async () => {
        mockedApiFetch.mockRejectedValueOnce(new Error('boom'));
        const { result } = renderHook(() => useKnowledgeBaseContext(), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.articles).toEqual([]);
    });
});

describe('KnowledgeBaseContext - CRUD', () => {
    it('addArticle invia POST con createdAt/updatedAt e aggiorna lo stato', async () => {
        mockedApiFetch.mockResolvedValueOnce([]); // fetch iniziale
        const { result } = renderHook(() => useKnowledgeBaseContext(), { wrapper });
        await waitFor(() => expect(result.current.loading).toBe(false));

        const created = sampleArticle({ id: 'new1', title: 'Nuova' });
        mockedApiFetch.mockResolvedValueOnce(created);

        await act(async () => {
            await result.current.addArticle({
                title: 'Nuova',
                content: 'x',
                format: 'plain',
                tags: [],
                linkedEntities: [],
            });
        });

        const postCall = mockedApiFetch.mock.calls.find(c => (c[1] as RequestInit)?.method === 'POST');
        expect(postCall).toBeDefined();
        const body = JSON.parse((postCall![1] as RequestInit).body as string);
        expect(body.createdAt).toBeTruthy();
        expect(body.updatedAt).toBeTruthy();
        expect(body.title).toBe('Nuova');
        expect(result.current.articles).toHaveLength(1);
        expect(result.current.articles[0].id).toBe('new1');
    });

    it('updateArticle invia PUT e aggiorna updatedAt', async () => {
        const existing = sampleArticle();
        mockedApiFetch.mockResolvedValueOnce([existing]);
        const { result } = renderHook(() => useKnowledgeBaseContext(), { wrapper });
        await waitFor(() => expect(result.current.loading).toBe(false));

        const updated = { ...existing, title: 'Modificata', updatedAt: '2026-02-01T00:00:00.000Z' };
        mockedApiFetch.mockResolvedValueOnce(updated);

        await act(async () => {
            await result.current.updateArticle({ ...existing, title: 'Modificata' });
        });

        const putCall = mockedApiFetch.mock.calls.find(c => (c[1] as RequestInit)?.method === 'PUT');
        expect(putCall).toBeDefined();
        expect((putCall![0] as string)).toContain('id=a1');
        expect(result.current.articles[0].title).toBe('Modificata');
    });

    it('deleteArticle invia DELETE e rimuove dallo stato', async () => {
        const existing = sampleArticle();
        mockedApiFetch.mockResolvedValueOnce([existing]);
        const { result } = renderHook(() => useKnowledgeBaseContext(), { wrapper });
        await waitFor(() => expect(result.current.loading).toBe(false));

        mockedApiFetch.mockResolvedValueOnce(null);
        await act(async () => {
            await result.current.deleteArticle('a1');
        });

        const delCall = mockedApiFetch.mock.calls.find(c => (c[1] as RequestInit)?.method === 'DELETE');
        expect(delCall).toBeDefined();
        expect(result.current.articles).toHaveLength(0);
    });
});

describe('useKnowledgeBaseContext - guardia provider', () => {
    it('lancia un errore se usato fuori dal provider', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => renderHook(() => useKnowledgeBaseContext())).toThrow();
        spy.mockRestore();
    });
});
