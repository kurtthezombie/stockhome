"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MAX_BACKUP_BYTES, parseBackup, validateBackup, type Backup } from "@/lib/backup";
import { supabase } from "@/lib/supabase";

export function BackupControls() {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ backup: Backup; userId: string } | null>(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function currentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("Sign in to export or import your data.");
    return data.user;
  }
  function report(error: unknown) {
    setError(error instanceof Error ? error.message : "The operation failed. Please try again.");
  }
  async function exportData() {
    setBusy(true); setError(null); setMessage(null);
    try {
      await currentUser();
      const { data, error } = await supabase.rpc("export_stockhome_backup");
      if (error) throw new Error(error.message);
      const backup = validateBackup(data);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      if (blob.size > MAX_BACKUP_BYTES) throw new Error("Your data exceeds the 10 MB backup limit.");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `stockhome-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Backup downloaded. Store it somewhere private; it contains your household data.");
    } catch (error) { report(error); } finally { setBusy(false); }
  }
  async function selectFile(file?: File) {
    if (!file) return;
    setBusy(true); setError(null); setMessage(null); setPending(null);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error("Backup files must be 10 MB or smaller.");
      const user = await currentUser();
      const backup = parseBackup(await file.text());
      setReplace(false); setPending({ backup, userId: user.id });
    } catch (error) { report(error); } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function importData() {
    if (!pending) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const user = await currentUser();
      if (user.id !== pending.userId) throw new Error("Your account changed. Select the backup again.");
      const { error } = await supabase.rpc("import_stockhome_backup", { backup: pending.backup, replace_existing: replace });
      if (error) {
        if (error.code === "23505") throw new Error("Import cancelled: a grocery name already exists. No data was changed. Use a different backup or choose replace.");
        throw new Error(`Import could not be confirmed. Refresh your data before retrying. ${error.message}`);
      }
      setPending(null);
      setMessage("Import complete. Your inventory, grocery list, and tasks are saved.");
    } catch (error) { report(error); } finally { setBusy(false); }
  }
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">Download your inventory, grocery list, and tasks, or import a StockHome backup (up to 10 MB). Account credentials are excluded.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={exportData}>Export backup</Button>
        <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>Import backup</Button>
      </div>
      <input ref={input} type="file" accept=".json,application/json" aria-label="Choose StockHome backup" className="hidden" disabled={busy} onChange={(event) => { void selectFile(event.target.files?.[0]); }} />
      {busy && <p role="status" className="text-sm">Processing backup…</p>}
      {error && !pending && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {message && <p role="status" className="text-sm">{message}</p>}
      <Dialog open={Boolean(pending)} onOpenChange={(open) => { if (!open && !busy) { setPending(null); setError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import backup</DialogTitle>
            <DialogDescription>Review the records and choose how to import them into your signed-in account.</DialogDescription>
          </DialogHeader>
          {pending && <p className="text-sm">{pending.backup.inventory.length} inventory items, {pending.backup.groceries.length} grocery items, and {pending.backup.tasks.length} tasks.</p>}
          <Label className="flex items-center gap-2">
            <Input type="checkbox" className="size-4" checked={replace} disabled={busy} onChange={(event) => setReplace(event.target.checked)} />
            Replace my current inventory, grocery list, and tasks
          </Label>
          <p className="text-sm text-muted-foreground">{replace ? "Your current records will be deleted and replaced. Export a backup first if you want to keep them." : "Records will be added with new IDs. Importing twice duplicates inventory and tasks. An existing grocery name will cancel the entire import."}</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => { setPending(null); setError(null); }}>Cancel</Button>
            <Button variant={replace ? "destructive" : "default"} disabled={busy} onClick={importData}>{busy ? "Importing…" : replace ? "Replace my data" : "Add records"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
