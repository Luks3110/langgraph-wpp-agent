/**
 * Types for workflow nodes and edges
 */
export type NodeType =
    'character'
    | 'knowledge'
    | 'testing'
    | 'deployment'
    | 'mercadolivreQa'
    | 'whatsapp'
    | 'function'
    | 'http'
    | 'decision'
    | 'webhook'
    | 'trigger'
    | 'delay'
    | 'transformation'
    | 'custom';

export interface NodePosition {
    x: number;
    y: number;
}

export interface NodeData {
    [key: string]: any;
}

export interface NodeMetadata {
    createdAt?: Date;
    updatedAt?: Date;
    createdBy?: string;
    tags?: string[];
    category?: string;
    isPublic?: boolean;
    status?: 'draft' | 'published' | 'deprecated';
    revision?: number;
}

/**
 * Extended node data with task execution information
 */
export interface ExecutableNodeData extends NodeData {
    taskDefinition: {
        type: 'function' | 'http' | 'custom' | 'webhook';
        name: string;
        config: Record<string, any>;
        functionName?: string;
        handlerId?: string;
        timeout?: number;
        retryPolicy?: {
            maxAttempts: number;
            backoffStrategy: 'fixed' | 'exponential';
            initialDelay: number;
        };
    };
    inputMapping?: Record<string, string>;
    outputMapping?: Record<string, string>;
}

/**
 * Webhook specific node data
 */
export interface WebhookNodeData extends NodeData {
    provider?: string;
    webhookUrl?: string;
    payloadSchema?: Record<string, any>;
    transformationTemplate?: string;
    webhookId?: string;
    responseTemplate?: string;
    validateSignature?: boolean;
    signatureHeader?: string;
    secretKey?: string;
}

/**
 * MercadoLivre QA specific node data
 */
export interface MercadoLivreQANodeData extends WebhookNodeData {
    apiConfigured: boolean;
    rulesCount: number;
    defaultResponseSet: boolean;
    responseDelay: string;
    rules?: Array<{
        id: string;
        condition: string;
        response: string;
        priority: number;
    }>;
}

/**
 * WhatsApp specific node data
 */
export interface WhatsAppNodeData extends WebhookNodeData {
    apiConfigured: boolean;
    phoneNumberConfigured: boolean;
    messageTemplatesCount: number;
    autoReplyEnabled: boolean;
    responseDelay?: string;
    accessToken?: string;
    phoneNumberId?: string;
    appSecret?: string;
    webhookVerifyToken?: string;
    autoReplyMessage?: string;
    autoReplyKeywords?: string;
    agentEnabled?: boolean;
}

/**
 * Instagram specific node data
 */
export interface InstagramNodeData extends WebhookNodeData {
    name: string;
    apiConfigured: boolean;
    accessToken: string;
    igBusinessId: string;
    webhookVerifyToken: string;
    webhookSecret: string;
    messageEvents: string[];
    reactionEvents: boolean;
    postbackEvents: boolean;
    seenEvents: boolean;
    referralEvents: boolean;
}

export interface AgentWorkflow {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    status: "draft" | "active" | "archived";
    version: string;
    workflow: {
        forest: {
            roots: string[];
            adjacencyList: Record<
                string,
                {
                    children: string[];
                    parents: string[];
                    depth: number; // Depth in the tree for efficient sorting
                    pathIndices: number[]; // Which paths this node belongs to
                }
            >;
        };
        nodes: Record<
            string,
            {
                id: string;
                type: NodeType;
                name: string;
                position: { x: number; y: number };
                data: Record<string, any>;
                metadata?: {
                    createdAt?: Date;
                    updatedAt?: Date;
                    createdBy?: string;
                    tags?: string[];
                    status?: "draft" | "published" | "deprecated";
                };
                version?: number;
                workflowId?: string;
            }
        >;
        // Execution paths through the workflow
        paths: Array<{
            id: string;
            name: string;
            rootId: string; // The entry point for this path
            nodeSequence: string[]; // Pre-computed optimal traversal
        }>;
        // Visual representation for the UI
        edges: Record<
            string,
            {
                id: string;
                source: string;
                target: string;
                label?: string;
                type?: "success" | "failure" | "default";
                condition?: string;
            }
        >;
        execution: {
            branchPoints: string[];
            leafNodes: string[];
            convergencePoints: string[];
            parallelExecutionGroups: string[][];
            metadata?: any;
        };
    };
    metadata: {
        tags: string[];
        author: string;
        lastRun?: string;
        runCount: number;
        avgExecutionTime?: number;
        environment: "development" | "staging" | "production";
    };
}

