import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowDown,
  lucideArrowUp,
  lucideGripVertical,
  lucideRotateCcw,
  lucideRotateCw,
  lucideTrash2,
} from '@ng-icons/lucide';
import { DocumentEditor } from '../../core/services/document-editor/document-editor';
import { PageItem } from '../../core/models/page-item';
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

  onDrop(event: CdkDragDrop<PageItem[]>): void {
    this.documentEditor.reorderPages(event);
  }

  moveUp(index: number): void {
    this.documentEditor.movePage(index, index - 1);
  }

  moveDown(index: number): void {
    this.documentEditor.movePage(index, index + 1);
  }

  rotateLeft(pageId: string): void {
    this.documentEditor.rotatePage(pageId, -90);
  }

  rotateRight(pageId: string): void {
    this.documentEditor.rotatePage(pageId, 90);
  }

  removePage(pageId: string): void {
    this.documentEditor.removePage(pageId);
  }

  resetFromFiles(): void {
    this.documentEditor.resetPagesFromFiles();
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
