import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { DocumentEditor } from '../../core/services/document-editor/document-editor';
import { PdfComposer } from '../../core/services/pdf-composer/pdf-composer';
import { PdfPreview } from '../../core/services/pdf-preview/pdf-preview';
import { Export } from './export';

describe('Export', () => {
  const filesSignal = signal<any[]>([]);
  const pagesSignal = signal<any[]>([]);
  const optionsSignal = signal({
    fileName: 'merged-document',
    pageSize: 'original' as const,
    quality: 'high' as const,
  });

  const mockDocumentEditor = {
    files: filesSignal.asReadonly(),
    pages: pagesSignal.asReadonly(),
    exportOptions: optionsSignal.asReadonly(),
    hasPages: () => pagesSignal().length > 0,
    setExportFileName: vi.fn((value: string) => optionsSignal.update((curr) => ({ ...curr, fileName: value }))),
    setExportPageSize: vi.fn((value: any) => optionsSignal.update((curr) => ({ ...curr, pageSize: value }))),
    setExportQuality: vi.fn((value: any) => optionsSignal.update((curr) => ({ ...curr, quality: value }))),
  };

  const mockPdfComposer = {
    compose: vi.fn(),
  };

  const mockPdfPreview = {
    renderMergedPreviewPages: vi.fn(),
  };

  beforeEach(async () => {
    filesSignal.set([
      {
        id: 'file-1',
        name: 'a.pdf',
        size: 2,
        type: 'application/pdf',
        lastModified: 1,
        pageCount: 1,
        previewUrl: 'blob:file-1',
        file: new File(['x'], 'a.pdf', { type: 'application/pdf' }),
      },
    ]);
    pagesSignal.set([
      {
        id: 'page-1',
        sourceFileId: 'file-1',
        sourceFileName: 'a.pdf',
        sourceType: 'application/pdf',
        sourcePageIndex: 0,
        rotation: 0,
      },
    ]);
    optionsSignal.set({ fileName: 'merged-document', pageSize: 'original', quality: 'high' });

    mockPdfComposer.compose.mockReset();
    mockPdfPreview.renderMergedPreviewPages.mockReset();

    await TestBed.configureTestingModule({
      imports: [Export],
      providers: [
        provideRouter([]),
        { provide: DocumentEditor, useValue: mockDocumentEditor },
        { provide: PdfComposer, useValue: mockPdfComposer },
        { provide: PdfPreview, useValue: mockPdfPreview },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Export);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('keeps the newest preview when stale requests resolve later', async () => {
    const fixture = TestBed.createComponent(Export);
    const component = fixture.componentInstance;

    let resolveFirst: ((value: Uint8Array) => void) | undefined;

    mockPdfComposer.compose
      .mockImplementationOnce(() => new Promise<Uint8Array>((resolve) => {
        resolveFirst = resolve;
      }))
      .mockResolvedValueOnce(Uint8Array.from([2]));

    mockPdfPreview.renderMergedPreviewPages
      .mockResolvedValueOnce(['blob:new'])
      .mockResolvedValueOnce(['blob:old']);

    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    component.refreshPreviewNow();
    component.refreshPreviewNow();

    await Promise.resolve();
    await Promise.resolve();

    if (resolveFirst) {
      resolveFirst(Uint8Array.from([1]));
    }

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect((component as any).previewUrls()).toEqual(['blob:new']);
    expect(revokeSpy).toHaveBeenCalledWith('blob:old');

    component.ngOnDestroy();
  });
});
