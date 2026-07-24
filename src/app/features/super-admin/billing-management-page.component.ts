import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { AcDropdownComponent } from '../../shared/ui/dropdown/dropdown.component';
import {
  BillingManagementSnapshot,
  BillingPayment,
  BillingTaxRate
} from './billing-management.models';
import { BillingManagementService } from './billing-management.service';

type BillingTab = 'invoices' | 'payments' | 'taxes' | 'gst' | 'refunds' | 'credits' | 'transactions';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AcDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="billing-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Billing</p>
          <h1 class="ac-page-title">Invoices, Payments, Taxes, GST</h1>
          <p>Control SaaS billing operations across invoices, payment receipts, GST rates, refunds, credits, and ledger transactions.</p>
        </div>
        <div class="head-actions">
          <a class="icon-btn" routerLink="/super-admin/subscriptions" title="Open subscriptions">
            <span class="material-symbols-rounded">autorenew</span>
          </a>
          <button class="icon-btn" type="button" (click)="load()" title="Refresh billing">
            <span class="material-symbols-rounded">refresh</span>
          </button>
        </div>
      </header>

      @if (snapshot(); as model) {
        <section class="stat-grid">
          <article class="stat"><span class="material-symbols-rounded">receipt_long</span><p>Open Invoices</p><strong>{{ money(model.summary.openInvoiceAmount, model.summary.currencyCode) }}</strong></article>
          <article class="stat"><span class="material-symbols-rounded">payments</span><p>Paid</p><strong>{{ money(model.summary.paidAmount, model.summary.currencyCode) }}</strong></article>
          <article class="stat"><span class="material-symbols-rounded">percent</span><p>Tax / GST</p><strong>{{ money(model.summary.taxCollected, model.summary.currencyCode) }}</strong></article>
          <article class="stat"><span class="material-symbols-rounded">account_balance_wallet</span><p>Credit Balance</p><strong>{{ money(model.summary.creditBalance, model.summary.currencyCode) }}</strong></article>
        </section>

        <nav class="tabs" aria-label="Billing sections">
          @for (tab of tabs; track tab.id) {
            <button type="button" [class.active]="activeTab() === tab.id" (click)="activeTab.set(tab.id)">
              <span class="material-symbols-rounded">{{ tab.icon }}</span>
              {{ tab.label }}
            </button>
          }
        </nav>

        <section class="workspace-grid">
          <main class="table-panel">
            @if (activeTab() === 'invoices') {
              <table>
                <thead><tr><th>Invoice</th><th>Hospital</th><th>Base</th><th>Tax</th><th>Total</th><th>Status</th><th>Due</th></tr></thead>
                <tbody>
                  @for (invoice of model.invoices; track invoice.invoiceId) {
                    <tr>
                      <td><code>{{ invoice.invoiceNo }}</code></td>
                      <td>{{ invoice.hospitalName }}</td>
                      <td>{{ money(invoice.amount, invoice.currencyCode) }}</td>
                      <td>{{ money(invoice.taxAmount, invoice.currencyCode) }}</td>
                      <td>{{ money(invoice.totalAmount, invoice.currencyCode) }}</td>
                      <td><span class="pill" [class]="statusClass(invoice.status)">{{ invoice.status }}</span></td>
                      <td>{{ invoice.dueDate | date:'mediumDate' }}</td>
                    </tr>
                  } @empty { <tr><td colspan="7" class="empty">No invoices yet.</td></tr> }
                </tbody>
              </table>
            }

            @if (activeTab() === 'payments') {
              <table>
                <thead><tr><th>Reference</th><th>Hospital</th><th>Amount</th><th>Method</th><th>Status</th><th>Paid</th><th>Refund</th></tr></thead>
                <tbody>
                  @for (payment of model.payments; track payment.paymentId) {
                    <tr>
                      <td><code>{{ payment.paymentReference }}</code></td>
                      <td>{{ payment.hospitalName }}</td>
                      <td>{{ money(payment.amount, payment.currencyCode) }}</td>
                      <td>{{ payment.method }}</td>
                      <td><span class="pill" [class]="statusClass(payment.status)">{{ payment.status }}</span></td>
                      <td>{{ payment.paidAt | date:'mediumDate' }}</td>
                      <td><button class="icon-btn" type="button" (click)="selectRefundPayment(payment)" title="Refund"><span class="material-symbols-rounded">undo</span></button></td>
                    </tr>
                  } @empty { <tr><td colspan="7" class="empty">No payments yet.</td></tr> }
                </tbody>
              </table>
            }

            @if (activeTab() === 'taxes' || activeTab() === 'gst') {
              <table>
                <thead><tr><th>Tax Code</th><th>Name</th><th>Type</th><th>Region</th><th>Rate</th><th>GSTIN</th><th>Status</th></tr></thead>
                <tbody>
                  @for (tax of filteredTaxes(model.taxRates); track tax.taxRateId) {
                    <tr [class.selected]="taxForm.taxCode === tax.taxCode">
                      <td><button class="link-cell" type="button" (click)="selectTax(tax)"><strong>{{ tax.taxCode }}</strong></button></td>
                      <td>{{ tax.taxName }}</td>
                      <td>{{ tax.taxType }}</td>
                      <td>{{ tax.countryCode }} {{ tax.stateCode || '' }}</td>
                      <td>{{ tax.ratePercent }}%</td>
                      <td>{{ tax.registrationNo || '-' }}</td>
                      <td><span class="pill" [class.active]="tax.isActive">{{ tax.isDefault ? 'Default' : (tax.isActive ? 'Active' : 'Inactive') }}</span></td>
                    </tr>
                  } @empty { <tr><td colspan="7" class="empty">No tax rates configured.</td></tr> }
                </tbody>
              </table>
            }

            @if (activeTab() === 'refunds') {
              <table>
                <thead><tr><th>Refund</th><th>Hospital</th><th>Amount</th><th>Status</th><th>Reason</th><th>Requested By</th></tr></thead>
                <tbody>
                  @for (refund of model.refunds; track refund.refundId) {
                    <tr><td><code>{{ refund.refundReference }}</code></td><td>{{ refund.hospitalName }}</td><td>{{ money(refund.amount, refund.currencyCode) }}</td><td><span class="pill" [class]="statusClass(refund.status)">{{ refund.status }}</span></td><td>{{ refund.reason }}</td><td>{{ refund.requestedBy }}</td></tr>
                  } @empty { <tr><td colspan="6" class="empty">No refunds issued.</td></tr> }
                </tbody>
              </table>
            }

            @if (activeTab() === 'credits') {
              <table>
                <thead><tr><th>Credit</th><th>Hospital</th><th>Amount</th><th>Remaining</th><th>Status</th><th>Expires</th></tr></thead>
                <tbody>
                  @for (credit of model.credits; track credit.creditId) {
                    <tr><td><code>{{ credit.creditNo }}</code></td><td>{{ credit.hospitalName }}</td><td>{{ money(credit.amount, credit.currencyCode) }}</td><td>{{ money(credit.remainingAmount, credit.currencyCode) }}</td><td><span class="pill" [class]="statusClass(credit.status)">{{ credit.status }}</span></td><td>{{ credit.expiresAt ? (credit.expiresAt | date:'mediumDate') : '-' }}</td></tr>
                  } @empty { <tr><td colspan="6" class="empty">No credits issued.</td></tr> }
                </tbody>
              </table>
            }

            @if (activeTab() === 'transactions') {
              <table>
                <thead><tr><th>Reference</th><th>Hospital</th><th>Type</th><th>Direction</th><th>Amount</th><th>Status</th><th>Occurred</th></tr></thead>
                <tbody>
                  @for (tx of model.transactions; track tx.transactionId) {
                    <tr><td><code>{{ tx.referenceNo }}</code></td><td>{{ tx.hospitalName }}</td><td>{{ tx.transactionType }}</td><td>{{ tx.direction }}</td><td>{{ money(tx.amount, tx.currencyCode) }}</td><td><span class="pill" [class]="statusClass(tx.status)">{{ tx.status }}</span></td><td>{{ tx.occurredAt | date:'medium' }}</td></tr>
                  } @empty { <tr><td colspan="7" class="empty">No billing transactions yet.</td></tr> }
                </tbody>
              </table>
            }
          </main>

          <aside class="ops-panel">
            <h2>Billing Actions</h2>

            <section class="mini-form">
              <h3>Taxes / GST</h3>
              <div class="form-grid">
                <input [(ngModel)]="taxForm.taxCode" name="taxCode" placeholder="GST18" />
                <input [(ngModel)]="taxForm.taxName" name="taxName" placeholder="GST 18%" />
                <ac-dropdown [(ngModel)]="taxForm.taxType" name="taxType" [options]="taxTypeOptions" />
                <input [(ngModel)]="taxForm.ratePercent" name="ratePercent" type="number" placeholder="18" />
                <input [(ngModel)]="taxForm.countryCode" name="countryCode" placeholder="IN" />
                <input [(ngModel)]="taxForm.stateCode" name="stateCode" placeholder="MH" />
                <input class="wide" [(ngModel)]="taxForm.registrationNo" name="registrationNo" placeholder="GSTIN / Registration No" />
              </div>
              <label class="check"><input type="checkbox" [(ngModel)]="taxForm.isDefault" name="isDefault" /> Default</label>
              <label class="check"><input type="checkbox" [(ngModel)]="taxForm.isActive" name="isActive" /> Active</label>
              <button class="ac-btn ac-btn-primary" type="button" (click)="saveTax()">Save Tax</button>
            </section>

            <section class="mini-form">
              <h3>Refunds</h3>
              <ac-dropdown [(ngModel)]="refundForm.paymentId" name="refundPaymentId" [options]="paymentOptions(model)" />
              <input [(ngModel)]="refundForm.amount" name="refundAmount" type="number" placeholder="Amount" />
              <input [(ngModel)]="refundForm.currencyCode" name="refundCurrency" placeholder="INR" />
              <input [(ngModel)]="refundForm.reason" name="refundReason" placeholder="Reason" />
              <ac-dropdown [(ngModel)]="refundForm.status" name="refundStatus" [options]="refundStatusOptions" />
              <button class="ac-btn ac-btn-primary" type="button" (click)="createRefund()">Create Refund</button>
            </section>

            <section class="mini-form">
              <h3>Credits</h3>
              <ac-dropdown [(ngModel)]="creditForm.tenantCode" name="creditTenant" [options]="tenantOptions(model)" />
              <input [(ngModel)]="creditForm.amount" name="creditAmount" type="number" placeholder="Amount" />
              <input [(ngModel)]="creditForm.currencyCode" name="creditCurrency" placeholder="INR" />
              <input [(ngModel)]="creditForm.reason" name="creditReason" placeholder="Reason" />
              <input [(ngModel)]="creditForm.expiresAt" name="creditExpiresAt" type="date" />
              <button class="ac-btn ac-btn-primary" type="button" (click)="createCredit()">Issue Credit</button>
            </section>

            <section class="mini-form">
              <h3>Transactions</h3>
              <ac-dropdown [(ngModel)]="transactionForm.tenantCode" name="txTenant" [options]="tenantOptions(model)" />
              <input [(ngModel)]="transactionForm.transactionType" name="txType" placeholder="Invoice / Payment / Adjustment" />
              <input [(ngModel)]="transactionForm.referenceNo" name="txRef" placeholder="Reference" />
              <ac-dropdown [(ngModel)]="transactionForm.direction" name="txDirection" [options]="directionOptions" />
              <input [(ngModel)]="transactionForm.amount" name="txAmount" type="number" placeholder="Amount" />
              <input [(ngModel)]="transactionForm.currencyCode" name="txCurrency" placeholder="INR" />
              <ac-dropdown [(ngModel)]="transactionForm.status" name="txStatus" [options]="transactionStatusOptions" />
              <input [(ngModel)]="transactionForm.description" name="txDescription" placeholder="Description" />
              <button class="ac-btn ac-btn-primary" type="button" (click)="recordTransaction()">Record Transaction</button>
            </section>
          </aside>
        </section>
      } @else {
        <section class="loading">Loading billing workspace...</section>
      }
    </section>
  `,
  styles: [`
    .billing-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head, .stat, .table-panel, .ops-panel { background: var(--ac-surface); border: 1px solid var(--ac-border); border-radius: 8px; box-shadow: var(--ac-shadow-sm); }
    .page-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; padding: 20px; }
    .page-head p { margin: 4px 0 0; color: var(--ac-muted); }
    .eyebrow { margin: 0; text-transform: uppercase; letter-spacing: .08em; font-size: 12px; color: var(--ac-primary); font-weight: 700; }
    .head-actions { display: flex; gap: 8px; }
    .icon-btn { width: 38px; height: 38px; display: inline-grid; place-items: center; border: 1px solid var(--ac-border); border-radius: 8px; color: var(--ac-text); background: var(--ac-surface); text-decoration: none; cursor: pointer; }
    .stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .stat { padding: 16px; display: grid; gap: 6px; }
    .stat span { color: var(--ac-primary); }
    .stat p { margin: 0; color: var(--ac-muted); font-size: 13px; }
    .stat strong { font-size: 24px; }
    .tabs { display: flex; flex-wrap: wrap; gap: 8px; }
    .tabs button { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text); padding: 9px 12px; cursor: pointer; }
    .tabs button.active { border-color: var(--ac-primary); background: color-mix(in srgb, var(--ac-primary) 10%, var(--ac-surface)); color: var(--ac-primary); }
    .workspace-grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 16px; align-items: start; }
    .table-panel, .ops-panel { padding: 14px; overflow: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 760px; }
    th, td { padding: 11px 10px; border-bottom: 1px solid var(--ac-border); text-align: left; white-space: nowrap; }
    th { font-size: 12px; color: var(--ac-muted); text-transform: uppercase; }
    code { font-size: 12px; }
    .selected { background: color-mix(in srgb, var(--ac-primary) 6%, var(--ac-surface)); }
    .link-cell { border: 0; background: transparent; color: var(--ac-text); cursor: pointer; padding: 0; text-align: left; }
    .pill { border-radius: 999px; padding: 4px 8px; font-size: 12px; background: var(--ac-border); }
    .pill.paid, .pill.success, .pill.completed, .pill.posted, .pill.active { background: color-mix(in srgb, var(--ac-success) 14%, var(--ac-surface)); color: var(--ac-success); }
    .pill.open, .pill.pending, .pill.requested { background: color-mix(in srgb, var(--ac-primary) 14%, var(--ac-surface)); color: var(--ac-primary); }
    .pill.failed, .pill.rejected, .pill.void { background: color-mix(in srgb, var(--ac-danger) 14%, var(--ac-surface)); color: var(--ac-danger); }
    .ops-panel { display: grid; gap: 14px; }
    .ops-panel h2, .mini-form h3 { margin: 0; }
    .mini-form { border: 1px solid var(--ac-border); border-radius: 8px; padding: 12px; display: grid; gap: 9px; background: var(--ac-subtle); }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    input, select { min-height: 38px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 0 10px; background: var(--ac-surface); color: var(--ac-text); min-width: 0; }
    .wide { grid-column: 1 / -1; }
    .check { display: inline-flex; align-items: center; gap: 8px; color: var(--ac-muted); }
    .check input { min-height: auto; }
    .empty, .loading { color: var(--ac-muted); }
    @media (max-width: 1120px) { .workspace-grid, .stat-grid { grid-template-columns: 1fr; } }
    @media (max-width: 720px) { .page-head { flex-direction: column; } .form-grid { grid-template-columns: 1fr; } }
  `]
})
export class BillingManagementPageComponent implements OnInit {
  private readonly billingService = inject(BillingManagementService);
  private readonly toast = inject(ToastService);

  protected readonly snapshot = signal<BillingManagementSnapshot | null>(null);
  protected readonly activeTab = signal<BillingTab>('invoices');
  protected readonly tabs: { id: BillingTab; label: string; icon: string }[] = [
    { id: 'invoices', label: 'Invoices', icon: 'receipt_long' },
    { id: 'payments', label: 'Payments', icon: 'payments' },
    { id: 'taxes', label: 'Taxes', icon: 'percent' },
    { id: 'gst', label: 'GST', icon: 'request_quote' },
    { id: 'refunds', label: 'Refunds', icon: 'undo' },
    { id: 'credits', label: 'Credits', icon: 'account_balance_wallet' },
    { id: 'transactions', label: 'Transactions', icon: 'sync_alt' }
  ];

  protected readonly paymentCount = computed(() => this.snapshot()?.payments.length ?? 0);

  protected taxForm = { taxCode: 'GST18', taxName: 'GST 18%', taxType: 'GST', countryCode: 'IN', stateCode: '', ratePercent: 18, registrationNo: '', isDefault: true, isActive: true };
  protected refundForm = { paymentId: '', amount: 0, currencyCode: 'INR', reason: '', status: 'Requested' };
  protected creditForm = { tenantCode: '', amount: 0, currencyCode: 'INR', reason: '', expiresAt: '' };
  protected transactionForm = { tenantCode: '', subscriptionId: null, invoiceId: null, paymentId: null, refundId: null, creditId: null, transactionType: 'Adjustment', referenceNo: '', direction: 'Debit', amount: 0, currencyCode: 'INR', status: 'Posted', description: '' };
  protected readonly taxTypeOptions = ['GST', 'CGST', 'SGST', 'IGST', 'VAT'].map(value => ({ label: value, value }));
  protected readonly refundStatusOptions = ['Requested', 'Approved', 'Completed', 'Rejected'].map(value => ({ label: value, value }));
  protected readonly directionOptions = ['Debit', 'Credit'].map(value => ({ label: value, value }));
  protected readonly transactionStatusOptions = ['Posted', 'Pending', 'Void'].map(value => ({ label: value, value }));

  ngOnInit(): void {
    void this.load();
  }

  protected paymentOptions(model: BillingManagementSnapshot) {
    return [
      { label: 'Select payment', value: '' },
      ...model.payments.map(payment => ({
        label: `${payment.hospitalName} - ${this.money(payment.amount, payment.currencyCode)}`,
        value: payment.paymentId
      }))
    ];
  }

  protected tenantOptions(model: BillingManagementSnapshot) {
    return [
      { label: 'Select hospital', value: '' },
      ...model.tenants.map(tenant => ({ label: tenant.hospitalName, value: tenant.tenantCode }))
    ];
  }

  protected async load(): Promise<void> {
    const response = await this.billingService.getSnapshot();
    if (!response.success || !response.data) {
      this.toast.error(response.message || 'Could not load billing');
      return;
    }

    this.snapshot.set(response.data);
  }

  protected filteredTaxes(taxes: BillingTaxRate[]): BillingTaxRate[] {
    return this.activeTab() === 'gst' ? taxes.filter(tax => ['GST', 'CGST', 'SGST', 'IGST'].includes(tax.taxType)) : taxes;
  }

  protected selectTax(tax: BillingTaxRate): void {
    this.taxForm = { taxCode: tax.taxCode, taxName: tax.taxName, taxType: tax.taxType, countryCode: tax.countryCode, stateCode: tax.stateCode ?? '', ratePercent: tax.ratePercent, registrationNo: tax.registrationNo, isDefault: tax.isDefault, isActive: tax.isActive };
  }

  protected selectRefundPayment(payment: BillingPayment): void {
    this.activeTab.set('refunds');
    this.refundForm = { paymentId: payment.paymentId, amount: payment.amount, currencyCode: payment.currencyCode, reason: 'Customer refund', status: 'Requested' };
  }

  protected async saveTax(): Promise<void> {
    const response = await this.billingService.saveTaxRate({ ...this.taxForm, stateCode: this.taxForm.stateCode || null, registrationNo: this.taxForm.registrationNo || null });
    this.handleSnapshot(response, 'Tax configuration saved.');
  }

  protected async createRefund(): Promise<void> {
    const response = await this.billingService.createRefund(this.refundForm);
    this.handleSnapshot(response, 'Refund created.');
  }

  protected async createCredit(): Promise<void> {
    const response = await this.billingService.createCredit({ ...this.creditForm, expiresAt: this.creditForm.expiresAt || null });
    this.handleSnapshot(response, 'Credit issued.');
  }

  protected async recordTransaction(): Promise<void> {
    const response = await this.billingService.recordTransaction({ ...this.transactionForm, occurredAt: null });
    this.handleSnapshot(response, 'Transaction recorded.');
  }

  protected money(value: number, currency: string): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 }).format(value || 0);
  }

  protected statusClass(status: string): string {
    return status.toLowerCase();
  }

  private handleSnapshot(response: { success: boolean; data: BillingManagementSnapshot | null; message?: string }, successMessage: string): void {
    if (!response.success || !response.data) {
      this.toast.error(response.message || 'Billing action failed');
      return;
    }

    this.snapshot.set(response.data);
    this.toast.success(successMessage);
  }
}
