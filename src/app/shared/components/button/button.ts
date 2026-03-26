import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-button',
  imports: [],
  templateUrl: './button.html',
  styleUrl: './button.css',
})
export class Button {
  readonly text = input<string>('Click Me');

  clicked = output<void>();

  onClick() {
    this.clicked.emit();
  }
}
