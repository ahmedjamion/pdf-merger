import { AsyncPipe } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ImportedFile } from '../../core/models/imported-file';
import { DocumentEditor } from '../../core/services/document-editor/document-editor';
import { PdfPreview } from '../../core/services/pdf-preview/pdf-preview';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { PageFooter } from '../../shared/components/page-footer/page-footer';
import { Alert } from '../../shared/components/alert/alert';

@Component({
  selector: 'app-files-page',
  imports: [DragDropModule, AsyncPipe, PageHeader, PageFooter, Alert],
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
