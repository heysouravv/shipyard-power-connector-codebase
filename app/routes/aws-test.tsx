// app/routes/aws-test.tsx
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { testing, sendToKinesis } from "../aws.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  await authenticate.admin(request);
  
  const results = {
    streamVerification: await testing.verifyKinesisStream(),
    connectionTest: await testing.testKinesisConnection(),
    envVars: {
      hasRegion: !!process.env.AWS_REGION,
      region: process.env.AWS_REGION,
      hasStreamName: !!process.env.AWS_KINESIS_STREAM_NAME,
      streamName: process.env.AWS_KINESIS_STREAM_NAME,
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
    }
  };

  return json(results);
}

export async function action({ request }) {
  await authenticate.admin(request);
  
  try {
    const response = await sendToKinesis({
      id: `test_${Date.now()}`,
      topic: "products/create",
      shop: "test-shop.myshopify.com",
      payload: { test: true },
      timestamp: new Date().toISOString(),
    });

    return json({ 
      success: true, 
      sequenceNumber: response.SequenceNumber,
      shardId: response.ShardId
    });
  } catch (error) {
    return json({ 
      success: false, 
      error: error.message,
      errorName: error.name,
      errorCode: error.$metadata?.httpStatusCode
    }, { status: 500 });
  }
}

export default function AWSTest() {
  const data = useLoaderData<typeof loader>();
  
  return (
    <div style={{ padding: '20px' }}>
      <h1>AWS Configuration Test Results</h1>
      
      <h2>Environment Variables</h2>
      <pre>{JSON.stringify(data.envVars, null, 2)}</pre>
      
      <h2>Stream Verification</h2>
      <p>Status: {data.streamVerification ? '✅ Success' : '❌ Failed'}</p>
      
      <h2>Connection Test</h2>
      <p>Status: {data.connectionTest ? '✅ Success' : '❌ Failed'}</p>
      
      <form method="post">
        <button type="submit">Send Test Event</button>
      </form>
    </div>
  );
}