import { TestBed } from '@angular/core/testing';
import { PDFDocument } from 'pdf-lib';
import { PdfComposer } from './pdf-composer';

function createPdfFile(bytes: Uint8Array, name: string, lastModified: number): File {
  return {
    name,
    type: 'application/pdf',
    lastModified,
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as unknown as File;
}

describe('PdfComposer', () => {
  let service: PdfComposer;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PdfComposer);
  });

  it('composes a rotated PDF page into target page size', async () => {
    const source = await PDFDocument.create();
    const srcPage = source.addPage([200, 100]);
    srcPage.drawText('x', { x: 20, y: 40 });
    const sourceBytes = await source.save();

    const sourceFile = createPdfFile(sourceBytes, 'sample.pdf', 1);

    const importedFile = {
      id: 'file-1',
      name: sourceFile.name,
      size: sourceFile.size,
      type: sourceFile.type,
      lastModified: sourceFile.lastModified,
      pageCount: 1,
      previewUrl: 'blob:file-1',
      file: sourceFile,
    };

    const pages = [
      {
        id: 'page-1',
        sourceFileId: 'file-1',
        sourceFileName: 'sample.pdf',
        sourceType: 'application/pdf',
        sourcePageIndex: 0,
        rotation: 90,
      },
    ];

    const bytes = await service.compose([importedFile], pages, {
      fileName: 'out',
      pageSize: 'a4',
      quality: 'high',
      orientation: 'landscape',
    });

    const output = await PDFDocument.load(bytes);
    const page = output.getPage(0);

    expect(output.getPageCount()).toBe(1);
    expect(Math.round(page.getWidth())).toBe(842);
    expect(Math.round(page.getHeight())).toBe(595);
  });
});
