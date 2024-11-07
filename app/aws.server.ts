import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

const eventBridge = new EventBridgeClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function sendToEventBridge(source: string, detailType: string, detail: any) {
  const command = new PutEventsCommand({
    Entries: [
      {
        Source: source,
        DetailType: detailType,
        Detail: JSON.stringify(detail),
        EventBusName: "default"
      },
    ],
  });

  try {
    const response = await eventBridge.send(command);
    return response;
  } catch (error) {
    console.error("Error sending to EventBridge:", error);
    throw error;
  }
} 