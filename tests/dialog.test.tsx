import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

function ControlledDialog({ disableOpener = false, customFocus = false }: { disableOpener?: boolean; customFocus?: boolean }) {
  const [open, setOpen] = useState(false);
  const [removed, setRemoved] = useState(false);

  return <>
    <button id="add-item" onClick={() => setOpen(true)}>Add item</button>
    {!removed || disableOpener ? <button disabled={removed} onClick={() => setOpen(true)}>Edit item</button> : null}
    <button id="custom-focus">Custom focus</button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        returnFocusFallback="#add-item"
        onCloseAutoFocus={customFocus ? (event) => {
          event.preventDefault();
          document.getElementById("custom-focus")?.focus();
        } : undefined}
      >
        <DialogTitle>Edit item</DialogTitle>
        <DialogDescription>Update or remove this item.</DialogDescription>
        <label>Name<input defaultValue="Rice" /></label>
        <button onClick={() => setOpen(false)}>Cancel</button>
        <button onClick={() => { setRemoved(true); setOpen(false); }}>Delete</button>
      </DialogContent>
    </Dialog>
  </>;
}

test("controlled dialogs return focus to their latest opener on cancel and Escape", async () => {
  const user = userEvent.setup();
  render(<ControlledDialog />);
  const edit = screen.getByRole("button", { name: "Edit item" });
  await user.click(edit);
  expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(edit).toHaveFocus());

  const add = screen.getByRole("button", { name: "Add item" });
  await user.click(add);
  await user.keyboard("{Escape}");
  await waitFor(() => expect(add).toHaveFocus());
});

test.each([false, true])("uses a useful fallback when the opener is removed or disabled (disabled: %s)", async (disableOpener) => {
  const user = userEvent.setup();
  render(<ControlledDialog disableOpener={disableOpener} />);
  await user.click(screen.getByRole("button", { name: "Edit item" }));
  await user.click(screen.getByRole("button", { name: "Delete" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Add item" })).toHaveFocus());
});

test("preserves an explicit close focus handler", async () => {
  const user = userEvent.setup();
  render(<ControlledDialog customFocus />);
  await user.click(screen.getByRole("button", { name: "Edit item" }));
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.getByRole("button", { name: "Custom focus" })).toHaveFocus());
});
