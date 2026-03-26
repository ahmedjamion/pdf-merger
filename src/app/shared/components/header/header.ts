import { Component } from '@angular/core';
import { ThemeSelector } from '../theme-selector/theme-selector';

@Component({
  selector: 'app-header',
  imports: [ThemeSelector],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {}
