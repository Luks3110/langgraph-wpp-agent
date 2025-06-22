/**
 * Node registry for managing workflow triggers and actions
 */

import type {
  TriggerNode,
  ActionNode,
  RegisteredNode,
  NodeCategory
} from "../types/nodes.js";

export class NodeRegistry {
  private triggers = new Map<string, RegisteredNode>();
  private actions = new Map<string, RegisteredNode>();

  /**
   * Register a trigger node
   */
  registerTrigger(type: string, node: TriggerNode): void {
    if (this.triggers.has(type)) {
      console.warn(
        `Trigger node "${type}" is already registered. Overwriting.`
      );
    }

    this.triggers.set(type, {
      node,
      type: "trigger",
      registeredAt: new Date()
    });

    console.log(`Registered trigger node: ${type} (${node.displayName})`);
  }

  /**
   * Register an action node
   */
  registerAction(type: string, node: ActionNode): void {
    if (this.actions.has(type)) {
      console.warn(`Action node "${type}" is already registered. Overwriting.`);
    }

    this.actions.set(type, {
      node,
      type: "action",
      registeredAt: new Date()
    });

    console.log(`Registered action node: ${type} (${node.displayName})`);
  }

  /**
   * Get a trigger node by type
   */
  getTrigger(type: string): TriggerNode | undefined {
    const registered = this.triggers.get(type);
    return registered?.node as TriggerNode;
  }

  /**
   * Get an action node by type
   */
  getAction(type: string): ActionNode | undefined {
    const registered = this.actions.get(type);
    return registered?.node as ActionNode;
  }

  /**
   * Check if a trigger exists
   */
  hasTrigger(type: string): boolean {
    return this.triggers.has(type);
  }

  /**
   * Check if an action exists
   */
  hasAction(type: string): boolean {
    return this.actions.has(type);
  }

  /**
   * Get all registered trigger types
   */
  listTriggers(): string[] {
    return Array.from(this.triggers.keys());
  }

  /**
   * Get all registered action types
   */
  listActions(): string[] {
    return Array.from(this.actions.keys());
  }

  /**
   * Get all registered node types
   */
  listAllNodes(): string[] {
    return [...this.listTriggers(), ...this.listActions()];
  }

  /**
   * Get trigger nodes by category
   */
  getTriggersByCategory(category: NodeCategory): RegisteredNode[] {
    return Array.from(this.triggers.values()).filter(
      (registered) => registered.node.category === category
    );
  }

  /**
   * Get action nodes by category
   */
  getActionsByCategory(category: NodeCategory): RegisteredNode[] {
    return Array.from(this.actions.values()).filter(
      (registered) => registered.node.category === category
    );
  }

  /**
   * Search nodes by name, displayName, or description
   */
  searchNodes(query: string): {
    triggers: RegisteredNode[];
    actions: RegisteredNode[];
  } {
    const searchTerm = query.toLowerCase();

    const matchesQuery = (node: TriggerNode | ActionNode): boolean => {
      return (
        node.name.toLowerCase().includes(searchTerm) ||
        node.displayName.toLowerCase().includes(searchTerm) ||
        node.description.toLowerCase().includes(searchTerm) ||
        (node.tags?.some((tag) => tag.toLowerCase().includes(searchTerm)) ??
          false)
      );
    };

    const triggers = Array.from(this.triggers.values()).filter((registered) =>
      matchesQuery(registered.node)
    );

    const actions = Array.from(this.actions.values()).filter((registered) =>
      matchesQuery(registered.node)
    );

    return { triggers, actions };
  }

  /**
   * Get detailed information about all registered nodes
   */
  getRegistryInfo(): {
    totalNodes: number;
    triggers: number;
    actions: number;
    categories: Record<NodeCategory, number>;
    nodes: Array<{
      type: string;
      nodeType: "trigger" | "action";
      displayName: string;
      description: string;
      version: string;
      category?: string;
      registeredAt: Date;
    }>;
  } {
    const triggerEntries = Array.from(this.triggers.entries()).map(
      ([nodeTypeName, registered]) => ({
        typeName: nodeTypeName,
        nodeType: "trigger" as const,
        node: registered.node,
        registeredAt: registered.registeredAt
      })
    );

    const actionEntries = Array.from(this.actions.entries()).map(
      ([nodeTypeName, registered]) => ({
        typeName: nodeTypeName,
        nodeType: "action" as const,
        node: registered.node,
        registeredAt: registered.registeredAt
      })
    );

    const allNodeEntries = [...triggerEntries, ...actionEntries];

    // Count nodes by category
    const categories: Record<string, number> = {};
    allNodeEntries.forEach(({ node }) => {
      if (node.category) {
        categories[node.category] = (categories[node.category] || 0) + 1;
      }
    });

    return {
      totalNodes: allNodeEntries.length,
      triggers: this.triggers.size,
      actions: this.actions.size,
      categories: categories as Record<NodeCategory, number>,
      nodes: allNodeEntries.map(
        ({ typeName, nodeType, node, registeredAt }) => ({
          type: typeName,
          nodeType,
          displayName: node.displayName,
          description: node.description,
          version: node.version,
          category: node.category,
          registeredAt
        })
      )
    };
  }

  /**
   * Unregister a trigger node
   */
  unregisterTrigger(type: string): boolean {
    const existed = this.triggers.has(type);
    this.triggers.delete(type);

    if (existed) {
      console.log(`Unregistered trigger node: ${type}`);
    }

    return existed;
  }

  /**
   * Unregister an action node
   */
  unregisterAction(type: string): boolean {
    const existed = this.actions.has(type);
    this.actions.delete(type);

    if (existed) {
      console.log(`Unregistered action node: ${type}`);
    }

    return existed;
  }

  /**
   * Clear all registered nodes
   */
  clear(): void {
    this.triggers.clear();
    this.actions.clear();
    console.log("Cleared all registered nodes");
  }

  /**
   * Validate a workflow definition against registered nodes
   */
  validateWorkflow(workflow: {
    trigger: { triggerType: string };
    steps: Record<string, { actionType: string }>;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate trigger
    if (!this.hasTrigger(workflow.trigger.triggerType)) {
      errors.push(`Unknown trigger type: ${workflow.trigger.triggerType}`);
    }

    // Validate actions
    for (const [stepName, step] of Object.entries(workflow.steps)) {
      if (!this.hasAction(step.actionType)) {
        errors.push(
          `Unknown action type in step "${stepName}": ${step.actionType}`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
