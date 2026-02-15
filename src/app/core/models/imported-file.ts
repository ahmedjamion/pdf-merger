export interface ImportedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  pageCount: number;
  previewUrl: string;
  file: File;
}