export interface WorkflowNode {
    id: string;
    type: NodeType;
    name: string;
    position: NodePosition;
    data: NodeData;
    metadata?: NodeMetadata;
    version?: number;
    workflowId?: string;
}

export interface WorkflowEdge {
    id: string;
    source: string;
    target: string;
    label?: string;
    type?: 'success' | 'failure' | 'default';
    condition?: string;
}

export interface GraphNodeRelationship {
    children: string[];
    parents: string[];
    depth: number;
    pathIndices: number[];
}

export interface WorkflowPath {
    id: string;
    name: string;
    rootId: string;
    nodeSequence: string[];
}

/**
 * Execution metadata for the workflow engine
 */
export interface ExecutionMetadata {
    executionOrder: string[];  // Topologically sorted execution sequence
    taskMapping: Record<string, string>; // Maps node IDs to function names
    conditionalBranches: Record<string, {
        nodeId: string;
        outgoingEdges: string[];
        conditionHandler: string;
    }>;
    executionGroups: {
        sequential: string[][];   // Groups of nodes that must run in sequence
        parallel: string[][];     // Groups of nodes that can run in parallel
        synchronization: Record<string, string[]>; // Convergence points and their required predecessors
    };
}

export interface ProcessedWorkflow {
    forest: {
        roots: string[];
        adjacencyList: Record<string, GraphNodeRelationship>;
    };
    nodes: Record<string, WorkflowNode>;
    paths: WorkflowPath[];
    edges: Record<string, WorkflowEdge>;
    execution: {
        branchPoints: string[];
        leafNodes: string[];
        convergencePoints: string[];
        parallelExecutionGroups: string[][];
        metadata?: ExecutionMetadata;
    };
}

/**
 * WorkflowGraph class - Responsible for processing workflow graphs, 
 * building adjacency lists, and identifying execution paths
 */
export class WorkflowGraph {
    private nodes: WorkflowNode[];
    private edges: WorkflowEdge[];
    private adjacencyList: Record<string, GraphNodeRelationship> = {};
    private rootNodes: string[] = [];
    private leafNodes: string[] = [];
    private branchPoints: string[] = [];
    private convergencePoints: string[] = [];

    /**
     * Constructor initializes the graph with nodes and edges
     */
    constructor(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
        this.nodes = nodes;
        this.edges = edges;
    }

    /**
     * Process the workflow to build adjacency lists and identify paths
     */
    public processWorkflow(): ProcessedWorkflow {
        this.buildAdjacencyList();
        this.findRootNodes();
        this.calculateNodeDepths();
        this.findBranchPoints();
        this.findLeafNodes();
        this.findConvergencePoints();

        const paths = this.generateAllPaths();
        this.updatePathIndices(paths);

        // Check for orphaned nodes and add them to paths if needed
        const orphanedNodes = this.findOrphanedNodes(paths);
        if (orphanedNodes.length > 0) {
            paths.push(this.createOrphanedPath(orphanedNodes));
        }

        // Identify parallel execution groups
        const parallelExecutionGroups = this.identifyParallelExecutionGroups();

        // Generate execution metadata for workflow engine
        const executionMetadata = this.generateExecutionMetadata();

        // Return the processed workflow with all necessary data
        return {
            forest: {
                roots: this.rootNodes,
                adjacencyList: this.adjacencyList
            },
            nodes: this.nodes.reduce((acc, node) => {
                acc[node.id] = {
                    id: node.id,
                    type: node.type,
                    name: node.name || `${node.type} Node`,
                    position: node.position,
                    data: node.data,
                    metadata: node.metadata || this.generateDefaultMetadata(),
                    version: node.version || 1,
                    workflowId: node.workflowId
                };
                return acc;
            }, {} as Record<string, WorkflowNode>),
            paths,
            edges: this.edges.reduce((acc, edge) => {
                acc[edge.id] = {
                    id: edge.id,
                    source: edge.source,
                    target: edge.target,
                    label: typeof edge.label === 'string' ? edge.label : undefined,
                    type: edge.type || 'default',
                    condition: edge.condition
                };
                return acc;
            }, {} as Record<string, WorkflowEdge>),
            execution: {
                branchPoints: this.branchPoints,
                leafNodes: this.leafNodes,
                convergencePoints: this.convergencePoints,
                parallelExecutionGroups,
                metadata: executionMetadata
            }
        };
    }

