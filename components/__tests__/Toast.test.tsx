/* @vitest-environment jsdom */
/**
 * @file components/__tests__/Toast.test.tsx
 * @description Test del componente Toast.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Toast from '../Toast';

describe('Toast', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('mostra il messaggio passato come prop', () => {
        const onDismiss = vi.fn();
        render(<Toast message="Operazione completata" type="success" onDismiss={onDismiss} />);
        expect(screen.getByText('Operazione completata')).toBeDefined();
    });

    it('chiama onDismiss dopo 5 secondi', () => {
        const onDismiss = vi.fn();
        render(<Toast message="Test timeout" type="info" onDismiss={onDismiss} />);
        expect(onDismiss).not.toHaveBeenCalled();
        act(() => {
            vi.advanceTimersByTime(5000);
        });
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('chiama onDismiss al click sul bottone di chiusura', () => {
        const onDismiss = vi.fn();
        render(<Toast message="Chiudi" type="warning" onDismiss={onDismiss} />);
        const closeBtn = screen.getByRole('button');
        fireEvent.click(closeBtn);
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('non chiama onDismiss prima dei 5 secondi', () => {
        const onDismiss = vi.fn();
        render(<Toast message="Test" type="error" onDismiss={onDismiss} />);
        act(() => {
            vi.advanceTimersByTime(4999);
        });
        expect(onDismiss).not.toHaveBeenCalled();
    });

    it('mostra l\'icona check_circle per type=success', () => {
        const { container } = render(<Toast message="OK" type="success" onDismiss={() => {}} />);
        expect(container.textContent).toContain('check_circle');
    });

    it('mostra l\'icona error per type=error', () => {
        const { container } = render(<Toast message="Errore" type="error" onDismiss={() => {}} />);
        expect(container.textContent).toContain('error');
    });

    it('mostra l\'icona warning per type=warning', () => {
        const { container } = render(<Toast message="Attenzione" type="warning" onDismiss={() => {}} />);
        expect(container.textContent).toContain('warning');
    });

    it('mostra l\'icona info per type=info', () => {
        const { container } = render(<Toast message="Info" type="info" onDismiss={() => {}} />);
        expect(container.textContent).toContain('info');
    });

    it('pulisce il timer al dismount (no chiamata dopo unmount)', () => {
        const onDismiss = vi.fn();
        const { unmount } = render(<Toast message="Test" type="success" onDismiss={onDismiss} />);
        unmount();
        act(() => {
            vi.advanceTimersByTime(10000);
        });
        expect(onDismiss).not.toHaveBeenCalled();
    });
});
