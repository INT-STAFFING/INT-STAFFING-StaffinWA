/* @vitest-environment jsdom */
/**
 * @file components/__tests__/Toast.test.tsx
 * @description Test unitari per il componente Toast.
 * Verifica rendering per ogni tipo, auto-dismiss e dismiss manuale.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Toast from '../Toast';

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
});

describe('Toast – rendering', () => {
    it('mostra il messaggio passato come prop', () => {
        render(<Toast message="Operazione completata" type="success" onDismiss={() => {}} />);
        expect(screen.getByText('Operazione completata')).toBeDefined();
    });

    it('mostra l\'icona check_circle per type=success', () => {
        const { container } = render(<Toast message="ok" type="success" onDismiss={() => {}} />);
        const icon = container.querySelector('.material-symbols-outlined');
        expect(icon?.textContent).toBe('check_circle');
    });

    it('mostra l\'icona error per type=error', () => {
        const { container } = render(<Toast message="errore" type="error" onDismiss={() => {}} />);
        const icons = container.querySelectorAll('.material-symbols-outlined');
        // Prima icona = tipo, seconda = close
        expect(icons[0]?.textContent).toBe('error');
    });

    it('mostra l\'icona warning per type=warning', () => {
        const { container } = render(<Toast message="attenzione" type="warning" onDismiss={() => {}} />);
        const icons = container.querySelectorAll('.material-symbols-outlined');
        expect(icons[0]?.textContent).toBe('warning');
    });

    it('mostra l\'icona info per type=info', () => {
        const { container } = render(<Toast message="info" type="info" onDismiss={() => {}} />);
        const icons = container.querySelectorAll('.material-symbols-outlined');
        expect(icons[0]?.textContent).toBe('info');
    });

    it('mostra il pulsante di chiusura con icona close', () => {
        const { container } = render(<Toast message="test" type="success" onDismiss={() => {}} />);
        const icons = container.querySelectorAll('.material-symbols-outlined');
        expect(icons[icons.length - 1]?.textContent).toBe('close');
    });
});

describe('Toast – auto-dismiss', () => {
    it('chiama onDismiss dopo 5000ms', () => {
        const onDismiss = vi.fn();
        render(<Toast message="test" type="success" onDismiss={onDismiss} />);

        expect(onDismiss).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(5000);
        });

        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('non chiama onDismiss prima dei 5000ms', () => {
        const onDismiss = vi.fn();
        render(<Toast message="test" type="success" onDismiss={onDismiss} />);

        act(() => {
            vi.advanceTimersByTime(4999);
        });

        expect(onDismiss).not.toHaveBeenCalled();
    });

    it('cancella il timer quando il componente viene smontato', () => {
        const onDismiss = vi.fn();
        const { unmount } = render(<Toast message="test" type="success" onDismiss={onDismiss} />);
        unmount();

        act(() => {
            vi.advanceTimersByTime(5000);
        });

        // Non deve essere chiamato perché il timer è stato cancellato al unmount
        expect(onDismiss).not.toHaveBeenCalled();
    });
});

describe('Toast – dismiss manuale', () => {
    it('chiama onDismiss cliccando il pulsante di chiusura', () => {
        const onDismiss = vi.fn();
        const { container } = render(<Toast message="test" type="success" onDismiss={onDismiss} />);
        const closeButton = container.querySelector('button') as HTMLElement;
        fireEvent.click(closeButton);
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('il click al pulsante non richiede di attendere i 5000ms', () => {
        const onDismiss = vi.fn();
        const { container } = render(<Toast message="test" type="error" onDismiss={onDismiss} />);
        const closeButton = container.querySelector('button') as HTMLElement;

        // Clicca subito senza avanzare il timer
        fireEvent.click(closeButton);
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });
});
