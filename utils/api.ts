import { getStoredAuthToken } from './auth';
import { apiFetch } from '../services/apiClient';

const buildAuthHeaders = (init?: RequestInit): HeadersInit => {
    const token = getStoredAuthToken();
    const headers: HeadersInit = { 'Content-Type': 'application/json', ...init?.headers };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

export const authorizedFetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const response = await fetch(input, { ...init, headers: buildAuthHeaders(init) });
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Request failed with status ${response.status}`);
    }
    return response;
};

export const authorizedJsonFetch = async <T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> => {
    return apiFetch<T>(input.toString(), init);
};
