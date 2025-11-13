import React from 'react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="mb-12">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-6 pb-3 border-b-2 border-primary/30 dark:border-primary/50">{title}</h2>
        <div className="prose prose-lg dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-6">
            {children}
        </div>
    </section>
);

const SubSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
     <div className="mt-8">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">{title}</h3>
        <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400 space-y-4">
             {children}
        </div>
    </div>
);


const UserManualPage: React.FC = () => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 md:p-12">
            <header className="text-center mb-16">
                <h1 className="text-5xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">Manuale Utente</h1>
                <p className="text-xl text-gray-500 dark:text-gray-400">La tua guida completa allo Staffing Allocation Planner.</p>
            </header>
            
            <Section title="1. Introduzione">
                <p>Benvenuto nello <strong>Staffing Allocation Planner</strong>. Questo strumento è stato creato per centralizzare, semplificare e potenziare la pianificazione delle risorse umane sui progetti aziendali. Dalla gestione operativa quotidiana all'analisi strategica di alto livello, l'applicazione fornisce tutti gli strumenti necessari per ottimizzare l'utilizzo del personale, monitorare i costi, prevedere le necessità future e personalizzare l'esperienza d'uso.</p>
                <p>Questo manuale è strutturato per guidarti attraverso ogni modulo dell'applicazione. Ti consigliamo di leggerlo per intero per comprendere appieno le potenzialità dello strumento.</p>
            </Section>

            <Section title="2. La Dashboard: Il Tuo Centro di Controllo Dinamico">
                <p>La Dashboard è il tuo centro di comando, progettata per darti una visione d'insieme immediata e completa. È composta da diverse "card" analitiche che riassumono i dati più importanti. L'ordine di queste card può essere personalizzato da un amministratore nella pagina <strong>Impostazioni Admin</strong>.</p>
                <SubSection title="Indicatori Chiave di Performance (KPI)">
                    <p>Le card in cima alla pagina mostrano i KPI fondamentali:</p>
                    <ul>
                        <li><strong>Budget Complessivo:</strong> La somma dei budget di tutti i progetti registrati.</li>
                        <li><strong>Costo Stimato (Mese Corrente):</strong> Una stima del costo totale del personale allocato per il mese in corso.</li>
                        <li><strong>Giorni Allocati (Mese Corrente):</strong> Il totale dei giorni/uomo (person-days) allocati su tutti i progetti nel mese corrente.</li>
                    </ul>
                </SubSection>
                <SubSection title="Card di Attenzione e Monitoraggio">
                     <p>Queste card evidenziano situazioni che richiedono un'azione immediata. Sono interattive: cliccandoci sopra, verrai reindirizzato alla pagina pertinente con i filtri già applicati.</p>
                    <ul>
                        <li><strong>Risorse Non Allocate:</strong> Mostra il numero di risorse attive che non hanno alcuna allocazione.</li>
                        <li><strong>Progetti Senza Staff:</strong> Indica il numero di progetti "In corso" a cui non è stata ancora assegnata nessuna risorsa.</li>
                        <li><strong>FTE Non Allocati:</strong> Calcola i <em>Full-Time Equivalent</em> (equivalenti a tempo pieno) disponibili ma non ancora allocati nel mese corrente.</li>
                    </ul>
                </SubSection>
                <SubSection title="Analisi Dettagliate con Vista Grafica">
                    <p>La parte principale della dashboard contiene una serie di tabelle e grafici che offrono insight specifici. Ogni card è dotata di <strong>filtri indipendenti</strong> e di un selettore <code className="text-sm">📊</code> / <code className="text-sm">📋</code> per passare da una <strong>vista grafica</strong> a una <strong>vista tabellare</strong>.</p>
                    <ul>
                        <li><strong>Allocazione Media:</strong> Confronta il carico di lavoro medio percentuale di ogni risorsa tra il mese corrente e il mese successivo.</li>
                        <li><strong>FTE per Progetto:</strong> Calcola il numero di persone a tempo pieno equivalenti dedicate a ciascun progetto.</li>
                        <li><strong>Analisi Budget (Totale e Temporale):</strong> Confronta il budget con il costo stimato, mostrando la varianza. La versione "Temporale" permette di analizzare un intervallo di date personalizzato.</li>
                        <li><strong>Tariffa Media Giornaliera:</strong> Calcola il costo medio giornaliero effettivo per ogni progetto, basato sui ruoli delle risorse allocate.</li>
                        <li><strong>Risorse Sottoutilizzate, Costo per Cliente, Sforzo per Horizontal, Analisi per Sede:</strong> Ulteriori analisi per identificare inefficienze e aree di maggiore investimento.</li>
                    </ul>
                </SubSection>
                <SubSection title="Grafici a Tutto Schermo">
                     <p>In fondo alla pagina, troverai grafici più ampi per analisi di trend:</p>
                    <ul>
                         <li><strong>Trend Saturazione Risorsa:</strong> Seleziona una risorsa per visualizzare l'andamento del suo carico di lavoro negli ultimi e nei prossimi mesi.</li>
                         <li><strong>Forecast Costo Mensile:</strong> Mostra una previsione dei costi totali per i prossimi mesi basata sulle allocazioni correnti.</li>
                    </ul>
                </SubSection>
            </Section>

            <Section title="3. Operatività: Staffing e Carico Risorse">
                <p>Queste due sezioni sono il cuore operativo dell'applicazione, dove gestisci le allocazioni giorno per giorno.</p>
                 <SubSection title="Pagina Staffing">
                     <p>Qui puoi visualizzare e modificare la griglia di allocazione di tutte le risorse su tutti i progetti. È la vista più completa e potente per la pianificazione dettagliata.</p>
                    <ul>
                        <li><strong>Griglia Interattiva:</strong> Per ogni risorsa e progetto, definisci la percentuale di allocazione giornaliera. I giorni non lavorativi sono bloccati.</li>
                        <li><strong>Riga di Carico Totale:</strong> La prima riga per ogni risorsa mostra il suo carico totale giornaliero, con colori che indicano il livello di carico: <span className="font-semibold text-yellow-600">giallo</span> (sottoutilizzo), <span className="font-semibold text-green-600">verde</span> (pieno utilizzo) e <span className="font-semibold text-red-600">rosso</span> (sovraccarico).</li>
                        <li><strong>Assegnazione Massiva (<code className="text-sm">🗓️</code>):</strong> Applica una percentuale a un intero intervallo di date in un'unica operazione.</li>
                    </ul>
                </SubSection>
                <SubSection title="Pagina Carico Risorse">
                     <p>Questa pagina è una versione semplificata e di <strong>sola lettura</strong> della griglia di staffing. Mostra unicamente le righe del carico totale per ogni risorsa, offrendo una visione chiara del carico individuale senza il rischio di modifiche accidentali.</p>
                </SubSection>
            </Section>
            
            <Section title="4. Gestione Anagrafiche">
                <p>Le pagine nella sezione "Gestione" ti permettono di amministrare le entità fondamentali del sistema, ora con un'interfaccia potenziata.</p>
                 <SubSection title="Interfaccia Tabellare Avanzata">
                    <p>Tutte le pagine di gestione utilizzano una nuova tabella dati con funzionalità avanzate:</p>
                    <ul>
                        <li><strong>Modifica Rapida (<code className="text-sm">edit</code>):</strong> Trasforma una riga della tabella in un form per modifiche veloci senza lasciare la pagina.</li>
                        <li><strong>Modifica Dettagliata (<code className="text-sm">edit_note</code>):</strong> Apre il classico modulo modale per modifiche complete.</li>
                        <li><strong>Filtri per Colonna:</strong> Sotto l'intestazione principale, è presente una riga di campi di input che ti permette di filtrare i dati per ogni singola colonna.</li>
                        <li><strong>Ordinamento Multi-colonna:</strong> Clicca sulle intestazioni delle colonne per ordinare i dati.</li>
                        <li><strong>Vista Mobile:</strong> Su schermi piccoli, la tabella si trasforma automaticamente in una vista a "card" per una migliore leggibilità.</li>
                    </ul>
                </SubSection>
                <SubSection title="Entità Gestite">
                    <ul>
                        <li><strong>Risorse:</strong> Gestisci i dipendenti, la loro `maxStaffingPercentage` e lo stato di dimissione.</li>
                        <li><strong>Progetti:</strong> Definisci budget, `realizationPercentage` e collega i progetti ai Contratti.</li>
                        <li><strong>Contratti (Novità):</strong> Raggruppa più progetti sotto un unico cappello finanziario. Il `Backlog` (capienza residua) viene calcolato automaticamente ma può essere ricalcolato manualmente con l'icona <code className="text-sm">refresh</code>.</li>
                        <li><strong>Clienti e Ruoli:</strong> Gestisci le anagrafiche standard.</li>
                    </ul>
                </SubSection>
            </Section>
            
            <Section title="5. Modulo HR & Recruitment">
                <p>Questi moduli sono dedicati al processo di ricerca, selezione e assunzione di nuovo personale.</p>
                <SubSection title="Richiesta Risorse">
                    <p>Formalizza le necessità di personale per i progetti. La pagina è stata migliorata con:</p>
                    <ul>
                        <li><strong>Vista Tabella/Card:</strong> Puoi alternare tra una vista tabellare e una a "card" più visuale.</li>
                        <li><strong>Riepilogo FTE:</strong> Le card in cima alla pagina riassumono gli FTE (Full-Time Equivalent) totali richiesti, aggregati per ruolo.</li>
                        <li><strong>Codice Richiesta:</strong> Ogni richiesta ha ora un codice univoco e leggibile (es. `HCR00001`) per un facile tracciamento.</li>
                    </ul>
                </SubSection>
                 <SubSection title="Gestione Colloqui">
                    <p>Traccia l'intero ciclo di vita di un candidato. Nuove funzionalità includono:</p>
                    <ul>
                        <li><strong>Card Riassuntive Interattive:</strong> Le card in cima non solo mostrano i totali, ma agiscono anche da filtri rapidi (es. clicca su "Prossimi Ingressi" per vedere solo i candidati assunti).</li>
                        <li><strong>Pipeline per Richiesta:</strong> Una nuova tabella mostra tutte le richieste di risorse attive e i candidati attualmente in pipeline per ciascuna, evidenziando le richieste scoperte.</li>
                        <li><strong>Creazione Risorsa:</strong> Quando un candidato viene assunto (`Stato Assunzione = SI`), un pulsante "Crea nuova Risorsa" appare nel modulo, permettendoti di creare direttamente l'anagrafica della nuova risorsa con i dati pre-compilati dal colloquio.</li>
                    </ul>
                </SubSection>
            </Section>

            <Section title="6. Analisi, Report e Visualizzazioni">
                <p>Queste sezioni offrono strumenti potenti per analizzare i dati da diverse prospettive.</p>
                 <SubSection title="Forecasting & Gantt">
                    <p>Queste sezioni sono state potenziate. Il <strong>Gantt Progetti</strong> è ora una timeline interattiva completa con livelli di zoom (mese, trimestre, anno), un indicatore della data odierna e la possibilità di espandere ogni progetto per vedere le risorse assegnate.</p>
                </SubSection>
                <SubSection title="Visualizzazione Staffing (Potenziato)">
                    <p>Questa pagina ora utilizza la potente libreria D3.js per creare visualizzazioni grafiche interattive e personalizzabili:</p>
                    <ul>
                        <li><strong>Diagramma di Flusso (Sankey):</strong> Mostra come lo "sforzo" (giorni/uomo) fluisce da Risorse a Progetti, Clienti e Contratti. L'aspetto del grafico (es. spessore dei nodi, opacità dei link) può essere personalizzato da un amministratore.</li>
                        <li><strong>Mappa delle Connessioni (Network):</strong> Visualizza le entità come nodi interattivi.</li>
                        <li><strong>Export:</strong> Entrambi i grafici possono essere esportati come immagini vettoriali <strong>SVG</strong> o raster <strong>PNG</strong>.</li>
                    </ul>
                </SubSection>
            </Section>

            <Section title="7. Amministrazione (Potenziato)">
                <p>La sezione per gli amministratori è stata notevolmente ampliata con nuove funzionalità di personalizzazione e controllo.</p>
                <SubSection title="Impostazioni Admin">
                     <p>Questa nuova pagina è il centro di controllo per la personalizzazione dell'applicazione:</p>
                    <ul>
                        <li><strong>Sicurezza:</strong> Attiva o disattiva la protezione tramite password per l'intera applicazione.</li>
                        <li><strong>Ordinamento Dashboard:</strong> Trascina e rilascia le card della dashboard per definire l'ordine in cui appaiono. La tua preferenza viene salvata localmente nel browser.</li>
                        <li><strong>Personalizzazione Notifiche:</strong> Scegli la posizione in cui le notifiche "toast" (es. "Salvataggio completato") appaiono sullo schermo.</li>
                        <li><strong>Personalizzazione Visualizzazioni:</strong> Tramite degli slider, puoi modificare parametri tecnici dei grafici Sankey e Network (es. forza di repulsione dei nodi, distanza dei link) per ottimizzarne la leggibilità.</li>
                        <li><strong>Editor Tema Material 3:</strong> Un editor completo che permette di cambiare ogni singolo colore dell'interfaccia utente, sia per il tema chiaro che per quello scuro, per allineare l'aspetto dell'app al tuo brand.</li>
                    </ul>
                </SubSection>
                <SubSection title="Database Inspector">
                    <p><strong className="text-red-500">ATTENZIONE:</strong> Questo è uno strumento per sviluppatori e manutenzione. Un uso improprio può corrompere i dati.</p>
                    <ul>
                         <li><strong>Accesso Diretto:</strong> Visualizza e modifica i dati grezzi di qualsiasi tabella del database.</li>
                         <li><strong>Azioni Pericolose:</strong> Include una funzione per svuotare completamente una tabella (`TRUNCATE`).</li>
                         <li><strong>Export SQL:</strong> Genera uno script `.sql` completo (schema + dati) per l'intero database, con la possibilità di scegliere tra il dialetto PostgreSQL (per Neon/Vercel) e MySQL per migrazioni o backup.</li>
                    </ul>
                </SubSection>
            </Section>

            <style>{`
                .prose ul > li::before {
                    background-color: #2563eb;
                }
                .prose a {
                    color: #2563eb;
                    text-decoration: none;
                    font-weight: 500;
                }
                 .prose a:hover {
                    text-decoration: underline;
                }
                .prose code {
                    color: #1d4ed8;
                    font-weight: 600;
                    background-color: #e0e7ff;
                    padding: 0.2em 0.4em;
                    border-radius: 0.25rem;
                }
                .dark .prose code {
                     color: #93c5fd;
                     background-color: #1e293b;
                }
            `}</style>
        </div>
    );
};

export default UserManualPage;
