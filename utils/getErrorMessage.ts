/**
 * @file utils/getErrorMessage.ts
 * @description Estrae un messaggio leggibile da un valore catturato in un blocco
 * `catch`. Permette di tipizzare i catch come `unknown` (più sicuro di `any`)
 * preservando il comportamento esistente: per gli oggetti `Error` restituisce
 * `.message`, altrimenti la rappresentazione a stringa del valore.
 */
export const getErrorMessage = (e: unknown): string =>
    e instanceof Error ? e.message : String(e);
