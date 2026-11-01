import { expect, test, vi } from "vitest";
import { loadAllPages } from "@/lib/pagination";

test.each([0, 1, 500, 501, 1000, 1001])("loads %i records without skipping or repeating page boundaries", async (length) => {
  const rows = Array.from({ length }, (_, id) => ({ id }));
  const fetchPage = vi.fn(async (from: number, to: number) => ({
    data: rows.slice(from, to + 1), error: null, count: from === 0 ? length : null,
  }));
  expect(await loadAllPages(fetchPage)).toEqual(rows);
  expect(fetchPage).toHaveBeenCalledTimes(Math.max(1, Math.ceil(length / 500)));
  for (const [index, call] of fetchPage.mock.calls.entries()) {
    expect(call).toEqual([index * 500, index * 500 + 499]);
  }
});

test("continues after a short page when the API limit is below the requested size", async () => {
  const rows = Array.from({ length: 7 }, (_, id) => ({ id }));
  const fetchPage = vi.fn(async (from: number) => ({
    data: rows.slice(from, from + 2), error: null, count: from === 0 ? rows.length : null,
  }));
  expect(await loadAllPages(fetchPage)).toEqual(rows);
  expect(fetchPage.mock.calls.map(([from]) => from)).toEqual([0, 2, 4, 6]);
});

test("falls back to a final short page when the response omits the count", async () => {
  const rows = Array.from({ length: 501 }, (_, id) => ({ id }));
  const fetchPage = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));
  expect(await loadAllPages(fetchPage)).toEqual(rows);
  expect(fetchPage).toHaveBeenCalledTimes(2);
});

test.each(["returned", "thrown", "missing", "empty"])("rejects the entire result on a %s later-page failure without exposing internal errors", async (mode) => {
  const fetchPage = vi.fn().mockResolvedValueOnce({ data: [{ id: 1 }], error: null, count: 2 });
  if (mode === "thrown") fetchPage.mockRejectedValueOnce(new Error("private database detail"));
  else fetchPage.mockResolvedValueOnce({
    data: mode === "empty" ? [] : null,
    error: mode === "returned" ? { message: "private database detail" } : null,
  });
  await expect(loadAllPages(fetchPage)).rejects.toThrow("We couldn't load the complete list. Please try again.");
  expect(fetchPage).toHaveBeenCalledTimes(2);
});
