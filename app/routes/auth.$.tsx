// app/routes/auth.$.tsx
import { DataFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { DeliveryMethod } from "@shopify/shopify-api";
import prisma from "../db.server";

// These are the webhooks we want to register
const WEBHOOK_TOPICS = [
  "products/create",
  "products/update",
  "products/delete",
  "orders/create",
  "orders/updated",
  "orders/cancelled",
];

export async function loader({ request }: DataFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  
  if (!session) {
    return null;
  }

  try {
    console.log('[Auth] Starting webhook registration for shop:', session.shop);

    // Register each webhook
    const results = await Promise.all(
      WEBHOOK_TOPICS.map(async (topic) => {
        try {
          const response = await admin.webhooks.add({
            path: "/webhook",
            topic,
            deliveryMethod: DeliveryMethod.Http
          });

          console.log(`[Auth] Registered webhook for ${topic}:`, {
            success: true,
            shop: session.shop,
            response
          });

          return { topic, success: true };
        } catch (error: any) {
          console.error(`[Auth] Failed to register webhook for ${topic}:`, {
            error: error.message,
            shop: session.shop
          });
          return { topic, success: false, error: error.message };
        }
      })
    );

    // Create or update integration settings
    await prisma.integrationSettings.upsert({
      where: { shop: session.shop },
      create: { 
        shop: session.shop,
        isEnabled: true
      },
      update: {} // No update needed
    });

    console.log('[Auth] Webhook registration completed:', {
      shop: session.shop,
      results
    });
  } catch (error: any) {
    console.error('[Auth] Error during setup:', {
      shop: session.shop,
      error: error.message,
      stack: error.stack
    });
  }

  return null;
}