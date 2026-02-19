import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PdfPreview } from './pdf-preview';

describe('PdfPreview', () => {
  let service: PdfPreview;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PdfPreview);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reuses cached preview promise for the same file/page/scale key', async () => {
    const file = new File(['a'], 'a.pdf', { type: 'application/pdf', lastModified: 1 });
    const importedFile = {
      id: 'file-1',
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      pageCount: 1,
      previewUrl: 'blob:file-1',
      file,
    };

    const renderSpy = vi
      .spyOn(service as unknown as { renderPagePreview: () => Promise<string> }, 'renderPagePreview')
      .mockResolvedValue('blob:preview-1');

    const first = service.getPagePreview(importedFile, 0, 0.35);
    const second = service.getPagePreview(importedFile, 0, 0.35);

    expect(first).toBe(second);
    await first;
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });

  it('clears cached previews and revokes known URLs for a file', () => {
    const previewCache = (service as unknown as { previewCache: Map<string, any> }).previewCache;
    const previewUrlsByFile = (service as unknown as { previewUrlsByFile: Map<string, Set<string>> }).previewUrlsByFile;

    previewCache.set('file-1:0:0.35', {
      fileId: 'file-1',
      promise: Promise.resolve('blob:preview-a'),
      lastAccess: Date.now(),
      resolvedUrl: 'blob:preview-a',
    });

    previewUrlsByFile.set('file-1', new Set(['blob:preview-a', 'blob:preview-b']));

    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    service.clearFile('file-1');

    expect(previewCache.size).toBe(0);
    expect(previewUrlsByFile.has('file-1')).toBe(false);
    expect(revokeSpy).toHaveBeenCalled();
  });
});
