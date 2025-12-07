import type { Route } from "./+types/dashboard";
import { Banner, BlockStack, Button, Card, DataTable, InlineStack, Page, SkeletonBodyText, Text } from "@shopify/polaris";
import { claimStock, getInventory } from "../models/inventory.server";
import type { Item } from "../models/inventory.server";
import { Await, useFetcher, useRevalidator } from "react-router";
import { Suspense } from "react";

// LOADER
export async function loader({ }: Route.LoaderArgs) {
  return {
    inventory: getInventory()
  };
}

// ACTION
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const itemId = formData.get("itemId") as string;

  try {
    const updatedItem = await claimStock(itemId);
    return { success: true, item: updatedItem };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// MAIN COMPONENT
export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { inventory } = loaderData;

  return (
    <Page title="Inventory Dashboard" subtitle="Real-time warehouse stock management">
      <Card>
        <Suspense fallback={<LoadingSkeleton />}>
          <Await resolve={inventory} errorElement={<ErrorDisplay />} children={(inventoryData: Item[]) => <InventoryTable items={inventoryData} />} />
        </Suspense>
      </Card>
    </Page>
  );
}

// LOADING SKELETON
function LoadingSkeleton() {
  return (
    <BlockStack gap="400">
      <SkeletonBodyText lines={1} />
      <SkeletonBodyText lines={4} />
      <SkeletonBodyText lines={4} />
    </BlockStack>
  );
}

// ERROR DISPLAY
function ErrorDisplay() {
  const revalidator = useRevalidator();

  return (
    <Banner
      title="Failed to load inventory"
      tone="critical"
      onDismiss={() => revalidator.revalidate()}
    >
      <BlockStack gap="200">
        <Text as="p">
          The legacy API encountered an error. This happens occasionally due to system instability.
        </Text>
        <InlineStack gap="200">
          <Button
            variant="primary"
            onClick={() => revalidator.revalidate()}
            loading={revalidator.state === "loading"}
          >
            Retry
          </Button>
        </InlineStack>
      </BlockStack>
    </Banner>
  );
}

// INVENTORY TABLE
function InventoryTable({ items }: { items: Item[] }) {
  const rows = items.map((item) => [
    item.name,
    <StockCell key={`stock-${item.id}`} item={item} />,
    <ActionCell key={`action-${item.id}`} item={item} />,
  ]);

  return (
    <DataTable
      columnContentTypes={["text", "numeric", "text"]}
      headings={["Item Name", "Stock", "Actions"]}
      rows={rows}
    />
  );
}

// STOCK CELL WITH OPTIMISTIC UPDATE
function StockCell({ item }: { item: Item }) {
  const fetcher = useFetcher({ key: `claim-${item.id}` });

  const optimisticStock = fetcher.formData
    ? Math.max(0, item.stock - 1)
    : item.stock;

  return (
    <Text as="span" fontWeight="semibold">
      {optimisticStock}
    </Text>
  );
}

// ACTION CELL WITH FORM
function ActionCell({ item }: { item: Item }) {
  const fetcher = useFetcher({ key: `claim-${item.id}` });

  const isSubmitting = fetcher.state === "submitting" || fetcher.state === "loading";
  const hasError = fetcher.data && !fetcher.data.success;

  return (
    <InlineStack gap="200" align="start">
      <fetcher.Form method="post">
        <input type="hidden" name="itemId" value={item.id} />
        <Button
          submit
          disabled={item.stock === 0 || isSubmitting}
          loading={isSubmitting}
          size="slim"
        >
          Claim One
        </Button>
      </fetcher.Form>
      {hasError && (
        <Text as="span" tone="critical" fontWeight="semibold">
          {fetcher.data.error} - Stock restored
        </Text>
      )}
    </InlineStack>
  );
}

// ERROR BOUNDARY
export function ErrorBoundary() {
  const revalidator = useRevalidator();

  return (
    <Page title="Inventory Dashboard">
      <Card>
        <Banner
          title="Something went wrong"
          tone="critical"
        >
          <BlockStack gap="200">
            <Text as="p">
              We encountered an unexpected error while loading the inventory dashboard.
            </Text>
            <InlineStack gap="200">
              <Button
                variant="primary"
                onClick={() => revalidator.revalidate()}
              >
                Try Again
              </Button>
            </InlineStack>
          </BlockStack>
        </Banner>
      </Card>
    </Page>
  );
}