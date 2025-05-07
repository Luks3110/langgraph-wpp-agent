import { WebhookProviderAdapterFactory, WebhookProviderType } from '../providerAdapters.js';
import { FacebookWebhookAdapter } from './facebookAdapter.js';
import { InstagramWebhookAdapter } from './instagramAdapter.js';
import { SlackWebhookAdapter } from './slackAdapter.js';
import { WhatsAppWebhookAdapter } from './whatsappAdapter.js';

/**
 * Initialize and register all webhook provider adapters
 */
export function registerWebhookProviderAdapters(factory: WebhookProviderAdapterFactory): void {
    // Register WhatsApp adapter
    const whatsappAdapter = new WhatsAppWebhookAdapter();
    factory.registerAdapter(WebhookProviderType.WHATSAPP, whatsappAdapter);

    // Register Instagram adapter
    const instagramAdapter = new InstagramWebhookAdapter();
    factory.registerAdapter(WebhookProviderType.INSTAGRAM, instagramAdapter);

    // Register Facebook adapter
    const facebookAdapter = new FacebookWebhookAdapter();
    factory.registerAdapter(WebhookProviderType.FACEBOOK, facebookAdapter);

    // Register Slack adapter
    const slackAdapter = new SlackWebhookAdapter();
    factory.registerAdapter(WebhookProviderType.SLACK, slackAdapter);
}

// Export all adapters
export {
    FacebookWebhookAdapter, InstagramWebhookAdapter, SlackWebhookAdapter, WhatsAppWebhookAdapter
};
