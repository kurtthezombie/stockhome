type Page<T> = {
  data: T[] | null;
  error: unknown;
  count?: number | null;
};

// Callers provide a fresh, account-scoped query with a unique final sort key.
export async function loadAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<Page<T>>,
): Promise<T[]> {
  const pageSize = 500;
  const rows: T[] = [];
  let total: number | null = null;

  try {
    for (;;) {
      const page = await fetchPage(rows.length, rows.length + pageSize - 1);
      if (page.error || !page.data) throw new Error();
      if (rows.length === 0) total = page.count ?? null;
      rows.push(...page.data);

      if (total !== null) {
        if (rows.length >= total) return rows;
        // Do not publish a partial list if records changed while paging.
        if (page.data.length === 0) throw new Error();
      } else if (page.data.length < pageSize) {
        return rows;
      }
    }
  } catch {
    throw new Error("We couldn't load the complete list. Please try again.");
  }
}
