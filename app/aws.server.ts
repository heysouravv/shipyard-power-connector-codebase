import { 
  KinesisClient, 
  PutRecordCommand,
  PutRecordsCommand,
  type PutRecordCommandInput 
} from "@aws-sdk/client-kinesis";

const STREAM_NAME = process.env.AWS_KINESIS_STREAM_NAME || 'shopify-events-stream';

const kinesis = new KinesisClient({
  region: process.env.AWS_REGION,
  credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export type ShopifyEventType = 
  | 'products/create' 
  | 'products/update' 
  | 'products/delete'
  | 'orders/create'
  | 'orders/updated'
  | 'orders/cancelled'
  | 'inventory_levels/update'
  | 'fulfillments/create'
  | 'fulfillments/update'
  | 'app/uninstalled'
  | 'customers/redact'
  | 'customers/data_request'
  | 'shop/redact';

interface ShopifyEvent {
  id: string;
  topic: ShopifyEventType;
  shop: string;
  payload: any;
  timestamp: string;
}

export async function sendToKinesis(event: ShopifyEvent) {
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log('[Kinesis] Processing event:', {
      eventId,
      topic: event.topic,
      shop: event.shop,
      timestamp: new Date().toISOString()
  });

  const record: PutRecordCommandInput = {
      StreamName: STREAM_NAME,
      Data: Buffer.from(JSON.stringify({
          id: eventId,
          ...event,
          processedAt: new Date().toISOString(),
      })),
      // Use shop domain as partition key to maintain order per shop
      PartitionKey: event.shop,
  };

  const command = new PutRecordCommand(record);

  try {
      const startTime = performance.now();
      const response = await kinesis.send(command);
      const duration = (performance.now() - startTime).toFixed(2);

      console.log('[Kinesis] Successfully sent event:', {
          eventId,
          topic: event.topic,
          shop: event.shop,
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`,
          sequenceNumber: response.SequenceNumber,
          shardId: response.ShardId,
      });

      return response;
  } catch (error: any) {
      console.error('[Kinesis] Error sending event:', {
          eventId,
          topic: event.topic,
          shop: event.shop,
          timestamp: new Date().toISOString(),
          errorMessage: error.message,
          errorName: error.name,
          errorStack: error.stack,
      });
      throw error;
  }
}

// Utility function to send multiple events in batch
export async function sendBatchToKinesis(events: ShopifyEvent[]) {
  const records = events.map(event => ({
      Data: Buffer.from(JSON.stringify({
          id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...event,
          processedAt: new Date().toISOString(),
      })),
      PartitionKey: event.shop,
  }));

  const command = new PutRecordsCommand({
      StreamName: STREAM_NAME,
      Records: records,
  });

  try {
      const response = await kinesis.send(command);
      console.log('[Kinesis] Successfully sent batch:', {
          successCount: response.Records?.filter(r => !r.ErrorCode).length,
          failureCount: response.Records?.filter(r => r.ErrorCode).length,
          timestamp: new Date().toISOString(),
      });
      return response;
  } catch (error) {
      console.error('[Kinesis] Error sending batch:', error);
      throw error;
  }
}