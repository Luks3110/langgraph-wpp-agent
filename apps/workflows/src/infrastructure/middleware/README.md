# Command Validation Middleware

This directory contains middleware components for validating commands in the CQRS architecture.

## Components

### 1. Validation Middleware

Core validation infrastructure using Zod schemas:

- `ValidationMiddleware`: Interface for validation middleware
- `ZodValidationMiddleware`: Implementation using Zod schemas
- `ValidationPipeline`: Chain multiple validators together
- `ValidationError`: Error details for validation failures

### 2. Command Bus

A command bus with middleware support:

- `CommandBus`: Main command dispatcher with middleware support
- `CommandHandler`: Interface for command handlers
- `CommandMiddleware`: Interface for command bus middleware
- `ValidationCommandMiddleware`: Middleware for validating commands
- `LoggingCommandMiddleware`: Middleware for logging command execution

## Usage

### Basic Validation

```typescript
import { z } from 'zod';
import { ZodValidationMiddleware } from './validation.js';

// Define a schema
const schema = z.object({
  id: z.string().uuid(),
  name: z.string().min(3),
  count: z.number().positive()
});

// Create validation middleware
const validator = new ZodValidationMiddleware(schema);

// Validate data
const result = await validator.validate(data);
if (result.isValid) {
  // Data is valid
} else {
  // Handle validation errors
  console.error(result.errors);
}
```

### Command Bus with Validation

```typescript
import { z } from 'zod';
import { 
  Command, 
  CommandBus, 
  CommandHandler, 
  createCommandBus, 
  createValidationMiddleware 
} from './commandBus.js';

// Define command type
interface MyCommand extends Command {
  type: 'my.command';
  id: string;
  name: string;
}

// Define schema
const myCommandSchema = z.object({
  type: z.literal('my.command'),
  id: z.string().uuid(),
  name: z.string().min(3)
});

// Create validation middleware
const validationMiddleware = createValidationMiddleware<MyCommand>(myCommandSchema);

// Set up command bus
const commandBus = createCommandBus();
commandBus.addMiddleware(validationMiddleware);

// Register handler
commandBus.registerHandler('my.command', new MyCommandHandler());

// Execute command (will be validated)
await commandBus.execute({
  type: 'my.command',
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Example Command'
});
```

## Error Handling

Validation failures throw a `ValidationFailedError` with detailed information about what failed:

```typescript
try {
  await commandBus.execute(command);
} catch (error) {
  if (error instanceof ValidationFailedError) {
    // Handle validation errors
    error.errors.forEach(err => {
      console.log(`${err.field}: ${err.message}`);
    });
  } else {
    // Handle other errors
  }
}
``` 
