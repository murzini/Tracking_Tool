"use client";

import { Suspense } from "react";
import { motion } from "framer-motion";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CheckoutFlow } from "../../../components/prototype/CheckoutFlow";
import {
  ShopFrame,
  getCheckoutHref,
  getCheckoutHeatmapHref,
  getDetailsHref,
  getThankYouHref,
  useCatalogItem,
  useTourState,
} from "../../../components/prototype/shopRuntime";
import { flushCheckoutHeatmapOutcome, useCheckoutHeatmapCapture } from "../../../lib/prototype/checkoutHeatmapClient";
import { fade } from "../../../lib/prototype/fade";

// M4 Part 5: step order, so advancing to a later step records the step being left
// as a success (`advanced`); finishing the checkout records the pay step as
// `completed`.
const CHECKOUT_STEP_ORDER = ["personal-info", "delivery", "pay"];

function resolveStep(searchParams) {
  const routeStep = searchParams.get("step");
  if (routeStep === "personal-info") return "personal-info";
  if (routeStep === "delivery" || routeStep === "pay") return routeStep;
  if (routeStep === "payment") return "pay";
  if (routeStep === "customize") return "personal-info";
  return "personal-info";
}

export default function CheckoutRoutePage() {
  return (
    <Suspense fallback={<CheckoutPageFallback />}>
      <CheckoutRouteContent />
    </Suspense>
  );
}

function CheckoutRouteContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isTour } = useTourState();
  const sku = Array.isArray(params?.sku) ? params.sku[0] : params?.sku;
  const { item, loading } = useCatalogItem(sku);
  const step = resolveStep(searchParams);
  const heatmapAutomation = searchParams.get("m1HeatmapTest") === "1";
  const isHeatmapPreview = searchParams.get("heatmapPreview") === "1";

  // M2 Part 3: capture is enabled on all checkout steps. `step` is already
  // resolved/validated to one of personal-info | delivery | pay above and is
  // passed through to the session, so the scanner tags each step's clicks.
  useCheckoutHeatmapCapture({
    enabled: Boolean(item) && !isHeatmapPreview,
    sku: item?.sku || sku,
    step,
    automation: heatmapAutomation,
  });

  return (
    <ShopFrame isTour={isTour} showChat heatmapHref={getCheckoutHeatmapHref(item?.sku || sku || "001")}>
      {loading ? (
        <div className="py-24 text-sm text-muted-foreground">Loading checkout...</div>
      ) : !item ? (
        <div className="py-24 text-sm text-muted-foreground">Product not found.</div>
      ) : (
        <motion.div key="checkout" {...fade} transition={{ duration: 0.2 }}>
          <CheckoutFlow
            item={item}
            step={step}
            setStep={(nextStep) => {
              // Advancing to a later step = the current step was a success.
              if (CHECKOUT_STEP_ORDER.indexOf(nextStep) > CHECKOUT_STEP_ORDER.indexOf(step)) {
                flushCheckoutHeatmapOutcome("advanced");
              }
              router.push(getCheckoutHref(item.sku, nextStep, { isTour }));
            }}
            onBackToDetails={() => router.push(getDetailsHref(item.sku, { isTour, step: "details" }))}
            onFinish={() => {
              // Finishing checkout = the pay step (final step) was completed.
              flushCheckoutHeatmapOutcome("completed");
              router.push(getThankYouHref({ isTour, step: "thankyou", sku: item.sku }));
            }}
          />
        </motion.div>
      )}
    </ShopFrame>
  );
}

function CheckoutPageFallback() {
  return (
    <ShopFrame showChat>
      <div className="py-24 text-sm text-muted-foreground">Loading checkout...</div>
    </ShopFrame>
  );
}
