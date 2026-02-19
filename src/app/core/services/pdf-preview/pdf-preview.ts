import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { ImportedFile } from '../../models/imported-file';

interface PdfRenderTaskLike {
  promise: Promise<void>;
}

interface PdfPageLike {
  getViewport(options: { scale: number }): { width: number; height: number };
  render(options: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }): PdfRenderTaskLike;
}

interface PdfDocumentLike {
  readonly numPages: number;
  getPage(pageNumber: number): Promise<PdfPageLike>;
  destroy(): Promise<void> | void;
}

interface PdfJsModuleLike {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(options: { data: Uint8Array | ArrayBuffer }): { promise: Promise<PdfDocumentLike> };
}

interface PreviewCacheEntry {
  fileId: string;
  promise: Promise<string | null>;
  lastAccess: number;
  resolvedUrl?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class PdfPreview {
  private readonly document = inject(DOCUMENT);

  private pdfJsModulePromise?: Promise<PdfJsModuleLike>;
  private readonly documentCache = new Map<string, Promise<PdfDocumentLike>>();
  private readonly previewCache = new Map<string, PreviewCacheEntry>();
  private readonly previewUrlsByFile = new Map<string, Set<string>>();
  private readonly MAX_PREVIEW_CACHE_ENTRIES = 300;

  getPagePreview(file: ImportedFile, pageIndex: number, scale = 0.35): Promise<string | null> {
    const cacheKey = `${file.id}:${pageIndex}:${scale}`;
    const existing = this.previewCache.get(cacheKey);

    if (existing) {
      existing.lastAccess = Date.now();
      return existing.promise;
    }

    const entry: PreviewCacheEntry = {
      fileId: file.id,
      lastAccess: Date.now(),
      promise: Promise.resolve(null),
    };

    const previewTask = this.renderPagePreview(file, pageIndex, scale).catch(() => null);
    entry.promise = previewTask;

    void previewTask.then((url) => {
      entry.resolvedUrl = url;
      if (!this.previewCache.has(cacheKey) && url) {
        this.untrackPreviewUrl(file.id, url);
        URL.revokeObjectURL(url);
      }
    });

    this.previewCache.set(cacheKey, entry);
    this.enforcePreviewCacheLimit();

    return previewTask;
  }

  async renderMergedPreview(pdfBytes: Uint8Array, pageIndex = 0, scale = 0.75): Promise<string | null> {
    const previews = await this.renderMergedPreviewPages(pdfBytes, {
      scale,
      maxPages: 1,
      startPageIndex: pageIndex,
    });

    return previews[0] ?? null;
  }

  async renderMergedPreviewPages(
    pdfBytes: Uint8Array,
    options?: { scale?: number; maxPages?: number; startPageIndex?: number; batchSize?: number },
  ): Promise<string[]> {
    const scale = options?.scale ?? 0.75;
    const maxPages = options?.maxPages;
    const startPageIndex = options?.startPageIndex ?? 0;
    const batchSize = Math.max(1, options?.batchSize ?? 4);

    try {
      const pdfJs = await this.loadPdfJs();
      const pdfDocument = await pdfJs.getDocument({ data: pdfBytes }).promise;
      const totalPages = Number(pdfDocument.numPages) || 0;

      if (totalPages < 1) {
        await Promise.resolve(pdfDocument.destroy());
        return [];
      }

      const firstPage = Math.max(0, Math.min(startPageIndex, totalPages - 1));
      const remaining = totalPages - firstPage;
      const count = typeof maxPages === 'number' ? Math.max(0, Math.min(maxPages, remaining)) : remaining;
      const previews: string[] = [];

      for (let offset = 0; offset < count; offset += 1) {
        const page = await pdfDocument.getPage(firstPage + offset + 1);
        const preview = await this.renderPageToObjectUrl(page, scale);

        if (preview) {
          previews.push(preview);
        }

        if (offset > 0 && offset % batchSize === 0) {
          await this.nextFrame();
        }
      }

      await Promise.resolve(pdfDocument.destroy());
      return previews;
    } catch {
      return [];
    }
  }

  clearFile(fileId: string): void {
    for (const [key, entry] of Array.from(this.previewCache.entries())) {
      if (entry.fileId !== fileId) {
        continue;
      }

      if (entry.resolvedUrl) {
        this.untrackPreviewUrl(fileId, entry.resolvedUrl);
        URL.revokeObjectURL(entry.resolvedUrl);
      }

      this.previewCache.delete(key);
    }

    const urls = this.previewUrlsByFile.get(fileId);
    if (urls) {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
      this.previewUrlsByFile.delete(fileId);
    }

    const documentPromise = this.documentCache.get(fileId);
    this.documentCache.delete(fileId);
    void documentPromise?.then((pdfDocument) => Promise.resolve(pdfDocument.destroy())).catch(() => undefined);
  }

  clearAll(fileIds: string[]): void {
    for (const fileId of fileIds) {
      this.clearFile(fileId);
    }
  }

  private async renderPagePreview(file: ImportedFile, pageIndex: number, scale: number): Promise<string> {
    const pdfDocument = await this.getDocument(file);
    const totalPages = Number(pdfDocument.numPages) || 0;

    if (totalPages < 1) {
      throw new Error('PDF has no pages.');
    }

    const boundedIndex = Math.max(0, Math.min(pageIndex, totalPages - 1));
    let page = await this.safeGetPage(pdfDocument, boundedIndex + 1);

    if (!page) {
      page = await this.safeGetPage(pdfDocument, 1);
    }

    if (!page) {
      throw new Error('Could not read the requested PDF page.');
    }

    const previewUrl = await this.renderPageToObjectUrl(page, scale);
    if (!previewUrl) {
      throw new Error('Could not generate PDF preview image.');
    }

    this.trackPreviewUrl(file.id, previewUrl);
    return previewUrl;
  }

  private async renderPageToObjectUrl(page: PdfPageLike, scale: number): Promise<string | null> {
    const viewport = page.getViewport({ scale });

    const canvas = this.document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      return null;
    }

    await page
      .render({
        canvas,
        canvasContext: context,
        viewport,
      })
      .promise;

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));

    if (!blob) {
      return null;
    }

    return URL.createObjectURL(blob);
  }

  private async safeGetPage(pdfDocument: PdfDocumentLike, pageNumber: number): Promise<PdfPageLike | null> {
    try {
      return await pdfDocument.getPage(pageNumber);
    } catch {
      return null;
    }
  }

  private async getDocument(file: ImportedFile): Promise<PdfDocumentLike> {
    const cached = this.documentCache.get(file.id);
    if (cached) {
      return cached;
    }

    const promise = this.loadPdfJs().then(async (pdfJs) => {
      const bytes = await file.file.arrayBuffer();
      return pdfJs.getDocument({ data: bytes }).promise;
    });

    this.documentCache.set(file.id, promise);
    return promise;
  }

  private async loadPdfJs(): Promise<PdfJsModuleLike> {
    if (!this.pdfJsModulePromise) {
      this.pdfJsModulePromise = import('pdfjs-dist').then((pdfJs) => {
        const typedPdfJs = pdfJs as unknown as PdfJsModuleLike;
        typedPdfJs.GlobalWorkerOptions.workerSrc = new URL('assets/pdf.worker.min.mjs', this.document.baseURI).toString();
        return typedPdfJs;
      });
    }

    return this.pdfJsModulePromise;
  }

  private enforcePreviewCacheLimit(): void {
    while (this.previewCache.size > this.MAX_PREVIEW_CACHE_ENTRIES) {
      let oldestKey: string | null = null;
      let oldestAccess = Number.POSITIVE_INFINITY;

      for (const [key, entry] of this.previewCache.entries()) {
        if (entry.lastAccess < oldestAccess) {
          oldestAccess = entry.lastAccess;
          oldestKey = key;
        }
      }

      if (!oldestKey) {
        return;
      }

      const oldestEntry = this.previewCache.get(oldestKey);
      this.previewCache.delete(oldestKey);

      if (oldestEntry?.resolvedUrl) {
        this.untrackPreviewUrl(oldestEntry.fileId, oldestEntry.resolvedUrl);
        URL.revokeObjectURL(oldestEntry.resolvedUrl);
      }
    }
  }

  private trackPreviewUrl(fileId: string, url: string): void {
    const urls = this.previewUrlsByFile.get(fileId) ?? new Set<string>();
    urls.add(url);
    this.previewUrlsByFile.set(fileId, urls);
  }

  private untrackPreviewUrl(fileId: string, url: string): void {
    const urls = this.previewUrlsByFile.get(fileId);
    if (!urls) {
      return;
    }

    urls.delete(url);
    if (urls.size === 0) {
      this.previewUrlsByFile.delete(fileId);
    }
  }

  private nextFrame(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
}
