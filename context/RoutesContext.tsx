import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useEntitiesContext } from './AppContext';
import { routesManifest, type AppRoute } from '../src/routes';
import { normalizePath } from '../src/utils/paths';
import type { UserRole } from '../types';

type BreadcrumbItem = { path: string; label: string };

interface RoutesContextValue {
    manifest: AppRoute[];
    enabledRoutes: AppRoute[];
    navigationRoutes: AppRoute[];
    bottomNavigationRoutes: AppRoute[];
    homePath: string;
    getBreadcrumb: (pathname: string) => BreadcrumbItem[];
    getHomeForRole: (role?: UserRole | null) => string;
    canAccessRoute: (route: AppRoute) => boolean;
    isRouteEnabled: (route: AppRoute) => boolean;
}

const RoutesContext = createContext<RoutesContextValue | undefined>(undefined);

const isRouteEnabledByFeatureFlag = (
    route: AppRoute,
    options: { isAdmin: boolean; pageVisibility: Record<string, boolean> }
) => {
    if (route.featureFlag === 'pageVisibility') {
        const visibilityFlag = options.pageVisibility[route.path];
        if (visibilityFlag === true && !options.isAdmin) return false;
    }
    return true;
};

const matchRole = (route: AppRoute, role?: UserRole | null) => {
    if (!route.requiredRole) return true;
    if (!role) return false;
    return Array.isArray(route.requiredRole)
        ? route.requiredRole.includes(role)
        : route.requiredRole === role;
};

export const RoutesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { pageVisibility, roleHomePages, sidebarConfig } = useEntitiesContext();
    const { user, hasPermission, isLoginProtectionEnabled, isAdmin } = useAuth();

    const isRouteEnabled = useCallback(
        (route: AppRoute) => isRouteEnabledByFeatureFlag(route, { pageVisibility, isAdmin }),
        [isAdmin, pageVisibility]
    );

    const canAccessRoute = useCallback(
        (route: AppRoute) => {
            if (!isRouteEnabled(route)) return false;
            if (route.requiresAuth === false) return true;
            if (!isLoginProtectionEnabled) return true;
            if (!user) return false;
            if (!matchRole(route, user.role)) return false;

            const permissionKey = route.requiredPermission ?? route.path;
            return hasPermission(normalizePath(permissionKey));
        },
        [hasPermission, isLoginProtectionEnabled, isRouteEnabled, user]
    );

    const enabledRoutes = useMemo(() => routesManifest.filter(canAccessRoute), [canAccessRoute]);

    const sidebarOverrides = useMemo(() => {
        const map = new Map<string, { label?: string; icon?: string; section?: string; color?: string; order: number }>();
        sidebarConfig.forEach((item, index) => {
            map.set(normalizePath(item.path), {
                label: item.label,
                icon: item.icon,
                section: item.section,
                color: item.color,
                order: index
            });
        });
        return map;
    }, [sidebarConfig]);

    const navigationRoutes = useMemo(() => {
        const decorated = enabledRoutes
            .filter(route => route.showInSidebar)
            .map(route => {
                const override = sidebarOverrides.get(normalizePath(route.path));
                if (!override) return route;
                return {
                    ...route,
                    label: override.label || route.label,
                    icon: override.icon || route.icon,
                    section: override.section || route.section,
                    color: override.color ?? route.color,
                };
            });

        const fallbackOrder = new Map<string, number>();
        decorated.forEach((route, index) => fallbackOrder.set(normalizePath(route.path), index));

        const sorted = decorated.sort((a, b) => {
            const overrideA = sidebarOverrides.get(normalizePath(a.path));
            const overrideB = sidebarOverrides.get(normalizePath(b.path));

            if (overrideA && overrideB) return overrideA.order - overrideB.order;
            if (overrideA) return -1;
            if (overrideB) return 1;
            return (fallbackOrder.get(normalizePath(a.path)) ?? 0) - (fallbackOrder.get(normalizePath(b.path)) ?? 0);
        });

        return sorted;
    }, [enabledRoutes, sidebarOverrides]);

    const bottomNavigationRoutes = useMemo(() => enabledRoutes.filter(route => route.showInBottomNav), [enabledRoutes]);

    const getHomeForRole = useCallback(
        (role?: UserRole | null) => {
            const preferred = role ? roleHomePages[role] : undefined;
            const preferredRoute = preferred ? enabledRoutes.find(route => route.path === preferred) : undefined;
            if (preferredRoute) return preferredRoute.path;

            const defaultRoute = enabledRoutes.find(route => route.isDefaultHome) ?? enabledRoutes[0];
            return defaultRoute?.path ?? '/';
        },
        [enabledRoutes, roleHomePages]
    );

    const homePath = useMemo(() => getHomeForRole(user?.role), [getHomeForRole, user?.role]);

    const getBreadcrumb = useCallback(
        (pathname: string): BreadcrumbItem[] => {
            const normalizedPath = normalizePath(pathname);
            const items: BreadcrumbItem[] = [{ label: 'Home', path: homePath }];
            const target = enabledRoutes.find(route => route.path === normalizedPath);
            if (target && target.path !== homePath) {
                items.push({ label: target.label, path: target.path });
            }
            return items;
        },
        [enabledRoutes, homePath]
    );

    const value: RoutesContextValue = {
        manifest: routesManifest,
        enabledRoutes,
        navigationRoutes,
        bottomNavigationRoutes,
        homePath,
        getBreadcrumb,
        getHomeForRole,
        canAccessRoute,
        isRouteEnabled,
    };

    return <RoutesContext.Provider value={value}>{children}</RoutesContext.Provider>;
};

export const useRoutesManifest = () => {
    const context = useContext(RoutesContext);
    if (!context) {
        throw new Error('useRoutesManifest must be used within a RoutesProvider');
    }
    return context;
};
