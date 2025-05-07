import { z } from 'zod';

export interface ValidationError {
    field: string;
    code: string;
    message: string;
    metadata?: Record<string, unknown>;
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}

export interface ValidationContext {
    tenantId?: string;
    userId?: string;
    correlationId?: string;
    [key: string]: unknown;
}

export interface ValidationMiddleware<T> {
    validate(command: unknown, context?: ValidationContext): Promise<ValidationResult>;
    transformIfValid<R = T>(command: unknown, context?: ValidationContext): Promise<R>;
}

export class ZodValidationMiddleware<T> implements ValidationMiddleware<T> {
    constructor(private schema: z.ZodSchema<T>) { }

    async validate(command: unknown, context?: ValidationContext): Promise<ValidationResult> {
        try {
            await this.schema.parseAsync(command);
            return { isValid: true, errors: [] };
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errors = error.errors.map(err => ({
                    field: err.path.join('.'),
                    code: `validation.${err.code}`,
                    message: err.message,
                    metadata: {
                        ...(context || {}),
                        issue: err
                    }
                }));

                return { isValid: false, errors };
            }

            // For other types of errors
            return {
                isValid: false,
                errors: [{
                    field: 'unknown',
                    code: 'validation.unknown',
                    message: error instanceof Error ? error.message : 'Unknown validation error',
                    metadata: context
                }]
            };
        }
    }

    async transformIfValid<R = T>(command: unknown, context?: ValidationContext): Promise<R> {
        const result = await this.validate(command, context);

        if (!result.isValid) {
            throw new ValidationFailedError(
                'Command validation failed',
                result.errors
            );
        }

        return this.schema.parse(command) as unknown as R;
    }
}

export class ValidationFailedError extends Error {
    constructor(
        message: string,
        public readonly errors: ValidationError[]
    ) {
        super(message);
        this.name = 'ValidationFailedError';
    }
}

export class ValidationPipeline<T> {
    private validators: ValidationMiddleware<T>[] = [];

    constructor(private stopOnFirstError = true) { }

    addValidator(validator: ValidationMiddleware<T>): ValidationPipeline<T> {
        this.validators.push(validator);
        return this;
    }

    async validate(command: unknown, context?: ValidationContext): Promise<ValidationResult> {
        const allErrors: ValidationError[] = [];

        for (const validator of this.validators) {
            const result = await validator.validate(command, context);

            if (!result.isValid) {
                if (this.stopOnFirstError) {
                    return result;
                }

                allErrors.push(...result.errors);
            }
        }

        return {
            isValid: allErrors.length === 0,
            errors: allErrors
        };
    }

    async transformIfValid<R = T>(command: unknown, context?: ValidationContext): Promise<R> {
        const result = await this.validate(command, context);

        if (!result.isValid) {
            throw new ValidationFailedError(
                'Command validation failed',
                result.errors
            );
        }

        // If all validators pass, use the last validator to transform
        if (this.validators.length > 0) {
            const lastValidator = this.validators[this.validators.length - 1];
            return lastValidator.transformIfValid<R>(command, context);
        }

        // If no validators, return as is
        return command as unknown as R;
    }
} 
