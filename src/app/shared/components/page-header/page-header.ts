import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucideChevronLeft } from '@ng-icons/lucide';
@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    provideIcons({
      lucideChevronLeft,
    }),
  ],
  templateUrl: './page-header.html',
  styleUrl: './page-header.css',
  imports: [RouterLink, NgIcon],
})
export class PageHeader {
  readonly step = input(1);
  readonly totalSteps = input(4);
  readonly title = input('');
  readonly description = input('');
  readonly previousPage = input<string | undefined>(undefined);
}
