import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideFileText, lucideImage, lucideTrash2 } from '@ng-icons/lucide';
import { ImportedFile } from '../../../core/models/imported-file';

@Component({
  selector: 'app-file-card',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideFileText, lucideImage, lucideTrash2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './file-card.html',
  styleUrl: './file-card.css',
})
export class FileCard {
  readonly file = input.required<ImportedFile>();
  readonly index = input(0);
  readonly previewUrl = input<string | null>(null);
  readonly disabled = input(false);
  readonly remove = output<string>();

  get isPdf(): boolean {
    return this.file().type === 'application/pdf';
  }

  onRemove(): void {
    this.remove.emit(this.file().id);
  }
}
