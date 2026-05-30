import { isAuthorizedToken } from "@/lib/prototype/dashboardAuth";
import ReportClientPage from "./ReportClientPage";
import { Backpack } from "lucide-react";

export const metadata = { title: "Report — AdventureBag" };

function Blocked() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="mx-auto max-w-sm px-6 py-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3C5A7D] text-white shadow-sm">
          <Backpack className="h-6 w-6" />
        </div>
        <h1 className="mb-2 text-lg font-bold text-[#1F2A37]">Access denied</h1>
        <p className="text-sm text-slate-500">A valid token is required.</p>
      </div>
    </div>
  );
}

export default async function ReportPage({ searchParams }) {
  const token = searchParams?.token ?? "";
  if (!isAuthorizedToken(token)) return <Blocked />;
  const source = searchParams?.source ?? null;
  return <ReportClientPage token={token} source={source} />;
}
