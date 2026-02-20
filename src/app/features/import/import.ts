import { DecimalPipe, AsyncPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert } from '@ng-icons/lucide';
import { DocumentEditor } from '../../core/services/document-editor/document-editor';
import { PdfPreview } from '../../core/services/pdf-preview/pdf-preview';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { PageFooter } from '../../shared/components/page-footer/page-footer';
import { DropZone } from '../../shared/components/drop-zone/drop-zone';
import { FileCard } from '../../shared/components/file-card/file-card';
import { Alert } from '../../shared/components/alert/alert';

@Component({
  selector: 'app-import-page',
  imports: [DecimalPipe, AsyncPipe, NgIcon, PageHeader, PageFooter, DropZone, FileCard, Alert],
  providers: [provideIcons({ lucideCircleAlert })],
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
  protected readonly statusMessage = signal('');

  async onFileSelected(files: FileList | null): Promise<void> {
    if (!files?.length) {
      return;
    }

    const fileList = Array.from(files);
    await this.addFiles(fileList);
  }

  onDragOver(): void {
    this.isDragging.set(true);
  }

  onDragLeave(): void {
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
    this.statusMessage.set('File removed.');
  }

  clearInvalidFiles(): void {
    this.documentEditor.clearInvalidFiles();
    this.statusMessage.set('Rejected files list cleared.');
  }

  async goToFiles(): Promise<void> {
    if (!this.documentEditor.hasFiles()) {
      return;
    }

    await this.router.navigate(['/files']);
  }

  getPdfFilePreview(file: any): Promise<string | null> {
    return this.pdfPreview.getPagePreview(file, 0);
  }

  private async addFiles(files: File[]): Promise<void> {
    this.isImporting.set(true);

    try {
      await this.documentEditor.addFiles(files);
      this.statusMessage.set('Import completed.');
    } finally {
      this.isImporting.set(false);
    }
  }
}
