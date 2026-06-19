/* @vitest-environment jsdom */
/**
 * @file components/knowledgeBase/RichTextEditor.test.tsx
 * @description Test unitari per l'editor WYSIWYG basato su contentEditable.
 */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import RichTextEditor from './RichTextEditor';

afterEach(cleanup);

describe('RichTextEditor', () => {
    it('renderizza la toolbar con i comandi di formattazione', () => {
        render(<RichTextEditor value="" onChange={vi.fn()} />);
        expect(screen.getByLabelText('Grassetto')).toBeDefined();
        expect(screen.getByLabelText('Corsivo')).toBeDefined();
        expect(screen.getByLabelText('Elenco puntato')).toBeDefined();
    });

    it('renderizza un\'area editabile con il contenuto HTML iniziale', () => {
        render(<RichTextEditor value="<p>ciao</p>" onChange={vi.fn()} ariaLabel="Editor contenuto" />);
        const editable = screen.getByLabelText('Editor contenuto');
        expect(editable.getAttribute('contenteditable')).toBe('true');
        expect(editable.innerHTML).toContain('ciao');
    });

    it('chiama onChange quando il contenuto viene modificato', () => {
        const onChange = vi.fn();
        render(<RichTextEditor value="" onChange={onChange} ariaLabel="Editor contenuto" />);
        const editable = screen.getByLabelText('Editor contenuto');
        editable.innerHTML = '<p>nuovo</p>';
        fireEvent.input(editable);
        expect(onChange).toHaveBeenCalledWith('<p>nuovo</p>');
    });

    it('esegue document.execCommand quando si clicca un pulsante della toolbar', () => {
        const execSpy = vi.fn().mockReturnValue(true);
        // jsdom non implementa execCommand: lo iniettiamo.
        (document as unknown as { execCommand: typeof execSpy }).execCommand = execSpy;
        const onChange = vi.fn();
        render(<RichTextEditor value="" onChange={onChange} ariaLabel="Editor contenuto" />);
        fireEvent.click(screen.getByLabelText('Grassetto'));
        expect(execSpy).toHaveBeenCalledWith('bold', false, undefined);
    });
});
