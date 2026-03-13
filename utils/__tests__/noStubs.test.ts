/**
 * @file noStubs.test.ts
 * @description Verifica che nessun file del progetto contenga stub vuoti o codice troncato
 * introdotti da agenti AI che abbreviano le implementazioni con placeholder.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '../..');

// Pattern che indicano stub vuoti o codice troncato da AI
const STUB_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
    {
        pattern: /\{\s*\/\*\s*logic remains similar\s*\*\/\s*\}/,
        description: 'Stub "logic remains similar"',
    },
    {
        pattern: /\/\/\s*\.\.\.\s*(Rest of|rest of).*(truncated|omitted)/i,
        description: 'Commento di troncamento "... Rest of ... truncated"',
    },
    {
        pattern: /\/\*\s*(truncated for space|omitted for brevity|implementation omitted|code truncated)\s*\*\//i,
        description: 'Commento di troncamento nel blocco',
    },
    {
        pattern: /=>\s*\{\s*\/\*\s*(logic|implementation|code)\s+remains?\s+similar\s*\*\/\s*\}/i,
        description: 'Arrow function stub con "logic/implementation remains similar"',
    },
    {
        pattern: /function\s+\w+\s*\([^)]*\)\s*\{\s*\/\*\s*(TODO|STUB|PLACEHOLDER|not implemented)\s*\*\/\s*\}/i,
        description: 'Funzione stub con TODO/STUB/PLACEHOLDER',
    },
];

// Directory e file da escludere dalla scansione
const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'src', '.vercel']);
const INCLUDED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

function collectFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir)) {
        if (EXCLUDED_DIRS.has(entry)) continue;
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
            files.push(...collectFiles(fullPath));
        } else if (INCLUDED_EXTENSIONS.has(fullPath.slice(fullPath.lastIndexOf('.')))) {
            files.push(fullPath);
        }
    }
    return files;
}

describe('Nessuno stub vuoto o codice troncato', () => {
    const allFiles = collectFiles(ROOT);

    for (const { pattern, description } of STUB_PATTERNS) {
        it(`non deve contenere: ${description}`, () => {
            const violations: string[] = [];

            for (const filePath of allFiles) {
                const content = readFileSync(filePath, 'utf-8');
                const lines = content.split('\n');
                lines.forEach((line, index) => {
                    if (pattern.test(line)) {
                        const relativePath = filePath.replace(ROOT + '/', '');
                        violations.push(`  ${relativePath}:${index + 1}  →  ${line.trim()}`);
                    }
                });
            }

            if (violations.length > 0) {
                throw new Error(
                    `Trovati ${violations.length} stub/troncamenti non ammessi:\n${violations.join('\n')}`
                );
            }
        });
    }

    it('exportUtils.ts esporta funzioni con implementazione reale', async () => {
        const { exportStaffing, exportMonthlyAllocations, exportResourceRequests,
                exportInterviews, exportSkills, exportLeaves,
                exportUsersPermissions, exportTutorMapping, exportTemplate } = await import('../exportUtils');

        const functions = {
            exportStaffing,
            exportMonthlyAllocations,
            exportResourceRequests,
            exportInterviews,
            exportSkills,
            exportLeaves,
            exportUsersPermissions,
            exportTutorMapping,
            exportTemplate,
        };

        for (const [name, fn] of Object.entries(functions)) {
            expect(typeof fn, `${name} deve essere una funzione`).toBe('function');
            // Una funzione stub occupa ~30 caratteri. Una reale ne occupa molti di più.
            expect(fn.toString().length, `${name} sembra uno stub (corpo troppo corto)`).toBeGreaterThan(100);
        }
    });
});
