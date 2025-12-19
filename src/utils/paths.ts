export const normalizePath = (path: string): string => {
    const cleanPath = path.split('?')[0];
    if (cleanPath === '/') return cleanPath;
    return cleanPath.replace(/\/$/, '') || '/';
};
