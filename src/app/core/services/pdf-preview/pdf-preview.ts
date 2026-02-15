import { Injectable } from '@angular/core';
import { ImportedFile } from '../../models/imported-file';

type PdfJsModule = typeof import('pdfjs-dist');

@Injectable({
  providedIn: 'root',
})
export class PdfPreview {
  private pdfJsModulePromise?: Promise<PdfJsModule>;
  private readonly documentCache = new Map<string, Promise<any>>();
  private readonly previewCache = new Map<string, Promise<string | null>>();
  private readonly previewUrlsByFile = new Map<string, Set<string>>();

  getPagePreview(file: ImportedFile, pageIndex: number, scale = 0.35): Promise<string | null> {
    const cacheKey = `${file.id}:${pageIndex}:${scale}`;
    const existing = this.previewCache.get(cacheKey);

    if (existing) {
      return existing;
    }

    const previewTask = this.renderPagePreview(file, pageIndex, scale).catch(() => null);
    this.previewCache.set(cacheKey, previewTask);

    return previewTask;
  }

  async renderMergedPreview(
    pdfBytes: Uint8Array,
    pageIndex = 0,
    scale = 0.75,
  ): Promise<string | null> {
    const previews = await this.renderMergedPreviewPages(pdfBytes, {
      scale,
      maxPages: 1,
      startPageIndex: pageIndex,
    });

    return previews[0] ?? null;
  }

  async renderMergedPreviewPages(
    pdfBytes: Uint8Array,
    options?: { scale?: number; maxPages?: number; startPageIndex?: number },
  ): Promise<string[]> {
    const scale = options?.scale ?? 0.75;
    const maxPages = options?.maxPages;
    const startPageIndex = options?.startPageIndex ?? 0;

    try {
      const pdfJs = await this.loadPdfJs();
      const pdfDocument = await pdfJs.getDocument({ data: pdfBytes }).promise;
      const totalPages = Number(pdfDocument.numPages) || 0;

      if (totalPages < 1) {
        await pdfDocument.destroy();
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
      }

      await pdfDocument.destroy();
      return previews;
    } catch {
      return [];
    }
  }

  clearFile(fileId: string): void {
    for (const key of Array.from(this.previewCache.keys())) {
      if (key.startsWith(`${fileId}:`)) {
        this.previewCache.delete(key);
      }
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
    void documentPromise?.then((pdfDocument) => pdfDocument.destroy()).catch(() => undefined);
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

    const urls = this.previewUrlsByFile.get(file.id) ?? new Set<string>();
    urls.add(previewUrl);
    this.previewUrlsByFile.set(file.id, urls);

    return previewUrl;
  }

  private async renderPageToObjectUrl(page: any, scale: number): Promise<string | null> {
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
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

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.86),
    );

    if (!blob) {
      return null;
    }

    return URL.createObjectURL(blob);
  }

  private async safeGetPage(pdfDocument: any, pageNumber: number): Promise<any | null> {
    try {
      return await pdfDocument.getPage(pageNumber);
    } catch {
      return null;
    }
  }

  private async getDocument(file: ImportedFile): Promise<any> {
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

  private async loadPdfJs(): Promise<PdfJsModule> {
    if (!this.pdfJsModulePromise) {
      this.pdfJsModulePromise = import('pdfjs-dist').then((pdfJs) => {
        if (!pdfJs.GlobalWorkerOptions.workerSrc) {
          pdfJs.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/build/pdf.worker.min.mjs',
            import.meta.url,
          ).toString();
        }

        return pdfJs;
      });
    }

    return this.pdfJsModulePromise;
  }
}
