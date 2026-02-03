
/**
 * @file utils/webhookNotifier.ts
 * @description Servizio per inviare notifiche MS Teams tramite Webhook.
 * Gestisce la formattazione di Adaptive Cards e l'invio asincrono.
 */

import { VercelPoolClient } from '@vercel/postgres';

interface NotificationPayload {
    title: string;
    facts: { name: string; value: string }[];
    actions?: { type: 'OpenUrl'; title: string; url: string }[];
    color?: 'Good' | 'Warning' | 'Attention' | 'Accent';
}

const COLOR_MAP = {
    Good: '2E7D32', // Green
    Warning: 'F9A825', // Yellow/Orange
    Attention: 'C62828', // Red
    Accent: '006493' // Primary Blue
};

/**
 * Invia una notifica a tutti i webhook attivi per un dato evento.
 * Non blocca l'esecuzione (fire-and-forget pattern simulato con catch interno).
 */
export async function notify(
    client: VercelPoolClient,
    eventType: string,
    payload: NotificationPayload
) {
    try {
        // 1. Recupera configurazioni attive per l'evento
        const { rows } = await client.query(
            `SELECT webhook_url FROM notification_configs WHERE event_type = $1 AND is_active = TRUE`,
            [eventType]
        );

        if (rows.length === 0) return;

        // 2. Costruisci Adaptive Card
        const card = {
            type: "message",
            attachments: [
                {
                    contentType: "application/vnd.microsoft.card.adaptive",
                    contentUrl: null,
                    content: {
                        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                        "version": "1.4",
                        "type": "AdaptiveCard",
                        "body": [
                            {
                                "type": "Container",
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": payload.title,
                                        "weight": "Bolder",
                                        "size": "Medium",
                                        "color": payload.color === 'Attention' ? 'Attention' : 'Default'
                                    },
                                    {
                                        "type": "FactSet",
                                        "facts": payload.facts.map(f => ({ title: f.name, value: f.value }))
                                    }
                                ],
                                "style": "emphasis",
                                "bleed": true
                            }
                        ],
                        "actions": payload.actions?.map(a => ({
                            "type": "Action.OpenUrl",
                            "title": a.title,
                            "url": a.url
                        }))
                    }
                }
            ]
        };

        // 3. Invia a tutti gli endpoint (Promise.allSettled per non fallire se uno è down)
        const requests = rows.map(row => 
            fetch(row.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(card)
            }).catch(err => console.error(`Failed to notify ${row.webhook_url}:`, err))
        );

        // Attendiamo ma senza bloccare troppo a lungo (best effort)
        // In Vercel serverless functions, è meglio attendere o usare waitUntil se disponibile.
        // Qui usiamo await semplice perché la latenza verso MS Teams è bassa.
        await Promise.allSettled(requests);

    } catch (error) {
        console.error("Error in webhookNotifier:", error);
        // Non rilanciamo l'errore per non interrompere il flusso principale dell'applicazione
    }
}
