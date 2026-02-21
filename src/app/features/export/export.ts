import { Component, OnDestroy, OnInit, inject, signal, DestroyRef, Injector } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { ExportPageSize, ExportQuality, ExportOrientation } from '../../core/models/export-options';
import { DocumentEditor } from '../../core/services/document-editor/document-editor';
import { PdfComposer } from '../../core/services/pdf-composer/pdf-composer';
import { PdfPreview } from '../../core/services/pdf-preview/pdf-preview';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { PageFooter } from '../../shared/components/page-footer/page-footer';
import { Alert } from '../../shared/components/alert/alert';

type PreviewMode = 'quick' | 'full';

@Component({
  selector: 'app-export-page',
  imports: [ReactiveFormsModule, PageHeader, PageFooter, Alert],
  templateUrl: './export.html',
  styleUrl: './export.css',
})
export class Export implements OnInit, OnDestroy {
  protected readonly documentEditor = inject(DocumentEditor);
  private readonly pdfComposer = inject(PdfComposer);
  private readonly pdfPreview = inject(PdfPreview);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  protected readonly exportOptions = this.documentEditor.exportOptions;
  protected readonly isExporting = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly previewMode = signal<PreviewMode>('quick');
  protected readonly previewUrls = signal<string[]>([]);
  protected readonly previewLoading = signal(false);
  protected readonly previewError = signal('');
  protected readonly previewNeedsRefresh = signal(false);

  protected readonly FULL_PREVIEW_MAX_PAGES = 24;

  protected readonly exportForm = new FormGroup({
    fileName: new FormControl('', [Validators.required, Validators.maxLength(200), Validators.pattern(/^[^<>:"|?*]*$/)]),
    pageSize: new FormControl<ExportPageSize>('original', [Validators.required]),
    orientation: new FormControl<ExportOrientation>('auto', [Validators.required]),
    quality: new FormControl<ExportQuality>('high', [Validators.required]),
  });

  private previewRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private previewRequestId = 0;
  private lastPreviewKey = '';

  ngOnInit(): void {
    this.initializeForm();
    this.setupFormSubscriptions();
    this.schedulePreviewRefresh();
  }

  ngOnDestroy(): void {
    if (this.previewRefreshTimer) {
      clearTimeout(this.previewRefreshTimer);
      this.previewRefreshTimer = null;
    }

    this.clearPreviewUrls();
  }

  private initializeForm(): void {
    const options = this.exportOptions();
    this.exportForm.patchValue({
      fileName: options.fileName,
      pageSize: options.pageSize,
      orientation: options.orientation,
      quality: options.quality,
    });
  }

  private setupFormSubscriptions(): void {
    this.exportForm.controls.fileName.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (value !== null && value !== this.exportOptions().fileName) {
          this.documentEditor.setExportFileName(value);
        }
      });

    this.exportForm.controls.pageSize.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (value !== null && value !== this.exportOptions().pageSize) {
          this.documentEditor.setExportPageSize(value);
          this.handlePreviewOptionChange();
        }
      });

    this.exportForm.controls.orientation.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (value !== null && value !== this.exportOptions().orientation) {
          this.documentEditor.setExportOrientation(value);
          this.handlePreviewOptionChange();
        }
      });

    this.exportForm.controls.quality.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (value !== null && value !== this.exportOptions().quality) {
          this.documentEditor.setExportQuality(value);
          this.handlePreviewOptionChange();
        }
      });

    const previewLoading$ = toObservable(this.previewLoading, { injector: this.injector });
    const isExporting$ = toObservable(this.isExporting, { injector: this.injector });

    combineLatest([previewLoading$, isExporting$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([loading, exporting]) => {
        if (loading || exporting) {
          this.exportForm.disable();
        } else {
          this.exportForm.enable();
        }
      });
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
      const normalizedName = this.exportOptions().fileName.trim().replace(/\.pdf$/i, '');
      const safeFileName = normalizedName.length > 0 ? normalizedName : 'merged-document';
      const fileName = `${safeFileName}.pdf`;
      this.downloadBlob(blob, fileName);
    } catch {
      this.errorMessage.set('Export failed. Please review your files and try again.');
    } finally {
      this.isExporting.set(false);
    }
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

  isQuickMode(): boolean {
    return this.previewMode() === 'quick';
  }

  isFullMode(): boolean {
    return this.previewMode() === 'full';
  }

  private handlePreviewOptionChange(): void {
    this.lastPreviewKey = '';
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

    const isQuick = this.previewMode() === 'quick';
    const maxPages = isQuick ? 1 : this.FULL_PREVIEW_MAX_PAGES;
    const previewKey = this.createPreviewKey(maxPages);

    if (previewKey === this.lastPreviewKey && this.previewUrls().length > 0 && !this.previewNeedsRefresh()) {
      return;
    }

    this.previewLoading.set(true);

    try {
      const bytes = await this.pdfComposer.compose(
        this.documentEditor.files(),
        this.documentEditor.pages(),
        this.documentEditor.exportOptions(),
        maxPages,
      );

      const previews = await this.pdfPreview.renderMergedPreviewPages(Uint8Array.from(bytes), {
        scale: isQuick ? 0.9 : 0.68,
        maxPages,
        batchSize: isQuick ? 1 : 4,
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
      this.lastPreviewKey = previewKey;

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

  private createPreviewKey(maxPages: number): string {
    const filesKey = this.documentEditor
      .files()
      .map((file) => `${file.id}:${file.name}:${file.size}:${file.lastModified}`)
      .join('|');

    const pagesKey = this.documentEditor
      .pages()
      .map((page) => `${page.id}:${page.sourceFileId}:${page.sourcePageIndex}:${page.rotation}`)
      .join('|');

    const options = this.documentEditor.exportOptions();
    return `${this.previewMode()}:${maxPages}:${options.pageSize}:${options.quality}:${filesKey}:${pagesKey}`;
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
