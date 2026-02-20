import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTrash2, lucideArrowUp, lucideArrowDown, lucideRotateCcw, lucideRotateCw, lucideUpload, lucideFolderOpen, lucideRefreshCw } from '@ng-icons/lucide';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-action-button',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideTrash2, lucideArrowUp, lucideArrowDown, lucideRotateCcw, lucideRotateCw, lucideUpload, lucideFolderOpen, lucideRefreshCw })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './action-button.html',
  styleUrl: './action-button.css',
})
export class ActionButton {
  readonly variant = input<ButtonVariant>('secondary');
  readonly size = input<ButtonSize>('md');
  readonly disabled = input(false);
  readonly icon = input<string>();
  readonly iconOnly = input(false);
  readonly loading = input(false);
  readonly click = output<void>();

  onClick(): void {
    if (!this.disabled() && !this.loading()) {
      this.click.emit();
    }
  }

  get iconSize(): string {
    return this.size() === 'sm' ? '14' : this.size() === 'lg' ? '20' : '16';
  }
}
