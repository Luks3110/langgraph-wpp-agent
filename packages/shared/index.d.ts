// Temporary workaround declaration file
declare module "@products-monorepo/shared" {
  export interface WhatsAppMessage {
    from: string;
    text: string;
    timestamp: number;
    messageId: string;
  }

  export interface AgentResponseMessage {
    to: string;
    text: string;
  }

  export interface AgentRequestMessage {
    from: string;
    text: string;
    timestamp: number;
    messageId: string;
  }
}
