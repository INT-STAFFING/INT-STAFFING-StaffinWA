# Design Validation — Staffing Allocation Planner

Validazione della progettazione condotta con il taglio di un **Product Designer
Senior** (UX research, information architecture, design system) e un approccio
**critico-Socratico**: sfidare le assunzioni deboli, non compiacere.

## Indice
1. [`01-personas.md`](./01-personas.md) — 6 personas comportamentali ancorate ai ruoli RBAC reali + anti-personas.
2. [`02-user-stories.md`](./02-user-stories.md) — User stories per epica con criteri di accettazione e stato (✅/⚠️/❌).
3. [`03-user-journeys.md`](./03-user-journeys.md) — Journey end-to-end con momenti di verità e attriti.
4. [`04-flussi-wireframe.md`](./04-flussi-wireframe.md) — Wireframe testuali e flussi as-is/to-be.
5. [`05-audit-e-stress-test.md`](./05-audit-e-stress-test.md) — **FASE 1** audit (coerenza/utente/edge case), **FASE 2** 10 domande di stress test, **FASE 3** suggerimenti e re-audit.
6. [`06-checklist-design-review.md`](./06-checklist-design-review.md) — **FASE 4** checklist gate da verificare sistematicamente.

## Metodo
- Tutto è **ancorato al codice reale** (38 pagine, RBAC a 3 livelli, moduli HR/finance/skills): niente design teorico scollegato dall'app.
- Ogni criticità ha una **domanda di ricerca** o una **azione di sviluppo** con ID tracciabile (R-xx).
- Il loop è **proponi → sviluppa → ri-audita**: in questa iterazione è stato chiuso **R-D3** (empty state distinto) con codice + test; il resto è backlog tracciato nella checklist.

## Onestà intellettuale
L'audit documenta anche un'**ipotesi iniziale errata** (poi corretta verificando
il codice): vedi la "nota di onestà" in `05-audit-e-stress-test.md`. È parte del
metodo: il design review serve a trovare la verità, non a confermare le premesse.
