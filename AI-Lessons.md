# AI-Lessons.md — Lezioni apprese

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

### ⚠️ L10-02 — @testing-library/react richiede cleanup esplicito in file con più test (2026-03-11)

**Problema:** In `ConfirmationModal.test.tsx`, ogni `render()` accumulava elementi nel DOM
perché il cleanup automatico non veniva eseguito tra i test. Questo causava l'errore
"Found multiple elements with the text: ...".

**Regola:** Nei file di test per componenti React con più di un `it()` che chiama `render()`,
aggiungere sempre:
```ts
import { cleanup } from '@testing-library/react';
afterEach(cleanup);
```
Il cleanup automatico di `@testing-library/react` non è garantito in tutte le configurazioni
Vitest. Meglio renderlo esplicito.

---

### ⚠️ L10-03 — Unhandled rejection nei test di retry asincrono (2026-03-11)

**Problema:** Nei test di `apiFetch` con retry, la promise veniva creata ma il suo handler
`.rejects` veniva attaccato solo DOPO `vi.runAllTimersAsync()`. Nel frattempo, Node segnalava
"PromiseRejectionHandledWarning" e Vitest lo trattava come errore non gestito.

**Regola:** Quando si crea una promise che ci si aspetta rigetti, attaccare subito un
`.catch(() => {})` no-op per sopprimere l'unhandled rejection, lasciando comunque che il test
possa verificare con `await expect(promise).rejects.toThrow()`:
```ts
const promise = someAsyncFn();
promise.catch(() => {}); // evita unhandled rejection warning
await vi.runAllTimersAsync();
await expect(promise).rejects.toThrow('...');
```

---

### ⚠️ L10-04 — Non spiare setTimeout con `vi.spyOn` dopo `vi.useFakeTimers()` (2026-03-11)

**Problema:** Nel test del backoff esponenziale, ho usato
`vi.spyOn(globalThis, 'setTimeout').mockImplementation(...)` DOPO che `vi.useFakeTimers()`
era già stato chiamato in `beforeEach`. La variabile `realSetTimeout` catturava il timer FAKE,
non quello reale, causando il timeout del test.

**Regola:** Per testare il backoff esponenziale, usare `vi.advanceTimersByTimeAsync(N)` per
avanzare il clock step-by-step e verificare il numero di chiamate a fetch:
```ts
// delay1 = 100ms → secondo tentativo
await vi.advanceTimersByTimeAsync(100);
expect(mockFetch).toHaveBeenCalledTimes(2);
// delay2 = 200ms → terzo tentativo
await vi.advanceTimersByTimeAsync(200);
expect(mockFetch).toHaveBeenCalledTimes(3);
```
Non usare mai `vi.spyOn(setTimeout)` dopo `vi.useFakeTimers()` — sostituiresti il fake con un altro fake.

---

## Workflow

### ⚠️ L20-01 — Creare AI-ToDo.md e AI-Lessons.md all'avvio di ogni task non banale (2026-03-10)

**Problema:** Ho completato un task multi-step senza creare né AI-ToDo.md né
AI-Lessons.md come richiesto dalle istruzioni di workflow.

**Regola:**
1. Prima di iniziare qualsiasi task con 3+ step, creare `AI-ToDo.md` con:
   - Lista checkable degli step pianificati
   - Sezione `## Revisione` vuota da riempire alla fine
2. Dopo aver completato il task (o ricevuto una correzione), aggiornare `AI-Lessons.md`.
3. Controllare questo file all'**inizio** di ogni sessione per evitare di ripetere gli stessi errori.

---
