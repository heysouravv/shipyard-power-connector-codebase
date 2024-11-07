import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { sendToEventBridge } from "../aws.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);

  // Check if integration is enabled for this shop
  const settings = await prisma.integrationSettings.findUnique({
    where: { shop },
  });

  if (settings?.isEnabled) {
    await sendToEventBridge(
      "shopify.products",
      "product.updated",
      {
        shop,
        ...payload,
      }
    );
  }

  return new Response();
}; 