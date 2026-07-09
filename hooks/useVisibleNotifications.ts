/**
 * @file useVisibleNotifications.ts
 * @description Notifiche visibili all'utente corrente: quelle indirizzate alla
 * sua risorsa più le broadcast senza destinatario. Un utente senza risorsa
 * collegata (o senza login attivo) vede l'intera inbox, per retrocompatibilità.
 * Stessa regola applicata lato server dalla mark_read massiva.
 */

import { useMemo } from 'react';
import { useUIConfigContext } from '../context/UIConfigContext';
import { useAuth } from '../context/AuthContext';
import { Notification } from '../types';

export const filterNotificationsForRecipient = (
    notifications: Notification[],
    recipientResourceId: string | null | undefined
): Notification[] => {
    if (!recipientResourceId) return notifications;
    return notifications.filter(n => !n.recipientResourceId || n.recipientResourceId === recipientResourceId);
};

export const useVisibleNotifications = (): Notification[] => {
    const { notifications } = useUIConfigContext();
    const { user } = useAuth();
    return useMemo(
        () => filterNotificationsForRecipient(notifications, user?.resourceId),
        [notifications, user?.resourceId]
    );
};

export default useVisibleNotifications;
