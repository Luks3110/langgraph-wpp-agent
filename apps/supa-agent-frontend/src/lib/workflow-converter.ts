/**
 * Workflow converter utility to transform flow editor data to workflow engine format
 */

import {
  ActionStep,
  FlowEdge,
  FlowNode,
  FlowWorkflow,
  NODE_TYPE_MAPPINGS,
  NodeTypeKey,
  TriggerStep,
  WorkflowCreatePayload,
  WorkflowDefinition
} from "@/types/workflow";

export class WorkflowConverter {
  /**
   * Convert flow editor data to workflow engine format
   */
  static convertFlowToWorkflow(flow: FlowWorkflow): WorkflowCreatePayload {
    console.log("Converting flow to workflow:", flow);

    // Find the trigger node (should be the first node or explicitly marked)
    const triggerNode = this.findTriggerNode(flow.nodes);
    console.log("Found trigger node:", triggerNode);

    if (!triggerNode) {
      throw new Error("Workflow must have at least one trigger node");
    }

    // Build the workflow definition
    const trigger = this.convertNodeToTrigger(triggerNode, flow.edges);
    const steps = this.convertNodesToSteps(
      flow.nodes,
      flow.edges,
      triggerNode.id
    );

    const definition: Omit<WorkflowDefinition, "id"> = {
      name: flow.name,
      description: flow.description,
      version: flow.version || 1,
      trigger,
      steps
    };

    return {
      name: flow.name,
      description: flow.description,
      definition
    };
  }

  /**
   * Convert workflow engine format back to flow editor data
   */
  static convertWorkflowToFlow(workflow: any): FlowWorkflow {
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];

    // Convert trigger to node
    if (workflow.definition?.trigger) {
      const triggerNode = this.convertTriggerToNode(
        workflow.definition.trigger
      );
      nodes.push(triggerNode);
    }

    // Convert steps to nodes
    if (workflow.definition?.steps) {
      const stepNodes = this.convertStepsToNodes(workflow.definition.steps);
      nodes.push(...stepNodes);
    }

