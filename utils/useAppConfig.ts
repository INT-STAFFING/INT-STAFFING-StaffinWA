import { useState, useCallback } from 'react';
import { useToast } from '../context/ToastContext';

const APP_CONFIG_CACHE_KEY = 'app_config_cache';

type AppConfig = Record<string, any>;

const getCache = (): AppConfig => {
    try {
        const cached = localStorage.getItem(APP_CONFIG_CACHE_KEY);
        return cached ? JSON.parse(cached) : {};
    } catch (e) {
        console.error("Failed to read app config cache from localStorage", e);
        return {};
    }
};

const setCache = (cache: AppConfig) => {
    try {
        localStorage.setItem(APP_CONFIG_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
        console.error("Failed to write app config cache to localStorage", e);
    }
};

/**
 * A map of new database keys to their legacy localStorage keys.
 */
const LEGACY_KEYS: Record<string, string> = {
  theme: 'staffing-app-theme',
  dashboardLayout: 'dashboardCardOrder',
};

/**
 * Checks for legacy settings in localStorage and migrates them to the server if they don't already exist there.
 * This is a one-time, silent operation.
 * @param keysToMigrate An array of new configuration keys to check for migration.
 */
export const migrateLocalToServerIfNeeded = async (keysToMigrate: (keyof typeof LEGACY_KEYS)[]) => {
  if (localStorage.getItem('v1-migration-complete')) {
    return;
  }

  console.log('Checking for legacy settings to migrate...');

  for (const newKey of keysToMigrate) {
    try {
      // 1. Check if the key already exists on the server.
      const serverCheck = await fetch(`/api/auth-config?key=${newKey}`);
      
      // If it exists on the server (200 OK) or there's a server error, skip migration for this key.
      if (serverCheck.ok) {
        console.log(`'${newKey}' already exists on server. Skipping migration.`);
        continue;
      }
      
      // We only proceed if the server explicitly tells us the key is not found.
      if (serverCheck.status !== 404) {
          console.warn(`Server check for '${newKey}' failed with status ${serverCheck.status}. Skipping migration for this key.`);
          continue;
      }

      // 2. If not on server, check for the legacy key in localStorage.
      const legacyKey = LEGACY_KEYS[newKey];
      const localValueStr = localStorage.getItem(legacyKey);

      if (localValueStr) {
        console.log(`Found legacy setting for '${newKey}' in localStorage. Migrating...`);
        const localValue = JSON.parse(localValueStr);

        // 3. Save the value to the server using the generic API endpoint.
        const saveResponse = await fetch('/api/auth-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: newKey, value: localValue }),
        });

        if (saveResponse.ok) {
          console.log(`Successfully migrated '${newKey}' to server.`);
          // 4. On successful migration, clean up the old localStorage key.
          localStorage.removeItem(legacyKey);
        } else {
             const errorData = await saveResponse.json();
             throw new Error(errorData.error || 'Failed to save migrated setting.');
        }
      }
    } catch (error) {
      console.error(`Silent failure during migration for key '${newKey}':`, error);
      // Fail silently as requested and continue to the next key.
    }
  }

  // Mark the migration as attempted to prevent it from running again.
  localStorage.setItem('v1-migration-complete', 'true');
  console.log('Migration check complete.');
};


export function useAppConfig() {
    const [config, setConfig] = useState<AppConfig>(getCache);
    const { addToast } = useToast();

    const getKey = useCallback(async <T = any>(key: string): Promise<T | undefined> => {
        try {
            const response = await fetch(`/api/auth-config?key=${key}`);
            if (response.ok) {
                const data = await response.json();
                const newCache = { ...getCache(), [key]: data.value };
                setCache(newCache);
                setConfig(newCache);
                return data.value as T;
            }
            if (response.status === 404) {
                // Key not found in DB, check local cache (which is in `config` state)
                return config[key] as T | undefined;
            }
            throw new Error(`API error: ${response.statusText}`);
        } catch (error) {
            console.warn(`[useAppConfig] getKey for '${key}' failed, falling back to cache.`, error);
            // Fallback to cache if API fails (offline, etc.)
            return config[key] as T | undefined;
        }
    }, [config]);

    const setKey = useCallback(async (key: string, value: any): Promise<void> => {
        // Optimistic update
        const oldCache = getCache();
        const newCache = { ...oldCache, [key]: value };
        setCache(newCache);
        setConfig(newCache);

        try {
            const response = await fetch('/api/auth-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save config to server.');
            }
            // Success! The optimistic update was correct.
        } catch (error) {
            console.error(`[useAppConfig] setKey for '${key}' failed. Reverting optimistic update.`, error);
            // Revert on failure
            setCache(oldCache);
            setConfig(oldCache);
            addToast(`Failed to save setting '${key}': ${(error as Error).message}`, 'error');
            throw error; // Rethrow so caller knows about the failure
        }
    }, [addToast]);

    const mutateAll = useCallback(async () => {
        const keysToRefetch = Object.keys(getCache());
        if (keysToRefetch.length === 0) return;

        for (const key of keysToRefetch) {
            await getKey(key);
        }
    }, [getKey]);

    return { config, getKey, setKey, mutateAll };
}