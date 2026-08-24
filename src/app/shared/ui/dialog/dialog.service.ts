import { Injectable, signal } from '@angular/core';

export type DialogIntent = 'default' | 'danger' | 'warning' | 'success' | 'info';
export type DialogFieldType = 'text' | 'textarea' | 'date' | 'number' | 'select';

export interface DialogFieldOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface DialogField {
  name: string;
  label: string;
  type?: DialogFieldType;
  value?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  options?: DialogFieldOption[];
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  details?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: string;
  intent?: DialogIntent;
  dismissible?: boolean;
}

export interface FormDialogOptions extends Omit<ConfirmDialogOptions, 'message'> {
  message?: string;
  fields: DialogField[];
}

export interface PromptDialogOptions extends Omit<FormDialogOptions, 'fields'> {
  label: string;
  value?: string;
  placeholder?: string;
  inputType?: Exclude<DialogFieldType, 'select'>;
  required?: boolean;
}

export type DialogFormValues = Record<string, string>;

export interface ConfirmDialogState extends Required<Omit<ConfirmDialogOptions, 'details'>> {
  id: string;
  details?: string;
  fields: DialogField[];
}

interface DialogRequest {
  state: ConfirmDialogState;
  resolve: (result: boolean | DialogFormValues | null) => void;
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly dialog = signal<ConfirmDialogState | null>(null);

  private activeRequest: DialogRequest | null = null;
  private readonly queue: DialogRequest[] = [];

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const request: DialogRequest = {
        state: this.createState(options, []),
        resolve: result => resolve(result === true)
      };

      if (this.activeRequest) {
        this.queue.push(request);
        return;
      }

      this.show(request);
    });
  }

  form(options: FormDialogOptions): Promise<DialogFormValues | null> {
    return new Promise<DialogFormValues | null>((resolve) => {
      const request: DialogRequest = {
        state: this.createState(
          {
            ...options,
            message: options.message ?? 'Complete the details below.'
          },
          options.fields
        ),
        resolve: result => resolve(result && typeof result === 'object' ? result : null)
      };

      if (this.activeRequest) {
        this.queue.push(request);
        return;
      }

      this.show(request);
    });
  }

  async prompt(options: PromptDialogOptions): Promise<string | null> {
    const result = await this.form({
      ...options,
      fields: [
        {
          name: 'value',
          label: options.label,
          type: options.inputType ?? 'text',
          value: options.value,
          placeholder: options.placeholder,
          required: options.required ?? false
        }
      ]
    });

    return result?.['value'] ?? null;
  }

  confirmDiscard(message = 'You have unsaved form changes. Leaving now will discard them.'): Promise<boolean> {
    return this.confirm({
      title: 'Discard unsaved changes?',
      message,
      confirmText: 'Discard changes',
      cancelText: 'Keep editing',
      intent: 'warning',
      icon: 'edit_note'
    });
  }

  settle(result: boolean | DialogFormValues | null): void {
    const request = this.activeRequest;
    if (!request) {
      return;
    }

    request.resolve(result);
    this.activeRequest = null;
    this.dialog.set(null);

    const next = this.queue.shift();
    if (next) {
      queueMicrotask(() => this.show(next));
    }
  }

  private show(request: DialogRequest): void {
    this.activeRequest = request;
    this.dialog.set(request.state);
  }

  private createState(options: ConfirmDialogOptions, fields: DialogField[]): ConfirmDialogState {
    return {
      id: crypto.randomUUID(),
      title: options.title,
      message: options.message,
      details: options.details,
      confirmText: options.confirmText ?? 'Confirm',
      cancelText: options.cancelText ?? 'Cancel',
      icon: options.icon ?? this.defaultIcon(options.intent),
      intent: options.intent ?? 'default',
      dismissible: options.dismissible ?? true,
      fields: fields.map(field => ({
        ...field,
        type: field.type ?? 'text',
        value: field.value ?? ''
      }))
    };
  }

  private defaultIcon(intent: DialogIntent | undefined): string {
    const icons: Record<DialogIntent, string> = {
      default: 'help',
      danger: 'warning',
      warning: 'report_problem',
      success: 'check_circle',
      info: 'info'
    };

    return icons[intent ?? 'default'];
  }
}
