
import { describe, expect, it } from 'vitest';
import { loginSchema } from '../LoginPage';
import { resourceRequestSchema } from '../ResourceRequestPage';

const baseResourceRequest = {
    projectId: 'project-1',
    roleId: 'role-1',
    requestorId: null,
    startDate: '2024-05-01',
    endDate: '2024-06-01',
    commitmentPercentage: 50,
    isUrgent: false,
    isLongTerm: false,
    isTechRequest: false,
    isOsrOpen: false,
    osrNumber: '',
    notes: '',
    status: 'ATTIVA' as const,
};

describe('loginSchema', () => {
    it('rejects credentials that do not respect minimum length', () => {
        const result = loginSchema.safeParse({ username: 'ab', password: 'short' });
        expect(result.success).toBe(false);
    });

    it('accepts valid credentials', () => {
        const result = loginSchema.safeParse({ username: 'utente.demo', password: 'password123' });
        expect(result.success).toBe(true);
    });
});

describe('resourceRequestSchema', () => {
    it('requires chronological dates', () => {
        const result = resourceRequestSchema.safeParse({ ...baseResourceRequest, endDate: '2024-04-01' });
        expect(result.success).toBe(false);
        if (!result.success) {
            // FIX: Using explicit any cast for result to access error property as narrowing fails here.
            expect((result as any).error.flatten().fieldErrors.endDate?.[0]).toContain('fine');
        }
    });

    it('requires osrNumber when OSR is flagged as open', () => {
        const result = resourceRequestSchema.safeParse({ ...baseResourceRequest, isOsrOpen: true, osrNumber: '' });
        expect(result.success).toBe(false);
        if (!result.success) {
            // FIX: Using explicit any cast for result to access error property as narrowing fails here.
            expect((result as any).error.flatten().fieldErrors.osrNumber?.[0]).toBeDefined();
        }
    });

    it('accepts a well formed request', () => {
        const result = resourceRequestSchema.safeParse({
            ...baseResourceRequest,
            commitmentPercentage: 80,
            isOsrOpen: true,
            osrNumber: 'OSR-1234',
        });
        expect(result.success).toBe(true);
    });
});
