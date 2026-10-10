import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { InventoryItem } from "@/types";

type InventoryDeleteDialogProps = {
  error?: string | null;
  isDeleting: boolean;
  isOpen: boolean;
  item: InventoryItem | null;
  onDelete: () => void;
  onOpenChange: (isOpen: boolean) => void;
};

export function InventoryDeleteDialog({
  error,
  isDeleting,
  isOpen,
  item,
  onDelete,
  onOpenChange,
}: InventoryDeleteDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent returnFocusFallback="#add-inventory-item">
        <DialogHeader>
          <DialogTitle>Delete item?</DialogTitle>
          <DialogDescription>
            This will permanently remove {item?.name ?? "this item"}.
          </DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
