import { InventoryPageClient } from "@/components/stockhome/inventory-page";
import type { InventoryStatus } from "@/types";

const validStatuses: InventoryStatus[] = [
  "available",
  "low_stock",
  "unavailable",
];

type InventoryPageProps = {
  searchParams?: Promise<{
    status?: string | string[];
    expiring?: string | string[];
  }>;
};

function parseStatusFilters(statusParam: string | string[] | undefined) {
  const values = Array.isArray(statusParam)
    ? statusParam
    : (statusParam?.split(",") ?? []);

  return values.filter((value): value is InventoryStatus =>
    validStatuses.includes(value as InventoryStatus),
  );
}

export default async function InventoryPage({
  searchParams,
}: InventoryPageProps) {
  const params = await searchParams;
  const initialStatusFilters = parseStatusFilters(params?.status);
  const expiringParam = Array.isArray(params?.expiring)
    ? params.expiring[0]
    : params?.expiring;

  return (
    <InventoryPageClient
      initialStatusFilters={initialStatusFilters}
      initialExpiringSoonOnly={expiringParam === "soon"}
    />
  );
}
