import { Injectable, computed, inject, signal } from '@angular/core';
import { PDFDocument } from 'pdf-lib';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { ImportedFile } from '../../models/imported-file';
import { InvalidFile } from '../../models/invalid-file';
import { PageItem } from '../../models/page-item';
import { ExportOptions, ExportPageSize, ExportQuality } from '../../models/export-options';
import { PdfPreview } from '../pdf-preview/pdf-preview';

@Injectable({
  providedIn: 'root',
})
export class DocumentEditor {
  readonly MAX_FILE_SIZE = 10 * 1024 * 1024;
  readonly MAX_TOTAL_SIZE = 120 * 1024 * 1024;
  readonly MAX_PAGES = 400;
  readonly ACCEPTED_FILE_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  private readonly pdfPreview = inject(PdfPreview);

  private readonly _files = signal<ImportedFile[]>([]);
  readonly files = this._files.asReadonly();

  private readonly _invalidFiles = signal<InvalidFile[]>([]);
  readonly invalidFiles = this._invalidFiles.asReadonly();

  private readonly _pages = signal<PageItem[]>([]);
  readonly pages = this._pages.asReadonly();

  private readonly _exportOptions = signal<ExportOptions>({
    fileName: 'merged-document',
    pageSize: 'original',
    quality: 'high',
  });
  readonly exportOptions = this._exportOptions.asReadonly();

  readonly totalSizeBytes = computed(() => this.files().reduce((total, file) => total + file.size, 0));
  readonly totalPages = computed(() => this.pages().length);
  readonly hasFiles = computed(() => this.files().length > 0);
  readonly hasPages = computed(() => this.pages().length > 0);

  async addFiles(files: File[]): Promise<void> {
    const validFiles: ImportedFile[] = [];
    const invalidFiles: InvalidFile[] = [];
    const seenKeys = new Set(this.files().map((file) => this.toFileKey(file)));

    let runningTotalSize = this.totalSizeBytes();
    let runningTotalPages = this.totalPages();

    for (const file of files) {
      const errors = this.validateBasicFile(file);
      const key = this.toFileKey(file);

      if (seenKeys.has(key)) {
        errors.push('Duplicate files are not allowed.');
      }

      if (runningTotalSize + file.size > this.MAX_TOTAL_SIZE) {
        errors.push('Total upload size exceeds 120MB.');
      }

      let pageCount = 0;
      if (errors.length === 0) {
        try {
          pageCount = await this.getFilePageCount(file);
        } catch {
          errors.push('Unable to read this file.');
        }
      }

      if (errors.length === 0 && runningTotalPages + pageCount > this.MAX_PAGES) {
        errors.push('Total page count exceeds 400 pages.');
      }

      if (errors.length > 0) {
        invalidFiles.push(this.toInvalidFile(file, errors));
        continue;
      }

      const importedFile: ImportedFile = {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        pageCount,
        previewUrl: URL.createObjectURL(file),
        file,
      };

      validFiles.push(importedFile);
      seenKeys.add(key);
      runningTotalSize += file.size;
      runningTotalPages += pageCount;
    }

    if (validFiles.length > 0) {
      this._files.update((current) => [...current, ...validFiles]);
      this.rebuildPagesFromFiles();
    }

    if (invalidFiles.length > 0) {
      this._invalidFiles.update((current) => [...current, ...invalidFiles]);
    }
  }

  getFileById(fileId: string): ImportedFile | undefined {
    return this.files().find((file) => file.id === fileId);
  }

  clearInvalidFiles(): void {
    this._invalidFiles.set([]);
  }

  removeFile(id: string): void {
    const file = this.files().find((item) => item.id === id);
    if (!file) {
      return;
    }

    URL.revokeObjectURL(file.previewUrl);
    this.pdfPreview.clearFile(file.id);

    this._files.update((current) => current.filter((item) => item.id !== id));
    this.rebuildPagesFromFiles();
  }

  clearFiles(): void {
    const fileIds = this.files().map((file) => file.id);
    this.revokeAllFilePreviewUrls();
    this.pdfPreview.clearAll(fileIds);
    this._files.set([]);
    this._pages.set([]);
  }

