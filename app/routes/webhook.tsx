import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { sendToKinesis, type ShopifyEventType } from "../aws.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);

  // Always log incoming webhook
  console.log(`Received webhook ${topic} for ${shop}`);

  try {
    await sendToKinesis({
      id: `${topic}_${Date.now()}`,
      topic: topic as ShopifyEventType,
      shop,
      payload,
      timestamp: new Date().toISOString(),
    });

    console.log(`Successfully processed ${topic} webhook for ${shop}`);
  } catch (error) {
    console.error(`Error processing ${topic} webhook for ${shop}:`, error);
    // Don't throw the error - we want to return 200 to Shopify
  }

  return new Response();
};