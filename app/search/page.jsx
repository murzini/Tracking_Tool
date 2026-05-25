"use client";

import { Suspense } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { SearchPage } from "../../components/prototype/SearchPage";
import { ShopFrame, getDetailsHref, useCatalogData, useRemoteConfig, useTourState } from "../../components/prototype/shopRuntime";
import { fade } from "../../lib/prototype/fade";

export default function SearchRoutePage() {
  return (
    <Suspense fallback={<SearchPageFallback />}>
      <SearchRouteContent />
    </Suspense>
  );
}

function SearchRouteContent() {
  const router = useRouter();
  const { isTour } = useTourState();
  const { catalog, loading } = useCatalogData();
  const searchConfig = useRemoteConfig("/api/search-config");

  return (
    <ShopFrame isTour={isTour}>
      {loading ? (
        <div className="py-24 text-sm text-muted-foreground">Loading catalog...</div>
      ) : (
        <motion.div key="search" {...fade} transition={{ duration: 0.2 }}>
          <SearchPage
            items={catalog}
            config={searchConfig}
            onSelect={(item) => {
              router.push(getDetailsHref(item.sku, { isTour, step: "details" }));
            }}
            onBack={() => router.push("/")}
          />
        </motion.div>
      )}
    </ShopFrame>
  );
}

function SearchPageFallback() {
  return (
    <ShopFrame>
      <div className="py-24 text-sm text-muted-foreground">Loading catalog...</div>
    </ShopFrame>
  );
}
