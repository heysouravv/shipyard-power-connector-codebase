import {
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { authenticate, login } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  try {
    // Create default integration settings
    await prisma.integrationSettings.upsert({
      where: { shop: session.shop },
      update: {}, // Don't update if exists
      create: {
        shop: session.shop,
        isEnabled: true, // Enable by default
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

  } catch (error) {
    console.error('Setup Error:', {
      error,
      shop: session.shop,
      timestamp: new Date().toISOString(),
    });
  }

  return await login(request);
};