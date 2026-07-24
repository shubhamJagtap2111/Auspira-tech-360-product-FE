import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { AcDropdownComponent } from '../../shared/ui/dropdown/dropdown.component';
import {
  SubscriptionCoupon,
  SubscriptionInvoice,
  SubscriptionManagementSnapshot,
  TenantSubscription,
  UpsertSubscriptionCouponRequest,
  UpsertSubscriptionRequest
} from './subscription-management.models';
import { SubscriptionManagementService } from './subscription-management.service';

type SubscriptionTab = 'subscriptions' | 'invoices' | 'payments' | 'renewals' | 'trials' | 'coupons';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AcDropdownComponent],
  template: `
    <section class="subscription-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Subscription Management</p>
          <h1 class="ac-page-title">Subscriptions, Invoices, Payments</h1>
          <p>Manage hospital SaaS subscriptions, renewals, trials, coupons, invoices, and payment status.</p>
        </div>
        <div class="head-actions">
          <a class="icon-btn" routerLink="/super-admin/tenants" title="Open tenants">
            <span class="material-symbols-rounded">corporate_fare</span>
          </a>
          <button class="icon-btn" type="button" (click)="load()" title="Refresh subscriptions">
            <span class="material-symbols-rounded">refresh</span>
          </button>
          <button class="ac-btn ac-btn-primary" type="button" (click)="startNewSubscription()">
            <span class="material-symbols-rounded">add</span>
            Subscription
          </button>
        </div>
      </header>

      <nav class="tabs" aria-label="Subscription management sections">
        @for (tab of tabs; track tab.id) {
          <button type="button" [class.active]="activeTab() === tab.id" (click)="activeTab.set(tab.id)">
            <span class="material-symbols-rounded">{{ tab.icon }}</span>
            {{ tab.label }}
          </button>
        }
      </nav>

      @if (snapshot(); as model) {
        <section class="stat-grid">
          <article class="stat">
            <span class="material-symbols-rounded">autorenew</span>
            <p>Subscriptions</p>
            <strong>{{ model.subscriptions.length }}</strong>
          </article>
          <article class="stat">
            <span class="material-symbols-rounded">hourglass_top</span>
            <p>Trials</p>
            <strong>{{ trialCount() }}</strong>
          </article>
          <article class="stat">
            <span class="material-symbols-rounded">receipt_long</span>
            <p>Open Invoices</p>
            <strong>{{ openInvoiceCount() }}</strong>
          </article>
          <article class="stat">
            <span class="material-symbols-rounded">payments</span>
            <p>Revenue</p>
            <strong>{{ formatMoney(revenue(), defaultCurrency()) }}</strong>
          </article>
        </section>

        <section class="workspace-grid">
          <main class="table-panel">
            @if (activeTab() === 'subscriptions') {
              <table>
                <thead>
                  <tr>
                    <th>Hospital</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Grace Period</th>
                    <th>Amount</th>
                    <th>Renew</th>
                  </tr>
                </thead>
                <tbody>
                  @for (subscription of model.subscriptions; track subscription.subscriptionId) {
                    <tr [class.selected]="selectedSubscriptionId() === subscription.subscriptionId">
                      <td>
                        <button class="link-cell" type="button" (click)="selectSubscription(subscription)">
                          <strong>{{ subscription.hospitalName }}</strong>
                          <span>{{ subscription.tenantCode }}</span>
                        </button>
                      </td>
                      <td>{{ subscription.planName }}</td>
                      <td><span class="pill" [class]="statusClass(subscription.status)">{{ subscription.status }}</span></td>
                      <td>{{ subscription.startDate | date:'mediumDate' }}</td>
                      <td>{{ subscription.endDate | date:'mediumDate' }}</td>
                      <td>{{ subscription.gracePeriodDays }} days</td>
                      <td>{{ formatMoney(subscription.amount, subscription.currencyCode) }}</td>
                      <td>
                        <button class="icon-btn" type="button" (click)="selectForRenew(subscription)" title="Renew">
                          <span class="material-symbols-rounded">autorenew</span>
                        </button>
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="8" class="empty">No subscriptions found.</td></tr>
                  }
                </tbody>
              </table>
            }

            @if (activeTab() === 'invoices') {
              <table>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Hospital</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Issued</th>
                    <th>Due</th>
                    <th>Pay</th>
                  </tr>
                </thead>
                <tbody>
                  @for (invoice of model.invoices; track invoice.invoiceId) {
                    <tr [class.selected]="paymentForm.invoiceId === invoice.invoiceId">
                      <td><code>{{ invoice.invoiceNo }}</code></td>
                      <td>{{ invoice.hospitalName }}</td>
                      <td>{{ formatMoney(invoice.totalAmount, invoice.currencyCode) }}</td>
                      <td><span class="pill" [class]="statusClass(invoice.status)">{{ invoice.status }}</span></td>
                      <td>{{ invoice.issuedAt | date:'mediumDate' }}</td>
                      <td>{{ invoice.dueDate | date:'mediumDate' }}</td>
                      <td>
                        <button class="icon-btn" type="button" (click)="selectInvoiceForPayment(invoice)" title="Record payment">
                          <span class="material-symbols-rounded">payments</span>
                        </button>
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="7" class="empty">No invoices found.</td></tr>
                  }
                </tbody>
              </table>
            }

            @if (activeTab() === 'payments') {
              <table>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Hospital</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Paid At</th>
                  </tr>
                </thead>
                <tbody>
                  @for (payment of model.payments; track payment.paymentId) {
                    <tr>
                      <td><code>{{ payment.paymentReference }}</code></td>
                      <td>{{ payment.hospitalName }}</td>
                      <td>{{ formatMoney(payment.amount, payment.currencyCode) }}</td>
                      <td>{{ payment.method }}</td>
                      <td><span class="pill" [class]="statusClass(payment.status)">{{ payment.status }}</span></td>
                      <td>{{ payment.paidAt | date:'medium' }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6" class="empty">No payments recorded.</td></tr>
                  }
                </tbody>
              </table>
            }

            @if (activeTab() === 'renewals') {
              <table>
                <thead>
                  <tr>
                    <th>Hospital</th>
                    <th>Previous End</th>
                    <th>New End</th>
                    <th>Grace</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Requested By</th>
                  </tr>
                </thead>
                <tbody>
                  @for (renewal of model.renewals; track renewal.renewalId) {
                    <tr>
                      <td>{{ renewal.hospitalName }}</td>
                      <td>{{ renewal.previousEndDate | date:'mediumDate' }}</td>
                      <td>{{ renewal.newEndDate | date:'mediumDate' }}</td>
                      <td>{{ renewal.gracePeriodDays }} days</td>
                      <td>{{ formatMoney(renewal.amount, renewal.currencyCode) }}</td>
                      <td><span class="pill active">{{ renewal.status }}</span></td>
                      <td>{{ renewal.requestedBy }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="7" class="empty">No renewal history.</td></tr>
                  }
                </tbody>
              </table>
            }

            @if (activeTab() === 'trials') {
              <table>
                <thead>
                  <tr>
                    <th>Hospital</th>
                    <th>Plan</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (trial of model.trials; track trial.trialId) {
                    <tr>
                      <td>{{ trial.hospitalName }}</td>
                      <td>{{ trial.planCode }}</td>
                      <td>{{ trial.startDate | date:'mediumDate' }}</td>
                      <td>{{ trial.endDate | date:'mediumDate' }}</td>
                      <td><span class="pill" [class]="statusClass(trial.status)">{{ trial.status }}</span></td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5" class="empty">No active or historical trials.</td></tr>
                  }
                </tbody>
              </table>
            }

            @if (activeTab() === 'coupons') {
              <table>
                <thead>
                  <tr>
                    <th>Coupon</th>
                    <th>Discount</th>
                    <th>Redemptions</th>
                    <th>Valid Until</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (coupon of model.coupons; track coupon.couponId) {
                    <tr [class.selected]="couponForm.code === coupon.code">
                      <td>
                        <button class="link-cell" type="button" (click)="selectCoupon(coupon)">
                          <strong>{{ coupon.code }}</strong>
                          <span>{{ coupon.description || '-' }}</span>
                        </button>
                      </td>
                      <td>{{ coupon.discountValue }} {{ coupon.discountType }}</td>
                      <td>{{ coupon.redeemedCount }} / {{ coupon.maxRedemptions ?? 'Unlimited' }}</td>
                      <td>{{ coupon.validUntil ? (coupon.validUntil | date:'mediumDate') : '-' }}</td>
                      <td><span class="pill" [class.off]="!coupon.isActive">{{ coupon.isActive ? 'Active' : 'Inactive' }}</span></td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5" class="empty">No coupons configured.</td></tr>
                  }
                </tbody>
              </table>
            }
          </main>

          <aside class="editor-panel">
            <div class="section-head">
              <div>
                <h2>{{ selectedSubscription()?.hospitalName || 'Subscription' }}</h2>
                <p>{{ selectedSubscription()?.planName || 'Hospital -> Plan -> Dates -> Renew' }}</p>
              </div>
              @if (selectedSubscription(); as subscription) {
                <span class="pill" [class]="statusClass(subscription.status)">{{ subscription.status }}</span>
              }
            </div>

            <form (ngSubmit)="saveSubscription()">
              <label>
                <span>Hospital</span>
                <ac-dropdown name="tenantCode" [(ngModel)]="subscriptionForm.tenantCode" [options]="tenantOptions(model)" required />
              </label>
              <label>
                <span>Plan</span>
                <ac-dropdown name="planCode" [(ngModel)]="subscriptionForm.planCode" [options]="planOptions(model)" (selectionChange)="applySelectedPlanAmount()" required />
              </label>
              <div class="form-grid">
                <label>
                  <span>Start</span>
                  <input type="date" name="startDate" [(ngModel)]="subscriptionForm.startDate" required />
                </label>
                <label>
                  <span>End</span>
                  <input type="date" name="endDate" [(ngModel)]="subscriptionForm.endDate" required />
                </label>
              </div>
              <div class="form-grid">
                <label>
                  <span>Grace Period</span>
                  <input type="number" min="0" name="gracePeriodDays" [(ngModel)]="subscriptionForm.gracePeriodDays" />
                </label>
                <label>
                  <span>Status</span>
                  <ac-dropdown name="status" [(ngModel)]="subscriptionForm.status" [options]="subscriptionStatusOptions()" />
                </label>
              </div>
              <div class="form-grid">
                <label>
                  <span>Billing Cycle</span>
                  <ac-dropdown name="billingCycle" [(ngModel)]="subscriptionForm.billingCycle" [options]="billingCycleOptions()" (selectionChange)="applySelectedPlanAmount()" />
                </label>
                <label>
                  <span>Amount</span>
                  <input type="number" min="0" step="0.01" name="amount" [(ngModel)]="subscriptionForm.amount" />
                </label>
              </div>
              <div class="form-grid">
                <label>
                  <span>Currency</span>
                  <input name="currencyCode" [(ngModel)]="subscriptionForm.currencyCode" />
                </label>
                <label>
                  <span>Coupon</span>
                  <ac-dropdown name="couponCode" [(ngModel)]="subscriptionForm.couponCode" [options]="couponOptions(model)" />
                </label>
              </div>
              <label class="switch">
                <input type="checkbox" name="autoRenew" [(ngModel)]="subscriptionForm.autoRenew" />
                <span>Auto Renew</span>
              </label>
              <div class="form-actions">
                <button class="ac-btn ac-btn-secondary" type="button" (click)="startNewSubscription()">Reset</button>
                <button class="ac-btn ac-btn-primary" type="submit" [disabled]="saving()">
                  <span class="material-symbols-rounded">save</span>
                  Save
                </button>
              </div>
            </form>

            @if (selectedSubscription(); as subscription) {
              <form class="mini-form" (ngSubmit)="renewSubscription(subscription)">
                <h3>Renew</h3>
                <div class="form-grid">
                  <label>
                    <span>New End</span>
                    <input type="date" name="renewEnd" [(ngModel)]="renewForm.newEndDate" />
                  </label>
                  <label>
                    <span>Grace</span>
                    <input type="number" min="0" name="renewGrace" [(ngModel)]="renewForm.gracePeriodDays" />
                  </label>
                </div>
                <div class="form-grid">
                  <label>
                    <span>Amount</span>
                    <input type="number" min="0" step="0.01" name="renewAmount" [(ngModel)]="renewForm.amount" />
                  </label>
                  <label>
                    <span>Currency</span>
                    <input name="renewCurrency" [(ngModel)]="renewForm.currencyCode" />
                  </label>
                </div>
                <label>
                  <span>Notes</span>
                  <input name="renewNotes" [(ngModel)]="renewForm.notes" />
                </label>
                <button class="ac-btn ac-btn-secondary" type="submit">
                  <span class="material-symbols-rounded">autorenew</span>
                  Renew
                </button>
              </form>

              <form class="mini-form" (ngSubmit)="createInvoice(subscription)">
                <h3>Invoice</h3>
                <div class="form-grid">
                  <label>
                    <span>Amount</span>
                    <input type="number" min="0" step="0.01" name="invoiceAmount" [(ngModel)]="invoiceForm.amount" />
                  </label>
                  <label>
                    <span>Tax</span>
                    <input type="number" min="0" step="0.01" name="invoiceTax" [(ngModel)]="invoiceForm.taxAmount" />
                  </label>
                </div>
                <div class="form-grid">
                  <label>
                    <span>Discount</span>
                    <input type="number" min="0" step="0.01" name="invoiceDiscount" [(ngModel)]="invoiceForm.discountAmount" />
                  </label>
                  <label>
                    <span>Due</span>
                    <input type="date" name="invoiceDue" [(ngModel)]="invoiceForm.dueDate" />
                  </label>
                </div>
                <button class="ac-btn ac-btn-secondary" type="submit">
                  <span class="material-symbols-rounded">receipt_long</span>
                  Create Invoice
                </button>
              </form>

              <form class="mini-form" (ngSubmit)="recordPayment(subscription)">
                <h3>Payment</h3>
                <label>
                  <span>Reference</span>
                  <input name="paymentReference" [(ngModel)]="paymentForm.paymentReference" />
                </label>
                <div class="form-grid">
                  <label>
                    <span>Amount</span>
                    <input type="number" min="0" step="0.01" name="paymentAmount" [(ngModel)]="paymentForm.amount" />
                  </label>
                  <label>
                    <span>Method</span>
                    <input name="paymentMethod" [(ngModel)]="paymentForm.method" />
                  </label>
                </div>
                <button class="ac-btn ac-btn-secondary" type="submit">
                  <span class="material-symbols-rounded">payments</span>
                  Record Payment
                </button>
              </form>
            }

            <form class="mini-form" (ngSubmit)="saveCoupon()">
              <h3>Coupon</h3>
              <div class="form-grid">
                <label>
                  <span>Code</span>
                  <input name="couponCode" [(ngModel)]="couponForm.code" />
                </label>
                <label>
                  <span>Type</span>
                  <ac-dropdown name="couponType" [(ngModel)]="couponForm.discountType" [options]="couponTypeOptions" />
                </label>
              </div>
              <div class="form-grid">
                <label>
                  <span>Value</span>
                  <input type="number" min="0" step="0.01" name="couponValue" [(ngModel)]="couponForm.discountValue" />
                </label>
                <label>
                  <span>Max Uses</span>
                  <input type="number" min="0" name="couponMax" [(ngModel)]="couponMaxInput" />
                </label>
              </div>
              <label>
                <span>Description</span>
                <input name="couponDescription" [(ngModel)]="couponForm.description" />
              </label>
              <label class="switch">
                <input type="checkbox" name="couponActive" [(ngModel)]="couponForm.isActive" />
                <span>Active</span>
              </label>
              <button class="ac-btn ac-btn-secondary" type="submit">
                <span class="material-symbols-rounded">sell</span>
                Save Coupon
              </button>
            </form>
          </aside>
        </section>
      } @else {
        <section class="loading">Loading subscriptions...</section>
      }
    </section>
  `,
  styles: `
    .subscription-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head, .head-actions, .tabs, .section-head, .form-grid, .form-actions { display: flex; gap: 12px; }
    .page-head, .section-head { align-items: flex-start; justify-content: space-between; }
    .page-head p:not(.eyebrow), .section-head p { margin: 4px 0 0; color: var(--ac-muted); font-size: 13px; max-width: 860px; }
    .eyebrow { margin: 0 0 4px; color: var(--ac-primary); font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .head-actions { align-items: center; flex-wrap: wrap; justify-content: flex-end; }
    .icon-btn { width: 38px; height: 38px; min-width: 38px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text-2); display: inline-grid; place-items: center; cursor: pointer; text-decoration: none; }
    .icon-btn:hover { border-color: var(--ac-primary); color: var(--ac-primary); }
    .tabs { overflow-x: auto; padding-bottom: 2px; }
    .tabs button { height: 38px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 0 12px; background: var(--ac-surface); color: var(--ac-text-2); font-weight: 800; cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; gap: 7px; }
    .tabs button.active { border-color: var(--ac-primary); color: var(--ac-primary); background: var(--ac-primary-light); }
    .tabs .material-symbols-rounded, .ac-btn .material-symbols-rounded { font-size: 18px; }
    .stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .stat, .table-panel, .editor-panel, .mini-form, .loading { border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); }
    .stat { min-height: 100px; padding: 12px; display: flex; flex-direction: column; gap: 4px; border-top: 3px solid var(--ac-primary); }
    .stat .material-symbols-rounded { color: var(--ac-primary); }
    .stat p { margin: 0; color: var(--ac-muted); font-size: 12px; font-weight: 800; }
    .stat strong { font-size: 22px; line-height: 1.1; }
    .workspace-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(360px, 420px); gap: 16px; align-items: start; }
    .table-panel { overflow: auto; }
    table { width: 100%; min-width: 920px; border-collapse: collapse; }
    th, td { padding: 11px 12px; border-bottom: 1px solid var(--ac-border); text-align: left; vertical-align: middle; font-size: 13px; }
    th { color: var(--ac-muted); background: var(--ac-bg); font-size: 11px; text-transform: uppercase; }
    tr.selected td { background: rgba(37,99,235,.06); }
    code { background: var(--ac-bg); color: var(--ac-muted); border-radius: 6px; padding: 3px 6px; font-size: 12px; }
    .link-cell { border: 0; background: transparent; color: var(--ac-text); text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 3px; padding: 0; }
    .link-cell span { color: var(--ac-muted); font-size: 12px; }
    .pill { display: inline-flex; align-items: center; min-height: 24px; padding: 4px 8px; border-radius: 999px; background: rgba(100,116,139,.12); color: #475569; font-size: 11px; font-weight: 900; white-space: nowrap; }
    .pill.active, .pill.paid, .pill.success, .pill.completed { background: rgba(22,163,74,.12); color: #15803d; }
    .pill.trial, .pill.grace, .pill.open { background: rgba(217,119,6,.12); color: #b45309; }
    .pill.expired, .pill.cancelled, .pill.pastdue, .pill.off { background: rgba(220,38,38,.1); color: #b91c1c; }
    .editor-panel { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
    .editor-panel > form, .mini-form { display: flex; flex-direction: column; gap: 12px; }
    .mini-form { padding: 12px; background: var(--ac-bg); }
    .mini-form h3 { margin: 0; font-size: 14px; }
    label { display: flex; flex-direction: column; gap: 6px; color: var(--ac-text-2); font-size: 12px; font-weight: 800; }
    input, select { height: 38px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 0 10px; background: var(--ac-surface); color: var(--ac-text); font: inherit; min-width: 0; }
    input:focus, select:focus { outline: none; border-color: var(--ac-primary); box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
    .form-grid > label { flex: 1; min-width: 0; }
    .switch { flex-direction: row; align-items: center; min-height: 28px; }
    .switch input { width: 17px; height: 17px; }
    .form-actions { justify-content: flex-end; flex-wrap: wrap; }
    .empty, .loading { margin: 0; padding: 24px; color: var(--ac-muted); text-align: center; font-size: 13px; }
    @media (max-width: 1280px) { .workspace-grid { grid-template-columns: 1fr; } .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 760px) { .page-head, .head-actions, .form-grid { flex-direction: column; align-items: stretch; } .stat-grid { grid-template-columns: 1fr; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubscriptionManagementPageComponent implements OnInit {
  protected readonly tabs: { id: SubscriptionTab; label: string; icon: string }[] = [
    { id: 'subscriptions', label: 'Subscriptions', icon: 'autorenew' },
    { id: 'invoices', label: 'Invoices', icon: 'receipt_long' },
    { id: 'payments', label: 'Payments', icon: 'payments' },
    { id: 'renewals', label: 'Renewals', icon: 'update' },
    { id: 'trials', label: 'Trials', icon: 'hourglass_top' },
    { id: 'coupons', label: 'Coupons', icon: 'sell' }
  ];
  protected readonly statusOptions = ['Trial', 'Active', 'Grace', 'PastDue', 'Expired', 'Cancelled'];
  protected readonly billingCycles = ['Monthly', 'Annual', 'Custom'];

  protected readonly activeTab = signal<SubscriptionTab>('subscriptions');
  protected readonly snapshot = signal<SubscriptionManagementSnapshot | null>(null);
  protected readonly selectedSubscriptionId = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected subscriptionForm: UpsertSubscriptionRequest = emptySubscriptionForm();
  protected renewForm = { newEndDate: todayPlus(365), gracePeriodDays: 15, amount: 0, currencyCode: 'USD', notes: '' };
  protected invoiceForm = { amount: 0, taxAmount: 0, discountAmount: 0, dueDate: todayPlus(15) };
  protected paymentForm = { invoiceId: '', paymentReference: '', amount: 0, currencyCode: 'USD', method: 'BankTransfer', status: 'Success', paidAt: today() };
  protected couponForm: UpsertSubscriptionCouponRequest = emptyCouponForm();
  protected couponMaxInput = '';
  protected readonly couponTypeOptions = [
    { label: 'Percent', value: 'Percent' },
    { label: 'Fixed', value: 'Fixed' }
  ];

  protected readonly selectedSubscription = computed(() =>
    this.snapshot()?.subscriptions.find(item => item.subscriptionId === this.selectedSubscriptionId()) ?? null
  );
  protected readonly trialCount = computed(() => String(this.snapshot()?.trials.filter(trial => trial.status === 'Active').length ?? 0));
  protected readonly openInvoiceCount = computed(() => String(this.snapshot()?.invoices.filter(invoice => invoice.status !== 'Paid').length ?? 0));
  protected readonly revenue = computed(() => this.snapshot()?.payments.filter(payment => ['Success', 'Completed', 'Paid'].includes(payment.status)).reduce((total, payment) => total + payment.amount, 0) ?? 0);
  protected readonly defaultCurrency = computed(() => this.snapshot()?.plans[0]?.currencyCode ?? 'USD');

  private readonly service = inject(SubscriptionManagementService);
  private readonly toast = inject(ToastService);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected tenantOptions(model: SubscriptionManagementSnapshot) {
    return model.tenants.map(tenant => ({ label: tenant.hospitalName, value: tenant.tenantCode }));
  }

  protected planOptions(model: SubscriptionManagementSnapshot) {
    return model.plans.map(plan => ({ label: plan.planName, value: plan.planCode }));
  }

  protected subscriptionStatusOptions() {
    return this.statusOptions.map(status => ({ label: status, value: status }));
  }

  protected billingCycleOptions() {
    return this.billingCycles.map(cycle => ({ label: cycle, value: cycle }));
  }

  protected couponOptions(model: SubscriptionManagementSnapshot) {
    return [
      { label: 'None', value: '' },
      ...model.coupons.map(coupon => ({ label: coupon.code, value: coupon.code }))
    ];
  }

  protected async load(): Promise<void> {
    const response = await this.service.getSnapshot();
    this.applySnapshot(response, true);
  }

  protected selectSubscription(subscription: TenantSubscription): void {
    this.selectedSubscriptionId.set(subscription.subscriptionId);
    this.subscriptionForm = {
      tenantCode: subscription.tenantCode,
      planCode: subscription.planCode,
      startDate: toDateInput(subscription.startDate),
      endDate: toDateInput(subscription.endDate),
      gracePeriodDays: subscription.gracePeriodDays,
      billingCycle: subscription.billingCycle,
      autoRenew: subscription.autoRenew,
      amount: subscription.amount,
      currencyCode: subscription.currencyCode,
      status: subscription.status,
      couponCode: subscription.couponCode ?? ''
    };
    this.renewForm = {
      newEndDate: toDateInput(addDays(subscription.endDate, 365)),
      gracePeriodDays: subscription.gracePeriodDays,
      amount: subscription.amount,
      currencyCode: subscription.currencyCode,
      notes: ''
    };
    this.invoiceForm = { amount: subscription.amount, taxAmount: 0, discountAmount: 0, dueDate: todayPlus(15) };
    this.paymentForm = { ...this.paymentForm, amount: subscription.amount, currencyCode: subscription.currencyCode };
  }

  protected selectForRenew(subscription: TenantSubscription): void {
    this.selectSubscription(subscription);
    this.activeTab.set('renewals');
  }

  protected startNewSubscription(): void {
    this.selectedSubscriptionId.set(null);
    const firstTenant = this.snapshot()?.tenants[0];
    const firstPlan = this.snapshot()?.plans[0];
    this.subscriptionForm = {
      ...emptySubscriptionForm(),
      tenantCode: firstTenant?.tenantCode ?? '',
      planCode: firstPlan?.planCode ?? '',
      amount: firstPlan?.annualPrice ?? 0,
      currencyCode: firstPlan?.currencyCode ?? 'USD'
    };
  }

  protected applySelectedPlanAmount(): void {
    const plan = this.snapshot()?.plans.find(item => item.planCode === this.subscriptionForm.planCode);
    if (!plan) {
      return;
    }

    this.subscriptionForm.currencyCode = plan.currencyCode;
    this.subscriptionForm.amount = this.subscriptionForm.billingCycle === 'Monthly' ? plan.monthlyPrice : plan.annualPrice;
  }

  protected async saveSubscription(): Promise<void> {
    this.saving.set(true);
    try {
      const response = await this.service.saveSubscription({ ...this.subscriptionForm, couponCode: this.subscriptionForm.couponCode || null });
      this.applySnapshot(response, false);
      if (response.success) {
        this.toast.success('Subscription saved.');
        const saved = response.data?.subscriptions.find(item => item.tenantCode === this.subscriptionForm.tenantCode);
        if (saved) {
          this.selectSubscription(saved);
        }
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected async renewSubscription(subscription: TenantSubscription): Promise<void> {
    const response = await this.service.renew(subscription.subscriptionId, { ...this.renewForm, notes: this.renewForm.notes || null });
    this.applySnapshot(response, false);
    if (response.success) {
      this.toast.success('Subscription renewed.');
      this.reselectSubscription(subscription.subscriptionId);
    }
  }

  protected async createInvoice(subscription: TenantSubscription): Promise<void> {
    const response = await this.service.createInvoice({
      subscriptionId: subscription.subscriptionId,
      amount: this.invoiceForm.amount,
      taxAmount: this.invoiceForm.taxAmount,
      discountAmount: this.invoiceForm.discountAmount,
      currencyCode: subscription.currencyCode,
      dueDate: this.invoiceForm.dueDate
    });
    this.applySnapshot(response, false);
    if (response.success) {
      this.toast.success('Invoice created.');
      this.activeTab.set('invoices');
    }
  }

  protected selectInvoiceForPayment(invoice: SubscriptionInvoice): void {
    this.paymentForm = {
      invoiceId: invoice.invoiceId,
      paymentReference: `PAY-${Date.now()}`,
      amount: invoice.totalAmount,
      currencyCode: invoice.currencyCode,
      method: 'BankTransfer',
      status: 'Success',
      paidAt: today()
    };
    const subscription = this.snapshot()?.subscriptions.find(item => item.subscriptionId === invoice.subscriptionId);
    if (subscription) {
      this.selectSubscription(subscription);
    }
    this.activeTab.set('payments');
  }

  protected async recordPayment(subscription: TenantSubscription): Promise<void> {
    const response = await this.service.recordPayment({
      subscriptionId: subscription.subscriptionId,
      invoiceId: this.paymentForm.invoiceId || null,
      paymentReference: this.paymentForm.paymentReference || `PAY-${Date.now()}`,
      amount: this.paymentForm.amount,
      currencyCode: this.paymentForm.currencyCode || subscription.currencyCode,
      method: this.paymentForm.method,
      status: this.paymentForm.status,
      paidAt: this.paymentForm.paidAt
    });
    this.applySnapshot(response, false);
    if (response.success) {
      this.toast.success('Payment recorded.');
      this.activeTab.set('payments');
    }
  }

  protected selectCoupon(coupon: SubscriptionCoupon): void {
    this.couponForm = {
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxRedemptions: coupon.maxRedemptions,
      validFrom: coupon.validFrom ? toDateInput(coupon.validFrom) : null,
      validUntil: coupon.validUntil ? toDateInput(coupon.validUntil) : null,
      isActive: coupon.isActive
    };
    this.couponMaxInput = coupon.maxRedemptions === null ? '' : String(coupon.maxRedemptions);
  }

  protected async saveCoupon(): Promise<void> {
    const response = await this.service.saveCoupon({
      ...this.couponForm,
      maxRedemptions: this.couponMaxInput.trim() ? Number(this.couponMaxInput) : null,
      validFrom: this.couponForm.validFrom || null,
      validUntil: this.couponForm.validUntil || null
    });
    this.applySnapshot(response, false);
    if (response.success) {
      this.toast.success('Coupon saved.');
      this.activeTab.set('coupons');
    }
  }

  protected formatMoney(value: number, currencyCode: string): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode || 'USD', maximumFractionDigits: 0 }).format(value || 0);
  }

  protected statusClass(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  private applySnapshot(response: { success: boolean; message: string; data: SubscriptionManagementSnapshot | null }, selectFirst: boolean): void {
    if (!response.success || !response.data) {
      this.toast.error(response.message || 'Could not load subscriptions');
      return;
    }

    this.snapshot.set(response.data);
    if (selectFirst && response.data.subscriptions.length > 0) {
      this.selectSubscription(response.data.subscriptions[0]);
    } else if (this.selectedSubscriptionId()) {
      this.reselectSubscription(this.selectedSubscriptionId()!);
    }
  }

  private reselectSubscription(subscriptionId: string): void {
    const subscription = this.snapshot()?.subscriptions.find(item => item.subscriptionId === subscriptionId);
    if (subscription) {
      this.selectSubscription(subscription);
    }
  }
}

function emptySubscriptionForm(): UpsertSubscriptionRequest {
  return {
    tenantCode: '',
    planCode: '',
    startDate: today(),
    endDate: todayPlus(365),
    gracePeriodDays: 15,
    billingCycle: 'Annual',
    autoRenew: true,
    amount: 0,
    currencyCode: 'USD',
    status: 'Active',
    couponCode: ''
  };
}

function emptyCouponForm(): UpsertSubscriptionCouponRequest {
  return {
    code: '',
    description: '',
    discountType: 'Percent',
    discountValue: 0,
    maxRedemptions: null,
    validFrom: today(),
    validUntil: todayPlus(365),
    isActive: true
  };
}

function today(): string {
  return toDateInput(new Date().toISOString());
}

function todayPlus(days: number): string {
  return toDateInput(addDays(new Date().toISOString(), days));
}

function addDays(value: string, days: number): string {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function toDateInput(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}
