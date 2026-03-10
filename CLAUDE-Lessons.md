# CLAUDE-Lessons.md — Lezioni apprese

Regole auto-aggiornate per ridurre il tasso di errore nelle sessioni future.
Aggiornare dopo ogni correzione ricevuta dall'utente.

---

## Testing

### ⚠️ L10-01 — jsdom non supporta separatori migliaia ICU per la locale it-IT (2026-03-10)

**Problema:** Ho scritto test che verificavano `'1.000'` come output di `toLocaleString('it-IT')`.
In jsdom, la chiamata restituisce `'1000,00 €'` senza il separatore migliaia perché l'ambiente
non carica i dati ICU completi per le locale non-inglesi.

**Regola:** Nei test che coprono funzioni di formattazione basate su `toLocaleString()`:
- **NON** verificare il separatore migliaia come stringa letterale (`'1.000'`).
- **USA** regex flessibili che accettino entrambe le forme:
  ```ts
  expect(result).toMatch(/1[.'\s]?000/);   // 1.000 oppure 1000
  expect(result).toMatch(/[,.]50/);         // decimali con virgola o punto
  ```
- Verifica sempre la presenza del simbolo di valuta (`'€'`) e del valore numerico.

**Generalizzazione:** Per qualsiasi funzione che usa `Intl` o `toLocaleString`, assumere che
jsdom produca output senza separatori locale-specifici. Usare regex o `toBeGreaterThan` sul
valore numerico estratto, mai stringhe letterali dipendenti dalla locale.

---

## Workflow

### ⚠️ L20-01 — Creare CLAUDE-ToDo.md e CLAUDE-Lessons.md all'avvio di ogni task non banale (2026-03-10)

**Problema:** Ho completato un task multi-step senza creare né CLAUDE-ToDo.md né
CLAUDE-Lessons.md come richiesto dalle istruzioni di workflow.

**Regola:**
1. Prima di iniziare qualsiasi task con 3+ step, creare `CLAUDE-ToDo.md` con:
   - Lista checkable degli step pianificati
   - Sezione `## Revisione` vuota da riempire alla fine
2. Dopo aver completato il task (o ricevuto una correzione), aggiornare `CLAUDE-Lessons.md`.
3. Controllare questo file all'**inizio** di ogni sessione per evitare di ripetere gli stessi errori.

---
