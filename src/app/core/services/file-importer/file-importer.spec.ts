import { TestBed } from '@angular/core/testing';
import { FileImporter } from './file-importer';

describe('FileImporter', () => {
  let service: FileImporter;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FileImporter);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
