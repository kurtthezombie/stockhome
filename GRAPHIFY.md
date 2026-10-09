# Graphify pilot

Graphify is optional local developer tooling for exploring StockHome's code relationships. It is installed in `.graphify-venv`, separately from the Next.js application. The version is pinned in `requirements-graphify.txt`.

## Setup on Windows

From the repository root, with Python 3.10 or newer:

```powershell
python -m venv .graphify-venv
.\.graphify-venv\Scripts\python.exe -m pip install -r requirements-graphify.txt
```

No virtual-environment activation or global PATH change is needed. Installation downloads Python packages; the pilot's extraction uses local parsers.

## Scope

`.graphifyignore` allows only `src/`, `tests/`, and `supabase/migrations/`. Graphify also respects `.gitignore`. Dependencies, generated output, environment files, and other files outside that scope are excluded. This scans migration files, not a live Supabase database.

Documentation and media extraction are outside this pilot. They require a separate decision about model-backed processing.

## Build or refresh

```powershell
.\.graphify-venv\Scripts\graphify.exe extract . --code-only --no-cluster
.\.graphify-venv\Scripts\graphify.exe cluster-only . --no-label
```

The first command extracts code without semantic model calls. The second clusters the graph and generates its report and visualization without model-generated community names. Repeat both commands after code changes; extraction supports incremental updates. Check that each command succeeds before using the output.

Generated files live in the ignored `graphify-out/` directory:

- `graph.json`: queryable relationships and source locations.
- `GRAPH_REPORT.md`: graph summary.
- `graph.html`: interactive visualization; open it in a browser.

## Query

```powershell
.\.graphify-venv\Scripts\graphify.exe query "DialogContent" --budget 1000
.\.graphify-venv\Scripts\graphify.exe explain "GroceryList"
.\.graphify-venv\Scripts\graphify.exe query "inventory refresh tests" --budget 1000
.\.graphify-venv\Scripts\graphify.exe explain "supabase/migrations/20261008000100_grocery_items.sql::public.grocery_items"
```

Use the returned source locations to inspect the actual implementation. Graph relationships are navigation aids, not proof of runtime behavior, test coverage, or database authorization.

## Pilot results (2026-10-10)

Graphify 0.9.82 on Python 3.13.7 scanned 68 code files and produced 345 nodes, 1,128 clustered edges, and 14 communities. The report records zero input/output model tokens. A second extraction found 68 unchanged files and left the output intact. The indexed-file manifest contains only the allowed directories, including both SQL migrations.

- `DialogContent` locates its task, grocery, inventory, app-shell, and backup consumers, plus the dedicated dialog tests.
- `GroceryList` links to `InventoryPageClient`, `ListLoadFeedback`, `AnimatedList`, and the action/grocery feedback tests.
- The qualified grocery table query finds its indexes and foreign-key references to `auth.users` and `public.inventory_items`.
- Broad natural-language queries can select similarly named symbols and truncate results. Prefer exact symbols or `path::symbol` queries, then inspect source.
- Five tests yielded no symbols: `animated-list.test.tsx`, `dashboard-stock-chart.test.tsx`, `grocery-utils.test.ts`, `loading-status.test.tsx`, and `setup.ts`. CSS and the favicon are unsupported and skipped. This graph is therefore not a complete test or visual dependency map.
- The short table name `grocery_items` matched an index; `public.grocery_items` was ambiguous between a definition and a reference. The qualified query above selects the migration definition explicitly.

The pilot is useful for component navigation and schema exploration. Keep source inspection and the existing tests as the authority for correctness.

## Integration status

This pilot uses manual commands. No Git hooks or assistant configuration are installed. The MCP dependency is available for a later local integration after assessing extraction quality.

Official reference: [Graphify source and documentation](https://github.com/Graphify-Labs/graphify).
