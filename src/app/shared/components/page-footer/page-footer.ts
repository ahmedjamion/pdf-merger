import { ChangeDetectionStrategy, Component, output, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-page-footer',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './page-footer.html',
  styleUrl: './page-footer.css',
})
export class PageFooter {
  readonly backLink = input('');
  readonly backLabel = input('Back');
  readonly continueLabel = input('Continue');
  readonly continueDisabled = input(false);
  readonly isLoading = input(false);
  readonly continue = output<void>();

  onContinue(): void {
    if (!this.continueDisabled() && !this.isLoading()) {
      this.continue.emit();
    }
  }
}
