import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { I18nService } from '../../../core/i18n/i18n.service';

@Component({
  selector: 'ac-language-switcher',
  standalone: true,
  imports: [MatButtonToggleModule],
  template: `
    <mat-button-toggle-group
      [attr.aria-label]="i18n.translate('Localization.LanguageSwitcher.AriaLabel')"
      [value]="i18n.catalog()?.effectiveCulture ?? 'en-US'"
      (change)="i18n.loadCatalog($event.value)">
      @for (language of i18n.languages(); track language.cultureCode) {
        <mat-button-toggle [value]="language.cultureCode">
          {{ language.nativeName }}
        </mat-button-toggle>
      }
    </mat-button-toggle-group>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LanguageSwitcherComponent {
  protected readonly i18n = inject(I18nService);
}
