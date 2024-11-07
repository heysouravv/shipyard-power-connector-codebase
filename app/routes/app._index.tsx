import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  BlockStack,
  Banner,
  SettingToggle,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  
  let settings = await prisma.integrationSettings.findUnique({
    where: { shop: session.shop },
  });

  if (!settings) {
    settings = await prisma.integrationSettings.create({
      data: { shop: session.shop },
    });
  }

  return json({ settings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const isEnabled = formData.get("enabled") === "true";

  const settings = await prisma.integrationSettings.update({
    where: { shop: session.shop },
    data: { isEnabled },
  });

  return json({ settings });
};

export default function Index() {
  const { settings } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const handleToggle = () => {
    const formData = new FormData();
    formData.append("enabled", (!settings.isEnabled).toString());
    submit(formData, { method: "POST" });
  };

  return (
    <Page>
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  AWS EventBridge Integration
                </Text>
                <Banner status="info">
                  This integration automatically sends product updates to AWS EventBridge.
                </Banner>
                <SettingToggle
                  action={{
                    content: settings.isEnabled ? "Disable" : "Enable",
                    onAction: handleToggle,
                  }}
                  enabled={settings.isEnabled}
                >
                  Integration is{" "}
                  <Text variant="headingMd" as="span">
                    {settings.isEnabled ? "enabled" : "disabled"}
                  </Text>
                </SettingToggle>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
