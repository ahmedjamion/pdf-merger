import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { degrees, PDFDocument } from 'pdf-lib';
import { ExportOptions, ExportOrientation } from '../../models/export-options';
import { ImportedFile } from '../../models/imported-file';
import { PageItem } from '../../models/page-item';

interface ImagePayload {
  bytes: Uint8Array;
  type: 'jpeg' | 'png';
}

interface DrawPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

@Injectable({
  providedIn: 'root',
})
export class PdfComposer {
  private readonly document = inject(DOCUMENT);

  async compose(files: ImportedFile[], pages: PageItem[], options: ExportOptions, maxPages?: number): Promise<Uint8Array> {
    const output = await PDFDocument.create();
    const filesById = new Map(files.map((file) => [file.id, file]));
    const pdfCache = new Map<string, PDFDocument>();

    const pagesToCompose = typeof maxPages === 'number' ? pages.slice(0, Math.max(0, maxPages)) : pages;

    for (const pageItem of pagesToCompose) {
      const file = filesById.get(pageItem.sourceFileId);
      if (!file) {
        continue;
      }

      const normalizedRotation = this.normalizeRotation(pageItem.rotation);

      if (file.type === 'application/pdf') {
        let source = pdfCache.get(file.id);
        if (!source) {
          source = await PDFDocument.load(await this.readFileBytes(file.file));
          pdfCache.set(file.id, source);
        }

        const sourcePage = source.getPage(pageItem.sourcePageIndex);
        const embeddedPage = await output.embedPage(sourcePage);
        const pageSize = this.resolvePageSize(options.pageSize, embeddedPage.width, embeddedPage.height, options.orientation);

        const rotatedContentSize = this.rotatedContentSize(
          embeddedPage.width,
          embeddedPage.height,
          normalizedRotation,
        );

        const box = this.fitWithin(
          pageSize.width,
          pageSize.height,
          rotatedContentSize.width,
          rotatedContentSize.height,
        );

        const placement = this.resolveDrawPlacement(box, normalizedRotation);
        const outputPage = output.addPage([pageSize.width, pageSize.height]);

        outputPage.drawPage(embeddedPage, {
          x: placement.x,
          y: placement.y,
          width: placement.width,
          height: placement.height,
          rotate: degrees(placement.rotation),
        });
      } else {
        const imagePayload = await this.prepareImage(file.file, file.type, options.quality, options.pageSize);
        const embeddedImage =
          imagePayload.type === 'png'
            ? await output.embedPng(imagePayload.bytes)
            : await output.embedJpg(imagePayload.bytes);

        const pageSize = this.resolvePageSize(options.pageSize, embeddedImage.width, embeddedImage.height, options.orientation);

        const rotatedContentSize = this.rotatedContentSize(
          embeddedImage.width,
          embeddedImage.height,
          normalizedRotation,
        );

        const box = this.fitWithin(
          pageSize.width,
          pageSize.height,
          rotatedContentSize.width,
          rotatedContentSize.height,
        );

        const placement = this.resolveDrawPlacement(box, normalizedRotation);
        const outputPage = output.addPage([pageSize.width, pageSize.height]);

        outputPage.drawImage(embeddedImage, {
          x: placement.x,
          y: placement.y,
          width: placement.width,
          height: placement.height,
          rotate: degrees(placement.rotation),
        });
      }
    }

    return output.save();
  }

  private normalizeRotation(rotation: number): 0 | 90 | 180 | 270 {
    const normalized = ((rotation % 360) + 360) % 360;

    if (normalized === 90 || normalized === 180 || normalized === 270) {
      return normalized;
    }

    return 0;
  }

  private rotatedContentSize(
    width: number,
    height: number,
    rotation: 0 | 90 | 180 | 270,
  ): { width: number; height: number } {
    if (rotation === 90 || rotation === 270) {
      return { width: height, height: width };
    }

    return { width, height };
  }

