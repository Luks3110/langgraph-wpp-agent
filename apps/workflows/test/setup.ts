// @ts-nocheck
import { afterEach, vi } from 'vitest';

// Make sure vitest's mocking utilities are available globally
global.vi = vi;

afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
}); 
