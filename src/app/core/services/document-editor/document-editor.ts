import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Injectable, computed, inject, signal } from '@angular/core';
import { PDFDocument } from 'pdf-lib';
import { ExportOptions, ExportPageSize, ExportQuality, ExportOrientation } from '../../models/export-options';
import { ImportedFile } from '../../models/imported-file';
import { InvalidFile } from '../../models/invalid-file';
import { PageItem } from '../../models/page-item';
import { PdfPreview } from '../pdf-preview/pdf-preview';

type AcceptedFileType = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';

interface SeenFileEntry {
  importedFile?: ImportedFile;
  rawFile?: File;
  hash?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class DocumentEditor {
  readonly MAX_FILE_SIZE = 10 * 1024 * 1024;
  readonly MAX_TOTAL_SIZE = 120 * 1024 * 1024;
  readonly MAX_PAGES = 400;
  readonly ACCEPTED_FILE_TYPES: AcceptedFileType[] = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  private readonly ALLOWED_EXTENSIONS = new Map<string, AcceptedFileType>([
    ['pdf', 'application/pdf'],
    ['jpg', 'image/jpeg'],
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
  ]);

  private readonly pdfPreview = inject(PdfPreview);

  private readonly _files = signal<ImportedFile[]>([]);
  readonly files = this._files.asReadonly();

  private readonly _invalidFiles = signal<InvalidFile[]>([]);
  readonly invalidFiles = this._invalidFiles.asReadonly();

  private readonly _pages = signal<PageItem[]>([]);
  readonly pages = this._pages.asReadonly();

  private readonly _hasManualPageEdits = signal(false);
  readonly hasManualPageEdits = this._hasManualPageEdits.asReadonly();

  private readonly _exportOptions = signal<ExportOptions>({
    fileName: 'merged-document',
    pageSize: 'original',
    quality: 'high',
    orientation: 'auto',
  });
  readonly exportOptions = this._exportOptions.asReadonly();

  readonly totalSizeBytes = computed(() => this.files().reduce((total, file) => total + file.size, 0));
  readonly totalPages = computed(() => this.pages().length);
  readonly hasFiles = computed(() => this.files().length > 0);
  readonly hasPages = computed(() => this.pages().length > 0);

  private readonly fileHashById = new Map<string, string>();

  async addFiles(files: File[]): Promise<void> {
    const validFiles: ImportedFile[] = [];
    const invalidFiles: InvalidFile[] = [];
    const seenByKey = this.createSeenEntries();

    let runningTotalSize = this.totalSizeBytes();
    let runningTotalPages = this.totalPages();

    for (const file of files) {
      const normalizedType = this.normalizeFileType(file);
      const errors = this.validateBasicFile(file, normalizedType);
      const key = this.toFileKey(file);
      const existingEntries = seenByKey.get(key) ?? [];

      if (existingEntries.length > 0 && (await this.matchesExistingDuplicate(file, existingEntries))) {
        errors.push('Duplicate files are not allowed.');
      }

      if (runningTotalSize + file.size > this.MAX_TOTAL_SIZE) {
        errors.push('Total upload size exceeds 120MB.');
      }

      let pageCount = 0;
      if (errors.length === 0) {
        try {
          pageCount = await this.getFilePageCount(file, normalizedType);
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
        type: normalizedType ?? file.type,
        lastModified: file.lastModified,
        pageCount,
        previewUrl: URL.createObjectURL(file),
        file,
      };

      validFiles.push(importedFile);
      const knownHash = await this.computeFileHash(file);
      seenByKey.set(key, [...existingEntries, { importedFile, hash: knownHash }]);
      if (knownHash) {
        this.fileHashById.set(importedFile.id, knownHash);
      }

      runningTotalSize += file.size;
      runningTotalPages += pageCount;
    }

    if (validFiles.length > 0) {
      this._files.update((current) => [...current, ...validFiles]);
      if (this.hasManualPageEdits()) {
        this._pages.update((current) => [...current, ...validFiles.flatMap((file) => this.buildPagesForFile(file))]);
      } else {
        this.rebuildPagesFromFiles({ force: true });
      }
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
    this.fileHashById.delete(file.id);

    this._files.update((current) => current.filter((item) => item.id !== id));
    if (this.hasManualPageEdits()) {
      this._pages.update((current) => current.filter((page) => page.sourceFileId !== id));
    } else {
      this.rebuildPagesFromFiles({ force: true });
    }
  }

  clearFiles(): void {
    const fileIds = this.files().map((file) => file.id);
    this.revokeAllFilePreviewUrls();
    this.pdfPreview.clearAll(fileIds);
    this.fileHashById.clear();
    this._files.set([]);
    this._pages.set([]);
    this._hasManualPageEdits.set(false);
  }

  reorderFiles(event: CdkDragDrop<ImportedFile[]>): void {
    this._files.update((current) => {
      const next = [...current];
      moveItemInArray(next, event.previousIndex, event.currentIndex);
      return next;
    });

    if (!this.hasManualPageEdits()) {
      this.rebuildPagesFromFiles({ force: false });
    }
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

    if (!this.hasManualPageEdits()) {
      this.rebuildPagesFromFiles({ force: false });
    }
  }

  reorderPages(event: CdkDragDrop<PageItem[]>): void {
    this._pages.update((current) => {
      const next = [...current];
      moveItemInArray(next, event.previousIndex, event.currentIndex);
      return next;
    });
    this._hasManualPageEdits.set(true);
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
    this._hasManualPageEdits.set(true);
  }

  removePage(id: string): void {
    this._pages.update((current) => current.filter((item) => item.id !== id));
    this._hasManualPageEdits.set(true);
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
    this._hasManualPageEdits.set(true);
  }

  setExportFileName(fileName: string): void {
    const cleaned = this.sanitizeFileName(fileName);
    this._exportOptions.update((options) => ({
      ...options,
      fileName: cleaned,
    }));
  }

  setExportPageSize(pageSize: ExportPageSize): void {
    this._exportOptions.update((options) => ({ ...options, pageSize }));
  }

  setExportQuality(quality: ExportQuality): void {
    this._exportOptions.update((options) => ({ ...options, quality }));
  }

  setExportOrientation(orientation: ExportOrientation): void {
    this._exportOptions.update((options) => ({ ...options, orientation }));
  }

  rebuildPagesFromFiles(options?: { force?: boolean }): void {
    const force = options?.force ?? false;
    if (!force && this.hasManualPageEdits()) {
      return;
    }

    const nextPages = this.files().flatMap((file) => this.buildPagesForFile(file));
    this._pages.set(nextPages);
    this._hasManualPageEdits.set(false);
  }

  resetPagesFromFiles(): void {
    this.rebuildPagesFromFiles({ force: true });
  }

  private validateBasicFile(file: File, normalizedType: AcceptedFileType | null): string[] {
    const errors: string[] = [];

    if (!normalizedType) {
      errors.push('Unsupported file type. Use PDF, JPG, PNG, or WEBP.');
    }

    if (file.size > this.MAX_FILE_SIZE) {
      errors.push('File size exceeds the 10MB limit.');
    }

    return errors;
  }

  private async getFilePageCount(file: File, normalizedType: AcceptedFileType | null): Promise<number> {
    if (normalizedType === 'application/pdf') {
      const document = await PDFDocument.load(await this.readFileBytes(file));
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

  private buildPagesForFile(file: ImportedFile): PageItem[] {
    if (file.type === 'application/pdf') {
      const pages: PageItem[] = [];
      for (let index = 0; index < file.pageCount; index += 1) {
        pages.push({
          id: crypto.randomUUID(),
          sourceFileId: file.id,
          sourceFileName: file.name,
          sourceType: file.type,
          sourcePageIndex: index,
          rotation: 0,
          originOrderKey: `${file.id}:${index}`,
        });
      }
      return pages;
    }

    return [
      {
        id: crypto.randomUUID(),
        sourceFileId: file.id,
        sourceFileName: file.name,
        sourceType: file.type,
        sourcePageIndex: 0,
        rotation: 0,
        previewUrl: file.previewUrl,
        originOrderKey: `${file.id}:0`,
      },
    ];
  }

  private revokeAllFilePreviewUrls(): void {
    for (const file of this.files()) {
      URL.revokeObjectURL(file.previewUrl);
    }
  }

  private normalizeFileType(file: Pick<File, 'name' | 'type'>): AcceptedFileType | null {
    const mimeType = file.type.trim().toLowerCase();
    if (mimeType === 'application/pdf') {
      return 'application/pdf';
    }

    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      return 'image/jpeg';
    }

    if (mimeType === 'image/png') {
      return 'image/png';
    }

    if (mimeType === 'image/webp') {
      return 'image/webp';
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension) {
      return null;
    }

    return this.ALLOWED_EXTENSIONS.get(extension) ?? null;
  }

  private sanitizeFileName(fileName: string): string {
    const withoutExtension = fileName.trim().replace(/\.pdf$/i, '');
    const withoutInvalidChars = withoutExtension.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '');
    const withoutTrailingSpaceOrDot = withoutInvalidChars.replace(/[. ]+$/g, '');
    return withoutTrailingSpaceOrDot.length > 0 ? withoutTrailingSpaceOrDot : 'merged-document';
  }

  private createSeenEntries(): Map<string, SeenFileEntry[]> {
    const seenByKey = new Map<string, SeenFileEntry[]>();
    for (const file of this.files()) {
      const key = this.toFileKey(file);
      const existing = seenByKey.get(key) ?? [];
      seenByKey.set(key, [
        ...existing,
        {
          importedFile: file,
          hash: this.fileHashById.get(file.id),
        },
      ]);
    }

    return seenByKey;
  }

  private async matchesExistingDuplicate(file: File, existingEntries: SeenFileEntry[]): Promise<boolean> {
    const incomingHash = await this.computeFileHash(file);
    if (!incomingHash) {
      return true;
    }

    for (const entry of existingEntries) {
      const candidateHash = await this.resolveEntryHash(entry);
      if (!candidateHash) {
        return true;
      }

      if (candidateHash === incomingHash) {
        return true;
      }
    }

    return false;
  }

  private async resolveEntryHash(entry: SeenFileEntry): Promise<string | null> {
    if (entry.hash) {
      return entry.hash;
    }

    if (entry.importedFile) {
      const known = this.fileHashById.get(entry.importedFile.id);
      if (known) {
        entry.hash = known;
        return known;
      }

      const computed = await this.computeFileHash(entry.importedFile.file);
      if (computed) {
        this.fileHashById.set(entry.importedFile.id, computed);
      }

      entry.hash = computed;
      return computed;
    }

    if (!entry.rawFile) {
      return null;
    }

    const computed = await this.computeFileHash(entry.rawFile);
    entry.hash = computed;
    return computed;
  }

  private async computeFileHash(file: File): Promise<string | null> {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      return null;
    }

    const buffer = await this.readFileBytes(file);
    const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(buffer));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  private async readFileBytes(file: File): Promise<ArrayBuffer> {
    if (typeof file.arrayBuffer === 'function') {
      return file.arrayBuffer();
    }

    return new Response(file).arrayBuffer();
  }
}

