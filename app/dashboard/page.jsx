import { Backpack } from "lucide-react";
import { isAuthorizedToken } from "@/lib/prototype/dashboardAuth";
import { getHeatmapConfig } from "@/lib/prototype/heatmapConfigStore.server";
import { DashboardClient } from "./DashboardClient";

export const metadata = { title: "Admin Dashboard — AdventureBag" };

export default async function DashboardPage({ searchParams }) {
  const token = searchParams?.token ?? "";

  if (!isAuthorizedToken(token)) {
    return <DashboardBlocked />;
  }

  const config = await getHeatmapConfig();
  return <DashboardClient token={token} initialConfig={config} />;
}

function DashboardBlocked() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="mx-auto max-w-sm px-6 py-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3C5A7D] text-white shadow-sm">
          <Backpack className="h-6 w-6" />
        </div>
        <h1 className="mb-2 text-lg font-bold text-[#1F2A37]" data-dashboard-blocked>
          Access denied
        </h1>
        <p className="text-sm text-slate-500">
          A valid token is required. Open this page via the link provided by your administrator.
        </p>
      </div>
    </div>
  );
}
