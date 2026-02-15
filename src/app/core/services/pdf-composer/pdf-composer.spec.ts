import { TestBed } from '@angular/core/testing';
import { PdfComposer } from './pdf-composer';

describe('PdfComposer', () => {
  let service: PdfComposer;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PdfComposer);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
