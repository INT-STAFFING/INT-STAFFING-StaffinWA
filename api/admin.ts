/**
 * @file api/admin.ts
 * @description Endpoint API per utility amministrative.
 * Richiede autenticazione JWT per tutti i metodi.
 *
 * Route:
 *   POST /api/admin?action=webhook-test  → invia una Adaptive Card di test all'URL webhook specificato
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from './_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { action } = req.query;

    const user = getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Non autorizzato' });

    // ─── Test webhook ─────────────────────────────────────────────────────────
    if (action === 'webhook-test') {
        if (method !== 'POST') {
            res.setHeader('Allow', ['POST']);
            return res.status(405).end();
        }

        const { webhookUrl, eventType, blocks, color } = req.body || {};

        if (!webhookUrl || typeof webhookUrl !== 'string') {
            return res.status(400).json({ error: 'webhookUrl è obbligatorio' });
        }

        let cardBody: any[];
        let cardActions: any[] = [];

        if (Array.isArray(blocks) && blocks.length > 0) {
            cardBody = [];
            const sampleCtx: Record<string, string> = {
                title: `Test evento: ${eventType || 'TEST'}`,
                subtitle: 'Questa è una notifica di test',
                Nome: 'Mario Rossi',
                Progetto: 'Progetto Demo',
                Risorsa: 'Mario Rossi',
                Stato: 'ATTIVO',
                Budget: '50.000 €',
                Dal: '2026-03-01',
                Al: '2026-03-05',
                Username: 'test.user',
                IP: '127.0.0.1',
                Giorni: '5',
            };
            const interpolate = (tmpl: string) =>
                tmpl.replace(/\{\{context\.([^}]+)\}\}/g, (_, key) => sampleCtx[key] ?? `[${key}]`);

            for (const block of blocks) {
                if (block.type === 'header') {
                    const title = interpolate(block.config?.titleTemplate || 'Test Notifica');
                    const subtitle = block.config?.subtitleTemplate ? interpolate(block.config.subtitleTemplate) : null;
                    cardBody.push({
                        type: 'Container',
                        style: 'emphasis',
                        bleed: true,
                        items: [
                            { type: 'TextBlock', text: title, weight: 'Bolder', size: 'Medium', color: color || 'Default' },
                            subtitle ? { type: 'TextBlock', text: subtitle, isSubtle: true, wrap: true, size: 'Small', spacing: 'None' } : null,
                        ].filter(Boolean),
                    });
                } else if (block.type === 'text') {
                    cardBody.push({ type: 'TextBlock', text: interpolate(block.config?.textTemplate || ''), wrap: true });
                } else if (block.type === 'facts') {
                    const facts = (block.config?.facts || []).map((f: any) => ({
                        title: interpolate(f.nameTemplate || ''),
                        value: interpolate(f.valueTemplate || ''),
                    }));
                    if (facts.length > 0) cardBody.push({ type: 'FactSet', spacing: 'Medium', facts });
                } else if (block.type === 'detailed_facts') {
                    const facts = (block.config?.facts || []).map((f: any) => ({
                        title: interpolate(f.nameTemplate || ''),
                        value: interpolate(f.valueTemplate || ''),
                    }));
                    if (facts.length > 0) {
                        cardActions.push({
                            type: 'Action.ShowCard',
                            title: '🔍 Vedi Dettagli',
                            card: { type: 'AdaptiveCard', body: [{ type: 'FactSet', facts }] },
                        });
                    }
                } else if (block.type === 'divider') {
                    cardBody.push({ type: 'TextBlock', text: '---', separator: true, spacing: 'Medium' });
                }
            }
        } else {
            cardBody = [
                {
                    type: 'Container',
                    style: 'emphasis',
                    bleed: true,
                    items: [
                        { type: 'TextBlock', text: '🔔 Test Notifica Teams', weight: 'Bolder', size: 'Medium', color: 'Accent' },
                        { type: 'TextBlock', text: `Evento: ${eventType || 'TEST'}`, isSubtle: true, wrap: true, size: 'Small', spacing: 'None' },
                    ],
                },
                {
                    type: 'FactSet',
                    spacing: 'Medium',
                    facts: [
                        { title: 'Mittente', value: 'Staffing Allocation Planner' },
                        { title: 'Data/Ora', value: new Date().toLocaleString('it-IT') },
                        { title: 'Tipo', value: 'Notifica di test — webhook configurato correttamente ✅' },
                    ],
                },
            ];
        }

        if (cardBody.length === 0) {
            cardBody = [{ type: 'TextBlock', text: '🔔 Test notifica Teams — webhook attivo', wrap: true }];
        }

        const card = {
            type: 'message',
            attachments: [{
                contentType: 'application/vnd.microsoft.card.adaptive',
                content: {
                    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                    version: '1.2',
                    type: 'AdaptiveCard',
                    body: cardBody,
                    actions: cardActions.length > 0 ? cardActions : undefined,
                },
            }],
        };

        try {
            const resp = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(card),
            });
            const responseBody = await resp.text().catch(() => '');
            return res.status(200).json({ success: resp.ok, statusCode: resp.status, responseBody });
        } catch (error: any) {
            return res.status(200).json({ success: false, statusCode: 0, responseBody: error?.message || 'Errore di rete' });
        }
    }

    return res.status(400).json({ error: `Azione non riconosciuta: ${action}.` });
}
