export interface PageItem {
  id: string;
  sourceFileId: string;
  sourceFileName: string;
  sourceType: string;
  sourcePageIndex: number;
  rotation: number;
  previewUrl?: string;
  originOrderKey?: string;
}
