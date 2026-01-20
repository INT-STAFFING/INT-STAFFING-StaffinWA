import { useCallback, useEffect, useMemo, useState } from 'react';
import { authorizedJsonFetch } from '../utils/api';

export interface AuthorizedResourceState<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    updateCache: (updater: (current: T | null) => T, persist?: boolean) => void;
}

const resourceCache = new Map<string, unknown>();

export const clearAuthorizedResourceCache = (): void => {
    resourceCache.clear();
};

export const useAuthorizedResource = <T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    options?: { skip?: boolean }
): AuthorizedResourceState<T> => {
    const initialData = useMemo(() => resourceCache.get(cacheKey) as T | undefined, [cacheKey]);
    const [data, setData] = useState<T | null>(initialData ?? null);
    const [loading, setLoading] = useState<boolean>(!initialData && !options?.skip);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (options?.skip) return;
        setLoading(true);
        try {
            const result = await fetcher();
            resourceCache.set(cacheKey, result as unknown);
            setData(result);
            setError(null);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }, [cacheKey, fetcher, options?.skip]);

    const updateCache = useCallback(
        (updater: (current: T | null) => T, persist: boolean = true) => {
            setData(prev => {
                const nextValue = updater(prev);
                if (persist) {
                    resourceCache.set(cacheKey, nextValue as unknown);
                }
                return nextValue;
            });
        },
        [cacheKey]
    );

    useEffect(() => {
        if (!options?.skip && !resourceCache.has(cacheKey)) {
            void refresh();
        }
    }, [cacheKey, options?.skip, refresh]);

    return { data, loading, error, refresh, updateCache };
};

export const createAuthorizedFetcher = <T>(url: string, init?: RequestInit) => () => authorizedJsonFetch<T>(url, init);