import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideUpload, lucideFolderOpen } from '@ng-icons/lucide';

@Component({
  selector: 'app-drop-zone',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideUpload, lucideFolderOpen })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './drop-zone.html',
  styleUrl: './drop-zone.css',
})
export class DropZone {
  readonly isDragging = input(false);
  readonly isProcessing = input(false);
  readonly fileSelected = output<FileList | null>();
  readonly dragOver = output<void>();
  readonly dragLeave = output<void>();
  readonly drop = output<DragEvent>();

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.emit();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragLeave.emit();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.drop.emit(event);
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fileSelected.emit(input.files);
    input.value = '';
  }
}
