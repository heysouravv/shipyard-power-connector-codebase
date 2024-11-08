// app/routes/auth.callback.tsx
import { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate, registerWebhooks } from "../shopify.server";
import { DeliveryMethod } from "@shopify/shopify-api";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.callback(request);

  console.log("[Auth Callback] Processing installation for shop:", session?.shop);

  if (!session?.shop) {
    console.error("[Auth Callback] No shop found in session");
    return null;
  }

  try {
    // Register webhooks
    const webhookTopics = [
      "products/create",
      "products/update",
      "products/delete",
      "orders/create",
      "orders/updated",
      "orders/cancelled",
    ];

    console.log("[Auth Callback] Registering webhooks for shop:", session.shop);

    const webhookRegistrationPromises = webhookTopics.map(async (topic) => {
      try {
        const response = await shopify.api.webhooks.addHandlers({
          [topic]: [
            {
              deliveryMethod: DeliveryMethod.Http,
              callbackUrl: "/webhook",
            },
          ],
        });

        console.log(`[Auth Callback] Registered webhook ${topic}:`, {
          shop: session.shop,
          success: true,
        });

        return { topic, success: true };
      } catch (error: any) {
        console.error(`[Auth Callback] Failed to register webhook ${topic}:`, {
          shop: session.shop,
          error: error.message,
        });
        return { topic, success: false, error: error.message };
      }
    });

    const results = await Promise.all(webhookRegistrationPromises);

    // Initialize integration settings
    await prisma.integrationSettings.upsert({
      where: { shop: session.shop },
      create: {
        shop: session.shop,
        isEnabled: true,
      },
      update: {}, // No updates needed for existing settings
    });

    console.log("[Auth Callback] Installation completed:", {
      shop: session.shop,
      webhookResults: results,
    });
  } catch (error: any) {
    console.error("[Auth Callback] Error during installation:", {
      shop: session.shop,
      error: error.message,
      stack: error.stack,
    });
  }

  return null;
};