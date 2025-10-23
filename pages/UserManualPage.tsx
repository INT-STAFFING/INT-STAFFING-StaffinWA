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
                <p>Benvenuto nello <strong>Staffing Allocation Planner</strong>. Questo strumento è stato creato per centralizzare, semplificare e potenziare la pianificazione delle risorse umane sui progetti aziendali. Dalla gestione operativa quotidiana all'analisi strategica di alto livello, l'applicazione fornisce tutti gli strumenti necessari per ottimizzare l'utilizzo del personale, monitorare i costi e prevedere le necessità future.</p>
                <p>Questo manuale è strutturato per guidarti attraverso ogni modulo dell'applicazione. Ti consigliamo di leggerlo per intero per comprendere appieno le potenzialità dello strumento.</p>
            </Section>

            <Section title="2. La Dashboard: Il Tuo Centro di Controllo">
                <p>La Dashboard è la prima pagina che visualizzi ed è progettata per darti una visione d'insieme immediata e completa. È composta da diverse "card" analitiche che riassumono i dati più importanti.</p>
                <SubSection title="Indicatori Chiave di Performance (KPI)">
                    <p>Le card in cima alla pagina mostrano i KPI fondamentali:</p>
                    <ul>
                        <li><strong>Budget Complessivo:</strong> La somma dei budget di tutti i progetti registrati nel sistema.</li>
                        <li><strong>Costo Stimato (Mese Corrente):</strong> Una stima del costo totale del personale allocato per il mese in corso, calcolata moltiplicando i giorni/uomo allocati per il costo giornaliero di ciascuna risorsa.</li>
                        <li><strong>Giorni Allocati (Mese Corrente):</strong> Il totale dei giorni/uomo (person-days) allocati su tutti i progetti nel mese corrente.</li>
                    </ul>
                </SubSection>
                <SubSection title="Card di Attenzione">
                     <p>Queste card evidenziano situazioni che richiedono la tua attenzione. Sono interattive: cliccandoci sopra, verrai reindirizzato alla pagina pertinente con i filtri già applicati per un'analisi immediata.</p>
                    <ul>
                        <li><strong>Risorse Non Allocate:</strong> Mostra il numero di risorse attive che non hanno alcuna allocazione su progetti. Cliccando, andrai alla pagina <em>Risorse</em> visualizzando solo queste persone.</li>
                        <li><strong>Progetti Senza Staff:</strong> Indica il numero di progetti "In corso" a cui non è stata ancora assegnata nessuna risorsa. Cliccando, andrai alla pagina <em>Progetti</em> visualizzando solo questi progetti.</li>
                    </ul>
                </SubSection>
                <SubSection title="Analisi Dettagliate">
                    <p>La parte inferiore della dashboard contiene una serie di tabelle che offrono insight specifici. Ogni tabella è dotata di <strong>filtri indipendenti</strong> e le colonne sono <strong>ordinabili</strong> cliccando sulle intestazioni.</p>
                    <ul>
                        <li><strong>Allocazione Media:</strong> Confronta il carico di lavoro medio percentuale di ogni risorsa tra il mese corrente e il mese successivo. Utile per anticipare squilibri nel carico.</li>
                        <li><strong>FTE per Progetto:</strong> Calcola il <em>Full-Time Equivalent</em>, ovvero il numero di persone a tempo pieno equivalenti dedicate a ciascun progetto. Un valore di 2.5 FTE significa che lo sforzo totale sul progetto equivale a due persone e mezza che lavorano a tempo pieno.</li>
                        <li><strong>Analisi Budget:</strong> Confronta il budget stanziato per ogni progetto con il costo stimato basato sulle allocazioni attuali, mostrando la <strong>varianza</strong> (differenza). Una varianza negativa (in rosso) indica un potenziale superamento del budget.</li>
                        <li><strong>Risorse Sottoutilizzate:</strong> Elenca le risorse il cui carico di lavoro medio nel mese selezionato è inferiore al 100%, partendo da quelle meno utilizzate.</li>
                        <li><strong>Analisi per Cliente/Horizontal/Sede:</strong> Aggrega dati chiave (giorni/uomo, budget, costi) per queste dimensioni strategiche, permettendoti di capire dove si concentra lo sforzo aziendale.</li>
                    </ul>
                </SubSection>
            </Section>

            <Section title="3. Operatività: Staffing e Carico Risorse">
                <p>Queste due sezioni sono il cuore operativo dell'applicazione, dove gestisci le allocazioni giorno per giorno.</p>
                 <SubSection title="Pagina Staffing">
                     <p>Qui puoi visualizzare e modificare la griglia di allocazione di tutte le risorse su tutti i progetti. È la vista più completa e potente per la pianificazione dettagliata.</p>
                    <ul>
                        <li><strong>Griglia Interattiva:</strong> Per ogni risorsa e per ogni progetto a cui è assegnata, puoi definire la percentuale di allocazione per ogni singolo giorno tramite un menu a tendina (da 0% a 100% con step del 5%). I giorni non lavorativi (weekend e festività) sono visualizzati in grigio e non sono modificabili.</li>
                        <li><strong>Riga di Carico Totale:</strong> La prima riga per ogni risorsa mostra il suo carico di lavoro totale giornaliero, sommando tutte le sue allocazioni. Le celle si colorano per evidenziare il livello di carico: <span className="font-semibold text-yellow-600">giallo</span> (sottoutilizzo), <span className="font-semibold text-green-600">verde</span> (pieno utilizzo) e <span className="font-semibold text-red-600">rosso</span> (sovraccarico).</li>
                        <li><strong>Assegnazione Massiva (<code className="text-sm">🗓️</code>):</strong> Invece di inserire le percentuali giorno per giorno, puoi cliccare sull'icona del calendario su una riga di assegnazione per aprire un pop-up e applicare una percentuale a un intero intervallo di date in un colpo solo.</li>
                        <li><strong>Filtri Potenti:</strong> Puoi isolare la vista per singola risorsa, progetto, cliente o project manager per concentrarti solo su ciò che ti interessa.</li>
                    </ul>
                </SubSection>
                <SubSection title="Pagina Carico Risorse">
                     <p>Questa pagina è una versione semplificata e di <strong>sola lettura</strong> della griglia di staffing. Mostra unicamente le righe del carico totale per ogni risorsa. Il suo scopo è fornire una visione chiara e immediata del carico di lavoro individuale, perfetta per Project Manager o Team Lead che necessitano di monitorare il proprio team senza il rischio di effettuare modifiche accidentali.</p>
                </SubSection>
            </Section>

            <Section title="4. Gestione Anagrafiche">
                <p>Le pagine nella sezione "Gestione" ti permettono di amministrare le entità fondamentali del sistema. Tutte queste pagine condividono un'interfaccia simile per coerenza e facilità d'uso.</p>
                 <SubSection title="Operazioni Standard (CRUD)">
                    <ul>
                        <li><strong>Creazione:</strong> Usa il pulsante "Aggiungi..." per aprire un modulo dettagliato per inserire un nuovo record.</li>
                        <li><strong>Modifica:</strong> Ogni riga ha due icone a forma di matita (<code className="text-sm">✏️</code>). La prima apre il modulo di modifica completo. La seconda (dove presente) attiva la "modifica rapida", trasformando la riga in un form per aggiornamenti veloci.</li>
                        <li><strong>Eliminazione (<code className="text-sm">🗑️</code>):</strong> Rimuove un record. Una finestra di dialogo chiederà sempre una conferma.</li>
                        <li><strong>Filtri e Ordinamento:</strong> Usa i filtri in cima alla tabella per cercare i record e clicca sulle intestazioni delle colonne per ordinarli.</li>
                    </ul>
                </SubSection>
                <SubSection title="Specifiche delle Entità">
                    <ul>
                        <li><strong>Risorse:</strong> Oltre ai dati anagrafici, qui definisci la <code>maxStaffingPercentage</code> (la percentuale massima di allocazione, es. 80% per un part-time) e gestisci le dimissioni (flaggando <code>resigned</code> e inserendo l'ultimo giorno di lavoro).</li>
                        <li><strong>Progetti:</strong> Definisci la <code>realizationPercentage</code>, una percentuale che rettifica il calcolo dei costi stimati. Qui puoi anche collegare un progetto a un <strong>Contratto</strong>.</li>
                        <li><strong>Contratti:</strong> Un'entità che raggruppa più progetti sotto un unico cappello finanziario. La <code>Capienza</code> è l'importo totale del contratto, mentre il <code>Backlog</code> è la capienza residua, calcolata sottraendo i budget dei progetti collegati. Puoi forzare il ricalcolo del backlog con l'icona <code className="text-sm">🔄</code>.</li>
                    </ul>
                </SubSection>
            </Section>
            
            <Section title="5. Recruitment & HR">
                <p>Questi moduli sono dedicati al processo di ricerca, selezione e assunzione di nuovo personale, integrando le necessità dei progetti con le attività HR.</p>
                <SubSection title="Richiesta Risorse">
                    <p>Questo modulo formalizza le necessità di personale. Creando una richiesta, specifichi il progetto, il ruolo, il periodo e l'impegno richiesto. Questo crea un "fabbisogno" tracciabile.</p>
                    <ul>
                        <li><strong>Visualizzazione Tabella/Card:</strong> Puoi alternare tra una vista tabellare classica e una vista a "card" più leggibile, ideale per avere una panoramica delle richieste aperte.</li>
                        <li><strong>Riepilogo FTE:</strong> Le card in cima alla pagina riassumono gli FTE (Full-Time Equivalent) totali richiesti, aggregati per ruolo, fornendo una stima immediata del fabbisogno.</li>
                        <li><strong>Flag Speciali:</strong> Puoi marcare una richiesta come <code>Urgente</code> o <code>TECH</code> per una migliore categorizzazione e prioritizzazione.</li>
                    </ul>
                </SubSection>
                 <SubSection title="Gestione Colloqui">
                    <p>Questo modulo serve a tracciare l'intero ciclo di vita di un candidato, dal primo contatto all'assunzione.</p>
                    <ul>
                        <li><strong>Collegamento alle Richieste:</strong> Ogni colloquio può essere collegato a una specifica "Richiesta Risorsa", permettendo di tracciare quale candidato è in valutazione per quale posizione.</li>
                        <li><strong>Tracciamento Completo:</strong> Registra i dati del candidato, il riassunto del CV, gli intervistatori, la data del colloquio, il feedback (Positivo, Negativo, etc.) e lo stato del processo (Aperto, Chiuso, StandBy).</li>
                        <li><strong>Card Riassuntive Interattive:</strong> Le card in cima alla pagina non solo mostrano i totali, ma agiscono anche da filtri rapidi. Clicca su "Candidati Attivi" per vedere solo i processi aperti, o su "Prossimi Ingressi" per vedere i candidati assunti che devono ancora iniziare.</li>
                    </ul>
                </SubSection>
            </Section>

            <Section title="6. Analisi, Report e Visualizzazioni">
                <p>Queste sezioni offrono strumenti potenti per analizzare i dati da diverse prospettive e supportare le decisioni strategiche.</p>
                 <SubSection title="Forecasting & Capacity">
                    <p>Questa pagina ti permette di guardare al futuro. Analizza il carico di lavoro aggregato del team (o di un sottoinsieme filtrato per Horizontal, Cliente, ecc.) su un orizzonte di 12 mesi. Il grafico mostra l'andamento dell'utilizzo percentuale, mentre la tabella dettaglia i giorni/uomo (G/U) disponibili contro quelli allocati, evidenziando surplus (capacità libera) o deficit (necessità di personale).</p>
                </SubSection>
                <SubSection title="Gantt Progetti">
                    <p>Visualizza i tuoi progetti su una timeline interattiva. Ogni barra rappresenta la durata di un progetto. Puoi espandere un progetto per vedere le risorse assegnate. La linea verticale rossa indica la data odierna. Usa i controlli di zoom per visualizzare la timeline per mese, trimestre o anno.</p>
                </SubSection>
                <SubSection title="Report">
                    <p>Genera report tabellari dettagliati, pronti per essere analizzati o esportati in formato <strong>CSV</strong>. I report disponibili sono:</p>
                    <ul>
                        <li><strong>Report Costi Progetto:</strong> Per ogni progetto, confronta Budget, Costo Allocato Stimato e Varianza.</li>
                        <li><strong>Report Utilizzo Risorse:</strong> Per un mese a scelta, analizza il tasso di utilizzo percentuale di ogni singola risorsa.</li>
                    </ul>
                </SubSection>
                <SubSection title="Visualizzazione Staffing">
                    <p>Questa pagina offre due visualizzazioni grafiche avanzate per esplorare le relazioni tra i tuoi dati. Entrambe sono esportabili come immagini <strong>SVG</strong> o <strong>PNG</strong>.</p>
                    <ul>
                        <li><strong>Diagramma di Flusso (Sankey):</strong> Mostra come lo "sforzo" (misurato in giorni/uomo) fluisce dalle Risorse ai Progetti, poi ai Clienti e infine ai Contratti. Lo spessore dei flussi è proporzionale alla quantità di sforzo, rendendo immediato capire dove si concentra il lavoro.</li>
                        <li><strong>Mappa delle Connessioni (Network):</strong> Visualizza le entità come nodi e le loro relazioni come linee. È utile per esplorare le connessioni, ad esempio per vedere quali risorse lavorano insieme sugli stessi progetti.</li>
                    </ul>
                </SubSection>
            </Section>

            <Section title="7. Gestione Dati">
                <p>Le sezioni "Importa" ed "Esporta" sono strumenti potenti per la gestione massiva dei dati tramite file Excel.</p>
                <ul>
                    <li><strong>Esporta Dati:</strong> Ti permette di scaricare file Excel separati per le entità principali, le allocazioni di staffing, le richieste di risorse e i colloqui. È utile per fare backup o per analisi offline.</li>
                    <li><strong>Importa Dati:</strong> Segui la procedura guidata in 3 passaggi per caricare dati in blocco. È fondamentale usare il template scaricato dalla pagina stessa per assicurare la compatibilità delle colonne. Il sistema è intelligente: salterà i dati duplicati (es. un cliente con lo stesso nome) e ti fornirà un resoconto con eventuali avvisi.</li>
                </ul>
            </Section>

             <Section title="8. Amministrazione">
                <ul>
                    <li><strong>Calendario:</strong> Definisci le festività (nazionali o locali per una specifica sede) e i giorni di chiusura aziendale. Questi giorni saranno automaticamente disabilitati nella griglia di Staffing e ignorati nei calcoli dei giorni lavorativi.</li>
                    <li><strong>Configurazioni:</strong> Questa pagina ti permette di personalizzare le opzioni che appaiono nei vari menu a tendina dell'applicazione (es. l'elenco degli Horizontals, i livelli di Seniority, ecc.).</li>
                    <li><strong>Impostazioni Admin:</strong> Riservata agli amministratori, qui puoi attivare o disattivare la protezione tramite password per l'intera applicazione.</li>
                    <li><strong>Database Inspector:</strong> <strong className="text-red-500">ATTENZIONE:</strong> Questo è uno strumento per sviluppatori o per interventi di manutenzione straordinaria. Permette di visualizzare e modificare i dati direttamente nel database. Un uso improprio può compromettere l'integrità dei dati e il funzionamento dell'applicazione. Usare con estrema cautela.</li>
                </ul>
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
