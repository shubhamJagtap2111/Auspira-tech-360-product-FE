import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AcKpiCardComponent } from '../../shared/ui/kpi-card/kpi-card.component';

@Component({
  standalone: true,
  imports: [AcKpiCardComponent],
  template: `
    <section class="workspace ac-workspace">
      <header class="ac-workspace-head"><div><p class="ac-eyebrow">Hospital operations</p><h1 class="ac-page-title">{{ title }}</h1><p>A dedicated workspace for the hospital team.</p></div><span class="connection-state"><span class="material-symbols-rounded" aria-hidden="true">cloud_off</span> Not connected</span></header>
      <section class="ac-kpi-grid" aria-label="Data availability">
        <ac-kpi-card label="Open cases" value="—" icon="pending_actions" detail="Live data unavailable" />
        <ac-kpi-card label="Priority attention" value="—" icon="emergency" tone="var(--ac-warning-text)" detail="Live data unavailable" />
        <ac-kpi-card label="Completed today" value="—" icon="task_alt" tone="var(--ac-teal)" detail="Live data unavailable" />
      </section>
      <section class="availability-panel"><span class="material-symbols-rounded" aria-hidden="true">construction</span><div><h2>{{ title }} workspace is being prepared</h2><p>Live records and actions are not connected for this module yet. Use the connected clinical modules to manage ongoing care.</p></div></section>
      <section class="scope-panel"><h2>Planned areas</h2><div class="capabilities">@for (cap of capabilities; track cap) {<article><span class="material-symbols-rounded" aria-hidden="true">checklist</span><div><h3>{{ cap }}</h3><span>Awaiting workflow connection</span></div></article>}</div></section>
    </section>
  `,
  styles: [`
    :host{display:block;min-width:0}.connection-state{display:flex;align-items:center;gap:7px;white-space:nowrap;border:1px solid var(--ac-border);border-radius:20px;padding:6px 11px;color:var(--ac-muted);font-size:12px}.connection-state .material-symbols-rounded{font-size:18px}
    .availability-panel,.scope-panel{background:var(--ac-surface);border:1px solid var(--ac-border);border-radius:12px;padding:24px}.availability-panel{display:flex;align-items:flex-start;gap:18px}.availability-panel>span{display:grid;place-items:center;width:48px;height:48px;flex:none;background:var(--ac-secondary-light);color:var(--ac-secondary);border-radius:12px;font-size:26px}h2{margin:0 0 8px;font-size:18px}p{margin:0;color:var(--ac-muted);line-height:1.7;font-size:13px}.capabilities{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px;margin-top:18px}.capabilities article{display:flex;gap:12px;padding:16px;border:1px solid var(--ac-border);border-radius:10px}.capabilities article>span{color:var(--ac-primary);font-size:22px}h3{margin:0 0 6px;font-size:13px}.capabilities div>span{font-size:11px;color:var(--ac-muted)}@media(max-width:600px){.availability-panel,.scope-panel{padding:18px}.availability-panel{gap:12px}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModuleWorkspacePageComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly title = this.route.snapshot.data['title'] as string;
  protected readonly capabilities = this.route.snapshot.data['capabilities'] as string[];
}
