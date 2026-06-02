import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { InventoryItem, InventoryStatus } from "@/types";

import type { InventoryForm, InventoryFormErrors } from "./inventory-types";
import { categoryOptions } from "./inventory-utils";

type InventoryFormDialogProps = {
  editingItem: InventoryItem | null;
  errors: InventoryFormErrors;
  form: InventoryForm;
  isOpen: boolean;
  isSaving: boolean;
  onFormChange: (form: InventoryForm) => void;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function InventoryFormDialog({
  editingItem,
  errors,
  form,
  isOpen,
  isSaving,
  onFormChange,
  onOpenChange,
  onSubmit,
}: InventoryFormDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingItem ? "Edit inventory item" : "Add inventory item"}
          </DialogTitle>
          <DialogDescription>
            Use status to keep restock decisions obvious.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <div className="grid gap-2">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              value={form.name}
              placeholder="Soy sauce"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "item-name-error" : undefined}
              onChange={(event) =>
                onFormChange({
                  ...form,
                  name: event.target.value,
                })
              }
            />
            {errors.name ? (
              <p id="item-name-error" className="text-xs text-destructive">
                {errors.name}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(value) =>
                onFormChange({
                  ...form,
                  status: value as InventoryStatus,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="low_stock">Low stock</SelectItem>
                <SelectItem value="unavailable">Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="item-quantity">Quantity</Label>
              <Input
                id="item-quantity"
                type="number"
                min="0"
                step="0.01"
                value={form.quantity}
                aria-invalid={Boolean(errors.quantity)}
                aria-describedby={
                  errors.quantity ? "item-quantity-error" : undefined
                }
                onChange={(event) =>
                  onFormChange({
                    ...form,
                    quantity: event.target.value,
                  })
                }
              />
              {errors.quantity ? (
                <p id="item-quantity-error" className="text-xs text-destructive">
                  {errors.quantity}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="item-unit">Unit</Label>
              <Input
                id="item-unit"
                value={form.unit}
                placeholder="bottle, kg, roll"
                onChange={(event) =>
                  onFormChange({
                    ...form,
                    unit: event.target.value,
                  })
                }
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="item-has-expiry-date"
                  checked={form.has_expiry_date}
                  onCheckedChange={(checked) =>
                    onFormChange({
                      ...form,
                      has_expiry_date: checked === true,
                      expiry_date: checked === true ? form.expiry_date : "",
                    })
                  }
                />
                <Label htmlFor="item-has-expiry-date">Has expiry date</Label>
              </div>
              {form.has_expiry_date ? (
                <div className="grid gap-2">
                  <Label htmlFor="item-expiry-date">Expiry date</Label>
                  <Input
                    id="item-expiry-date"
                    type="date"
                    value={form.expiry_date}
                    aria-invalid={Boolean(errors.expiry_date)}
                    aria-describedby={
                      errors.expiry_date
                        ? "item-expiry-date-error"
                        : undefined
                    }
                    onChange={(event) =>
                      onFormChange({
                        ...form,
                        expiry_date: event.target.value,
                      })
                    }
                  />
                  {errors.expiry_date ? (
                    <p
                      id="item-expiry-date-error"
                      className="text-xs text-destructive"
                    >
                      {errors.expiry_date}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(value) =>
                  onFormChange({
                    ...form,
                    category: value,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="item-notes">Notes</Label>
            <Textarea
              id="item-notes"
              value={form.notes}
              placeholder="Brand, storage location, or reminder"
              onChange={(event) =>
                onFormChange({
                  ...form,
                  notes: event.target.value,
                })
              }
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
