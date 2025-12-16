import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearAuthorizedResourceCache, useAuthorizedResource } from './useAuthorizedResource';

interface SampleItem {
    id: number;
}

describe('useAuthorizedResource', () => {
    beforeEach(() => {
        clearAuthorizedResourceCache();
        vi.restoreAllMocks();
    });

    it('fetches data on mount and caches it', async () => {
        const fetcher = vi.fn().mockResolvedValue([{ id: 1 }]);
        const { result } = renderHook(() => useAuthorizedResource<SampleItem[]>('resource', fetcher));

        expect(result.current.loading).toBe(true);

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.data).toEqual([{ id: 1 }]);
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('reuses cached data without re-fetching', async () => {
        const firstFetcher = vi.fn().mockResolvedValue([{ id: 1 }]);
        const { result: firstResult } = renderHook(() => useAuthorizedResource<SampleItem[]>('cached', firstFetcher));
        await waitFor(() => expect(firstResult.current.loading).toBe(false));
        expect(firstFetcher).toHaveBeenCalledTimes(1);

        const secondFetcher = vi.fn().mockResolvedValue([{ id: 2 }]);
        const { result: secondResult } = renderHook(() => useAuthorizedResource<SampleItem[]>('cached', secondFetcher));

        expect(secondResult.current.data).toEqual([{ id: 1 }]);
        expect(secondResult.current.loading).toBe(false);
        expect(secondFetcher).not.toHaveBeenCalled();
    });

    it('allows manual cache updates and refreshes', async () => {
        const fetcher = vi.fn().mockResolvedValue<SampleItem[]>([{ id: 1 }]);
        const { result } = renderHook(() => useAuthorizedResource<SampleItem[]>('mutable', fetcher));
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => {
            result.current.updateCache(prev => ([...(prev ?? []), { id: 2 }]));
        });

        expect(result.current.data).toEqual([{ id: 1 }, { id: 2 }]);

        fetcher.mockResolvedValue([{ id: 3 }]);

        await act(async () => {
            await result.current.refresh();
        });

        expect(result.current.data).toEqual([{ id: 3 }]);
    });
});
