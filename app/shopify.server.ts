// app/shopify.server.ts
import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  DeliveryMethod,
  shopifyApp,
  LATEST_API_VERSION,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-07";
import { Shopify } from "@shopify/shopify-api";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October24,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  restResources,
  webhooks: {
    APP_UNINSTALLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhook",
      callback: async (topic, shop, body, webhookId) => {
        console.log('[Webhook] App uninstalled:', { topic, shop, webhookId });
        await prisma.integrationSettings.deleteMany({
          where: { shop }
        });
      },
    },
    PRODUCTS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhook",
      callback: async (topic, shop, body, webhookId) => {
        console.log('[Webhook] Product created:', { 
          topic, 
          shop, 
          webhookId,
          timestamp: new Date().toISOString()
        });
      },
    },
    PRODUCTS_UPDATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhook",
      callback: async (topic, shop, body, webhookId) => {
        console.log('[Webhook] Product updated:', { 
          topic, 
          shop, 
          webhookId,
          timestamp: new Date().toISOString()
        });
      },
    },
    PRODUCTS_DELETE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhook",
      callback: async (topic, shop, body, webhookId) => {
        console.log('[Webhook] Product deleted:', { 
          topic, 
          shop, 
          webhookId,
          timestamp: new Date().toISOString()
        });
      },
    },
    ORDERS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhook",
      callback: async (topic, shop, body, webhookId) => {
        console.log('[Webhook] Order created:', { 
          topic, 
          shop, 
          webhookId,
          timestamp: new Date().toISOString()
        });
      },
    },
    ORDERS_UPDATED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhook",
      callback: async (topic, shop, body, webhookId) => {
        console.log('[Webhook] Order updated:', { 
          topic, 
          shop, 
          webhookId,
          timestamp: new Date().toISOString()
        });
      },
    },
    ORDERS_CANCELLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhook",
      callback: async (topic, shop, body, webhookId) => {
        console.log('[Webhook] Order cancelled:', { 
          topic, 
          shop, 
          webhookId,
          timestamp: new Date().toISOString()
        });
      },
    }
  },
  hooks: {
    afterAuth: async ({ session, admin }) => {
      console.log("[Shopify] afterAuth hook triggered with session:", {
        shop: session?.shop,
        accessToken: session?.accessToken ? "present" : "missing",
        isOnline: session?.isOnline,
        timestamp: new Date().toISOString()
      });

      if (!session?.shop) {
        console.error("[Shopify] No shop in session during afterAuth");
        return;
      }

      try {
        // Register webhooks using the admin GraphQL client
        const webhookTopics = [
          "PRODUCTS_CREATE",
          "PRODUCTS_UPDATE",
          "PRODUCTS_DELETE",
          "ORDERS_CREATE",
          "ORDERS_UPDATED",
          "ORDERS_CANCELLED"
        ];

        for (const topic of webhookTopics) {
          try {
            const response = await admin.graphql(
              `#graphql
              mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $callbackUrl: URL!) {
                webhookSubscriptionCreate(
                  topic: $topic
                  webhookSubscription: {
                    callbackUrl: $callbackUrl
                    format: JSON
                  }
                ) {
                  userErrors {
                    field
                    message
                  }
                  webhookSubscription {
                    id
                  }
                }
              }`,
              {
                variables: {
                  topic,
                  callbackUrl: `${process.env.SHOPIFY_APP_URL}/webhook`,
                },
              },
            );

            console.log(`[Shopify] Registered webhook for ${topic}:`, {
              shop: session.shop,
              response,
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            console.error(`[Shopify] Failed to register webhook for ${topic}:`, {
              shop: session.shop,
              error,
              timestamp: new Date().toISOString()
            });
          }
        }

        // Initialize or update integration settings
        await prisma.integrationSettings.upsert({
          where: { shop: session.shop },
          create: {
            shop: session.shop,
            isEnabled: true,
          },
          update: {} // No updates needed for existing settings
        });

        console.log("[Shopify] Installation/authentication completed for shop:", {
          shop: session.shop,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        console.error("[Shopify] Error in afterAuth hook:", {
          shop: session?.shop,
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
      }
    }
  },
  future: {
    unstable_newEmbeddedAuthStrategy: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October24;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;