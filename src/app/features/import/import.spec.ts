import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Import } from './import';

describe('Import', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Import],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Import);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
