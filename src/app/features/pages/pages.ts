import { AsyncPipe } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowDown,
  lucideArrowUp,
  lucideGripVertical,
  lucideRotateCcw,
  lucideRotateCw,
  lucideTrash2,
} from '@ng-icons/lucide';
import { PageItem } from '../../core/models/page-item';
import { DocumentEditor } from '../../core/services/document-editor/document-editor';
import { PdfPreview } from '../../core/services/pdf-preview/pdf-preview';

@Component({
  selector: 'app-pages-page',
  imports: [RouterLink, DragDropModule, AsyncPipe, NgIcon],
  providers: [
    provideIcons({
      lucideArrowDown,
      lucideArrowUp,
      lucideGripVertical,
      lucideRotateCcw,
      lucideRotateCw,
      lucideTrash2,
    }),
  ],
  templateUrl: './pages.html',
  styleUrl: './pages.css',
})
export class Pages {
  protected readonly documentEditor = inject(DocumentEditor);
  private readonly router = inject(Router);
  private readonly pdfPreview = inject(PdfPreview);

  protected readonly pages = this.documentEditor.pages;
  protected readonly statusMessage = signal('');

  onDrop(event: CdkDragDrop<PageItem[]>): void {
    this.documentEditor.reorderPages(event);
    this.statusMessage.set('Page order updated.');
  }

  moveUp(index: number): void {
    this.documentEditor.movePage(index, index - 1);
    this.statusMessage.set('Page moved up.');
  }

  moveDown(index: number): void {
    this.documentEditor.movePage(index, index + 1);
    this.statusMessage.set('Page moved down.');
  }

  rotateLeft(pageId: string): void {
    this.documentEditor.rotatePage(pageId, -90);
    this.statusMessage.set('Page rotated left.');
  }

  rotateRight(pageId: string): void {
    this.documentEditor.rotatePage(pageId, 90);
    this.statusMessage.set('Page rotated right.');
  }

  removePage(pageId: string): void {
    this.documentEditor.removePage(pageId);
    this.statusMessage.set('Page removed.');
  }

  resetFromFiles(): void {
    this.documentEditor.resetPagesFromFiles();
    this.statusMessage.set('Pages reset to file order.');
  }

  async goToExport(): Promise<void> {
    if (!this.documentEditor.hasPages()) {
      return;
    }

    await this.router.navigate(['/export']);
  }

  protected isPdf(type: string): boolean {
    return type === 'application/pdf';
  }

  protected getPdfPagePreview(page: PageItem): Promise<string | null> {
    const sourceFile = this.documentEditor.getFileById(page.sourceFileId);

    if (!sourceFile) {
      return Promise.resolve('');
    }

    return this.pdfPreview.getPagePreview(sourceFile, page.sourcePageIndex);
  }
}
