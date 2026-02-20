import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideFileText, lucideImage, lucideArrowUp, lucideArrowDown, lucideRotateCcw, lucideRotateCw, lucideTrash2, lucideGripVertical } from '@ng-icons/lucide';
import { PageItem } from '../../../core/models/page-item';

@Component({
  selector: 'app-page-card',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideFileText, lucideImage, lucideArrowUp, lucideArrowDown, lucideRotateCcw, lucideRotateCw, lucideTrash2, lucideGripVertical })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './page-card.html',
  styleUrl: './page-card.css',
})
export class PageCard {
  readonly page = input.required<PageItem>();
  readonly index = input(0);
  readonly previewUrl = input<string | null>(null);
  readonly totalPages = input(0);
  readonly canMoveUp = input(false);
  readonly canMoveDown = input(false);
  
  readonly moveUp = output<number>();
  readonly moveDown = output<number>();
  readonly rotateLeft = output<string>();
  readonly rotateRight = output<string>();
  readonly remove = output<string>();

  get isPdf(): boolean {
    return this.page().sourceType === 'application/pdf';
  }

  onMoveUp(): void {
    this.moveUp.emit(this.index());
  }

  onMoveDown(): void {
    this.moveDown.emit(this.index());
  }

  onRotateLeft(): void {
    this.rotateLeft.emit(this.page().id);
  }

  onRotateRight(): void {
    this.rotateRight.emit(this.page().id);
  }

  onRemove(): void {
    this.remove.emit(this.page().id);
  }
}
