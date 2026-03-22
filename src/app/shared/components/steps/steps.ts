import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucideChevronDown } from '@ng-icons/lucide';

interface Step {
  link: string;
  title: string;
}

@Component({
  selector: 'app-steps',
  imports: [RouterLink, RouterLinkActive, NgIcon],
  providers: [
    provideIcons({
      lucideChevronDown,
    }),
  ],
  templateUrl: './steps.html',
  styleUrl: './steps.css',
})
export class Steps {
  protected readonly isStepsOpen = signal<boolean>(false);

  protected readonly steps = signal<Step[]>([
    {
      link: 'import',
      title: 'Import Files',
    },
    {
      link: 'files',
      title: 'Arrange Files',
    },
    {
      link: 'pages',
      title: 'Arrange Pages',
    },
    {
      link: 'export',
      title: 'Export PDF',
    },
  ]);

  toggleSteps() {
    this.isStepsOpen.set(!this.isStepsOpen());
  }
}
