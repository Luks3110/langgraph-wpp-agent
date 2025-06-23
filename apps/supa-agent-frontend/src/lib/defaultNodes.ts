import {
  CharacterNode,
  DeploymentNode,
  KnowledgeNode,
  TestingNode,
  ScheduleNode,
  ManualNode,
  HttpNode,
  TransformNode,
  ConditionNode,
  DelayNode,
  LogNode,
  NodeTypeOptions
} from "@/utils/flow-types";

export type NodeDataMapping = {
  character: CharacterNode["data"];
  knowledge: KnowledgeNode["data"];
  testing: TestingNode["data"];
  deployment: DeploymentNode["data"];
  mercadolivreQa: {
    apiConfigured: boolean;
    rulesCount: number;
    defaultResponseSet: boolean;
    responseDelay: string;
    workflowId: string;
    userId: string;
  };
  whatsapp: {
    apiConfigured: boolean;
    phoneNumberConfigured: boolean;
    messageTemplatesCount: number;
    autoReplyEnabled: boolean;
    responseDelay: string;
    workflowId: string;
    userId: string;
  };
  instagram: {
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
  };
  webhook: {
    name: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    payload: string;
    timeout: number;
    retryCount: number;
  };
  "webhook-trigger": {
    name: string;
    webhookId: string;
    description?: string;
    secretKey?: string;
  };
  // New workflow engine node types
  schedule: ScheduleNode["data"];
  manual: ManualNode["data"];
  http: HttpNode["data"];
  transform: TransformNode["data"];
  condition: ConditionNode["data"];
  delay: DelayNode["data"];
  log: LogNode["data"];
};

export type TypedNode<T extends NodeTypeOptions> = {
  type: T;
  data: NodeDataMapping[T];
};

export const defaultNodes: {
  [K in NodeTypeOptions]?: TypedNode<K>;
} = {
  // Legacy nodes
  character: {
    type: "character",
    data: { name: "New Character", personality: "Default" }
  },
  knowledge: {
    type: "knowledge",
    data: { domain: "General", sources: "None" }
  },
  testing: {
    type: "testing",
    data: { testCases: "0", status: "Not started" }
  },
  deployment: {
    type: "deployment",
    data: { environment: "Development", status: "Not deployed" }
  },
  mercadolivreQa: {
    type: "mercadolivreQa",
    data: {
      apiConfigured: false,
      rulesCount: 0,
      defaultResponseSet: false,
      responseDelay: "Immediate",
      workflowId: "",
      userId: ""
    }
  },
  whatsapp: {
    type: "whatsapp",
    data: {
      apiConfigured: false,
      phoneNumberConfigured: false,
      messageTemplatesCount: 0,
      autoReplyEnabled: false,
      responseDelay: "Immediate",
      workflowId: "",
      userId: ""
    }
  },
  instagram: {
    type: "instagram",
    data: {
      name: "Instagram Integration",
      apiConfigured: false,
      accessToken: "",
      igBusinessId: "",
      webhookVerifyToken: "",
      webhookSecret: "",
      messageEvents: [],
      reactionEvents: false,
      postbackEvents: false,
      seenEvents: false,
      referralEvents: false
    }
  },
  webhook: {
    type: "webhook",
    data: {
      name: "Webhook Integration",
      url: "",
      method: "POST",
      headers: {},
      payload: "",
      timeout: 30,
      retryCount: 3
    }
  },
  "webhook-trigger": {
    type: "webhook-trigger",
    data: {
      name: "Webhook Trigger",
      webhookId: "",
      description: "",
      secretKey: ""
    }
  },

  // New workflow engine nodes
  schedule: {
    type: "schedule",
    data: {
      name: "Schedule Trigger",
      cronExpression: "0 0 * * *",
      timezone: "UTC",
      enabled: true
    }
  },
  manual: {
    type: "manual",
    data: {
      name: "Manual Trigger",
      description: "Manually triggered workflow"
    }
  },
  http: {
    type: "http",
    data: {
      name: "HTTP Request",
      url: "",
      method: "GET",
      headers: {},
      body: "",
      timeout: 30
    }
  },
  transform: {
    type: "transform",
    data: {
      name: "Data Transform",
      inputData: "{{trigger.output}}",
      transformScript: "return data;"
    }
  },
  condition: {
    type: "condition",
    data: {
      name: "Condition",
      condition: "true",
      onTrue: "",
      onFalse: ""
    }
  },
  delay: {
    type: "delay",
    data: {
      name: "Delay",
      duration: 1000,
      unit: "milliseconds"
    }
  },
  log: {
    type: "log",
    data: {
      name: "Log",
      message: "Step executed successfully",
      level: "info"
    }
  }
};
