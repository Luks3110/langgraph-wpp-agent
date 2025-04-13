# Integration Test Suite

This directory contains integration tests for the workflows engine, addressing [TAL-54](https://linear.app/talkio/issue/TAL-54/[testing]-integration-test-suite).

## Structure

- `/integration` - Tests that verify system components working together
- `/mocks.ts` - Mock utilities for external dependencies
- `/setup.ts` - Common test setup

## Running Tests

Run all tests with:

```bash
pnpm test
```

Run tests with coverage:

```bash
pnpm test:coverage
```

Watch mode for development:

```bash
pnpm test:watch
```

Or use the convenience script:

```bash
./test/run-integration-tests.sh
```

## Coverage Reports

Coverage reports are generated in the `/coverage` directory after running `pnpm test:coverage`. These are automatically uploaded as artifacts by the GitHub Actions workflow.

## Writing New Tests

When writing new tests:

1. Place integration tests in the `/integration` directory
2. Follow the naming convention `*.test.ts`
3. Use the provided mocks for external dependencies
4. Consider edge cases and failure scenarios

Example test structure:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentToTest } from '../../src/path/to/component';

// Optional: Mock dependencies
vi.mock('dependency', () => ({
  // mock implementation
}));

describe('ComponentName', () => {
  let component: ComponentToTest;
  
  beforeEach(() => {
    component = new ComponentToTest();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should do something specific', () => {
    const result = component.method();
    expect(result).toBe(expectedValue);
  });
});
```

## CI Integration

Tests are automatically run on:
- Pull requests to `main`
- Push to `main`
- Manual trigger via GitHub Actions

The workflow configuration is in `.github/workflows/integration-tests.yml`. 
