import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInfo, lucideAlertTriangle, lucideXCircle, lucideX } from '@ng-icons/lucide';

export type AlertType = 'info' | 'warning' | 'error' | 'success';

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideInfo, lucideAlertTriangle, lucideXCircle, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './alert.html',
  styleUrl: './alert.css',
})
export class Alert {
  readonly type = input<AlertType>('info');
  readonly message = input('');
  readonly dismissible = input(false);
  readonly dismiss = output<void>();

  onDismiss(): void {
    this.dismiss.emit();
  }
}
