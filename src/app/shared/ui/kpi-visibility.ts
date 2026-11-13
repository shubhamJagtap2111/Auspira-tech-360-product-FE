import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, Directive, Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';

function pagePreferenceRoute(router: Router): string {
  const paths: string[] = [];
  let route = router.routerState.snapshot.root;
  while (route.firstChild) {
    route = route.firstChild;
    if (route.routeConfig?.path) paths.push(route.routeConfig.path);
  }
  return '/' + paths.join('/');
}

/** Presentation preferences only; no patient, branch or clinical data is stored. */
@Injectable({ providedIn: 'root' })
export class KpiVisibilityService {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly route = toSignal(this.router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    map(() => pagePreferenceRoute(this.router))
  ), { initialValue: pagePreferenceRoute(this.router) });
  private readonly preferences = signal<Record<string, boolean>>({});
  private readonly regions = signal<string[]>([]);
  private nextId = 0;
  private readonly page = computed(() => this.route());
  readonly controls = computed(() => this.regions().join(' '));
  readonly hidden = computed(() => {
    const page = this.page();
    const preference = this.preferences()[page];
    if (preference !== undefined) return preference;
    try { return this.document.defaultView?.localStorage.getItem(this.key(page)) === 'hidden'; }
    catch { return false; }
  });

  toggle(): void {
    const page = this.page();
    const hidden = !this.hidden();
    this.preferences.update(values => ({ ...values, [page]: hidden }));
    try { this.document.defaultView?.localStorage.setItem(this.key(page), hidden ? 'hidden' : 'visible'); }
    catch { /* The control still works when browser storage is unavailable. */ }
  }

  register(): string {
    const id = `ac-page-kpis-${++this.nextId}`;
    this.regions.update(ids => [...ids, id]);
    return id;
  }

  unregister(id: string): void { this.regions.update(ids => ids.filter(value => value !== id)); }
  private key(page: string): string { return `care360.ui.kpis:${page}`; }
}

/** Opt in summary regions only. Alerts and clinical safety information stay visible. */
@Directive({
  selector: '[acKpiRegion]',
  standalone: true,
  host: { '[attr.id]': 'id', '[hidden]': 'visibility.hidden()' }
})
export class AcKpiRegionDirective implements OnDestroy {
  readonly visibility = inject(KpiVisibilityService);
  readonly id = this.visibility.register();
  ngOnDestroy(): void { this.visibility.unregister(this.id); }
}

@Component({
  selector: 'ac-kpi-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="ac-btn ac-btn-secondary ac-kpi-toggle"
      [attr.aria-expanded]="!visibility.hidden()" [attr.aria-controls]="visibility.controls() || null"
      (click)="visibility.toggle()">
      <span class="material-symbols-rounded" aria-hidden="true">{{ visibility.hidden() ? 'expand_more' : 'expand_less' }}</span>
      {{ visibility.hidden() ? 'Show KPIs' : 'Hide KPIs' }}
    </button>
  `,
  styles: [`:host { display: inline-flex; flex: 0 0 auto; }`]
})
export class AcKpiToggleComponent {
  readonly visibility = inject(KpiVisibilityService);
}

export const AC_KPI_VISIBILITY = [AcKpiRegionDirective, AcKpiToggleComponent] as const;
