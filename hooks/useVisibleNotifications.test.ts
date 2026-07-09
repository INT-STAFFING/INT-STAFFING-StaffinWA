/**
 * @file useVisibleNotifications.test.ts
 * @description Test della regola di visibilità delle notifiche per destinatario,
 * condivisa tra pagina Notifiche, campanella header e badge sidebar (e speculare
 * alla mark_read massiva lato server).
 */

import { describe, it, expect } from 'vitest';
import { filterNotificationsForRecipient } from './useVisibleNotifications';
import { Notification } from '../types';

const notif = (id: string, recipientResourceId: string, isRead = false): Notification => ({
    id,
    recipientResourceId,
    title: `Notifica ${id}`,
    message: 'msg',
    isRead,
    createdAt: '2026-07-01T10:00:00Z',
});

const inbox: Notification[] = [
    notif('n1', 'res-A'),
    notif('n2', 'res-B'),
    notif('n3', '' /* broadcast senza destinatario */),
    notif('n4', 'res-A', true),
];

describe('filterNotificationsForRecipient', () => {
    it('mostra solo le notifiche della propria risorsa più le broadcast', () => {
        const visible = filterNotificationsForRecipient(inbox, 'res-A');
        expect(visible.map(n => n.id)).toEqual(['n1', 'n3', 'n4']);
    });

    it('senza risorsa collegata (o senza login) mostra tutta la inbox', () => {
        expect(filterNotificationsForRecipient(inbox, null)).toHaveLength(4);
        expect(filterNotificationsForRecipient(inbox, undefined)).toHaveLength(4);
    });

    it('un utente senza notifiche proprie vede solo le broadcast', () => {
        const visible = filterNotificationsForRecipient(inbox, 'res-C');
        expect(visible.map(n => n.id)).toEqual(['n3']);
    });
});
