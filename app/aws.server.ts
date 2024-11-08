import { 
  KinesisClient, 
  PutRecordCommand,
  PutRecordsCommand,
  DescribeStreamCommand,
  type PutRecordCommandInput,
  type PutRecordsCommandInput
} from "@aws-sdk/client-kinesis";

// Environment validation
const requiredEnvVars = {
  AWS_REGION: process.env.AWS_REGION,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_KINESIS_STREAM_NAME: process.env.AWS_KINESIS_STREAM_NAME
};

// Check for missing environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('[AWS Config] Missing required environment variables:', missingVars);
}

const STREAM_NAME = process.env.AWS_KINESIS_STREAM_NAME || 'shopify-events-stream';

// Log AWS configuration (safely)
console.log('[AWS Config] Initializing with:', {
    region: process.env.AWS_REGION,
    streamName: STREAM_NAME,
    hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
    timestamp: new Date().toISOString()
});

// Initialize Kinesis client
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

// Function to test stream existence and accessibility
async function verifyKinesisStream() {
  try {
    const command = new DescribeStreamCommand({
      StreamName: STREAM_NAME
    });
    
    console.log('[AWS] Verifying Kinesis stream configuration...');
    const response = await kinesis.send(command);
    
    console.log('[AWS] Stream verification successful:', {
      streamName: STREAM_NAME,
      streamStatus: response.StreamDescription?.StreamStatus,
      shardCount: response.StreamDescription?.Shards?.length,
      timestamp: new Date().toISOString()
    });
    
    return true;
  } catch (error: any) {
    console.error('[AWS] Stream verification failed:', {
      streamName: STREAM_NAME,
      errorMessage: error.message,
      errorName: error.name,
      errorCode: error.$metadata?.httpStatusCode,
      timestamp: new Date().toISOString()
    });
    return false;
  }
}

// Function to test sending a record to Kinesis
async function testKinesisConnection() {
  try {
    console.log('[AWS] Testing Kinesis connection...');
    
    const testRecord: PutRecordCommandInput = {
      StreamName: STREAM_NAME,
      Data: Buffer.from(JSON.stringify({
        id: `test_${Date.now()}`,
        type: 'connection_test',
        timestamp: new Date().toISOString()
      })),
      PartitionKey: 'test',
    };
    
    const command = new PutRecordCommand(testRecord);
    const response = await kinesis.send(command);
    
    console.log('[AWS] Kinesis connection test successful:', {
      sequenceNumber: response.SequenceNumber,
      shardId: response.ShardId,
      timestamp: new Date().toISOString()
    });
    
    return true;
  } catch (error: any) {
    console.error('[AWS] Kinesis connection test failed:', {
      errorMessage: error.message,
      errorName: error.name,
      errorCode: error.$metadata?.httpStatusCode,
      timestamp: new Date().toISOString()
    });
    return false;
  }
}

// Main function to send events to Kinesis
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
          errorCode: error.$metadata?.httpStatusCode
      });
      throw error;
  }
}

// Utility function to send multiple events in batch
export async function sendBatchToKinesis(events: ShopifyEvent[]) {
  const batchId = `batch_${Date.now()}`;
  console.log('[Kinesis] Processing batch:', {
    batchId,
    eventCount: events.length,
    timestamp: new Date().toISOString()
  });

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
      const startTime = performance.now();
      const response = await kinesis.send(command);
      const duration = (performance.now() - startTime).toFixed(2);

      console.log('[Kinesis] Successfully sent batch:', {
          batchId,
          successCount: response.Records?.filter(r => !r.ErrorCode).length,
          failureCount: response.Records?.filter(r => r.ErrorCode).length,
          duration: `${duration}ms`,
          timestamp: new Date().toISOString(),
      });

      // Log any failed records
      const failedRecords = response.Records?.filter(r => r.ErrorCode)
          .map((r, i) => ({
              index: i,
              errorCode: r.ErrorCode,
              errorMessage: r.ErrorMessage
          }));

      if (failedRecords?.length > 0) {
          console.error('[Kinesis] Failed records in batch:', {
              batchId,
              failedRecords,
              timestamp: new Date().toISOString()
          });
      }

      return response;
  } catch (error: any) {
      console.error('[Kinesis] Error sending batch:', {
          batchId,
          errorMessage: error.message,
          errorName: error.name,
          errorStack: error.stack,
          errorCode: error.$metadata?.httpStatusCode,
          timestamp: new Date().toISOString()
      });
      throw error;
  }
}

// Export test functions for external use
export const testing = {
  verifyKinesisStream,
  testKinesisConnection
};

// Run initial tests when the server starts
(async () => {
  console.log('[AWS] Running initial configuration tests...');
  
  const streamExists = await verifyKinesisStream();
  if (streamExists) {
    await testKinesisConnection();
  }
})();