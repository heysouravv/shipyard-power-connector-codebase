// app/webhooks.server.ts
import { DeliveryMethod } from "@shopify/shopify-api";
import shopify from "./shopify.server";
import { ShopifyEventType } from "./aws.server";

const WEBHOOKS: { topic: ShopifyEventType; deliveryMethod: DeliveryMethod }[] = [
  {
    topic: "products/create",
    deliveryMethod: DeliveryMethod.Http,
  },
  {
    topic: "products/update",
    deliveryMethod: DeliveryMethod.Http,
  },
  {
    topic: "products/delete",
    deliveryMethod: DeliveryMethod.Http,
  },
  // Add other webhook topics as needed
];

export async function registerWebhooks(shop: string, accessToken: string) {
  console.log('[Webhooks] Starting webhook registration for shop:', shop);

  const results = await Promise.all(
    WEBHOOKS.map(async (webhook) => {
      try {
        const response = await shopify.api.webhooks.addHandlers({
          [webhook.topic]: [
            {
              deliveryMethod: webhook.deliveryMethod,
              callbackUrl: "/webhook",
            },
          ],
        });

        console.log(`[Webhooks] Registered ${webhook.topic}:`, {
          shop,
          success: true,
          topic: webhook.topic
        });

        return {
          topic: webhook.topic,
          success: true,
          result: response
        };
      } catch (error: any) {
        console.error(`[Webhooks] Failed to register ${webhook.topic}:`, {
          shop,
          error: error.message,
          topic: webhook.topic
        });

        return {
          topic: webhook.topic,
          success: false,
          error: error.message
        };
      }
    })
  );

  return results;
}