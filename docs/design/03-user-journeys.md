# 03 — User Journeys

> Journey end-to-end per le personas primarie. Ogni step riporta: azione utente,
> tocco di sistema (pagina/funzione reale), emozione/rischio e momento di verità
> (😟 punto di attrito noto). I journey alimentano gli edge case dell'Audit.

## J1 — Giulia ribilancia lo staffing dopo una nuova richiesta  *(P1)*

| # | Fase | Azione utente | Sistema | Emozione / Rischio |
|---|---|---|---|---|
| 1 | Trigger | Riceve notifica: nuova Richiesta Risorsa `ATTIVA` | Notifiche / Richieste Risorse | Allerta |
| 2 | Orientamento | Apre **Staffing**, filtra per progetto/cliente | `StaffingPage` + filtri | Focus |
| 3 | Diagnosi | Cerca chi è sotto-allocato nel periodo | Carico Risorse / colori cella | 😟 deve incrociare a mente più viste |
| 4 | Azione | Assegna risorsa, applica % su range (`🗓️`) | Modale assegnazione massiva | Fiducia |
| 5 | Verifica | Controlla che nessuno vada in rosso | Colore totale cella | 😟 sforamento mostrato ma non spiegato |
| 6 | Errore | Sbaglia intervallo, vuole annullare | — | 😟 **nessun undo** → rifà a mano |
| 7 | Chiusura | Verifica progetto non più "senza staff" | Dashboard card attenzione | Sollievo |

**Momenti di verità:** step 3 (diagnosi cross-vista) e step 6 (recupero da errore).
**Opportunità:** anteprima bulk + undo; pannello "perché è rosso".

---

## J2 — Marco pianifica la capacità del trimestre  *(P2)*

| # | Fase | Azione | Sistema | Rischio |
|---|---|---|---|---|
| 1 | Trigger | Revisione mensile portfolio | — | — |
| 2 | Lettura | Apre **Forecasting**, legge Utilizzo% e Deficit | `ForecastingPage` | 😟 il deficit considera le assenze? |
| 3 | Approfondimento | Verifica margine su **Dashboard**/**Report** | KPI budget vs costo | 😟 numeri devono coincidere |
| 4 | Scenario | Simula assunzione/rotazione | **Simulazioni** | Fiducia se isolato dai dati reali |
| 5 | Decisione | Apre Richiesta Risorsa per il deficit | Richieste Risorse | 😟 passaggio manuale, non guidato |

**Momenti di verità:** affidabilità del forecast (step 2) e coerenza KPI (step 3).

---

## J3 — Elena porta una richiesta da aperta ad assunzione  *(P3)*

| # | Fase | Azione | Sistema | Rischio |
|---|---|---|---|---|
| 1 | Intake | Vede richieste `ATTIVA` non coperte internamente | Richieste Risorse | — |
| 2 | Pipeline | Crea candidati/colloqui collegati alla richiesta | Colloqui (vincolo → richiesta) | Ordine |
| 3 | Valutazione | Registra feedback e stato processo | Card-filtro colloqui | Chiarezza |
| 4 | Offerta | Imposta "Data Ingresso" | Form colloquio | Attesa |
| 5 | Conversione | Crea la **Risorsa** anagrafica per lo staffing | Risorse | 😟 **re-inserimento manuale** |
| 6 | Chiusura | Chiude la richiesta | Richieste Risorse | 😟 facile dimenticare → richiesta "orfana" |

**Momento di verità:** step 5–6 (handoff recruiting → staffing).

---

## J4 — Davide (dipendente) chiede ferie  *(P4 — first-run, bassa frequenza)*

| # | Fase | Azione | Sistema | Rischio |
|---|---|---|---|---|
| 1 | Accesso | Primo login, deve cambiare password | Login + `mustChangePassword` | 😟 onboarding asciutto |
| 2 | Orientamento | Cerca dove chiedere ferie tra 38 voci di menu | Sidebar | 😟 **sovraccarico di navigazione** |
| 3 | Lettura | Apre **Assenze**, lista vuota | `LeavePage` | 😟 **empty state assente** → "è rotto?" |
| 4 | Azione | Compila richiesta, vede giorni lavorativi | Validazione date + calcolo | Fiducia |
| 5 | Invio | Salva (`PENDING`) | HRContext | 😟 **non sa chi approva / cosa succede ora** |
| 6 | Follow-up | Torna a controllare lo stato | Assenze (filtro stato) | Incertezza |

**Momenti di verità:** step 2–3 (trovare la funzione + stato vuoto) e step 5 (chiarezza approvazione).
**Questa è la persona con il journey più fragile** → priorità di intervento.

---

## J5 — Sara modifica i permessi di un ruolo  *(P5)*

| # | Fase | Azione | Sistema | Rischio |
|---|---|---|---|---|
| 1 | Trigger | Nuova policy di accesso | — | — |
| 2 | Configurazione | Modifica Entity Visibility / RBAC | Security Center (pillar) | Controllo |
| 3 | Verifica | Vuole sapere chi è impattato e quando | — | 😟 **effetto su sessioni attive non chiaro** |
| 4 | Dati | Import massivo nuovo reparto | Import wizard | Fiducia (dedup) |
| 5 | Manutenzione | Corregge un record errato | DB Inspector | 😟 strumento ad alto rischio, audit debole |

**Momenti di verità:** step 3 (prevedibilità del cambio permessi) e step 5 (sicurezza operazioni dirette).

---

### Sintesi attriti trasversali emersi dai journey
1. **Recupero da errore** assente nei flussi di scrittura massiva (J1).
2. **Coerenza dei numeri** tra pagine analitiche (J2).
3. **Handoff tra moduli** non guidati: recruiting→staffing (J3), forecast→richiesta (J2).
4. **First-run e self-service** poveri: navigazione, empty state, stato approvazione (J4).
5. **Prevedibilità e tracciabilità** delle azioni di governance (J5).
