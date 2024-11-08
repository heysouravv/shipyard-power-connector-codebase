// app/routes/webhook.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { sendToKinesis, type ShopifyEventType } from "../aws.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // Log raw request details for debugging
    const rawHeaders = Object.fromEntries(request.headers.entries());
    console.log('[Webhook] Incoming request headers:', {
      topic: rawHeaders['x-shopify-topic'],
      shop: rawHeaders['x-shopify-shop-domain'],
      timestamp: new Date().toISOString()
    });

    // Clone request and get raw body for debugging
    const rawBody = await request.clone().text();
    console.log('[Webhook] Raw webhook body:', {
      bodyPreview: rawBody.substring(0, 200) + '...',
      timestamp: new Date().toISOString()
    });

    // Authenticate and process webhook
    const { shop, payload, topic } = await authenticate.webhook(request);

    console.log('[Webhook] Authenticated webhook:', {
      topic,
      shop,
      payloadPreview: JSON.stringify(payload).substring(0, 200) + '...',
      timestamp: new Date().toISOString()
    });

    // Check if integration is enabled
    const settings = await prisma.integrationSettings.findUnique({
      where: { shop },
    });

    if (!settings?.isEnabled) {
      console.log('[Webhook] Integration disabled for shop:', shop);
      return new Response(null, { status: 200 });
    }

    // Prepare event for Kinesis
    const event = {
      id: `${topic}_${Date.now()}`,
      topic: topic as ShopifyEventType,
      shop,
      payload,
      timestamp: new Date().toISOString(),
    };

    console.log('[Webhook] Sending to Kinesis:', {
      eventId: event.id,
      topic: event.topic,
      shop: event.shop,
      timestamp: event.timestamp
    });

    // Send to Kinesis
    await sendToKinesis(event);

    console.log('[Webhook] Successfully processed and sent to Kinesis:', {
      topic,
      shop,
      timestamp: new Date().toISOString()
    });

    return new Response(null, { status: 200 });
  } catch (error: any) {
    console.error('[Webhook] Error processing webhook:', {
      errorMessage: error.message,
      errorName: error.name,
      errorStack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Always return 200 to acknowledge receipt
    return new Response(null, { status: 200 });
  }
};