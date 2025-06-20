import { NodeExecutionStrategy } from '../execution/nodeStrategy.js';
import { ExecutionResult, ValidationResult, WorkflowContext } from '../execution/models.js';
import { WorkflowNodeQuery } from '../queries/index.js';

export interface RAGNodeData {
    knowledgeCollectionId: string;
    qdrantConfig: {
        url: string;
        apiKey?: string;
        collectionName: string;
    };
    queryConfig: {
        inputTextField: string; // Field path to get the query text from input
        similarityThreshold: number; // Minimum similarity score (0-1)
        maxResults: number; // Maximum number of results to return
        searchType: 'vector' | 'hybrid'; // Vector search or hybrid search
    };
    filterConfig?: {
        // Filters based on metadata stored with the vectors
        tenantId?: string;
        companyId?: string;
        category?: string;
        customFilters?: Array<{
            field: string;
            operator: 'equals' | 'in' | 'range';
            value: any;
        }>;
    };
    outputConfig: {
        includeMetadata: boolean;
        includeScore: boolean;
        maxContentLength?: number; // Truncate content if needed
        combineResults: boolean; // Whether to combine all results into single text
        resultTemplate?: string; // Template for formatting each result
    };
    embeddingConfig?: {
        model: 'text-embedding-ada-002' | 'sentence-transformers/all-MiniLM-L6-v2';
        apiKey?: string; // For OpenAI embeddings
        dimensions?: number;
    };
}

export interface RAGNodeInput {
    query: string;
    context?: Record<string, any>;
    userId?: string;
    tenantId?: string;
    companyId?: string;
    [key: string]: any;
}

export interface RAGResult {
    id: string;
    content: string;
    metadata: Record<string, any>;
    score: number;
}

export class RAGNodeStrategy implements NodeExecutionStrategy {
    
