import { Injectable, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

export type Theme = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);

  private readonly _currentTheme = signal<Theme>(this.getInitialTheme());
  readonly currentTheme = this._currentTheme.asReadonly();

  readonly effectiveTheme = computed(() => {
    const theme = this._currentTheme();
    if (theme === 'system') {
      return this.getSystemTheme();
    }
    return theme;
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.applyTheme();
      this.setupSystemListener();
    }
  }

  setTheme(theme: Theme): void {
    this._currentTheme.set(theme);
    localStorage.setItem('theme', theme);
    this.applyTheme();
  }

  private getInitialTheme(): Theme {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  }

  private getSystemTheme(): 'light' | 'dark' {
    if (typeof window.matchMedia !== 'function') {
      return 'light';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private setupSystemListener(): void {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (this._currentTheme() === 'system') {
        this.applyTheme();
      }
    });
  }

  private applyTheme(): void {
    const theme = this.effectiveTheme();
    document.documentElement.setAttribute('data-theme', theme);
  }
}
