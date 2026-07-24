import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { AcDropdownComponent } from '../../shared/ui/dropdown/dropdown.component';
import { DatabaseGridItem, DatabaseManagementSnapshot } from './database-management.models';
import { DatabaseManagementService } from './database-management.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AcDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="database-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Database Management</p>
          <h1 class="ac-page-title">DBA Console</h1>
          <p>Monitor tenant databases, backups, storage, health, connections, and migration state from one control-plane workspace.</p>
        </div>
        <div class="head-actions">
          <a class="icon-btn" routerLink="/super-admin/tenants" title="Open tenants">
            <span class="material-symbols-rounded">corporate_fare</span>
          </a>
          <button class="icon-btn" type="button" (click)="load()" title="Refresh databases">
            <span class="material-symbols-rounded">refresh</span>
          </button>
        </div>
      </header>

      @if (snapshot(); as model) {
        <section class="stat-grid">
          <article class="stat"><span class="material-symbols-rounded">database</span><p>Databases</p><strong>{{ model.summary.totalDatabases }}</strong></article>
          <article class="stat"><span class="material-symbols-rounded">verified</span><p>Healthy</p><strong>{{ model.summary.healthyDatabases }}</strong></article>
          <article class="stat"><span class="material-symbols-rounded">storage</span><p>Storage</p><strong>{{ model.summary.totalStorageGb }} GB</strong></article>
          <article class="stat"><span class="material-symbols-rounded">hub</span><p>Connections</p><strong>{{ model.summary.activeConnections }}</strong></article>
        </section>

        <section class="workspace-grid">
          <main class="table-panel">
            <table>
              <thead>
                <tr>
                  <th>Hospital</th>
                  <th>Database</th>
                  <th>Version</th>
                  <th>Storage</th>
                  <th>Health</th>
                  <th>Connections</th>
                  <th>Last Backup</th>
                  <th>Migration Version</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (db of model.databases; track db.tenantId) {
                  <tr [class.selected]="selectedTenantCode() === db.tenantCode">
                    <td>
                      <button class="link-cell" type="button" (click)="selectDatabase(db)">
                        <strong>{{ db.hospitalName }}</strong>
                        <span>{{ db.tenantCode }}</span>
                      </button>
                    </td>
                    <td><code>{{ db.databaseName }}</code><small>{{ db.databaseServerKey }}</small></td>
                    <td>{{ db.version }}</td>
                    <td>{{ db.storageGb }} GB</td>
                    <td><span class="pill" [class]="statusClass(db.health)">{{ db.health }}</span></td>
                    <td>{{ db.connections }}</td>
                    <td>{{ db.lastBackupAt ? (db.lastBackupAt | date:'medium') : '-' }}</td>
                    <td><strong>{{ db.migrationVersion }}</strong><small>{{ db.migrationStatus }}</small></td>
                    <td>
                      <div class="action-grid">
                        <button class="icon-btn" type="button" (click)="run(db, 'Backup')" title="Backup"><span class="material-symbols-rounded">backup</span></button>
                        <button class="icon-btn" type="button" (click)="run(db, 'Restore')" title="Restore"><span class="material-symbols-rounded">restore</span></button>
                        <button class="icon-btn" type="button" (click)="run(db, 'Vacuum')" title="Vacuum"><span class="material-symbols-rounded">cleaning_services</span></button>
                        <button class="icon-btn" type="button" (click)="run(db, 'Analyze')" title="Analyze"><span class="material-symbols-rounded">query_stats</span></button>
                        <button class="icon-btn" type="button" (click)="prepareMigration(db)" title="Run migration"><span class="material-symbols-rounded">upgrade</span></button>
                        <button class="icon-btn" type="button" (click)="downloadLogs(db)" title="Download logs"><span class="material-symbols-rounded">download</span></button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="9" class="empty">No tenant databases found.</td></tr>
                }
              </tbody>
            </table>
          </main>

          <aside class="side-panel">
            <section class="operation-box">
              <h2>Run Migration</h2>
              <ac-dropdown [(ngModel)]="migrationForm.tenantCode" name="migrationTenant" [options]="migrationTenantOptions(model)" />
              <input [(ngModel)]="migrationForm.targetVersion" name="targetVersion" placeholder="1.0.1" />
              <input [(ngModel)]="migrationForm.message" name="migrationMessage" placeholder="Migration notes" />
              <button class="ac-btn ac-btn-primary" type="button" (click)="runMigration()">Run Migration</button>
            </section>

            <section class="operation-list">
              <h2>Recent Operations</h2>
              @for (operation of model.recentOperations; track operation.operationLogId) {
                <article>
                  <header>
                    <strong>{{ operation.operationType }}</strong>
                    <span class="pill" [class]="statusClass(operation.status)">{{ operation.status }}</span>
                  </header>
                  <p>{{ operation.hospitalName }}</p>
                  <small>{{ operation.message }}</small>
                  <time>{{ operation.createdAt | date:'medium' }}</time>
                </article>
              } @empty {
                <p class="empty">No DBA operations recorded.</p>
              }
            </section>
          </aside>
        </section>
      } @else {
        <section class="loading">Loading database console...</section>
      }
    </section>
  `,
  styles: [`
    .database-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head, .stat, .table-panel, .side-panel { background: var(--ac-surface); border: 1px solid var(--ac-border); border-radius: 8px; box-shadow: var(--ac-shadow-sm); }
    .page-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; padding: 20px; }
    .page-head p { margin: 4px 0 0; color: var(--ac-muted); }
    .eyebrow { margin: 0; text-transform: uppercase; letter-spacing: .08em; font-size: 12px; color: var(--ac-primary); font-weight: 700; }
    .head-actions { display: flex; gap: 8px; }
    .icon-btn { width: 36px; height: 36px; display: inline-grid; place-items: center; border: 1px solid var(--ac-border); border-radius: 8px; color: var(--ac-text); background: var(--ac-surface); text-decoration: none; cursor: pointer; }
    .stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .stat { padding: 16px; display: grid; gap: 6px; }
    .stat span { color: var(--ac-primary); }
    .stat p { margin: 0; color: var(--ac-muted); font-size: 13px; }
    .stat strong { font-size: 26px; }
    .workspace-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start; }
    .table-panel, .side-panel { padding: 14px; overflow: auto; }
    table { width: 100%; min-width: 1080px; border-collapse: collapse; }
    th, td { padding: 11px 10px; border-bottom: 1px solid var(--ac-border); text-align: left; vertical-align: top; }
    th { font-size: 12px; color: var(--ac-muted); text-transform: uppercase; white-space: nowrap; }
    td small, .link-cell span { display: block; color: var(--ac-muted); margin-top: 3px; }
    code { font-size: 12px; }
    .link-cell { border: 0; background: transparent; color: var(--ac-text); cursor: pointer; padding: 0; text-align: left; }
    .selected { background: color-mix(in srgb, var(--ac-primary) 6%, var(--ac-surface)); }
    .action-grid { display: grid; grid-template-columns: repeat(3, 36px); gap: 6px; }
    .pill { border-radius: 999px; padding: 4px 8px; font-size: 12px; background: var(--ac-border); color: var(--ac-text); }
    .pill.healthy, .pill.completed, .pill.ready, .pill.migrated { background: color-mix(in srgb, var(--ac-success) 14%, var(--ac-surface)); color: var(--ac-success); }
    .pill.warning, .pill.restored { background: color-mix(in srgb, #c78318 18%, var(--ac-surface)); color: #9a5c00; }
    .pill.failed { background: color-mix(in srgb, var(--ac-danger) 14%, var(--ac-surface)); color: var(--ac-danger); }
    .side-panel { display: grid; gap: 14px; }
    .operation-box, .operation-list article { border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-subtle); padding: 12px; display: grid; gap: 9px; }
    .operation-box h2, .operation-list h2 { margin: 0; font-size: 18px; }
    input, select { min-height: 38px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text); padding: 0 10px; }
    .operation-list { display: grid; gap: 10px; }
    .operation-list article header { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
    .operation-list article p, .operation-list article small, .operation-list article time { margin: 0; color: var(--ac-muted); }
    .empty, .loading { color: var(--ac-muted); }
    @media (max-width: 1180px) { .workspace-grid, .stat-grid { grid-template-columns: 1fr; } }
    @media (max-width: 720px) { .page-head { flex-direction: column; } }
  `]
})
export class DatabaseManagementPageComponent implements OnInit {
  private readonly databaseService = inject(DatabaseManagementService);
  private readonly toast = inject(ToastService);

  protected readonly snapshot = signal<DatabaseManagementSnapshot | null>(null);
  protected readonly selectedTenantCode = signal<string | null>(null);
  protected migrationForm = { tenantCode: '', targetVersion: '', message: '' };

  ngOnInit(): void {
    void this.load();
  }

  protected migrationTenantOptions(model: DatabaseManagementSnapshot) {
    return [
      { label: 'Select hospital', value: '' },
      ...model.databases.map(db => ({ label: db.hospitalName, value: db.tenantCode }))
    ];
  }

  protected async load(): Promise<void> {
    const response = await this.databaseService.getSnapshot();
    if (!response.success || !response.data) {
      this.toast.error(response.message || 'Could not load databases');
      return;
    }

    this.snapshot.set(response.data);
  }

  protected selectDatabase(db: DatabaseGridItem): void {
    this.selectedTenantCode.set(db.tenantCode);
    this.migrationForm.tenantCode = db.tenantCode;
    this.migrationForm.targetVersion = db.migrationVersion;
  }

  protected prepareMigration(db: DatabaseGridItem): void {
    this.selectDatabase(db);
    this.toast.success('Migration target selected.');
  }

  protected async run(db: DatabaseGridItem, operationType: string): Promise<void> {
    const response = await this.databaseService.runOperation(db.tenantCode, { operationType, message: `${operationType} requested from DBA console.` });
    this.handleSnapshot(response, `${operationType} completed.`);
  }

  protected async runMigration(): Promise<void> {
    if (!this.migrationForm.tenantCode || !this.migrationForm.targetVersion) {
      this.toast.error('Hospital and target version are required.');
      return;
    }

    const response = await this.databaseService.runOperation(this.migrationForm.tenantCode, {
      operationType: 'RunMigration',
      targetVersion: this.migrationForm.targetVersion,
      message: this.migrationForm.message || null
    });
    this.handleSnapshot(response, 'Migration completed.');
  }

  protected async downloadLogs(db: DatabaseGridItem): Promise<void> {
    const response = await this.databaseService.getLogs(db.tenantCode);
    if (!response.success || !response.data) {
      this.toast.error(response.message || 'Could not download logs');
      return;
    }

    const blob = new Blob([response.data.content], { type: response.data.contentType || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = response.data.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  protected statusClass(status: string): string {
    return status.toLowerCase();
  }

  private handleSnapshot(response: { success: boolean; data: DatabaseManagementSnapshot | null; message?: string }, successMessage: string): void {
    if (!response.success || !response.data) {
      this.toast.error(response.message || 'Database operation failed');
      return;
    }

    this.snapshot.set(response.data);
    this.toast.success(successMessage);
  }
}
