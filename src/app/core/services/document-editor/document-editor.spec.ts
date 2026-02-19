import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { DocumentEditor } from './document-editor';

function createTestFile(content: string, name: string, type: string, lastModified: number): File {
  const bytes = new TextEncoder().encode(content);

  return {
    name,
    type,
    lastModified,
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer.slice(0),
  } as unknown as File;
}

describe('DocumentEditor', () => {
  let service: DocumentEditor;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DocumentEditor);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    service.clearFiles();
    service.clearInvalidFiles();
    vi.restoreAllMocks();
  });

  it('accepts files with empty MIME type when extension is supported', async () => {
    const file = createTestFile('hello', 'photo.JPG', '', 100);

    await service.addFiles([file]);

    expect(service.files().length).toBe(1);
    expect(service.files()[0].type).toBe('image/jpeg');
    expect(service.invalidFiles().length).toBe(0);
  });

  it('uses hash fallback for files that collide on metadata key', async () => {
    const first = createTestFile('ab', 'scan.png', 'image/png', 123);
    const second = createTestFile('cd', 'scan.png', 'image/png', 123);
    const duplicate = createTestFile('ab', 'scan.png', 'image/png', 123);

    await service.addFiles([first, second]);
    await service.addFiles([duplicate]);

    expect(service.files().length).toBe(2);
    expect(service.invalidFiles().length).toBe(1);
    expect(service.invalidFiles()[0].reasons.join(' ')).toContain('Duplicate files are not allowed.');
  });

  it('preserves manual page edits when file order changes', async () => {
    const one = createTestFile('one', 'one.png', 'image/png', 1);
    const two = createTestFile('two', 'two.png', 'image/png', 2);

    await service.addFiles([one, two]);

    const firstPageId = service.pages()[0].id;
    service.rotatePage(firstPageId, 90);

    service.moveFile(0, 1);

    expect(service.hasManualPageEdits()).toBe(true);
    expect(service.pages().some((page) => page.rotation === 90)).toBe(true);
  });

  it('sanitizes export file names', () => {
    service.setExportFileName(' report<>:"/\\|?*.pdf   ');
    expect(service.exportOptions().fileName).toBe('report');

    service.setExportFileName('   ');
    expect(service.exportOptions().fileName).toBe('merged-document');
  });
});
