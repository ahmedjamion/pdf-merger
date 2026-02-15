export type ExportPageSize =
  | 'original'
  | 'a3'
  | 'a4'
  | 'a5'
  | 'letter'
  | 'legal'
  | 'folio'
  | 'tabloid'
  | 'executive'
  | 'b5';

export type ExportQuality = 'high' | 'medium' | 'low';

export interface ExportOptions {
  fileName: string;
  pageSize: ExportPageSize;
  quality: ExportQuality;
}
