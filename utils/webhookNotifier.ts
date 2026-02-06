/**
 * @file utils/webhookNotifier.ts
 * @description Servizio evoluto per notifiche MS Teams.
 * Supporta tabelle (via ColumnSet/FactSet) e Grafici (via Immagini esterne).
 */

import { VercelPoolClient } from '@vercel/postgres';

// Estendiamo l'interfaccia per includere tabelle e immagini (grafici)
interface NotificationPayload {
    title: string;
    subtitle?: string;
    facts: { name: string; value: string }[];
    detailedFacts?: { name: string; value: string }[];
    
    /** Nuova sezione: Dati tabellari complessi */
    table?: {
        headers: string[];
        rows: string[][];
    };

    /** Nuova sezione: URL di un grafico (es. generato con QuickChart.io) */
    imageUrl?: string;
    imageCaption?: string;

    actions?: { type: 'OpenUrl'; title: string; url: string }[];
    color?: 'Good' | 'Warning' | 'Attention' | 'Accent';
}

export async function notify(
    client: VercelPoolClient,
    eventType: string,
    payload: NotificationPayload
) {
    try {
        const { rows: configs } = await client.query(
            `SELECT webhook_url FROM notification_configs WHERE event_type = $1 AND is_active = TRUE`,
            [eventType]
        );

        if (configs.length === 0) return;

        // 1. Costruzione del corpo dinamico
        const body: any[] = [];

        // Header (Titolo e Sottotitolo)
        body.push({
            "type": "Container",
            "style": "emphasis",
            "bleed": true,
            "items": [
                {
                    "type": "TextBlock",
                    "text": payload.title,
                    "weight": "Bolder",
                    "size": "Medium",
                    "color": payload.color || 'Default'
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
        });

        // FactSet base (quelli che avevi già)
        body.push({
            "type": "FactSet",
            "spacing": "Medium",
            "facts": payload.facts.map(f => ({ title: f.name, value: f.value }))
        });

        // 2. NUOVO: Gestione Grafico (Immagine)
        if (payload.imageUrl) {
            body.push({
                "type": "Image",
                "url": payload.imageUrl,
                "size": "Stretch",
                "altText": payload.imageCaption || "Grafico Notifica"
            });
            if (payload.imageCaption) {
                body.push({
                    "type": "TextBlock",
                    "text": payload.imageCaption,
                    "size": "Small",
                    "horizontalAlignment": "Center",
                    "isSubtle": true
                });
            }
        }

        // 3. NUOVO: Gestione Tabella (Simulata con ColumnSet per compatibilità v1.2)
        if (payload.table) {
            const tableColumns = payload.table.headers.map((h, i) => ({
                type: "Column",
                width: "auto",
                items: [
                    { "type": "TextBlock", "text": h, "weight": "Bolder", "wrap": true },
                    ...payload.table!.rows.map(row => ({
                        "type": "TextBlock",
                        "text": row[i] || "-",
                        "wrap": true,
                        "spacing": "Small"
                    }))
                ]
            }));

            body.push({
                "type": "Container",
                "separator": true,
                "spacing": "Large",
                "items": [
                    { "type": "TextBlock", "text": "Report Dati", "weight": "Bolder" },
                    { "type": "ColumnSet", "columns": tableColumns }
                ]
            });
        }

        // 4. Azioni (Invariate ma pulite)
        const actions: any[] = [];
        if (payload.actions) {
            payload.actions.forEach(a => actions.push({
                "type": "Action.OpenUrl",
                "title": a.title,
                "url": a.url
            }));
        }

        if (payload.detailedFacts && payload.detailedFacts.length > 0) {
            actions.push({
                "type": "Action.ShowCard",
                "title": "🔍 Vedi Dettagli",
                "card": {
                    "type": "AdaptiveCard",
                    "body": [
                        { "type": "FactSet", "facts": payload.detailedFacts.map(f => ({ title: f.name, value: f.value })) }
                    ]
                }
            });
        }

        // 5. Costruzione Finale e Invio
        const card = {
            type: "message",
            attachments: [{
                contentType: "application/vnd.microsoft.card.adaptive",
                content: {
                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                    "version": "1.2",
                    "type": "AdaptiveCard",
                    "body": body,
                    "actions": actions.length > 0 ? actions : undefined
                }
            }]
        };

        await Promise.allSettled(configs.map(row => 
            fetch(row.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(card)
            })
        ));

    } catch (error) {
        console.error("Error in webhookNotifier:", error);
    }
}