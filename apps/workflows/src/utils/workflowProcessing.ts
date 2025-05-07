/**
 * Map of node types to their corresponding queue names
 */
export const NODE_TYPE_QUEUE_MAP: Record<string, string> = {
    'agent': 'agent-execution',
    'message': 'message-processing',
    'api': 'api-request',
    'decision': 'decision-processing',
    'transform': 'data-transformation',
    'delay': 'scheduled-delay',
    'email': 'email-sending',
    'webhook': 'webhook-trigger',
    // Add more mappings as needed
    'default': 'workflow-node-execution' // Fallback queue
};

/**
 * Get the next nodes to execute in the workflow based on the current node
 */
export function getNextNodesFromWorkflow(workflow: any, currentNodeId: string): any[] {
    try {
        if (!workflow || !workflow.nodes || !workflow.edges) {
            return [];
        }

        // Parse nodes and edges if they're strings
        const nodes = typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : workflow.nodes;
        const edges = typeof workflow.edges === 'string' ? JSON.parse(workflow.edges) : workflow.edges;

        // Find edges that have the current node as the source
        const outgoingEdges = edges.filter((edge: any) => edge.source === currentNodeId || edge.sourceId === currentNodeId);

        if (!outgoingEdges || outgoingEdges.length === 0) {
            return [];
        }

        // Get the target node IDs
        const targetNodeIds = outgoingEdges.map((edge: any) => edge.target || edge.targetId);

        // Find the corresponding nodes
        const nextNodes = targetNodeIds
            .map((nodeId: string) => {
                const node = nodes.find((n: any) => n.id === nodeId);
                return node || null;
            })
            .filter((node: any) => node !== null);

        return nextNodes;
    } catch (error) {
        console.error(`Error extracting next nodes from workflow:`, error);
        return [];
    }
}

/**
 * Extract the node type from the node data
 */
export function getNodeType(node: any): string {
    if (!node) return 'unknown';

    // Different schemas might store type in different properties
    return node.type ||
        node.nodeType ||
        (node.data && node.data.type) ||
        (node.properties && node.properties.type) ||
        'unknown';
}

/**
 * Get the appropriate queue name for a node type
 */
export function getQueueNameForNodeType(nodeType: string): string {
    // Look up the queue name from the mapping, or use the default
    return NODE_TYPE_QUEUE_MAP[nodeType.toLowerCase()] || NODE_TYPE_QUEUE_MAP.default;
} 
