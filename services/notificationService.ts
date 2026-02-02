
/**
 * @file services/notificationService.ts
 * @description Servizio backend per inviare notifiche Webhook (es. MS Teams) basate su eventi.
 */

import { VercelPoolClient } from '@vercel/postgres';

interface WebhookConfig {
    id: string;
    target_url: string;
    template_json: string;
}

/**
 * Invia una notifica a tutti i webhook attivi per un dato tipo di evento.
 * Non blocca l'esecuzione (fire and forget) ma logga gli errori.
 */
export async function notify(
    client: VercelPoolClient,
    eventType: string,
    payload: Record<string, any>
) {
    // Eseguiamo in background per non rallentare la risposta API
    // Nota: In serverless functions, la funzione potrebbe terminare prima del completamento della fetch se non si usa `await`.
    // Dato che Vercel raccomanda di attendere le promesse critiche, useremo await ma dentro un try/catch che non propaga l'errore.
    try {
        const { rows } = await client.query(
            `SELECT id, target_url, template_json FROM webhook_integrations WHERE event_type = $1 AND is_active = TRUE`,
            [eventType]
        );

        if (rows.length === 0) return;

        const promises = rows.map((config: WebhookConfig) => sendWebhook(config, payload));
        await Promise.allSettled(promises);
    } catch (error) {
        console.error(`[NotificationService] Error triggering event ${eventType}:`, error);
    }
}

async function sendWebhook(config: WebhookConfig, payload: Record<string, any>) {
    try {
        let bodyString = config.template_json;

        // 1. Replace Simple Placeholders {{key}}
        for (const [key, value] of Object.entries(payload)) {
            // Se il valore è una stringa o numero, sostituisci direttamente
            if (typeof value === 'string' || typeof value === 'number') {
                const regex = new RegExp(`{{${key}}}`, 'g');
                bodyString = bodyString.replace(regex, String(value));
            } 
            // Se il valore è un oggetto/array (es. mentionsEntities), dobbiamo gestire la sostituzione nel JSON
            // Questo è tricky perché stiamo facendo replace su una stringa che poi diventerà JSON.
            else if (typeof value === 'object') {
                 // Per le entità complesse, usiamo un placeholder speciale che poi verrà parsato
                 // Oppure, se il template si aspetta una stringa JSON, serializziamo.
                 // Approccio semplificato: per "mentionsEntities", ci aspettiamo che nel template ci sia "{{mentionsEntities}}"
                 // come valore di una proprietà, quindi lo sostituiamo con la stringa JSON dell'oggetto, 
                 // MA facendo attenzione che non sia "double stringified" se è già dentro una stringa.
                 //
                 // Soluzione robusta: Parsing del template prima, poi sostituzione profonda.
                 // Ma per ora usiamo replace stringa con JSON.stringify
                 const regex = new RegExp(`"{{${key}}}"`, 'g'); // Cerca il placeholder tra virgolette
                 bodyString = bodyString.replace(regex, JSON.stringify(value));
            }
        }

        // Tenta di parsare per verificare validità JSON finale
        const bodyJson = JSON.parse(bodyString);

        const response = await fetch(config.target_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyJson)
        });

        if (!response.ok) {
            console.error(`[NotificationService] Webhook ${config.id} failed with status ${response.status}`);
        }
    } catch (error) {
        console.error(`[NotificationService] Error sending webhook ${config.id}:`, error);
    }
}

/**
 * Helper specifico per generare il payload delle Menzioni per MS Teams
 */
export function generateTeamsMentions(users: { name: string; email: string }[]) {
    let mentionsText = "";
    const mentionsEntities: any[] = [];

    users.forEach((u, index) => {
        if (!u.email) return;
        
        mentionsText += `<at>${u.name}</at> `;
        mentionsEntities.push({
            "type": "mention",
            "text": `<at>${u.name}</at>`,
            "mentioned": {
                "id": u.email,
                "name": u.name
            }
        });
    });

    return {
        mentionsText: mentionsText.trim(),
        mentionsEntities
    };
}
