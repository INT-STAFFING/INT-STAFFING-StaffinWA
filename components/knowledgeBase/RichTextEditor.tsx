/**
 * @file components/knowledgeBase/RichTextEditor.tsx
 * @description Editor WYSIWYG leggero e privo di dipendenze esterne, basato su
 * `contentEditable` + `document.execCommand`. Espone una toolbar con i comandi di
 * formattazione di base ed emette il contenuto come stringa HTML.
 *
 * Scelta progettuale: il progetto non includeva un editor di testo né una libreria
 * dedicata; per evitare di aggiungere dipendenze pesanti (Quill/TipTap) e mantenere
 * la compatibilità con React 19 e l'ambiente di test (jsdom), si adotta una soluzione
 * nativa del browser.
 */

import React, { useEffect, useRef, useCallback } from 'react';

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    ariaLabel?: string;
    placeholder?: string;
}

interface ToolbarCommand {
    command: string;
    value?: string;
    label: string;
    icon: string;
}

const TOOLBAR: ToolbarCommand[] = [
    { command: 'bold', label: 'Grassetto', icon: 'format_bold' },
    { command: 'italic', label: 'Corsivo', icon: 'format_italic' },
    { command: 'underline', label: 'Sottolineato', icon: 'format_underlined' },
    { command: 'formatBlock', value: 'H2', label: 'Intestazione', icon: 'title' },
    { command: 'insertUnorderedList', label: 'Elenco puntato', icon: 'format_list_bulleted' },
    { command: 'insertOrderedList', label: 'Elenco numerato', icon: 'format_list_numbered' },
];

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, ariaLabel = 'Editor contenuto', placeholder }) => {
    const editorRef = useRef<HTMLDivElement>(null);

    // Sincronizza il valore esterno solo quando differisce dal DOM, per non
    // resettare la posizione del cursore durante la digitazione.
    useEffect(() => {
        const el = editorRef.current;
        if (el && el.innerHTML !== value) {
            el.innerHTML = value || '';
        }
    }, [value]);

    const emitChange = useCallback(() => {
        if (editorRef.current) onChange(editorRef.current.innerHTML);
    }, [onChange]);

    const exec = useCallback((command: string, commandValue?: string) => {
        // execCommand è deprecato ma ancora ampiamente supportato; sufficiente per
        // un editor di base senza dipendenze. La guardia evita crash in ambienti privi.
        if (typeof document.execCommand === 'function') {
            document.execCommand(command, false, commandValue);
        }
        editorRef.current?.focus();
        emitChange();
    }, [emitChange]);

    const insertLink = useCallback(() => {
        const url = window.prompt('Inserisci URL del collegamento:');
        if (url) exec('createLink', url);
    }, [exec]);

    return (
        <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface">
            <div className="flex flex-wrap items-center gap-1 p-2 border-b border-outline-variant bg-surface-container-low" role="toolbar" aria-label="Strumenti di formattazione">
                {TOOLBAR.map(({ command, value: cmdValue, label, icon }) => (
                    <button
                        key={label}
                        type="button"
                        aria-label={label}
                        title={label}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => exec(command, cmdValue)}
                        className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary"
                    >
                        <span className="material-symbols-outlined text-lg" aria-hidden="true">{icon}</span>
                    </button>
                ))}
                <button
                    type="button"
                    aria-label="Inserisci collegamento"
                    title="Inserisci collegamento"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={insertLink}
                    className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary"
                >
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">link</span>
                </button>
                <button
                    type="button"
                    aria-label="Rimuovi formattazione"
                    title="Rimuovi formattazione"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => exec('removeFormat')}
                    className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary"
                >
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">format_clear</span>
                </button>
            </div>
            <div
                ref={editorRef}
                role="textbox"
                aria-multiline="true"
                aria-label={ariaLabel}
                data-placeholder={placeholder}
                contentEditable
                suppressContentEditableWarning
                onInput={emitChange}
                onBlur={emitChange}
                className="kb-rte-content min-h-[12rem] max-h-[24rem] overflow-y-auto p-4 text-on-surface focus:outline-none prose-sm"
            />
        </div>
    );
};

export default RichTextEditor;
