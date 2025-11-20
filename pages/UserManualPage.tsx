
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

const FormulaBox: React.FC<{ title: string; formula: string; description: React.ReactNode }> = ({ title, formula, description }) => (
    <div className="bg-surface-container-low border border-outline-variant rounded-lg p-4 my-4">
        <h4 className="font-bold text-primary mb-2">{title}</h4>
        <div className="font-mono bg-surface-container p-2 rounded text-sm mb-3 border border-outline-variant overflow-x-auto">
            {formula}
        </div>
        <div className="text-sm text-on-surface-variant">
            {description}
        </div>
    </div>
);


const UserManualPage: React.FC = () => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 md:p-12">
            <header className="text-center mb-16">
                <h1 className="text-5xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">Manuale Utente</h1>
                <p className="text-xl text-gray-500 dark:text-gray-400">Guida tecnica e funzionale allo Staffing Allocation Planner (V1.3).</p>
            </header>
            
            <Section title="1. Introduzione">
                <p>Benvenuto nello <strong>Staffing Allocation Planner</strong>. Questa piattaforma è progettata per la gestione strategica e operativa delle risorse umane sui progetti. L'applicazione combina funzionalità di pianificazione quotidiana (Staffing) con strumenti avanzati di controllo di gestione (Costi Storici, Forecasting Predittivo) e analisi delle competenze.</p>
                <p>Questo manuale descrive il funzionamento del sistema, con un focus particolare sulle formule di calcolo e sugli algoritmi utilizzati.</p>
            </Section>

            <Section title="2. Dashboard & KPI">
                <p>La Dashboard aggrega i dati in tempo reale per fornire una visione d'insieme immediata.</p>
                
                <SubSection title="Indicatori Economici e di Sforzo">
                    <FormulaBox 
                        title="Budget Complessivo" 
                        formula="Σ (Budget di tutti i progetti attivi o pianificati)"
                        description="Rappresenta il valore totale del portafoglio progetti censito a sistema."
                    />
                    <FormulaBox 
                        title="Costo Stimato (Mese Corrente)" 
                        formula="Σ [(Allocazione% / 100) * CostoRuoloStorico(Data) * %Realizzazione]"
                        description={
                            <>
                                Calcolato sommando il costo giornaliero di ogni allocazione nel mese corrente. 
                                <br/><strong>Nota Importante:</strong> Il sistema utilizza il <em>Costo Storico</em>. Se una risorsa ha cambiato livello (e quindi costo) a metà mese, i giorni precedenti il cambio vengono calcolati col vecchio costo, quelli successivi col nuovo.
                            </>
                        }
                    />
                    <FormulaBox 
                        title="Giorni Allocati (Mese Corrente)" 
                        formula="Σ (Allocazione% / 100) su tutti i giorni lavorativi del mese"
                        description="Il totale dei giorni/uomo (Person-Days) che l'azienda erogherà nel mese corrente."
                    />
                </SubSection>

                <SubSection title="Monitoraggio Operativo">
                    <ul>
                        <li><strong>Risorse Non Allocate:</strong> Numero di risorse attive (`resigned = false`) che non hanno alcuna allocazione (`assignment`) attiva.</li>
                        <li><strong>Progetti Senza Staff:</strong> Progetti in stato "In corso" che non hanno nessuna risorsa assegnata.</li>
                        <li><strong>FTE Non Allocati:</strong> Differenza tra la capacità totale teorica (somma delle % max delle risorse) e l'allocazione effettiva nel mese.</li>
                    </ul>
                </SubSection>
            </Section>

            <Section title="3. Gestione Staffing & Mobile">
                <SubSection title="Pianificazione Staffing">
                    <p>La griglia di staffing permette di definire quanto tempo (in %) una risorsa dedica a un progetto giorno per giorno.</p>
                    <ul>
                        <li><strong>Validazione:</strong> Il sistema evidenzia in <span className="text-red-500 font-bold">Rosso</span> se la somma delle allocazioni giornaliere di una risorsa supera la sua capacità massima (solitamente 100%).</li>
                        <li><strong>Giorni Non Lavorativi:</strong> I weekend e le festività (nazionali o locali in base alla sede della risorsa) sono automaticamente bloccati.</li>
                    </ul>
                </SubSection>
                <SubSection title="Esperienza Mobile (Responsive)">
                    <p>Su dispositivi mobili, la complessa griglia di staffing si trasforma automaticamente in una vista <strong>"Agenda a Card"</strong>:</p>
                    <ul>
                        <li>Ogni risorsa diventa una card verticale.</li>
                        <li>Una <strong>barra di progresso</strong> colorata indica immediatamente il carico totale nel periodo (Verde = Ok, Rosso = Overbooking).</li>
                        <li>Cliccando su un progetto nella card, si apre un editor a tutto schermo ottimizzato per il touch.</li>
                    </ul>
                </SubSection>
            </Section>

            <Section title="4. Forecasting & Algoritmi Predittivi">
                <p>La pagina di Forecasting permette di anticipare il carico di lavoro futuro. Il sistema opera in due modalità:</p>
                
                <SubSection title="1. Modalità Consuntiva (Hard Booking)">
                    <p>Per i mesi passati o correnti, o dove sono state inserite allocazioni manuali puntuali, il sistema somma semplicemente i valori presenti nel database.</p>
                </SubSection>

                <SubSection title="2. Modalità Predittiva (Proiezione)">
                    <p>Se abilitata (switch in alto), per i mesi futuri dove <strong>non</strong> sono presenti allocazioni puntuali, il sistema stima il carico:</p>
                    <FormulaBox 
                        title="Algoritmo di Proiezione" 
                        formula="Carico Previsto = Giorni Lavorativi Mese * Media Storica Allocazione %"
                        description={
                            <>
                                Il sistema calcola la <strong>velocità media storica</strong> con cui la risorsa ha lavorato sul progetto fino ad oggi.
                                <br/>Se il progetto è attivo nel mese futuro (ovvero la data corrente è compresa tra <code>Data Inizio</code> e <code>Data Fine</code> progetto), il sistema applica questa media ai giorni lavorativi futuri.
                            </>
                        }
                    />
                    <p>Questo permette di avere una stima realistica del "run-rate" senza dover pianificare manualmente ogni singolo giorno dei prossimi 12 mesi.</p>
                </SubSection>
            </Section>

            <Section title="5. Analisi Economica e Contratti">
                
                <SubSection title="Storicizzazione dei Costi (SCD Type 2)">
                    <p>Il sistema gestisce la storicità dei costi dei ruoli per garantire report finanziari accurati anche retroattivamente.</p>
                    <ul>
                        <li>Quando il costo giornaliero di un ruolo viene modificato in "Gestione Ruoli", il sistema non sovrascrive il valore precedente.</li>
                        <li>Viene creato un nuovo record storico valido da "Oggi" in poi.</li>
                        <li>Il record precedente viene "chiuso" con data fine "Ieri".</li>
                        <li><strong>Nei Report:</strong> Quando si calcola il costo di un'allocazione passata (es. Gennaio 2023), il sistema recupera il costo che il ruolo aveva <em>in quella data specifica</em>, non il costo attuale.</li>
                    </ul>
                </SubSection>

                <SubSection title="Gestione Contratti e Backlog">
                    <p>I progetti possono essere raggruppati sotto un "Contratto Quadro".</p>
                    <FormulaBox 
                        title="Backlog Commerciale" 
                        formula="Backlog = Capienza Contratto - Σ (Budget Progetti Collegati)"
                        description="Indica quanto budget è ancora disponibile nel contratto per avviare nuovi progetti o estendere quelli esistenti. Non dipende dal consuntivo (speso), ma dal pianificato (venduto)."
                    />
                </SubSection>
            </Section>

            <Section title="6. Analisi Competenze (Skill Matrix)">
                <p>Il sistema offre un motore avanzato per il tracciamento delle competenze, distinguendo tra competenze dichiarate e competenze acquisite sul campo.</p>
                
                <SubSection title="Modalità di Assegnazione">
                    <ul>
                        <li><strong>Esplicite (Manuali):</strong> Competenze certificate o dichiarate, inserite manualmente con un livello specifico (da 1 a 5) e date di validità. Hanno la priorità nel calcolo del profilo.</li>
                        <li><strong>Implicite (Inferite):</strong> Competenze dedotte dal lavoro svolto. Se una risorsa lavora su un progetto taggato con la skill "React", il sistema calcola automaticamente il livello di competenza basandosi sui giorni lavorati.</li>
                    </ul>
                </SubSection>

                <SubSection title="Livelli di Competenza e Calcolo Automatico">
                    <p>Ogni competenza è classificata su 5 livelli: <strong>Novice, Junior, Middle, Senior, Expert</strong>.</p>
                    <p>Per le competenze inferite, il livello viene calcolato sommando i <strong>Giorni/Uomo (FTE)</strong> totali lavorati dalla risorsa su progetti associati a quella competenza.</p>
                    
                    <FormulaBox 
                        title="Algoritmo di Calcolo Livello Inferito" 
                        formula="Totale FTE Skill = Σ (Allocazione% / 100) su tutti i giorni lavorativi dei progetti con la skill"
                        description={
                            <>
                                Il valore risultante viene confrontato con le soglie configurate (Admin Settings).
                                <br/><strong>Soglie di Default (FTE Totali):</strong>
                                <ul className="list-disc list-inside mt-2">
                                    <li><strong>Novice:</strong> &lt; 60 FTE</li>
                                    <li><strong>Junior:</strong> 60 - 149 FTE</li>
                                    <li><strong>Middle:</strong> 150 - 349 FTE</li>
                                    <li><strong>Senior:</strong> 350 - 699 FTE</li>
                                    <li><strong>Expert:</strong> ≥ 700 FTE</li>
                                </ul>
                                <p className="mt-2 text-xs italic">* 1 FTE = 1 Giorno lavorativo a tempo pieno.</p>
                            </>
                        }
                    />
                </SubSection>

                <SubSection title="Visualizzazioni Avanzate">
                    <p>Nella pagina <strong>Analisi Competenze</strong> sono disponibili 4 viste grafiche:</p>
                    <ul>
                        <li><strong>Network (Grafo):</strong> Mostra le relazioni tra Persone, Progetti e Skills come una rete interattiva. Utile per vedere cluster di competenze.</li>
                        <li><strong>Heatmap:</strong> Matrice Risorse x Skills che evidenzia con colori intensi le competenze più forti.</li>
                        <li><strong>Chord Diagram:</strong> Mostra la co-occorrenza delle skills. Se "Java" e "Spring" sono spesso usate negli stessi progetti, saranno collegate da archi spessi.</li>
                        <li><strong>Radar (Spider Chart):</strong> Confronta il profilo di competenza di una singola risorsa su più assi.</li>
                    </ul>
                </SubSection>
            </Section>
            
            <Section title="7. Amministrazione e Dati">
                 <SubSection title="Import/Export">
                    <p>È possibile esportare e importare massivamente i dati tramite file Excel. Esistono template specifici per:</p>
                    <ul>
                        <li><strong>Core Entities:</strong> Risorse, Progetti, Clienti, Ruoli.</li>
                        <li><strong>Staffing:</strong> La griglia delle allocazioni.</li>
                        <li><strong>Skills:</strong> Matrice di competenze e associazioni.</li>
                    </ul>
                </SubSection>
                <SubSection title="Database Inspector">
                    <p>Strumento tecnico per amministratori che permette di visualizzare i dati grezzi delle tabelle, eseguire query di update puntuali e generare dump SQL completi per backup o migrazione (compatibili con PostgreSQL e MySQL).</p>
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
