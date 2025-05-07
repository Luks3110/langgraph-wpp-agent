import { z } from 'zod';
import { Command } from './commandBus';
import { ValidationFailedError, ZodValidationMiddleware } from './validation';

// Sample command with validation
interface TestCommand extends Command {
    type: 'test.command';
    name: string;
    value: number;
    optional?: string;
}

// Run this to test validation
async function testCommandValidation() {
    // Define schema
    const testCommandSchema = z.object({
        type: z.literal('test.command'),
        name: z.string().min(3),
        value: z.number().positive(),
        optional: z.string().optional()
    });

    // Create middleware
    const validationMiddleware = new ZodValidationMiddleware(testCommandSchema);

    // Valid command
    const validCommand: TestCommand = {
        type: 'test.command',
        name: 'Test Command',
        value: 42
    };

    // Invalid command
    const invalidCommand = {
        type: 'test.command',
        name: 'T', // Too short
        value: -1, // Not positive
        extra: 'extra field'
    };

    // Test valid command
    console.log('Testing valid command:');
    try {
        const validationResult = await validationMiddleware.validate(validCommand);
        console.log('Validation result:', validationResult);

        const transformedCommand = await validationMiddleware.transformIfValid(validCommand);
        console.log('Transformed command:', transformedCommand);
        console.log('✅ Valid command passed validation');
    } catch (error) {
        console.error('❌ Valid command failed validation:',
            error instanceof ValidationFailedError ? error.errors : error);
    }

    // Test invalid command
    console.log('\nTesting invalid command:');
    try {
        const validationResult = await validationMiddleware.validate(invalidCommand);
        console.log('Validation result:', validationResult);

        // This should throw
        const transformedCommand = await validationMiddleware.transformIfValid(invalidCommand);
        console.log('Transformed command:', transformedCommand);
    } catch (error) {
        console.log('✅ Invalid command correctly failed validation:');
        if (error instanceof ValidationFailedError) {
            error.errors.forEach(err => {
                console.log(`- ${err.field}: ${err.message}`);
            });
        } else {
            console.error(error);
        }
    }
}

// Run the test if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
    testCommandValidation().catch(error => {
        console.error('Test error:', error);
        process.exit(1);
    });
}

export { testCommandValidation };
