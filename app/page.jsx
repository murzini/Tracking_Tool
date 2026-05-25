"use client";

import { Suspense, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Landing } from "../components/prototype/Landing";
import {
  ShopFrame,
  getCheckoutHref,
  getDetailsHref,
  getSearchHref,
  useRemoteConfig,
  useTourState,
} from "../components/prototype/shopRuntime";
import { fade } from "../lib/prototype/fade";

export default function ShopPage() {
  return (
    <Suspense fallback={<LandingPageFallback />}>
      <LandingPageContent />
    </Suspense>
  );
}

function LandingPageContent() {
  const router = useRouter();
  const landingConfig = useRemoteConfig("/api/landing-config", { requireOkConfig: true });
  const { isTour, tourStep, tourSku } = useTourState();

  useEffect(() => {
    if (!isTour || tourStep === "landing") return;

    if (tourStep === "search") {
      router.replace(getSearchHref({ isTour: true, step: "search", sku: tourSku }));
      return;
    }

    if (tourStep === "details" && tourSku) {
      router.replace(getDetailsHref(tourSku, { isTour: true, step: "details" }));
      return;
    }

    if ((tourStep === "personal-info" || tourStep === "customize" || tourStep === "delivery" || tourStep === "payment") && tourSku) {
      const checkoutStep = tourStep === "payment" ? "payment" : tourStep === "customize" ? "personal-info" : tourStep;
      router.replace(getCheckoutHref(tourSku, checkoutStep, { isTour: true }));
      return;
    }
  }, [isTour, router, tourSku, tourStep]);

  return (
    <ShopFrame isTour={isTour}>
      <motion.div key="landing" {...fade} transition={{ duration: 0.2 }}>
        <Landing
          config={landingConfig}
          onStart={() => router.push(getSearchHref({ isTour, step: "search", sku: tourSku }))}
        />
      </motion.div>
    </ShopFrame>
  );
}

function LandingPageFallback() {
  return (
    <ShopFrame>
      <div className="py-24 text-sm text-muted-foreground">Loading...</div>
    </ShopFrame>
  );
}
