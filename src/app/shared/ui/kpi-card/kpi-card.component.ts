import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** The same reading order and interaction contract across clinical and operational KPIs. */
@Component({
  selector: 'ac-kpi-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #content>
      <span class="kpi-icon material-symbols-rounded" aria-hidden="true">{{ icon() }}</span>
      <div class="kpi-copy"><span class="kpi-label" [title]="label()">{{ label() }}</span>
        <strong class="kpi-value" [title]="'' + value()" [class.long-value]="('' + value()).length > 8" [class.very-long-value]="('' + value()).length > 16">{{ pending() ? '—' : value() }}</strong>
        <span class="kpi-detail" [title]="detail()">{{ pending() ? 'Loading…' : detail() }}</span>
      </div>
      @if (actionable()) { <span class="kpi-arrow material-symbols-rounded" aria-hidden="true">arrow_forward</span> }
    </ng-template>
    @if (actionable()) {
      <button type="button" class="kpi-card" [style.--kpi-tone]="tone()" [disabled]="pending()" [attr.aria-busy]="pending()" (click)="activated.emit()"><ng-container [ngTemplateOutlet]="content" /></button>
    } @else {
      <article class="kpi-card" [style.--kpi-tone]="tone()" [attr.aria-busy]="pending()"><ng-container [ngTemplateOutlet]="content" /></article>
    }
  `,
  styles: [`
    :host { display:block; min-width:0; container-type:inline-size; }
    .kpi-card { box-sizing:border-box; position:relative; display:flex; align-items:center; width:100%; height:88px; min-height:0; padding:10px 12px 10px 14px; border:1px solid var(--ac-border); border-radius:10px; background:linear-gradient(115deg,color-mix(in srgb,var(--kpi-tone) 4%,var(--ac-surface)),var(--ac-surface) 75%); color:var(--ac-text); text-align:left; font:inherit; box-shadow:0 2px 8px color-mix(in srgb,var(--ac-text) 3%,transparent); overflow:hidden; }
    .kpi-card::before { content:''; position:absolute; inset:15px auto 15px 0; width:2px; border-radius:0 2px 2px 0; background:var(--kpi-tone); }
    button.kpi-card { cursor:pointer; transition:border-color .15s,background .15s; }
    button.kpi-card:hover:not(:disabled) { border-color:color-mix(in srgb,var(--kpi-tone) 50%,var(--ac-border)); background:color-mix(in srgb,var(--kpi-tone) 6%,var(--ac-surface)); }
    button.kpi-card:focus-visible { outline:2px solid var(--ac-primary); outline-offset:2px; }
    button.kpi-card:disabled { cursor:wait; }
    .kpi-icon { position:absolute; right:10px; top:10px; width:25px; height:25px; display:grid; place-items:center; border-radius:7px; color:var(--kpi-tone); background:color-mix(in srgb,var(--kpi-tone) 9%,var(--ac-surface)); font-size:16px; }
    .kpi-copy { display:grid; gap:3px; min-width:0; width:100%; }
    .kpi-label { display:block; min-height:0; padding-right:27px; font-size:11px; font-weight:650; color:var(--ac-text-3); line-height:1.4; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .kpi-value { display:block; min-width:0; font-size:23px; font-weight:750; line-height:1.12; letter-spacing:-.6px; font-variant-numeric:tabular-nums; white-space:nowrap; }
    .kpi-value.long-value { font-size:clamp(11px,9.5cqi,20px); letter-spacing:-.3px; }
    .kpi-value.very-long-value { font-size:clamp(9px,7cqi,16px); }
    .kpi-detail { display:block; font-size:10px; line-height:1.4; color:var(--ac-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .kpi-arrow { position:absolute; right:8px; bottom:10px; font-size:13px; color:var(--ac-muted); }
    button .kpi-detail { padding-right:12px; }
    @media(prefers-reduced-motion:reduce) { button.kpi-card { transition:none; } }
  `]
})
export class AcKpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input('monitoring');
  readonly detail = input('');
  readonly tone = input('var(--ac-primary)');
  readonly actionable = input(false);
  readonly pending = input(false);
  readonly activated = output<void>();
}
