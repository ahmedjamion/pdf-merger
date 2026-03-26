import { Component } from '@angular/core';
import { inject } from '@angular/core';
import { ThemeService } from './core/services/theme/theme.service';
import { Steps } from './shared/components/steps/steps';
import { Header } from './shared/components/header/header';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Steps, Header],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly themeService = inject(ThemeService);
}
