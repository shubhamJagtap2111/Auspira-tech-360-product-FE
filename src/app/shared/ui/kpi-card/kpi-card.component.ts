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
      <div class="kpi-copy"><span class="kpi-label">{{ label() }}</span>
        <strong class="kpi-value" [class.long-value]="('' + value()).length > 8" [class.very-long-value]="('' + value()).length > 16">{{ pending() ? '—' : value() }}</strong>
        <span class="kpi-detail">{{ pending() ? 'Loading…' : detail() }}</span>
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
    :host { display:block; min-width:0; height:100%; container-type:inline-size; }
    .kpi-card { position:relative; display:block; width:100%; height:100%; min-height:132px; padding:18px; border:1px solid var(--ac-border); border-top:3px solid var(--kpi-tone); border-radius:12px; background:var(--ac-surface); color:var(--ac-text); text-align:left; font:inherit; box-shadow:var(--ac-sh-xs); }
    button.kpi-card { cursor:pointer; transition:border-color .15s,box-shadow .15s; }
    button.kpi-card:hover:not(:disabled) { border-color:var(--kpi-tone); box-shadow:0 4px 16px color-mix(in srgb,var(--kpi-tone) 10%,transparent); }
    button.kpi-card:focus-visible { outline:2px solid var(--ac-primary); outline-offset:3px; }
    button.kpi-card:disabled { cursor:wait; }
    .kpi-icon { position:absolute; right:14px; top:14px; width:34px; height:34px; display:grid; place-items:center; border-radius:10px; color:var(--kpi-tone); background:color-mix(in srgb,var(--kpi-tone) 10%,var(--ac-surface)); font-size:21px; }
    .kpi-copy { display:grid; gap:5px; min-width:0; flex:1; }
    .kpi-label { min-height:34px; padding-right:35px; font-size:12px; font-weight:650; color:var(--ac-text-3); line-height:1.35; }
    .kpi-value { font-size:clamp(22px,2vw,28px); font-weight:750; line-height:1.15; letter-spacing:-.6px; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
    .kpi-value.long-value { font-size:clamp(14px,10cqi,23px); white-space:nowrap; letter-spacing:-.35px; }
    .kpi-value.very-long-value { font-size:clamp(11px,8cqi,18px); }
    .kpi-detail { font-size:11px; line-height:1.4; color:var(--ac-muted); }
    .kpi-arrow { position:absolute; right:10px; bottom:10px; font-size:16px; color:var(--ac-muted); }
    button .kpi-detail { padding-right:12px; }
    @media(max-width:600px) { .kpi-card { min-height:138px; padding:13px; } .kpi-icon { width:26px; height:26px; right:10px; top:12px; font-size:17px; border-radius:8px; } .kpi-label { min-height:42px; padding-right:29px; } .kpi-value { font-size:25px; } }
    .kpi-card { border-top:1px solid var(--ac-border); border-radius:16px; background:linear-gradient(135deg,color-mix(in srgb,var(--kpi-tone) 5%,var(--ac-surface)),var(--ac-surface) 65%); box-shadow:0 6px 24px color-mix(in srgb,var(--ac-text) 5%,transparent); overflow:hidden; }
    .kpi-card::before { content:''; position:absolute; top:20px; bottom:20px; left:0; width:3px; border-radius:0 3px 3px 0; background:var(--kpi-tone); }
    .kpi-icon { width:38px; height:38px; border-radius:12px; }
    .kpi-value { font-size:clamp(24px,2.2vw,32px); letter-spacing:-.8px; }
    button.kpi-card { transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease; }
    button.kpi-card:hover:not(:disabled) { transform:translateY(-3px); box-shadow:0 10px 26px color-mix(in srgb,var(--kpi-tone) 12%,transparent); }
    @media(max-width:600px) { .kpi-icon { width:28px; height:28px; border-radius:9px; } .kpi-value { font-size:25px; } }
    @media(prefers-reduced-motion:reduce) { button.kpi-card { transition:none; transform:none!important; } }
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