  private resolveDrawPlacement(
    box: { x: number; y: number; width: number; height: number },
    rotation: 0 | 90 | 180 | 270,
  ): DrawPlacement {
    if (rotation === 90) {
      return {
        x: box.x + box.width,
        y: box.y,
        width: box.height,
        height: box.width,
        rotation,
      };
    }

    if (rotation === 180) {
      return {
        x: box.x + box.width,
        y: box.y + box.height,
        width: box.width,
        height: box.height,
        rotation,
      };
    }

    if (rotation === 270) {
      return {
        x: box.x,
        y: box.y + box.height,
        width: box.height,
        height: box.width,
        rotation,
      };
    }

    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      rotation,
    };
  }

  private resolvePageSize(
    pageSize: ExportOptions['pageSize'],
    originalWidth: number,
    originalHeight: number,
    orientation: ExportOrientation = 'auto',
  ): { width: number; height: number } {
    if (pageSize === 'original') {
      return { width: originalWidth, height: originalHeight };
    }

    const isLandscapeOriginal = originalWidth > originalHeight;
    const isLandscape = orientation === 'auto' 
      ? isLandscapeOriginal 
      : orientation === 'landscape';

    const sizeMap: Record<Exclude<ExportOptions['pageSize'], 'original'>, { width: number; height: number }> = {
      a3: { width: 841.89, height: 1190.55 },
      a4: { width: 595.28, height: 841.89 },
      a5: { width: 419.53, height: 595.28 },
      letter: { width: 612, height: 792 },
      legal: { width: 612, height: 1008 },
      folio: { width: 612, height: 936 },
      tabloid: { width: 792, height: 1224 },
      executive: { width: 522, height: 756 },
      b5: { width: 498.9, height: 708.66 },
    };

    const base = sizeMap[pageSize];

    return isLandscape
      ? { width: Math.max(base.width, base.height), height: Math.min(base.width, base.height) }
      : { width: Math.min(base.width, base.height), height: Math.max(base.width, base.height) };
  }

  private fitWithin(
    pageWidth: number,
    pageHeight: number,
    contentWidth: number,
    contentHeight: number,
  ): { x: number; y: number; width: number; height: number } {
    const scale = Math.min(pageWidth / contentWidth, pageHeight / contentHeight);
    const width = contentWidth * scale;
    const height = contentHeight * scale;

    return {
      x: (pageWidth - width) / 2,
      y: (pageHeight - height) / 2,
      width,
      height,
    };
  }

  private async prepareImage(
    file: File,
    fileType: string,
    quality: ExportOptions['quality'],
    _pageSize: ExportOptions['pageSize'],
  ): Promise<ImagePayload> {
    const qualityValue = this.qualityValue(quality);
    const scale = this.qualityScale(quality);

    if (typeof createImageBitmap !== 'function' || !this.document?.createElement) {
      throw new Error('Image processing requires browser APIs.');
    }

    const blob = new Blob([await this.readFileBytes(file)], { type: fileType });
    const bitmap = await createImageBitmap(blob);
    const canvas = this.document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      throw new Error('Unable to process image quality settings.');
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const jpegBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', qualityValue));

    if (!jpegBlob) {
      throw new Error('Unable to process image quality settings.');
    }

    return {
      bytes: new Uint8Array(await jpegBlob.arrayBuffer()),
      type: 'jpeg',
    };
  }

  private qualityValue(quality: ExportOptions['quality']): number {
    if (quality === 'medium') {
      return 0.75;
    }

    if (quality === 'low') {
      return 0.6;
    }

    return 0.9;
  }

  private qualityScale(quality: ExportOptions['quality']): number {
    if (quality === 'medium') {
      return 0.85;
    }

    if (quality === 'low') {
      return 0.7;
    }

    return 1;
  }

  private async readFileBytes(file: File): Promise<ArrayBuffer> {
    if (typeof file.arrayBuffer === 'function') {
      return file.arrayBuffer();
    }

    return new Response(file).arrayBuffer();
  }
}

