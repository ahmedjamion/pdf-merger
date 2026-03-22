import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Steps } from './steps';
import { provideRouter } from '@angular/router';

describe('Steps', () => {
  let component: Steps;
  let fixture: ComponentFixture<Steps>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Steps],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Steps);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
