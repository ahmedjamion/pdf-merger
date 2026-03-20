import { AsyncPipe } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ImportedFile } from '../../core/models/imported-file';
import { DocumentEditor } from '../../core/services/document-editor/document-editor';
import { PdfPreview } from '../../core/services/pdf-preview/pdf-preview';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { Alert } from '../../shared/components/alert/alert';
import { provideIcons, NgIcon } from '@ng-icons/core';
import {
  lucideChevronLeft,
  lucideChevronRight,
  lucideGripVertical,
  lucideX,
} from '@ng-icons/lucide';

@Component({
  selector: 'app-files-page',
  imports: [DragDropModule, AsyncPipe, PageHeader, Alert, NgIcon],
  providers: [
    provideIcons({
      lucideGripVertical,
      lucideX,
      lucideChevronLeft,
      lucideChevronRight,
    }),
  ],
  templateUrl: './files.html',
  styleUrl: './files.css',
})
export class Files {
  protected readonly documentEditor = inject(DocumentEditor);
  private readonly router = inject(Router);
  private readonly pdfPreview = inject(PdfPreview);

  protected readonly files = this.documentEditor.files;
  protected readonly statusMessage = signal('');

  onDrop(event: CdkDragDrop<ImportedFile[]>): void {
    this.documentEditor.reorderFiles(event);
    this.statusMessage.set('File order updated.');
  }

  moveUp(index: number): void {
    this.documentEditor.moveFile(index, index - 1);
    this.statusMessage.set('File moved up.');
  }

  moveDown(index: number): void {
    this.documentEditor.moveFile(index, index + 1);
    this.statusMessage.set('File moved down.');
  }

  removeFile(id: string): void {
    this.documentEditor.removeFile(id);
    this.statusMessage.set('File removed.');
  }

  async goToPages(): Promise<void> {
    if (!this.documentEditor.hasPages()) {
      return;
    }

    await this.router.navigate(['/pages']);
  }

  getPdfFilePreview(file: ImportedFile): Promise<string | null> {
    return this.pdfPreview.getPagePreview(file, 0);
  }
}