    /**
     * Validate RAG node configuration
     */
    async validate(node: WorkflowNodeQuery): Promise<ValidationResult> {
        const errors: string[] = [];
        const data = node.config as RAGNodeData;

        if (!data) {
            return { isValid: false, errors: ['Node configuration is required'] };
        }

        // Validate knowledge collection
        if (!data.knowledgeCollectionId) {
            errors.push('Knowledge collection ID is required');
        }

        // Validate Qdrant configuration
        if (!data.qdrantConfig) {
            errors.push('Qdrant configuration is required');
        } else {
            if (!data.qdrantConfig.url) {
                errors.push('Qdrant URL is required');
            }
            if (!data.qdrantConfig.collectionName) {
                errors.push('Qdrant collection name is required');
            }
        }

        // Validate query configuration
        if (!data.queryConfig) {
            errors.push('Query configuration is required');
        } else {
            if (!data.queryConfig.inputTextField) {
                errors.push('Input text field is required');
            }
            if (data.queryConfig.similarityThreshold < 0 || data.queryConfig.similarityThreshold > 1) {
                errors.push('Similarity threshold must be between 0 and 1');
            }
            if (data.queryConfig.maxResults <= 0) {
                errors.push('Max results must be greater than 0');
            }
        }

        // Validate output configuration
        if (!data.outputConfig) {
            errors.push('Output configuration is required');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Execute RAG node to query knowledge base
     */
    async execute(context: WorkflowContext, node: WorkflowNodeQuery): Promise<ExecutionResult> {
        try {
            const data = node.config as RAGNodeData;
            const input = this.getNodeInput(context, node);

            // Extract query text
            const queryText = this.getNestedValue(input, data.queryConfig.inputTextField);
            if (!queryText || typeof queryText !== 'string') {
                throw new Error(`Query text not found or invalid at path: ${data.queryConfig.inputTextField}`);
            }

            // Get user context for filtering
            const userContext = this.extractUserContext(input, data.filterConfig);

            // Generate embedding for the query
            const queryEmbedding = await this.generateEmbedding(queryText, data.embeddingConfig);

            // Search in Qdrant
            const searchResults = await this.searchQdrant(
                data.qdrantConfig,
                queryEmbedding,
                data.queryConfig,
                userContext
            );

            // Process and format results
            const formattedResults = this.formatResults(searchResults, data.outputConfig);

            return {
                success: true,
                output: {
                    query: queryText,
                    results: formattedResults.results,
                    combinedContent: formattedResults.combinedContent,
                    totalResults: searchResults.length,
                    avgScore: searchResults.length > 0 
                        ? searchResults.reduce((sum, r) => sum + r.score, 0) / searchResults.length 
                        : 0,
                    timestamp: new Date().toISOString(),
                    metadata: {
                        collectionName: data.qdrantConfig.collectionName,
                        searchType: data.queryConfig.searchType,
                        threshold: data.queryConfig.similarityThreshold,
                        userContext
                    }
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }

    /**
     * Cleanup - no cleanup needed for RAG queries
     */
    async cleanup(_context: WorkflowContext, _node: WorkflowNodeQuery): Promise<void> {
        // No cleanup needed
    }

    /**
     * Get node input data (helper method)
     */
    private getNodeInput(context: WorkflowContext, node: WorkflowNodeQuery): any {
        // If this is an entry node, use the workflow variables as input
        if (context.metadata.processedWorkflow?.entryNodes?.includes(node.id)) {
            return context.variables;
        }

        // Otherwise, get input from predecessor nodes
        const adjacencyList = context.metadata.processedWorkflow?.adjacencyList || {};
        const predecessors: string[] = [];

        // Find all predecessor nodes
        Object.entries(adjacencyList).forEach(([sourceId, targets]) => {
            if (Array.isArray(targets) && targets.includes(node.id)) {
                predecessors.push(sourceId);
            }
        });

        // If there are no predecessors, return empty object
        if (predecessors.length === 0) {
            return {};
        }

        // If there's only one predecessor, return its output directly
        if (predecessors.length === 1) {
            const predecessorId = predecessors[0];
            return context.nodeResults[predecessorId]?.output || {};
        }

        // If there are multiple predecessors, return an object with outputs from all
        const input: Record<string, any> = {};
        predecessors.forEach(predecessorId => {
            const result = context.nodeResults[predecessorId];
            if (result && result.output) {
                input[predecessorId] = result.output;
            }
        });

        return input;
    }

    /**
     * Extract user context for filtering
     */
    private extractUserContext(input: any, filterConfig?: RAGNodeData['filterConfig']): Record<string, any> {
        const context: Record<string, any> = {};

        if (!filterConfig) {
            return context;
        }

        // Extract standard context fields
        if (filterConfig.tenantId) {
            context.tenantId = this.getNestedValue(input, 'tenantId') || filterConfig.tenantId;
        }
        if (filterConfig.companyId) {
            context.companyId = this.getNestedValue(input, 'companyId') || filterConfig.companyId;
        }
        if (filterConfig.category) {
            context.category = filterConfig.category;
        }

        // Extract custom filters
        if (filterConfig.customFilters) {
            filterConfig.customFilters.forEach(filter => {
                const value = this.getNestedValue(input, filter.field);
                if (value !== undefined) {
                    context[filter.field] = value;
                }
            });
        }

        return context;
    }

    /**
     * Generate embedding for query text
     */
    private async generateEmbedding(text: string, embeddingConfig?: RAGNodeData['embeddingConfig']): Promise<number[]> {
        const config = embeddingConfig || { model: 'sentence-transformers/all-MiniLM-L6-v2' };

        if (config.model === 'text-embedding-ada-002') {
            // Use OpenAI API
            if (!config.apiKey) {
                throw new Error('OpenAI API key is required for text-embedding-ada-002 model');
            }

            const response = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: config.model,
                    input: text
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.data[0].embedding;
        } else {
            // Use sentence-transformers model (would require a local service or API)
            // For now, return a placeholder - in real implementation, this would call
            // a sentence-transformers API or local service
            throw new Error('Sentence-transformers embedding not implemented yet. Please use OpenAI embeddings.');
        }
    }

    /**
     * Search in Qdrant vector database
     */
    private async searchQdrant(
        qdrantConfig: RAGNodeData['qdrantConfig'],
        queryEmbedding: number[],
        queryConfig: RAGNodeData['queryConfig'],
        userContext: Record<string, any>
    ): Promise<RAGResult[]> {
        const url = `${qdrantConfig.url}/collections/${qdrantConfig.collectionName}/points/search`;

        // Build search payload
        const searchPayload: any = {
            vector: queryEmbedding,
            limit: queryConfig.maxResults,
            score_threshold: queryConfig.similarityThreshold,
            with_payload: true,
            with_vector: false
        };

        // Add filters based on user context
        if (Object.keys(userContext).length > 0) {
            searchPayload.filter = {
                must: Object.entries(userContext).map(([key, value]) => ({
                    key: `metadata.${key}`,
                    match: { value }
                }))
            };
        }

        // Make request to Qdrant
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        if (qdrantConfig.apiKey) {
            headers['api-key'] = qdrantConfig.apiKey;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(searchPayload)
        });

        if (!response.ok) {
            throw new Error(`Qdrant search error: ${response.statusText}`);
        }

        const data = await response.json();

        // Transform Qdrant results to our format
        return data.result.map((item: any) => ({
            id: item.id,
            content: item.payload.content || item.payload.text || '',
            metadata: item.payload.metadata || {},
            score: item.score
        }));
    }

    /**
     * Format search results based on output configuration
     */
    private formatResults(results: RAGResult[], outputConfig: RAGNodeData['outputConfig']): {
        results: any[];
        combinedContent: string;
    } {
        // Process each result
        const formattedResults = results.map(result => {
            const formatted: any = {
                id: result.id,
                content: outputConfig.maxContentLength 
                    ? result.content.substring(0, outputConfig.maxContentLength)
                    : result.content
            };

            if (outputConfig.includeMetadata) {
                formatted.metadata = result.metadata;
            }

            if (outputConfig.includeScore) {
                formatted.score = result.score;
            }

            // Apply result template if provided
            if (outputConfig.resultTemplate) {
                formatted.formattedContent = this.applyTemplate(outputConfig.resultTemplate, {
                    content: formatted.content,
                    metadata: result.metadata,
                    score: result.score,
                    id: result.id
                });
            }

            return formatted;
        });

        // Combine results if requested
        let combinedContent = '';
        if (outputConfig.combineResults) {
            combinedContent = formattedResults
                .map(r => r.formattedContent || r.content)
                .join('\n\n---\n\n');
        }

        return {
            results: formattedResults,
            combinedContent
        };
    }

    /**
     * Apply template to format result
     */
    private applyTemplate(template: string, data: any): string {
        let result = template;
        
        // Replace placeholders like {{content}}, {{metadata.title}}, etc.
        const placeholderRegex = /\{\{([^}]+)\}\}/g;
        result = result.replace(placeholderRegex, (match, path) => {
            const value = this.getNestedValue(data, path.trim());
            return value !== undefined ? String(value) : match;
        });

        return result;
    }

    /**
     * Get nested value from object using dot notation
     */
    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }
}