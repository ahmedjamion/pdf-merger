import { isPlatformBrowser } from '@angular/common';
import { Component, DOCUMENT, inject, PLATFORM_ID, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMoon, lucideSun } from '@ng-icons/lucide';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgIcon],
  providers: [
    provideIcons({
      lucideSun,
      lucideMoon,
    }),
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly isDark = signal(false);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const storedTheme = localStorage.getItem('theme');
    const prefersDark = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;
    const isDark = storedTheme ? storedTheme === 'dark' : prefersDark;

    this.isDark.set(isDark);
    this.applyThemeClass(isDark);
  }

  toggleTheme(): void {
    const next = !this.isDark();
    this.isDark.set(next);

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.applyThemeClass(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  private applyThemeClass(isDark: boolean): void {
    this.document.documentElement.classList.toggle('theme-dark', isDark);
  }
}
