import React from 'react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">{title}</h2>
        <div className="prose prose-lg dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 space-y-4">
            {children}
        </div>
    </section>
);

const UserManualPage: React.FC = () => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-8 text-center">Manuale Utente</h1>
            
            <Section title="Introduzione">
                <p>Benvenuto nello Staffing Allocation Planner. Questo strumento è progettato per aiutarti a pianificare, gestire e monitorare l'allocazione delle risorse umane sui progetti aziendali. Questo manuale ti guiderà attraverso le funzionalità principali dell'applicazione.</p>
            </Section>

            <Section title="Dashboard">
                <p>La Dashboard offre una panoramica immediata dello stato di salute del tuo business. Qui puoi trovare:</p>
                <ul>
                    <li><strong>KPI Aggregati</strong>: Budget totale, costo stimato per il mese corrente e giorni/uomo allocati.</li>
                    <li><strong>Risorse e Progetti Critici</strong>: Evidenzia le risorse non allocate e i progetti senza staff per un intervento rapido.</li>
                    <li><strong>Analisi Dettagliate</strong>: Tabelle interattive che mostrano l'allocazione media per risorsa, il calcolo degli FTE (Full-Time Equivalent) per progetto, l'analisi dei budget e molto altro. Ogni card di analisi può essere filtrata indipendentemente.</li>
                </ul>
            </Section>

            <Section title="Staffing">
                <p>La pagina Staffing è il cuore dell'applicazione e ti permette di gestire le allocazioni giornaliere.</p>
                <h3 className="text-xl font-semibold mt-6 mb-2">Funzionalità Chiave</h3>
                <ul>
                    <li><strong>Griglia Interattiva</strong>: Visualizza le risorse e i progetti a cui sono assegnate. Puoi modificare la percentuale di allocazione per ogni giorno lavorativo direttamente dalla griglia usando i menu a tendina.</li>
                    <li><strong>Navigazione Temporale</strong>: Spostati avanti e indietro nel tempo usando i pulsanti "Prec." e "Succ.", o torna al giorno corrente con "Oggi".</li>
                    <li><strong>Viste Aggregate</strong>: Cambia la visualizzazione da giornaliera a settimanale o mensile per avere una visione d'insieme del carico di lavoro.</li>
                    <li><strong>Assegnazione Massiva</strong>: Seleziona l'icona del calendario <code className="text-sm bg-gray-200 dark:bg-gray-700 p-1 rounded">🗓️</code> su un'assegnazione per applicare una percentuale di allocazione a un intero periodo di tempo, saltando automaticamente weekend e festività.</li>
                    <li><strong>Filtri Potenti</strong>: Filtra la visualizzazione per risorsa, progetto, cliente o project manager per concentrarti solo sui dati che ti interessano.</li>
                    <li><strong>Aggiungere/Rimuovere Assegnazioni</strong>: Usa il pulsante "Assegna Risorsa" per creare nuove assegnazioni o l'icona del cestino <code className="text-sm bg-gray-200 dark:bg-gray-700 p-1 rounded">🗑️</code> per rimuoverle.</li>
                </ul>
            </Section>
            
            <Section title="Gestione delle Entità (Risorse, Progetti, Clienti, Contratti, Ruoli)">
                <p>Le pagine nella sezione "Gestione" ti permettono di amministrare tutte le entità fondamentali dell'applicazione.</p>
                <h3 className="text-xl font-semibold mt-6 mb-2">Operazioni Comuni</h3>
                <ul>
                    <li><strong>Aggiunta</strong>: Clicca sul pulsante "Aggiungi [Entità]" per aprire un modulo di inserimento.</li>
                    <li><strong>Modifica</strong>:
                        <ul>
                            <li><strong>Modifica Rapida (Inline)</strong>: Clicca sull'icona della matita verde <code className="text-sm bg-gray-200 dark:bg-gray-700 p-1 rounded">✏️</code> per modificare i campi principali direttamente nella tabella.</li>
                            <li><strong>Modifica Dettagliata</strong>: Clicca sull'icona della matita grigia <code className="text-sm bg-gray-200 dark:bg-gray-700 p-1 rounded">✏️</code> per aprire il modulo completo con tutti i campi disponibili.</li>
                        </ul>
                    </li>
                    <li><strong>Eliminazione</strong>: Clicca sull'icona del cestino <code className="text-sm bg-gray-200 dark:bg-gray-700 p-1 rounded">🗑️</code> per rimuovere un'entità. Verrà chiesta una conferma per prevenire eliminazioni accidentali.</li>
                </ul>
            </Section>
            
            <Section title="Analisi e Report">
                <p>Queste sezioni offrono viste aggregate e strumenti di analisi per decisioni strategiche.</p>
                <ul>
                    <li><strong>Forecasting & Capacity</strong>: Visualizza il carico di lavoro previsto per i prossimi mesi. Il grafico mostra l'utilizzo percentuale della capacità totale del team (o di un sottoinsieme filtrato), mentre la tabella dettaglia i giorni/uomo disponibili, allocati e il surplus/deficit.</li>
                    <li><strong>Gantt Progetti</strong>: Un diagramma di Gantt che mostra la timeline di tutti i progetti, con la possibilità di espandere ogni progetto per vedere le risorse assegnate.</li>
                    <li><strong>Report</strong>: Genera report tabellari dettagliati sui costi dei progetti (confronto budget vs. costi allocati) e sull'utilizzo delle risorse in un determinato mese. Entrambi i report sono esportabili in formato CSV.</li>
                    <li><strong>Visualizzazione Staffing</strong>: Offre una rappresentazione grafica delle connessioni tra risorse, progetti e contratti tramite un diagramma di flusso (Sankey) o una mappa di rete (Network). È utile per capire come lo sforzo si distribuisce tra le varie entità.</li>
                </ul>
            </Section>

            <Section title="Dati: Importazione ed Esportazione">
                <p>Queste funzionalità ti permettono di gestire i dati in modo massivo tramite file Excel.</p>
                <h3 className="text-xl font-semibold mt-6 mb-2">Esportazione</h3>
                <p>Dalla pagina "Esporta Dati", puoi scaricare file Excel separati per:</p>
                <ul>
                    <li><strong>Entità Principali</strong>: Un backup completo di risorse, progetti, clienti, ruoli e configurazioni.</li>
                    <li><strong>Staffing</strong>: La griglia completa delle allocazioni, ideale per analisi esterne o per essere modificata e re-importata.</li>
                    <li><strong>Richieste Risorse e Colloqui</strong>: Esportazioni complete di questi due moduli.</li>
                </ul>
                <h3 className="text-xl font-semibold mt-6 mb-2">Importazione</h3>
                <p>La pagina "Importa Dati" è un potente strumento per caricare dati massivamente. Il processo è guidato:</p>
                <ol>
                    <li><strong>Seleziona il tipo di dati</strong> che vuoi importare.</li>
                    <li><strong>Scarica il template Excel</strong> corrispondente.</li>
                    <li><strong>Compila il template</strong> con i tuoi dati, rispettando i nomi delle colonne.</li>
                    <li><strong>Carica il file</strong> e avvia l'importazione. Il sistema ignorerà i duplicati e ti fornirà un riepilogo delle operazioni.</li>
                </ol>
            </Section>

            <Section title="Impostazioni e Amministrazione">
                <ul>
                    <li><strong>Calendario</strong>: Definisci le festività nazionali, locali e le chiusure aziendali. Questi giorni verranno automaticamente esclusi dai calcoli dei giorni lavorativi e visualizzati come non disponibili nella griglia di staffing.</li>
                    <li><strong>Configurazioni</strong>: Gestisci le liste di opzioni utilizzate in tutta l'app, come gli "Horizontal" delle risorse, i livelli di seniority, gli stati dei progetti, etc.</li>
                    <li><strong>Impostazioni Admin (solo per amministratori)</strong>: Attiva o disattiva la protezione tramite password per l'intera applicazione.</li>
                    <li><strong>Database Inspector (solo per amministratori)</strong>: Uno strumento avanzato per visualizzare e modificare direttamente i dati grezzi nel database. Usare con estrema cautela.</li>
                </ul>
            </Section>
            <style>{`
                .prose ul > li::before {
                    background-color: #2563eb;
                }
                .prose a {
                    color: #2563eb;
                }
                .prose code {
                    color: #1d4ed8;
                    font-weight: 600;
                }
            `}</style>
        </div>
    );
};

export default UserManualPage;
