import CharacterNode from "../../nodes/character";
import KnowledgeNode from "../../nodes/knowledge";
import MercadoLivreQANode from "../../nodes/mercado-livre-qa";
import WhatsAppNode from "../../nodes/whatsapp";
import {
  DeploymentNodeComponent,
  InstagramNodeComponent,
  TestingNodeComponent,
  WebhookNodeComponent
} from "./simple-nodes";
import {
  WebhookTriggerNode,
  ScheduleTriggerNode,
  ManualTriggerNode,
  HttpRequestNode,
  DataTransformNode,
  ConditionNode,
  DelayActionNode,
  LogActionNode
} from "./workflow-nodes";

// Export a mapping of node types to their components
const nodeTypes = {
  // Legacy nodes
  character: CharacterNode,
  knowledge: KnowledgeNode,
  testing: TestingNodeComponent,
  deployment: DeploymentNodeComponent,
  mercadolivreQa: MercadoLivreQANode,
  whatsapp: WhatsAppNode,
  instagram: InstagramNodeComponent,
  webhook: WebhookNodeComponent,
  "webhook-trigger": WebhookTriggerNode,

  // New workflow engine nodes
  schedule: ScheduleTriggerNode,
  manual: ManualTriggerNode,
  http: HttpRequestNode,
  transform: DataTransformNode,
  condition: ConditionNode,
  delay: DelayActionNode,
  log: LogActionNode
};

export default nodeTypes;
