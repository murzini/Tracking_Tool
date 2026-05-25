"use client";

import { Suspense } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ThankYouPage } from "../../components/prototype/ThankYouPage";
import { ShopFrame, useTourState } from "../../components/prototype/shopRuntime";
import { fade } from "../../lib/prototype/fade";

export default function ThankYouRoutePage() {
  return (
    <Suspense fallback={<ThankYouPageFallback />}>
      <ThankYouRouteContent />
    </Suspense>
  );
}

function ThankYouRouteContent() {
  const router = useRouter();
  const { isTour } = useTourState();

  return (
    <ShopFrame isTour={isTour}>
      <motion.div key="thankyou" {...fade} transition={{ duration: 0.2 }}>
        <ThankYouPage onGoHome={() => router.push("/")} />
      </motion.div>
    </ShopFrame>
  );
}

function ThankYouPageFallback() {
  return (
    <ShopFrame>
      <div className="py-24 text-sm text-muted-foreground">Loading...</div>
    </ShopFrame>
  );
}
