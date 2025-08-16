export interface RegionData {
  id: string;
  document_id: string;
  user_id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  name: string;
  description: string[];
  created_at: string;
}

export interface WorksheetMetadata {
  documentName: string;
  documentId: string;
  regions: RegionData[];
  drmProtectedPages: number[] | boolean;
}