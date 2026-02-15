import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowDown,
  lucideArrowUp,
  lucideFileText,
  lucideGripVertical,
  lucideImage,
  lucideTrash2,
} from '@ng-icons/lucide';
import { DocumentEditor } from '../../core/services/document-editor/document-editor';
import { ImportedFile } from '../../core/models/imported-file';
import { PdfPreview } from '../../core/services/pdf-preview/pdf-preview';

@Component({
  selector: 'app-files-page',
  imports: [RouterLink, DragDropModule, AsyncPipe, NgIcon],
  providers: [
    provideIcons({
      lucideArrowDown,
      lucideArrowUp,
      lucideFileText,
      lucideGripVertical,
      lucideImage,
      lucideTrash2,
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

  onDrop(event: CdkDragDrop<ImportedFile[]>): void {
    this.documentEditor.reorderFiles(event);
  }

  moveUp(index: number): void {
    this.documentEditor.moveFile(index, index - 1);
  }

  moveDown(index: number): void {
    this.documentEditor.moveFile(index, index + 1);
  }

  removeFile(id: string): void {
    this.documentEditor.removeFile(id);
  }

  async goToPages(): Promise<void> {
    if (!this.documentEditor.hasPages()) {
      return;
    }

    await this.router.navigate(['/pages']);
  }

  protected isPdf(type: string): boolean {
    return type === 'application/pdf';
  }

  protected getPdfFilePreview(file: ImportedFile): Promise<string | null> {
    return this.pdfPreview.getPagePreview(file, 0);
  }
}
