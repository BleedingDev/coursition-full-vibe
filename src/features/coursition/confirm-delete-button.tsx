import { useState } from 'react';
import { Button } from '@techsio/ui-kit/atoms/button';
import { Dialog } from '@techsio/ui-kit/molecules/dialog';

interface ConfirmDeleteButtonProps {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
}

/**
 * Destructive action button paired with a kit alert dialog. Centralises the
 * "are you sure?" flow so delete sites never fall back to the native prompt.
 */
export const ConfirmDeleteButton = ({
  label,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  disabled,
}: ConfirmDeleteButtonProps) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button disabled={disabled} onClick={() => setOpen(true)} type="button" variant="danger">
        {label}
      </Button>
      <Dialog
        actions={
          <>
            <Button onClick={() => setOpen(false)} theme="light" type="button" variant="secondary">
              {cancelLabel}
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
              type="button"
              variant="danger"
            >
              {confirmLabel}
            </Button>
          </>
        }
        behavior="modal"
        customTrigger
        description={description}
        hideCloseButton
        modal
        onOpenChange={({ open: nextOpen }) => setOpen(nextOpen)}
        open={open}
        role="alertdialog"
        size="sm"
        title={title}
      />
    </>
  );
};