  reorderFiles(event: CdkDragDrop<ImportedFile[]>): void {
    this._files.update((current) => {
      const next = [...current];
      moveItemInArray(next, event.previousIndex, event.currentIndex);
      return next;
    });

    this.rebuildPagesFromFiles();
  }

  moveFile(fromIndex: number, toIndex: number): void {
    this._files.update((current) => {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= current.length || toIndex >= current.length) {
        return current;
      }

      const next = [...current];
      moveItemInArray(next, fromIndex, toIndex);
      return next;
    });

    this.rebuildPagesFromFiles();
  }

  reorderPages(event: CdkDragDrop<PageItem[]>): void {
    this._pages.update((current) => {
      const next = [...current];
      moveItemInArray(next, event.previousIndex, event.currentIndex);
      return next;
    });
  }

  movePage(fromIndex: number, toIndex: number): void {
    this._pages.update((current) => {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= current.length || toIndex >= current.length) {
        return current;
      }

      const next = [...current];
      moveItemInArray(next, fromIndex, toIndex);
      return next;
    });
  }

  removePage(id: string): void {
    this._pages.update((current) => current.filter((item) => item.id !== id));
  }

  rotatePage(id: string, delta: 90 | -90): void {
    this._pages.update((current) =>
      current.map((page) => {
        if (page.id !== id) {
          return page;
        }

        const nextRotation = (page.rotation + delta + 360) % 360;
        return {
          ...page,
          rotation: nextRotation,
        };
      }),
    );
  }

  setExportFileName(fileName: string): void {
    const cleaned = fileName.trim().replace(/\.pdf$/i, '');
    this._exportOptions.update((options) => ({
      ...options,
      fileName: cleaned.length > 0 ? cleaned : 'merged-document',
    }));
  }

  setExportPageSize(pageSize: ExportPageSize): void {
    this._exportOptions.update((options) => ({ ...options, pageSize }));
  }

  setExportQuality(quality: ExportQuality): void {
    this._exportOptions.update((options) => ({ ...options, quality }));
  }

  resetPagesFromFiles(): void {
    this.rebuildPagesFromFiles();
  }

  private validateBasicFile(file: File): string[] {
    const errors: string[] = [];

    if (!this.ACCEPTED_FILE_TYPES.includes(file.type)) {
      errors.push('Unsupported file type. Use PDF, JPG, PNG, or WEBP.');
    }

    if (file.size > this.MAX_FILE_SIZE) {
      errors.push('File size exceeds the 10MB limit.');
    }

    return errors;
  }

  private async getFilePageCount(file: File): Promise<number> {
    if (file.type === 'application/pdf') {
      const document = await PDFDocument.load(await file.arrayBuffer());
      return document.getPageCount();
    }

    return 1;
  }

  private toInvalidFile(file: File, reasons: string[]): InvalidFile {
    return {
      id: crypto.randomUUID(),
      name: file.name,
      reasons,
    };
  }

  private toFileKey(file: Pick<File, 'name' | 'size' | 'lastModified'>): string {
    return `${file.name}:${file.size}:${file.lastModified}`;
  }

  private rebuildPagesFromFiles(): void {
    const nextPages: PageItem[] = [];

    for (const file of this.files()) {
      if (file.type === 'application/pdf') {
        for (let index = 0; index < file.pageCount; index += 1) {
          nextPages.push({
            id: crypto.randomUUID(),
            sourceFileId: file.id,
            sourceFileName: file.name,
            sourceType: file.type,
            sourcePageIndex: index,
            rotation: 0,
          });
        }
      } else {
        nextPages.push({
          id: crypto.randomUUID(),
          sourceFileId: file.id,
          sourceFileName: file.name,
          sourceType: file.type,
          sourcePageIndex: 0,
          rotation: 0,
          previewUrl: file.previewUrl,
        });
      }
    }

    this._pages.set(nextPages);
  }

  private revokeAllFilePreviewUrls(): void {
    for (const file of this.files()) {
      URL.revokeObjectURL(file.previewUrl);
    }
  }
}
