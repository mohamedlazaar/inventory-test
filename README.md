# Remix Inventory Dashboard

A resilient inventory management system built with React Router v7 and Shopify Polaris, demonstrating advanced patterns for handling unreliable APIs.

## 🚀 Quick Start

```bash
npx create-react-router@latest inventory-test
npm run dev
```

Navigate to `/dashboard` to see the inventory management interface.

---

## 🎯 Key Implementation Choices

### Task 2: Optimistic UI Implementation

**Challenge:** The `claimStock` mutation takes 1 second to complete, creating a poor user experience if we wait for the server response before updating the UI.

**Solution:** We implemented optimistic updates using React Router's `useFetcher` hook with a shared key strategy.

#### How It Works:

1. **Separate Components with Shared Fetcher Key**
   ```typescript
   // Both components use the same fetcher key to share state
   function StockCell({ item }: { item: Item }) {
     const fetcher = useFetcher({ key: `claim-${item.id}` });
     
     const optimisticStock = fetcher.formData
       ? Math.max(0, item.stock - 1)  // Instantly decrease
       : item.stock;                   // Use real value
   }
   
   function ActionCell({ item }: { item: Item }) {
     const fetcher = useFetcher({ key: `claim-${item.id}` });
     // Same key means they share the same fetcher state
   }
   ```

2. **Instant Feedback (0ms delay)**
   - When the user clicks "Claim One", `fetcher.formData` immediately contains the submission data
   - `StockCell` detects this and renders the optimistic value instantly
   - The UI updates in 0ms, before any network request completes

3. **Automatic Rollback on Error**
   - If the server returns an error (e.g., "Out of stock"), the action returns `{ success: false, error: "..." }`
   - React Router automatically revalidates the page data
   - `fetcher.formData` clears, so `StockCell` reverts to showing `item.stock` (the real value)
   - No manual state management needed - React Router handles the rollback automatically

4. **Race Condition Protection**
   ```typescript
   const isSubmitting = fetcher.state === "submitting" || fetcher.state === "loading";
   
   <Button
     submit
     disabled={item.stock === 0 || isSubmitting}  // Prevents double-click
     loading={isSubmitting}                        // Shows loading state
   >
   ```

**Why This Approach?**
- ✅ No `useState` - single source of truth from fetcher state
- ✅ No manual state synchronization needed
- ✅ Automatic rollback via React Router's revalidation
- ✅ Each row has its own fetcher, preventing conflicts between simultaneous updates
- ✅ Progressive enhancement - forms work without JavaScript

---

### Task 3: Retry Logic Implementation

**Challenge:** The `getInventory` API fails randomly 20% of the time. We need graceful error handling with retry capability, without full page refreshes.

**Solution:** We implemented a two-layer error handling strategy using React Router's error boundaries.

#### How It Works:

1. **Streaming Error Boundary (Layer 1)**
   ```typescript
   <Suspense fallback={<LoadingSkeleton />}>
     <Await resolve={inventory} errorElement={<ErrorDisplay />}>
       <ResolvedInventory />
     </Await>
   </Suspense>
   ```
   
   - **Catches:** Errors from `getInventory()` during streaming
   - **Shows:** Polaris Banner with error message (only in the list area)
   - **Result:** Page structure (title, card) remains visible - only content area shows error

2. **Retry Without Page Refresh**
   ```typescript
   function ErrorDisplay() {
     const revalidator = useRevalidator();
     
     return (
       <Banner title="Failed to load inventory" tone="critical">
         <Button onClick={() => revalidator.revalidate()}>
           Retry
         </Button>
       </Banner>
     );
   }
   ```
   
   - `useRevalidator()` provides access to React Router's revalidation mechanism
   - Clicking "Retry" calls `revalidator.revalidate()`
   - This re-executes the loader function, attempting `getInventory()` again
   - All happens client-side - no full page reload, no lost state

3. **Route-Level Error Boundary (Layer 2)**
   ```typescript
   export function ErrorBoundary() {
     const revalidator = useRevalidator();
     
     return (
       <Page title="Inventory Dashboard">
         <Card>
           <Banner title="Something went wrong" tone="critical">
             <Button onClick={() => revalidator.revalidate()}>
               Try Again
             </Button>
           </Banner>
         </Card>
       </Page>
     );
   }
   ```
   
   - **Catches:** Unexpected runtime errors (code crashes)
   - **Shows:** Full-page error UI with retry option
   - **Exported:** From the route file, so React Router automatically uses it

**Why This Approach?**
- ✅ Two-layer protection: expected errors (API) vs unexpected errors (code crashes)
- ✅ Page structure always remains visible - no blank screens
- ✅ `useRevalidator()` is the canonical React Router way to retry loaders
- ✅ No manual fetch calls - stays within React Router's data flow
- ✅ Loading state tracked automatically (`revalidator.state === "loading"`)

---

## 🏗️ Architecture Decisions

### React Router v7 Streaming
The test document ment