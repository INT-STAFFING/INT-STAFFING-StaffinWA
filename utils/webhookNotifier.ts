
/**
 * @file utils/webhookNotifier.ts
 * @description Servizio ibrido per notifiche webhook.
 *
 * ARCHITETTURA IBRIDA:
 *  - Legacy: `notify()` costruisce una Adaptive Card da un payload imperativo e la invia
 *    ai webhook configurati nella tabella `notification_configs`.
 *  - Nuovo (Event-Driven): `processEvent()` interroga la tabella `notification_rules`,
 *    interpola i template con il contesto dell'evento e invia i messaggi risultanti.
 *    `notify()` invoca `processEvent()` in parallelo (hybrid mode) per supportare
 *    gradualmente il passaggio al nuovo sistema senza rompere il codice esistente.
 */

import { VercelPoolClient } from '@vercel/postgres';
import type { NotificationBlock } from '../types';

// ---------------------------------------------------------------------------
// Tipi interni
// ---------------------------------------------------------------------------

interface NotificationPayload {
    title: string;
    subtitle?: string;
    facts: { name: string; value: string }[];
    detailedFacts?: { name: string; value: string }[];
    table?: {
        headers: string[];
        rows: string[][];
    };
    imageUrl?: string;
    imageCaption?: string;
    actions?: { type: 'OpenUrl'; title: string; url: string }[];
    color?: 'Good' | 'Warning' | 'Attention' | 'Accent';
}

/** Contesto piatto evento — usato sia da processEvent() che derivato da notify() */
export type EventContext = Record<string, string>;

// ---------------------------------------------------------------------------
// Helper: interpolazione template {{context.key}}
// ---------------------------------------------------------------------------

function interpolate(template: string, ctx: EventContext): string {
    return template.replace(/\{\{context\.([^}]+)\}\}/g, (_, key) => ctx[key] ?? `{{context.${key}}}`);
}

// ---------------------------------------------------------------------------
// Helper: costruzione corpo Adaptive Card da NotificationBlock[]
// ---------------------------------------------------------------------------

function buildBodyFromBlocks(blocks: NotificationBlock[], ctx: EventContext, color?: string): any[] {
    const body: any[] = [];

    for (const block of blocks) {
        switch (block.type) {
            case 'header': {
                const title = interpolate(block.config.titleTemplate || '', ctx);
                const subtitle = block.config.subtitleTemplate
                    ? interpolate(block.config.subtitleTemplate, ctx)
                    : undefined;
                body.push({
                    type: 'Container',
                    style: 'emphasis',
                    bleed: true,
                    items: [
                        {
                            type: 'TextBlock',
                            text: title,
                            weight: 'Bolder',
                            size: 'Medium',
                            color: color || 'Default',
                        },
                        subtitle
                            ? { type: 'TextBlock', text: subtitle, isSubtle: true, wrap: true, size: 'Small', spacing: 'None' }
                            : null,
                    ].filter(Boolean),
                });
                break;
            }
            case 'text': {
                const text = interpolate(block.config.textTemplate || '', ctx);
                body.push({ type: 'TextBlock', text, wrap: true });
                break;
            }
            case 'facts': {
                const facts = (block.config.facts || []).map(f => ({
                    title: interpolate(f.nameTemplate, ctx),
                    value: interpolate(f.valueTemplate, ctx),
                }));
                if (facts.length > 0) {
                    body.push({ type: 'FactSet', spacing: 'Medium', facts });
                }
                break;
            }
            case 'detailed_facts': {
                // Inserito come ShowCard action — gestito separatamente (vedi buildActionsFromBlocks)
                break;
            }
            case 'image': {
                const url = interpolate(block.config.imageUrlTemplate || '', ctx);
                if (url) {
                    body.push({ type: 'Image', url, size: 'Stretch', altText: block.config.imageCaption || 'Immagine' });
                    if (block.config.imageCaption) {
                        body.push({ type: 'TextBlock', text: block.config.imageCaption, size: 'Small', horizontalAlignment: 'Center', isSubtle: true });
                    }
                }
                break;
            }
            case 'table': {
                const headers = block.config.headers || [];
                if (headers.length > 0) {
                    body.push({
                        type: 'Container',
                        separator: true,
                        spacing: 'Large',
                        items: [
                            { type: 'TextBlock', text: block.config.tableTitle || 'Dati', weight: 'Bolder' },
                            {
                                type: 'ColumnSet',
                                columns: headers.map(h => ({
                                    type: 'Column',
                                    width: 'auto',
                                    items: [{ type: 'TextBlock', text: h, weight: 'Bolder', wrap: true }],
                                })),
                            },
                        ],
                    });
                }
                break;
            }
            case 'divider': {
                body.push({ type: 'TextBlock', text: '---', separator: true, spacing: 'Medium' });
                break;
            }
        }
    }

    return body;
}