    // Build edges from nextAction relationships
    edges.push(...this.buildEdgesFromSteps(workflow.definition));

    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      nodes,
      edges,
      status: workflow.status,
      version: workflow.version,
      createdAt: workflow.created_at,
      updatedAt: workflow.updated_at
    };
  }

  /**
   * Find the trigger node in the flow
   */
  private static findTriggerNode(nodes: FlowNode[]): FlowNode | null {
    // Look for nodes that are marked as triggers
    const triggerNode = nodes.find((node) => {
      const mapping = NODE_TYPE_MAPPINGS[node.type as NodeTypeKey];
      return mapping?.category === "trigger";
    });

    if (triggerNode) return triggerNode;

    // Fallback: find nodes with no incoming edges (root nodes)
    // This is a simplified approach - in a real implementation, you'd want more sophisticated logic
    return nodes[0] || null;
  }

  /**
   * Convert a flow node to a trigger step
   */
  private static convertNodeToTrigger(
    node: FlowNode,
    edges: FlowEdge[]
  ): TriggerStep {
    const mapping = NODE_TYPE_MAPPINGS[node.type as NodeTypeKey];
    const engineType = mapping?.engineType || node.type;

    // Find the next action for this trigger node
    const outgoingEdge = edges.find((edge) => edge.source === node.id);
    const nextAction = outgoingEdge?.target;

    return {
      name: node.id,
      displayName: node.data.name || `${node.type} Trigger`,
      type: "TRIGGER",
      triggerType: engineType,
      settings: this.extractNodeSettings(node),
      nextAction
    };
  }

  /**
   * Convert flow nodes to action steps
   */
  private static convertNodesToSteps(
    nodes: FlowNode[],
    edges: FlowEdge[],
    triggerNodeId: string
  ): Record<string, ActionStep> {
    const steps: Record<string, ActionStep> = {};

    // Filter out the trigger node
    const actionNodes = nodes.filter((node) => node.id !== triggerNodeId);

    for (const node of actionNodes) {
      const mapping = NODE_TYPE_MAPPINGS[node.type as NodeTypeKey];
      const engineType = mapping?.engineType || node.type;

      // Find the next action for this node
      const outgoingEdge = edges.find((edge) => edge.source === node.id);
      const nextAction = outgoingEdge?.target;

      steps[node.id] = {
        name: node.id,
        displayName: node.data.name || `${node.type} Action`,
        type: "ACTION",
        actionType: engineType,
        settings: this.extractNodeSettings(node),
        nextAction
      };
    }

    return steps;
  }

  /**
   * Extract settings from a flow node based on its type
   */
  private static extractNodeSettings(node: FlowNode): Record<string, any> {
    const settings: Record<string, any> = { ...node.data };

    // Type-specific setting transformations
    switch (node.type) {
      case "webhook":
      case "webhook-trigger":
        // For webhook triggers, use the webhookId from the configuration
        return {
          webhookUrl:
            settings.webhookUrl || `/webhooks/${settings.webhookId || node.id}`,
          secretKey: settings.secretKey,
          method: settings.method || "POST",
          headers: settings.headers || {},
          timeout: settings.timeout || 30
        };

      case "http":
        return {
          url: settings.url || "",
          method: settings.method || "GET",
          headers: settings.headers || {},
          body: settings.payload || settings.body,
          timeout: settings.timeout || 30
        };

      case "transform":
        return {
          inputData: settings.inputData || "{{trigger.output}}",
          transformScript: settings.transformScript || "return data;"
        };

      case "delay":
        return {
          duration: settings.duration || 1000,
          unit: settings.unit || "milliseconds"
        };

      case "log":
        return {
          message: settings.message || "{{trigger.output}}",
          level: settings.level || "info"
        };

      case "condition":
        return {
          condition: settings.condition || "true",
          onTrue: settings.onTrue,
          onFalse: settings.onFalse
        };

      // Legacy node type conversions
      case "character":
        return {
          inputData: "{{trigger.output}}",
          transformScript: `
            return {
              character: {
                name: "${settings.name || "Character"}",
                personality: "${settings.personality || "Default"}"
              },
              processedData: data
            };
          `
        };

      case "knowledge":
        return {
          inputData: "{{trigger.output}}",
          transformScript: `
            return {
              knowledge: {
                domain: "${settings.domain || "General"}",
                sources: "${settings.sources || "None"}"
              },
              processedData: data
            };
          `
        };

      case "whatsapp":
      case "instagram":
      case "mercadolivreQa":
        return {
          url: settings.apiUrl || `https://api.${node.type}.com/send`,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.accessToken || ""}`
          },
          body: {
            message: "{{trigger.output.message}}",
            recipient: "{{trigger.output.recipient}}",
            ...settings
          }
        };

      default:
        return settings;
    }
  }

  /**
   * Convert trigger step back to flow node
   */
  private static convertTriggerToNode(trigger: TriggerStep): FlowNode {
    return {
      id: trigger.name,
      type: this.engineTypeToFlowType(trigger.triggerType, "trigger"),
      position: { x: 100, y: 100 }, // Default position
      data: {
        name: trigger.displayName,
        ...trigger.settings
      }
    };
  }

  /**
   * Convert action steps back to flow nodes
   */
  private static convertStepsToNodes(
    steps: Record<string, ActionStep>
  ): FlowNode[] {
    return Object.entries(steps).map(([stepId, step], index) => ({
      id: stepId,
      type: this.engineTypeToFlowType(step.actionType, "action"),
      position: {
        x: 300 + (index % 3) * 250,
        y: 100 + Math.floor(index / 3) * 150
      },
      data: {
        name: step.displayName,
        ...step.settings
      }
    }));
  }

  /**
   * Build edges from workflow step relationships
   */
  private static buildEdgesFromSteps(definition: any): FlowEdge[] {
    const edges: FlowEdge[] = [];

    // Add edge from trigger to first step
    if (definition.trigger?.nextAction) {
      edges.push({
        id: `${definition.trigger.name}-${definition.trigger.nextAction}`,
        source: definition.trigger.name,
        target: definition.trigger.nextAction,
        animated: true
      });
    }

    // Add edges between steps
    if (definition.steps) {
      Object.entries(definition.steps).forEach(
        ([stepId, step]: [string, any]) => {
          if (step.nextAction) {
            edges.push({
              id: `${stepId}-${step.nextAction}`,
              source: stepId,
              target: step.nextAction,
              animated: true
            });
          }
        }
      );
    }

    return edges;
  }

  /**
   * Convert engine type back to flow type
   */
  private static engineTypeToFlowType(
    engineType: string,
    category: string
  ): string {
    // Reverse lookup in NODE_TYPE_MAPPINGS
    for (const [flowType, mapping] of Object.entries(NODE_TYPE_MAPPINGS)) {
      if (mapping.engineType === engineType && mapping.category === category) {
        return flowType;
      }
    }

    // Fallback mappings
    const fallbackMappings: Record<string, string> = {
      webhook: "webhook",
      schedule: "schedule",
      manual: "manual",
      "http-request": "http",
      "data-transformer": "transform",
      delay: "delay",
      log: "log",
      condition: "condition"
    };

    return fallbackMappings[engineType] || engineType;
  }

  /**
   * Validate workflow before conversion
   */
  static validateFlow(flow: FlowWorkflow): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check if workflow has a name
    if (!flow.name?.trim()) {
      errors.push("Workflow must have a name");
    }

    // Check if workflow has nodes
    if (!flow.nodes || flow.nodes.length === 0) {
      errors.push("Workflow must have at least one node");
    }

    // Check if workflow has a trigger
    const triggerNode = this.findTriggerNode(flow.nodes);
    if (!triggerNode) {
      errors.push("Workflow must have at least one trigger node");
    }

    // Check for disconnected nodes (optional warning)
    const connectedNodeIds = new Set<string>();
    flow.edges.forEach((edge) => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });

    const disconnectedNodes = flow.nodes.filter(
      (node) => !connectedNodeIds.has(node.id) && flow.nodes.length > 1
    );

    if (disconnectedNodes.length > 0) {
      errors.push(
        `Disconnected nodes found: ${disconnectedNodes.map((n) => n.data.name || n.id).join(", ")}`
      );
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
