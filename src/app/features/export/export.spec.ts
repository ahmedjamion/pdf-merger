import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Export } from './export';

describe('Export', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Export],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Export);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
