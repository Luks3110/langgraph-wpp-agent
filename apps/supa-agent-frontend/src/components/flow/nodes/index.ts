import { DeploymentNodeComponent, InstagramNodeComponent, TestingNodeComponent, WebhookNodeComponent } from "@/components/flow/nodes/simple-nodes";
import CharacterNode from "@/components/nodes/character";
import KnowledgeNode from "@/components/nodes/knowledge";
import MercadoLivreQANode from "@/components/nodes/mercado-livre-qa";
import WhatsAppNode from "@/components/nodes/whatsapp";

// Export a mapping of node types to their components
const nodeTypes = {
    character: CharacterNode,
    knowledge: KnowledgeNode,
    testing: TestingNodeComponent,
    deployment: DeploymentNodeComponent,
    mercadolivreQa: MercadoLivreQANode,
    whatsapp: WhatsAppNode,
    instagram: InstagramNodeComponent,
    webhook: WebhookNodeComponent,
};

export default nodeTypes; 
