import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { DocumentEditor } from '../services/document-editor/document-editor';
import { requireFilesGuard, requirePagesGuard } from './flow-guards';

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

describe('flow guards', () => {
  let router: Router;
  let editor: DocumentEditor;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });

    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    router = TestBed.inject(Router);
    editor = TestBed.inject(DocumentEditor);
    editor.clearFiles();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects files route to import when no files exist', () => {
    const result = TestBed.runInInjectionContext(() => requireFilesGuard({} as never, {} as never));
    expect(result).toEqual(router.parseUrl('/import'));
  });

  it('redirects export route to files when no pages exist', async () => {
    const file = createTestFile('x', 'image.png', 'image/png', 1);
    await editor.addFiles([file]);
    editor.removePage(editor.pages()[0].id);

    const result = TestBed.runInInjectionContext(() => requirePagesGuard({} as never, {} as never));
    expect(result).toEqual(router.parseUrl('/files'));
  });
});
