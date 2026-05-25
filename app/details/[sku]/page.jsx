"use client";

import { Suspense } from "react";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { DetailsPage } from "../../../components/prototype/DetailsPage";
import {
  ShopFrame,
  getCheckoutHref,
  getSearchHref,
  useCatalogItem,
  useRemoteConfig,
  useTourState,
} from "../../../components/prototype/shopRuntime";
import { fade } from "../../../lib/prototype/fade";

export default function DetailsRoutePage() {
  return (
    <Suspense fallback={<DetailsPageFallback />}>
      <DetailsRouteContent />
    </Suspense>
  );
}

function DetailsRouteContent() {
  const params = useParams();
  const router = useRouter();
  const { isTour } = useTourState();
  const sku = Array.isArray(params?.sku) ? params.sku[0] : params?.sku;
  const { item, loading } = useCatalogItem(sku);
  const detailsConfig = useRemoteConfig("/api/details-config");

  return (
    <ShopFrame isTour={isTour}>
      {loading ? (
        <div className="py-24 text-sm text-muted-foreground">Loading product...</div>
      ) : !item ? (
        <div className="py-24 text-sm text-muted-foreground">Product not found.</div>
      ) : (
        <motion.div key="details" {...fade} transition={{ duration: 0.2 }}>
          <DetailsPage
            item={item}
            config={detailsConfig}
            onBack={() => router.push(getSearchHref({ isTour, step: "search", sku: item.sku }))}
            onCheckout={() => router.push(getCheckoutHref(item.sku, "personal-info", { isTour }))}
          />
        </motion.div>
      )}
    </ShopFrame>
  );
}

function DetailsPageFallback() {
  return (
    <ShopFrame>
      <div className="py-24 text-sm text-muted-foreground">Loading product...</div>
    </ShopFrame>
  );
}
