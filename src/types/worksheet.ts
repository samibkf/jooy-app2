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

export interface RegionsModeMetadata {
  documentName: string;
  documentId: string;
  regions: RegionData[];
  drmProtectedPages: number[] | boolean;
}

export interface AutoModeGuidanceItem {
  title: string;
  description: string[];
}

export interface AutoModePage {
  page_number: number;
  page_description: string;
  guidance: AutoModeGuidanceItem[];
}

export interface AutoModeMetadata {
  mode: 'auto';
  documentName: string;
  documentId: string;
  drmProtectedPages: number[] | boolean;
  pages: AutoModePage[];
}

export type WorksheetMetadata = RegionsModeMetadata | AutoModeMetadata;