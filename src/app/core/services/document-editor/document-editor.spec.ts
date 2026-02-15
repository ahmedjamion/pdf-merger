import { TestBed } from '@angular/core/testing';
import { DocumentEditor } from './document-editor';

describe('DocumentEditor', () => {
  let service: DocumentEditor;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DocumentEditor);
  });

  it('should reject duplicate non-pdf files', async () => {
    const first = new File(['hello'], 'test.png', {
      type: 'image/png',
      lastModified: 123,
    });

    const duplicate = new File(['hello'], 'test.png', {
      type: 'image/png',
      lastModified: 123,
    });

    await service.addFiles([first]);
    await service.addFiles([duplicate]);

    expect(service.files().length).toBe(1);
    expect(service.invalidFiles().length).toBeGreaterThan(0);
  });
});
