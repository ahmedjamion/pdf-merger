import { AsyncPipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleAlert,
  lucideFileText,
  lucideFolderOpen,
  lucideImage,
  lucideTrash2,
  lucideUpload,
} from '@ng-icons/lucide';
import { ImportedFile } from '../../core/models/imported-file';
import { DocumentEditor } from '../../core/services/document-editor/document-editor';
import { PdfPreview } from '../../core/services/pdf-preview/pdf-preview';

@Component({
  selector: 'app-import-page',
  imports: [RouterLink, DecimalPipe, AsyncPipe, NgIcon],
  providers: [
    provideIcons({
      lucideUpload,
      lucideFolderOpen,
      lucideFileText,
      lucideImage,
      lucideTrash2,
      lucideCircleAlert,
    }),
  ],
  templateUrl: './import.html',
  styleUrl: './import.css',
})
export class Import {
  protected readonly documentEditor = inject(DocumentEditor);
  private readonly router = inject(Router);
  private readonly pdfPreview = inject(PdfPreview);

  protected readonly files = this.documentEditor.files;
  protected readonly invalidFiles = this.documentEditor.invalidFiles;
  protected readonly totalSize = this.documentEditor.totalSizeBytes;
  protected readonly isDragging = signal(false);
  protected readonly isImporting = signal(false);

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;

    if (!input.files?.length) {
      return;
    }

    const files = Array.from(input.files);
    await this.addFiles(files);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.isDragging.set(false);

    if (!event.dataTransfer?.files?.length) {
      return;
    }

    const files = Array.from(event.dataTransfer.files);
    await this.addFiles(files);
  }

  removeFile(id: string): void {
    this.documentEditor.removeFile(id);
  }

  clearInvalidFiles(): void {
    this.documentEditor.clearInvalidFiles();
  }

  async goToFiles(): Promise<void> {
    if (!this.documentEditor.hasFiles()) {
      return;
    }

    await this.router.navigate(['/files']);
  }

  protected isPdf(type: string): boolean {
    return type === 'application/pdf';
  }

  protected getPdfFilePreview(file: ImportedFile): Promise<string | null> {
    return this.pdfPreview.getPagePreview(file, 0);
  }

  private async addFiles(files: File[]): Promise<void> {
    this.isImporting.set(true);

    try {
      await this.documentEditor.addFiles(files);
    } finally {
      this.isImporting.set(false);
    }
  }
}