function buildActionsFromBlocks(blocks: NotificationBlock[], ctx: EventContext): any[] {
    const actions: any[] = [];
    for (const block of blocks) {
        if (block.type === 'detailed_facts') {
            const facts = (block.config.facts || []).map(f => ({
                title: interpolate(f.nameTemplate, ctx),
                value: interpolate(f.valueTemplate, ctx),
            }));
            if (facts.length > 0) {
                actions.push({
                    type: 'Action.ShowCard',
                    title: '🔍 Vedi Dettagli',
                    card: {
                        type: 'AdaptiveCard',
                        body: [{ type: 'FactSet', facts }],
                    },
                });
            }
        }
    }
    return actions;
}

// ---------------------------------------------------------------------------
// Helper: invio Adaptive Card a un elenco di webhook URL
// ---------------------------------------------------------------------------

async function sendAdaptiveCard(webhookUrls: string[], body: any[], actions: any[]): Promise<void> {
    const card = {
        type: 'message',
        attachments: [{
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: {
                $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                version: '1.2',
                type: 'AdaptiveCard',
                body,
                actions: actions.length > 0 ? actions : undefined,
            },
        }],
    };

    await Promise.allSettled(webhookUrls.map(url =>
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(card),
        })
    ));
}

// ---------------------------------------------------------------------------
// processEvent() — Nuovo motore event-driven
// ---------------------------------------------------------------------------

/**
 * Interroga la tabella `notification_rules` per l'evento specificato, compila i
 * template con il contesto e invia le Adaptive Card ai webhook configurati.
 *
 * @param client  - Connessione PostgreSQL
 * @param eventType - Es. 'PROJECT_CREATED'
 * @param ctx       - Contesto piatto { key: value } usato per interpolazione template
 */
export async function processEvent(
    client: VercelPoolClient,
    eventType: string,
    ctx: EventContext
): Promise<void> {
    try {
        const { rows: rules } = await client.query(
            `SELECT id, name, webhook_url, template_blocks, color
             FROM notification_rules
             WHERE event_type = $1 AND is_active = TRUE`,
            [eventType]
        );

        if (rules.length === 0) return;

        await Promise.allSettled(rules.map(async (rule: any) => {
            const blocks: NotificationBlock[] = Array.isArray(rule.template_blocks)
                ? rule.template_blocks
                : JSON.parse(rule.template_blocks || '[]');

            const body = buildBodyFromBlocks(blocks, ctx, rule.color);
            const actions = buildActionsFromBlocks(blocks, ctx);

            await sendAdaptiveCard([rule.webhook_url], body, actions);
        }));
    } catch (error) {
        console.error('[processEvent] Errore nel motore event-driven:', error);
    }
}

// ---------------------------------------------------------------------------
// notify() — Funzione legacy (firma invariata) + chiamata ibrida a processEvent()
// ---------------------------------------------------------------------------