    /**
     * Generate default metadata for nodes that don't have it
     */
    private generateDefaultMetadata(): NodeMetadata {
        return {
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'system',
            status: 'draft'
        };
    }

    /**
     * Generate execution metadata for the workflow engine
     */
    public generateExecutionMetadata(): ExecutionMetadata {
        // Create a topologically sorted execution order
        const executionOrder = this.createTopologicalSort();

        // Map nodes to task functions
        const taskMapping: Record<string, string> = {};
        this.nodes.forEach(node => {
            // Check if node data has taskDefinition (using type assertion)
            const executableData = node.data as Partial<ExecutableNodeData>;
            if (executableData.taskDefinition?.functionName) {
                taskMapping[node.id] = executableData.taskDefinition.functionName;
            } else {
                // Default mapping based on node type if no specific function is defined
                taskMapping[node.id] = `execute${node.type.charAt(0).toUpperCase() + node.type.slice(1)}Node`;
            }
        });

        // Identify conditional branches and their handlers
        const conditionalBranches: Record<string, {
            nodeId: string;
            outgoingEdges: string[];
            conditionHandler: string;
        }> = {};

        this.branchPoints.forEach(nodeId => {
            const node = this.adjacencyList[nodeId];
            if (node) {
                const outgoingEdges = this.edges
                    .filter(edge => edge.source === nodeId)
                    .map(edge => edge.id);

                // Get condition handler from node data
                const nodeData = this.nodes.find(n => n.id === nodeId)?.data as Partial<ExecutableNodeData>;
                conditionalBranches[nodeId] = {
                    nodeId,
                    outgoingEdges,
                    conditionHandler: nodeData.taskDefinition?.handlerId || 'defaultConditionHandler'
                };
            }
        });

        // Group nodes for execution planning
        const sequentialGroups: string[][] = this.identifySequentialExecutionGroups();

        return {
            executionOrder,
            taskMapping,
            conditionalBranches,
            executionGroups: {
                sequential: sequentialGroups,
                parallel: this.identifyParallelExecutionGroups(),
                synchronization: this.createSynchronizationMap()
            }
        };
    }

    /**
     * Create a topologically sorted order of nodes for execution
     */
    private createTopologicalSort(): string[] {
        const visited = new Set<string>();
        const sorted: string[] = [];

        const visit = (nodeId: string) => {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);

            const node = this.adjacencyList[nodeId];
            if (node) {
                // Visit all children first (depth-first)
                node.children.forEach(childId => visit(childId));
                // Add current node after all dependencies
                sorted.unshift(nodeId);
            }
        };

        // Start with root nodes
        this.rootNodes.forEach(rootId => visit(rootId));

