export const getStoredAuthToken = (): string | null => {
    if (typeof localStorage === 'undefined') {
        return null;
    }
    return localStorage.getItem('authToken');
};
