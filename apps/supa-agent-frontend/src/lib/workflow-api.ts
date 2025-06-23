/**
 * Workflow API service for communicating with the workflow engine
 */

import {
  Workflow,
  WorkflowCreatePayload,
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowExecutionListResponse,
  WorkflowListResponse,
  WorkflowUpdatePayload
} from "@/types/workflow";

const WORKFLOW_API_BASE =
  process.env.NEXT_PUBLIC_WORKFLOW_API_URL || "http://localhost:3005";

// Function to get authentication token
async function getAuthToken(): Promise<string | null> {
  if (typeof window === "undefined") {
    // Server-side: We'll need to pass the token explicitly
    console.log("Server-side: Cannot get auth token automatically");
    return null;
  }

  // Client-side: Get token from Supabase
  try {
    console.log("Client-side: Attempting to get auth token...");
    const { createClient } = await import("../../supabase/client");
    const supabase = createClient();
    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    if (error) {
      console.error("Error getting session:", error);
      return null;
    }

    if (!session) {
      console.log("No active session found");
      return null;
    }

    if (!session.access_token) {
      console.log("Session found but no access token");
      return null;
    }

    console.log("Successfully retrieved auth token");
    return session.access_token;
  } catch (error) {
    console.error("Error getting auth token:", error);
    return null;
  }
}

class WorkflowAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: any
  ) {
    super(message);
    this.name = "WorkflowAPIError";
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  authToken?: string
): Promise<T> {
  const url = `${WORKFLOW_API_BASE}${endpoint}`;

  // Get auth token if not provided
  const token = authToken || (await getAuthToken());

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>)
  };

  // Add authorization header if token is available
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    console.log("Making API request with auth token to:", url);
  } else {
    console.warn("Making API request WITHOUT auth token to:", url);
  }

  const response = await fetch(url, {
    headers,
    ...options
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("API request failed:", {
      url,
      status: response.status,
      statusText: response.statusText,
      error: errorData,
      hasAuthToken: !!token
    });

    throw new WorkflowAPIError(
      errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      errorData
    );
  }

  return response.json();
}

export class WorkflowAPI {
  /**
   * List all workflows
   */
  static async listWorkflows(params?: {
    status?: "active" | "inactive" | "archived";
    limit?: number;
    offset?: number;
    authToken?: string;
  }): Promise<WorkflowListResponse> {
    const searchParams = new URLSearchParams();

    if (params?.status) searchParams.set("status", params.status);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());

    const query = searchParams.toString();
    const endpoint = `/api/workflows${query ? `?${query}` : ""}`;

    return apiRequest<WorkflowListResponse>(endpoint, {}, params?.authToken);
  }

  /**
   * Get a specific workflow by ID
   */
  static async getWorkflow(id: string, authToken?: string): Promise<Workflow> {
    return apiRequest<Workflow>(`/api/workflows/${id}`, {}, authToken);
  }

  /**
   * Create a new workflow
   */
  static async createWorkflow(
    payload: WorkflowCreatePayload,
    authToken?: string
  ): Promise<Workflow> {
    return apiRequest<Workflow>(
      "/api/workflows",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      authToken
    );
  }

  /**
   * Update an existing workflow
   */
  static async updateWorkflow(
    id: string,
    payload: WorkflowUpdatePayload,
    authToken?: string
  ): Promise<Workflow> {
    return apiRequest<Workflow>(
      `/api/workflows/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(payload)
      },
      authToken
    );
  }

  /**
   * Delete a workflow
   */
  static async deleteWorkflow(id: string, authToken?: string): Promise<void> {
    return apiRequest<void>(
      `/api/workflows/${id}`,
      {
        method: "DELETE"
      },
      authToken
    );
  }

  /**
   * Execute a workflow manually
   */
  static async executeWorkflow(
    id: string,
    triggerPayload: any = {},
    authToken?: string
  ): Promise<WorkflowExecution> {
    return apiRequest<WorkflowExecution>(
      `/api/workflows/${id}/execute`,
      {
        method: "POST",
        body: JSON.stringify(triggerPayload)
      },
      authToken
    );
  }

  /**
   * Activate a workflow
   */
  static async activateWorkflow(
    id: string,
    authToken?: string
  ): Promise<Workflow> {
    return apiRequest<Workflow>(
      `/api/workflows/${id}/activate`,
      {
        method: "POST"
      },
      authToken
    );
  }

  /**
   * Deactivate a workflow
   */
  static async deactivateWorkflow(
    id: string,
    authToken?: string
  ): Promise<Workflow> {
    return apiRequest<Workflow>(
      `/api/workflows/${id}/deactivate`,
      {
        method: "POST"
      },
      authToken
    );
  }

  /**
   * Get workflow executions
   */
  static async getWorkflowExecutions(
    workflowId: string,
    params?: {
      limit?: number;
      offset?: number;
      status?: "pending" | "running" | "completed" | "failed" | "cancelled";
      authToken?: string;
    }
  ): Promise<WorkflowExecutionListResponse> {
    const searchParams = new URLSearchParams();

    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());
    if (params?.status) searchParams.set("status", params.status);

    const query = searchParams.toString();
    const endpoint = `/api/workflows/${workflowId}/executions${query ? `?${query}` : ""}`;

    return apiRequest<WorkflowExecutionListResponse>(
      endpoint,
      {},
      params?.authToken
    );
  }

  /**
   * Get execution details
   */
  static async getExecution(executionId: string): Promise<WorkflowExecution> {
    return apiRequest<WorkflowExecution>(`/api/executions/${executionId}`);
  }

  /**
   * Cancel a running execution
   */
  static async cancelExecution(executionId: string): Promise<void> {
    return apiRequest<void>(`/api/executions/${executionId}/cancel`, {
      method: "POST"
    });
  }

  /**
   * Test a webhook endpoint
   */
  static async testWebhook(
    webhookId: string,
    testPayload: any = {}
  ): Promise<{ success: boolean; executionId?: string; error?: string }> {
    return apiRequest(`/webhooks/${webhookId}/test`, {
      method: "POST",
      body: JSON.stringify(testPayload)
    });
  }

  /**
   * Get webhook events
   */
  static async getWebhookEvents(
    webhookId: string,
    params?: { limit?: number }
  ): Promise<{ data: any[]; meta: any }> {
    const searchParams = new URLSearchParams();

    if (params?.limit) searchParams.set("limit", params.limit.toString());

    const query = searchParams.toString();
    const endpoint = `/webhooks/${webhookId}/events${query ? `?${query}` : ""}`;

    return apiRequest(endpoint);
  }
}

export { WorkflowAPIError };
