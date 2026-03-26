import { Component, HostListener, inject, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideSun, lucideMoon, lucideMonitor, lucideChevronDown } from '@ng-icons/lucide';
import { NgIconComponent } from '@ng-icons/core';
import { Theme, ThemeService } from '../../../core/services/theme/theme.service';

@Component({
  selector: 'app-theme-selector',
  imports: [NgIconComponent],
  providers: [
    provideIcons({
      lucideSun,
      lucideMoon,
      lucideMonitor,
      lucideChevronDown,
    }),
  ],
  templateUrl: './theme-selector.html',
  styleUrl: './theme-selector.css',
})
export class ThemeSelector {
  readonly themeService = inject(ThemeService);
  readonly isOpen = signal(false);

  readonly themes = [
    { value: 'light' as Theme, icon: 'lucideSun', label: 'Light' },
    { value: 'dark' as Theme, icon: 'lucideMoon', label: 'Dark' },
    { value: 'system' as Theme, icon: 'lucideMonitor', label: 'System' },
  ];

  get currentThemeOption() {
    return this.themes.find((t) => t.value === this.themeService.currentTheme()) ?? this.themes[0];
  }

  toggle(): void {
    this.isOpen.update((v) => !v);
  }

  select(theme: Theme): void {
    this.themeService.setTheme(theme);
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('app-theme-selector')) {
      this.isOpen.set(false);
    }
  }
}
