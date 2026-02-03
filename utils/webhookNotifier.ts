
/**
 * @file utils/webhookNotifier.ts
 * @description Servizio per inviare notifiche MS Teams tramite Webhook.
 * Gestisce la formattazione di Adaptive Cards e l'invio asincrono.
 */

import { VercelPoolClient } from '@vercel/postgres';

interface NotificationPayload {
    title: string;
    subtitle?: string;
    facts: { name: string; value: string }[];
    /** Dettagli aggiuntivi da mostrare solo espandendo la card */
    detailedFacts?: { name: string; value: string }[];
    actions?: { type: 'OpenUrl'; title: string; url: string }[];
    color?: 'Good' | 'Warning' | 'Attention' | 'Accent';
}

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

        // 2. Costruzione Azioni (Bottoni)
        const actions: any[] = [];

        // A. Link Esterni (es. "Vai al Progetto")
        if (payload.actions) {
            payload.actions.forEach(a => {
                actions.push({
                    "type": "Action.OpenUrl",
                    "title": a.title,
                    "url": a.url
                });
            });
        }

        // B. Dettagli Espandibili (ShowCard)
        if (payload.detailedFacts && payload.detailedFacts.length > 0) {
            actions.push({
                "type": "Action.ShowCard",
                "title": "🔍 Vedi Dettagli",
                "card": {
                    "type": "AdaptiveCard",
                    "body": [
                        {
                            "type": "TextBlock",
                            "text": "Dettagli Aggiuntivi",
                            "weight": "Bolder",
                            "size": "Medium",
                            "isSubtle": true
                        },
                        {
                            "type": "FactSet",
                            "facts": payload.detailedFacts.map(f => ({ title: f.name, value: f.value }))
                        }
                    ]
                }
            });
        }

        // 3. Costruisci Adaptive Card
        // NOTA: Versione 1.2 è più compatibile con i Webhook di Teams rispetto alla 1.4 o 1.5
        const card = {
            type: "message",
            attachments: [
                {
                    contentType: "application/vnd.microsoft.card.adaptive",
                    contentUrl: null,
                    content: {
                        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                        "version": "1.2", 
                        "type": "AdaptiveCard",
                        "body": [
                            {
                                "type": "Container",
                                "style": "emphasis", // Sfondo colorato leggero per l'header
                                "bleed": true,
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": payload.title,
                                        "weight": "Bolder",
                                        "size": "Medium",
                                        "color": payload.color || 'Default' // Usa colori semantici Teams (Good, Attention, etc.)
                                    },
                                    payload.subtitle ? {
                                        "type": "TextBlock",
                                        "text": payload.subtitle,
                                        "isSubtle": true,
                                        "wrap": true,
                                        "size": "Small",
                                        "spacing": "None"
                                    } : null
                                ].filter(Boolean)
                            },
                            {
                                "type": "Container",
                                "items": [
                                    {
                                        "type": "FactSet",
                                        "facts": payload.facts.map(f => ({ title: f.name, value: f.value }))
                                    }
                                ]
                            }
                        ],
                        "actions": actions.length > 0 ? actions : undefined
                    }
                }
            ]
        };

        // 4. Invia a tutti gli endpoint (Promise.allSettled per non fallire se uno è down)
        const requests = rows.map(row => 
            fetch(row.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(card)
            }).catch(err => console.error(`Failed to notify ${row.webhook_url}:`, err))
        );

        // Attendiamo ma senza bloccare troppo a lungo (best effort)
        await Promise.allSettled(requests);

    } catch (error) {
        console.error("Error in webhookNotifier:", error);
    }
}
