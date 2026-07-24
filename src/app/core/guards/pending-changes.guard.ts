import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { DialogService } from '../../shared/ui/dialog/dialog.service';

export interface PendingChangesComponent {
  hasUnsavedChanges?: () => boolean;
  unsavedChangesMessage?: () => string;
}

export const pendingChangesGuard: CanDeactivateFn<PendingChangesComponent> = (component) => {
  if (!component.hasUnsavedChanges?.()) {
    return true;
  }

  return inject(DialogService).confirmDiscard(component.unsavedChangesMessage?.());
};