        return sorted;
    }

    /**
     * Create synchronization map for convergence points
     */
    private createSynchronizationMap(): Record<string, string[]> {
        const syncMap: Record<string, string[]> = {};

        this.convergencePoints.forEach(nodeId => {
            const node = this.adjacencyList[nodeId];
            if (node) {
                syncMap[nodeId] = [...node.parents];
            }
        });

        return syncMap;
    }

    /**
     * Identify groups of nodes that must execute sequentially
     */
    private identifySequentialExecutionGroups(): string[][] {
        const sequentialGroups: string[][] = [];

        // Identify linear paths (no branching, no convergence)
        this.generateAllPaths().forEach(path => {
            const nodeSequence = path.nodeSequence;
            const linearSegments: string[][] = [];
            let currentSegment: string[] = [];

            for (let i = 0; i < nodeSequence.length; i++) {
                const nodeId = nodeSequence[i];

                // If node is not a branch point or convergence point, add to current segment
                if (!this.branchPoints.includes(nodeId) && !this.convergencePoints.includes(nodeId)) {
                    currentSegment.push(nodeId);
                } else {
                    // End current segment if it has nodes
                    if (currentSegment.length > 0) {
                        linearSegments.push([...currentSegment]);
                        currentSegment = [];
                    }

                    // Add the branch/convergence point as its own segment
                    linearSegments.push([nodeId]);
                }
            }

            // Add any remaining nodes in the segment
            if (currentSegment.length > 0) {
                linearSegments.push([...currentSegment]);
            }

            sequentialGroups.push(...linearSegments);
        });

        // Filter out duplicate segments
        return this.removeDuplicateArrays(sequentialGroups);
    }

    /**
     * Utility function to remove duplicate arrays from an array of arrays
     */
    private removeDuplicateArrays(arrays: string[][]): string[][] {
        const stringified = arrays.map(arr => JSON.stringify(arr));
        const unique = [...new Set(stringified)];
        return unique.map(str => JSON.parse(str));
    }

    /**
     * Build adjacency list from nodes and edges
     */
    private buildAdjacencyList(): void {
        // Initialize adjacency list for all nodes
        this.nodes.forEach(node => {
            this.adjacencyList[node.id] = {
                children: [],
                parents: [],
                depth: -1,
                pathIndices: []
            };
        });

        // Populate relationships based on edges
        this.edges.forEach(edge => {
            const sourceNode = this.adjacencyList[edge.source];
            const targetNode = this.adjacencyList[edge.target];

            if (sourceNode && !sourceNode.children.includes(edge.target)) {
                sourceNode.children.push(edge.target);
            }

            if (targetNode && !targetNode.parents.includes(edge.source)) {
                targetNode.parents.push(edge.source);
            }
        });
    }

    /**
     * Find root nodes (entry points) with no parents
     */
    private findRootNodes(): void {
        this.rootNodes = Object.entries(this.adjacencyList)
            .filter(([_, node]) => node.parents.length === 0)
            .map(([id]) => id);

        // Create a default root if none exists
        if (this.rootNodes.length === 0 && this.nodes.length > 0) {
            this.rootNodes.push(this.nodes[0].id);
        }
    }

    /**
     * Calculate depth of each node using BFS
     */
    private calculateNodeDepths(): void {
        const visited = new Set<string>();
        const queue: Array<{ id: string; depth: number }> =
            this.rootNodes.map(id => ({ id, depth: 0 }));

        while (queue.length > 0) {
            const { id, depth } = queue.shift()!;

            if (!visited.has(id)) {
                visited.add(id);
                const node = this.adjacencyList[id];

                if (node) {
                    node.depth = Math.max(node.depth, depth);

                    node.children.forEach(childId => {
                        queue.push({ id: childId, depth: depth + 1 });
                    });
                }
            }
        }
    }

    /**
     * Find branch points (nodes with multiple children)
     */
    private findBranchPoints(): void {
        this.branchPoints = Object.entries(this.adjacencyList)
            .filter(([_, node]) => node.children.length > 1)
            .map(([id]) => id);
    }

    /**
     * Find leaf nodes (nodes with no children)
     */
    private findLeafNodes(): void {
        this.leafNodes = Object.entries(this.adjacencyList)
            .filter(([_, node]) => node.children.length === 0)
            .map(([id]) => id);
    }

    /**
     * Find convergence points (nodes with multiple parents)
     * These are points where multiple branches merge back
     */
    private findConvergencePoints(): void {
        this.convergencePoints = Object.entries(this.adjacencyList)
            .filter(([_, node]) => node.parents.length > 1)
            .map(([id]) => id);
    }

    /**
     * Identify groups of nodes that can be executed in parallel
     * These are nodes that are independent of each other in the workflow
     */
    private identifyParallelExecutionGroups(): string[][] {
        const parallelGroups: string[][] = [];

        // For each branch point, identify nodes in each branch that can run in parallel
        this.branchPoints.forEach(branchPointId => {
            const node = this.adjacencyList[branchPointId];

            if (node) {
                // For branch points with multiple children, group immediate children
                if (node.children.length > 1) {
                    // Create a group of child nodes that can be executed in parallel
                    const parallelGroup = [...node.children];

                    // Check if this group is non-empty and doesn't have dependencies between its members
                    // (children of the same parent don't directly depend on each other)
                    if (parallelGroup.length > 1) {
                        // Check whether these nodes converge at a common point
                        const commonConvergencePoint = this.findCommonConvergencePoint(parallelGroup);

                        if (commonConvergencePoint) {
                            // Add metadata to identify the branch and convergence points
                            parallelGroups.push(parallelGroup);
                        }
                    }
                }
            }
        });

        return parallelGroups;
    }

    /**
     * Find a common convergence point for a group of nodes
     * Returns the ID of the common convergence point, or null if none exists
     */
    private findCommonConvergencePoint(nodeIds: string[]): string | null {
        // For each node, collect all its descendants
        const descendantSets = nodeIds.map(nodeId => {
            const descendants = new Set<string>();
            this.collectDescendants(nodeId, descendants);
            return descendants;
        });

        // Find nodes that appear in multiple descendant sets
        // These are potential convergence points
        const commonDescendants = new Set<string>();

        // Initialize with the first set's descendants
        if (descendantSets.length > 0) {
            descendantSets[0].forEach(id => commonDescendants.add(id));

            // Intersect with other sets
            for (let i = 1; i < descendantSets.length; i++) {
                const currentSet = descendantSets[i];
                const toRemove: string[] = [];

                commonDescendants.forEach(id => {
                    if (!currentSet.has(id)) {
                        toRemove.push(id);
                    }
                });

                toRemove.forEach(id => commonDescendants.delete(id));
            }
        }

        // Find the convergence point with the minimum depth (closest to the branches)
        let minDepth = Infinity;
        let closestConvergencePoint: string | null = null;

        commonDescendants.forEach(id => {
            const node = this.adjacencyList[id];
            if (node && node.parents.length > 1 && node.depth < minDepth) {
                minDepth = node.depth;
                closestConvergencePoint = id;
            }
        });

        return closestConvergencePoint;
    }

    /**
     * Collect all descendants of a node using DFS
     */
    private collectDescendants(nodeId: string, descendants: Set<string>): void {
        const node = this.adjacencyList[nodeId];
        if (!node) return;

        node.children.forEach(childId => {
            if (!descendants.has(childId)) {
                descendants.add(childId);
                this.collectDescendants(childId, descendants);
            }
        });
    }

    /**
     * Generate all paths from roots to leaves using DFS
     * Enhanced to prioritize paths through branch points
     */
    private generateAllPaths(): WorkflowPath[] {
        const allPaths: WorkflowPath[] = [];

        // For each root node
        this.rootNodes.forEach((rootId, rootIndex) => {
            // For each leaf, find all paths from root to leaf
            const pathsFromRoot: string[][] = [];

            // Enhanced DFS that prioritizes paths through important branch points
            const findPaths = (
                currentId: string,
                visited: Set<string> = new Set(),
                currentPath: string[] = []
            ) => {
                // Add current node to path
                const newPath = [...currentPath, currentId];
                const newVisited = new Set(visited);
                newVisited.add(currentId);

                const node = this.adjacencyList[currentId];

                // If leaf node, we've found a complete path
                if (!node || node.children.length === 0) {
                    pathsFromRoot.push(newPath);
                    return;
                }

                // Sort children to prioritize important branch points first
                const sortedChildren = [...node.children].sort((a, b) => {
                    const aIsBranchPoint = this.branchPoints.includes(a) ? 1 : 0;
                    const bIsBranchPoint = this.branchPoints.includes(b) ? 1 : 0;

                    // Prioritize branch points
                    if (aIsBranchPoint !== bIsBranchPoint) {
                        return bIsBranchPoint - aIsBranchPoint;
                    }

                    // If neither or both are branch points, sort by node depth
                    const nodeA = this.adjacencyList[a];
                    const nodeB = this.adjacencyList[b];
                    return (nodeA?.depth || 0) - (nodeB?.depth || 0);
                });

                // Continue DFS for each child
                sortedChildren.forEach(childId => {
                    // Avoid cycles
                    if (!newVisited.has(childId)) {
                        findPaths(childId, newVisited, newPath);
                    }
                });
            };

            // Start DFS from root
            findPaths(rootId);

            // Convert paths to proper format and add to collection
            pathsFromRoot.forEach((sequence, pathIndex) => {
                allPaths.push({
                    id: `path-${rootId}-${pathIndex}`,
                    name: `Path ${rootIndex + 1}.${pathIndex + 1}`,
                    rootId,
                    nodeSequence: sequence
                });
            });
        });

        return allPaths;
    }

    /**
     * Update pathIndices in adjacencyList
     */
    private updatePathIndices(paths: WorkflowPath[]): void {
        paths.forEach((path, pathIndex) => {
            path.nodeSequence.forEach(nodeId => {
                const node = this.adjacencyList[nodeId];
                if (node && !node.pathIndices.includes(pathIndex)) {
                    node.pathIndices.push(pathIndex);
                }
            });
        });
    }

    /**
     * Find orphaned nodes not in any path
     */
    private findOrphanedNodes(paths: WorkflowPath[]): string[] {
        const allPathNodes = new Set(paths.flatMap(path => path.nodeSequence));
        return this.nodes.map(node => node.id).filter(id => !allPathNodes.has(id));
    }

    /**
     * Create a path for orphaned nodes
     */
    private createOrphanedPath(orphanedNodes: string[]): WorkflowPath {
        return {
            id: 'path-orphaned',
            name: 'Orphaned Nodes',
            rootId: orphanedNodes[0],
            nodeSequence: orphanedNodes
        };
    }
} 
