import { z } from 'zod';
import { ValidationFailedError, ValidationMiddleware, ZodValidationMiddleware } from './validation';

export interface Command {
    type: string;
    [key: string]: unknown;
}

export interface CommandHandler<T extends Command, R = void> {
    handle(command: T): Promise<R>;
}

export interface CommandMiddleware<T extends Command = Command> {
    execute(command: T, next: (command: T) => Promise<unknown>): Promise<unknown>;
}

export class ValidationCommandMiddleware<T extends Command> implements CommandMiddleware<T> {
    constructor(private validationMiddleware: ValidationMiddleware<T>) { }

    async execute(command: T, next: (command: T) => Promise<unknown>): Promise<unknown> {
        // Validate the command before passing it to the next middleware
        try {
            const transformedCommand = await this.validationMiddleware.transformIfValid<T>(command);
            return next(transformedCommand);
        } catch (error) {
            if (error instanceof ValidationFailedError) {
                console.error(`Validation failed for command type ${command.type}:`,
                    error.errors.map(e => `${e.field}: ${e.message}`).join(', '));
                throw error;
            }
            throw error;
        }
    }
}

export class LoggingCommandMiddleware implements CommandMiddleware {
    async execute(command: Command, next: (command: Command) => Promise<unknown>): Promise<unknown> {
        console.log(`Executing command: ${command.type}`);

        try {
            const startTime = Date.now();
            const result = await next(command);
            const duration = Date.now() - startTime;

            console.log(`Command ${command.type} executed successfully in ${duration}ms`);
            return result;
        } catch (error) {
            console.error(`Error executing command ${command.type}:`, error);
            throw error;
        }
    }
}

export class CommandBus {
    private handlers = new Map<string, CommandHandler<any, unknown>>();
    private middleware: CommandMiddleware[] = [];

    registerHandler<T extends Command, R>(
        commandType: string,
        handler: CommandHandler<T, R>
    ): void {
        this.handlers.set(commandType, handler);
    }

    addMiddleware(middleware: CommandMiddleware): void {
        this.middleware.push(middleware);
    }

    async execute<T extends Command, R>(command: T): Promise<R> {
        const handler = this.handlers.get(command.type);

        if (!handler) {
            throw new Error(`No handler registered for command type: ${command.type}`);
        }

        // Create middleware chain
        let chain = (cmd: Command) => handler.handle(cmd as T);

        // Build the middleware chain in reverse order
        for (let i = this.middleware.length - 1; i >= 0; i--) {
            const middleware = this.middleware[i];
            const nextChain = chain;
            chain = (cmd: Command) => middleware.execute(cmd, nextChain);
        }

        // Execute the middleware chain
        return chain(command) as Promise<R>;
    }
}

// Factory function to create a command bus with default middleware
export function createCommandBus(): CommandBus {
    const commandBus = new CommandBus();

    // Add default middleware
    commandBus.addMiddleware(new LoggingCommandMiddleware());

    return commandBus;
}

// Create a validation middleware for a command using a Zod schema
export function createValidationMiddleware<T extends Command>(
    schema: z.ZodSchema<T>
): ValidationCommandMiddleware<T> {
    const zodMiddleware = new ZodValidationMiddleware<T>(schema);
    return new ValidationCommandMiddleware<T>(zodMiddleware);
} 