/**
 * Invia una notifica agli webhook configurati per l'evento specificato.
 * Mantiene la firma originale per piena retrocompatibilità.
 * In modalità ibrida chiama anche processEvent() per eseguire le regole
 * configurate via Builder Drag & Drop.
 */
export async function notify(
    client: VercelPoolClient,
    eventType: string,
    payload: NotificationPayload
) {
    try {
        // Deriva il contesto piatto dai facts del payload (per processEvent ibrido)
        const ctx: EventContext = {
            title: payload.title,
            subtitle: payload.subtitle || '',
            ...Object.fromEntries(payload.facts.map(f => [f.name, f.value])),
        };

        // Esegui legacy + nuovo motore in parallelo
        await Promise.allSettled([
            _legacyNotify(client, eventType, payload),
            processEvent(client, eventType, ctx),
        ]);
    } catch (error) {
        console.error('[notify] Errore nel dispatcher ibrido:', error);
    }
}

// ---------------------------------------------------------------------------
// _legacyNotify() — Implementazione originale (invariata)
// ---------------------------------------------------------------------------

async function _legacyNotify(
    client: VercelPoolClient,
    eventType: string,
    payload: NotificationPayload
) {
    const { rows: configs } = await client.query(
        `SELECT webhook_url FROM notification_configs WHERE event_type = $1 AND is_active = TRUE`,
        [eventType]
    );

    if (configs.length === 0) return;

    const body: any[] = [];

    // Header (Titolo e Sottotitolo)
    body.push({
        type: 'Container',
        style: 'emphasis',
        bleed: true,
        items: [
            {
                type: 'TextBlock',
                text: payload.title,
                weight: 'Bolder',
                size: 'Medium',
                color: payload.color || 'Default',
            },
            payload.subtitle
                ? { type: 'TextBlock', text: payload.subtitle, isSubtle: true, wrap: true, size: 'Small', spacing: 'None' }
                : null,
        ].filter(Boolean),
    });

    // FactSet base
    body.push({
        type: 'FactSet',
        spacing: 'Medium',
        facts: payload.facts.map(f => ({ title: f.name, value: f.value })),
    });

    // Grafico (Immagine)
    if (payload.imageUrl) {
        body.push({ type: 'Image', url: payload.imageUrl, size: 'Stretch', altText: payload.imageCaption || 'Grafico Notifica' });
        if (payload.imageCaption) {
            body.push({ type: 'TextBlock', text: payload.imageCaption, size: 'Small', horizontalAlignment: 'Center', isSubtle: true });
        }
    }

    // Tabella (simulata con ColumnSet)
    if (payload.table) {
        const tableColumns = payload.table.headers.map((h, i) => ({
            type: 'Column',
            width: 'auto',
            items: [
                { type: 'TextBlock', text: h, weight: 'Bolder', wrap: true },
                ...payload.table!.rows.map(row => ({
                    type: 'TextBlock',
                    text: row[i] || '-',
                    wrap: true,
                    spacing: 'Small',
                })),
            ],
        }));

        body.push({
            type: 'Container',
            separator: true,
            spacing: 'Large',
            items: [
                { type: 'TextBlock', text: 'Report Dati', weight: 'Bolder' },
                { type: 'ColumnSet', columns: tableColumns },
            ],
        });
    }

    // Azioni
    const actions: any[] = [];
    if (payload.actions) {
        payload.actions.forEach(a => actions.push({ type: 'Action.OpenUrl', title: a.title, url: a.url }));
    }

    if (payload.detailedFacts && payload.detailedFacts.length > 0) {
        actions.push({
            type: 'Action.ShowCard',
            title: '🔍 Vedi Dettagli',
            card: {
                type: 'AdaptiveCard',
                body: [{ type: 'FactSet', facts: payload.detailedFacts.map(f => ({ title: f.name, value: f.value })) }],
            },
        });
    }

    await sendAdaptiveCard(configs.map((r: any) => r.webhook_url), body, actions);
}
