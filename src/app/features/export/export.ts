import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DocumentEditor } from '../../core/services/document-editor/document-editor';
import { PdfComposer } from '../../core/services/pdf-composer/pdf-composer';
import { PdfPreview } from '../../core/services/pdf-preview/pdf-preview';
import { ExportPageSize, ExportQuality } from '../../core/models/export-options';

type PreviewMode = 'quick' | 'full';

@Component({
  selector: 'app-export-page',
  imports: [RouterLink, FormsModule],
  templateUrl: './export.html',
  styleUrl: './export.css',
})
export class Export implements OnInit, OnDestroy {
  protected readonly documentEditor = inject(DocumentEditor);
  private readonly pdfComposer = inject(PdfComposer);
  private readonly pdfPreview = inject(PdfPreview);

  protected readonly exportOptions = this.documentEditor.exportOptions;
  protected readonly isExporting = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly previewMode = signal<PreviewMode>('quick');
  protected readonly previewUrls = signal<string[]>([]);
  protected readonly previewLoading = signal(false);
  protected readonly previewError = signal('');
  protected readonly previewNeedsRefresh = signal(false);

  protected readonly FULL_PREVIEW_MAX_PAGES = 24;

  private previewRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private previewRequestId = 0;

  ngOnInit(): void {
    this.schedulePreviewRefresh();
  }

  ngOnDestroy(): void {
    if (this.previewRefreshTimer) {
      clearTimeout(this.previewRefreshTimer);
      this.previewRefreshTimer = null;
    }

    this.clearPreviewUrls();
  }

  async exportPdf(): Promise<void> {
    this.errorMessage.set('');

    if (!this.documentEditor.hasPages()) {
      this.errorMessage.set('No pages available. Please add pages before exporting.');
      return;
    }

    this.isExporting.set(true);

    try {
      const bytes = await this.pdfComposer.compose(
        this.documentEditor.files(),
        this.documentEditor.pages(),
        this.documentEditor.exportOptions(),
      );

      const pdfBytes = Uint8Array.from(bytes);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const fileName = `${this.exportOptions().fileName}.pdf`;
      this.downloadBlob(blob, fileName);
    } catch {
      this.errorMessage.set('Export failed. Please review your files and try again.');
    } finally {
      this.isExporting.set(false);
    }
  }

  onFileNameChange(value: string): void {
    this.documentEditor.setExportFileName(value);
  }

  onPageSizeChange(value: ExportPageSize): void {
    this.documentEditor.setExportPageSize(value);
    this.handlePreviewOptionChange();
  }

  onQualityChange(value: ExportQuality): void {
    this.documentEditor.setExportQuality(value);
    this.handlePreviewOptionChange();
  }

  onPreviewModeChange(value: PreviewMode): void {
    this.previewMode.set(value);
    this.previewError.set('');

    if (value === 'quick') {
      this.previewNeedsRefresh.set(false);
      this.schedulePreviewRefresh(50);
      return;
    }

    this.previewNeedsRefresh.set(true);
    this.clearPreviewUrls();
  }

  refreshPreviewNow(): void {
    void this.refreshPreview();
  }

  protected isQuickMode(): boolean {
    return this.previewMode() === 'quick';
  }

  protected isFullMode(): boolean {
    return this.previewMode() === 'full';
  }

  private handlePreviewOptionChange(): void {
    if (this.previewMode() === 'quick') {
      this.schedulePreviewRefresh();
      return;
    }

    this.previewNeedsRefresh.set(true);
  }

  private schedulePreviewRefresh(delayMs = 220): void {
    if (this.previewRefreshTimer) {
      clearTimeout(this.previewRefreshTimer);
    }

    this.previewRefreshTimer = setTimeout(() => {
      this.previewRefreshTimer = null;
      void this.refreshPreview();
    }, delayMs);
  }

  private async refreshPreview(): Promise<void> {
    const requestId = ++this.previewRequestId;
    this.previewError.set('');

    if (!this.documentEditor.hasPages()) {
      this.previewLoading.set(false);
      this.previewError.set('No pages available for preview.');
      this.clearPreviewUrls();
      return;
    }

    this.previewLoading.set(true);

    try {
      const isQuick = this.previewMode() === 'quick';
      const maxPages = isQuick ? 1 : this.FULL_PREVIEW_MAX_PAGES;

      const bytes = await this.pdfComposer.compose(
        this.documentEditor.files(),
        this.documentEditor.pages(),
        this.documentEditor.exportOptions(),
        maxPages,
      );

      const previews = await this.pdfPreview.renderMergedPreviewPages(Uint8Array.from(bytes), {
        scale: isQuick ? 0.9 : 0.68,
        maxPages,
      });

      if (requestId !== this.previewRequestId) {
        for (const url of previews) {
          URL.revokeObjectURL(url);
        }
        return;
      }

      if (previews.length === 0) {
        this.previewError.set('Preview not available for the current file set.');
        this.clearPreviewUrls();
        return;
      }

      this.setPreviewUrls(previews);
      this.previewNeedsRefresh.set(false);

      if (!isQuick && this.documentEditor.pages().length > this.FULL_PREVIEW_MAX_PAGES) {
        this.previewError.set(
          `Showing first ${this.FULL_PREVIEW_MAX_PAGES} pages for performance. Export includes all pages.`,
        );
      }
    } catch {
      if (requestId === this.previewRequestId) {
        this.previewError.set('Could not generate preview. You can still export the PDF.');
        this.clearPreviewUrls();
      }
    } finally {
      if (requestId === this.previewRequestId) {
        this.previewLoading.set(false);
      }
    }
  }

  private setPreviewUrls(nextUrls: string[]): void {
    this.clearPreviewUrls();
    this.previewUrls.set(nextUrls);
  }

  private clearPreviewUrls(): void {
    for (const url of this.previewUrls()) {
      URL.revokeObjectURL(url);
    }

    this.previewUrls.set([]);
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
