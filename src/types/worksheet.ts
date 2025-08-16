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
  description: string;
}

export interface AutoModePageData {
  page_number: number;
  page_description: string;
  guidance: AutoModeGuidanceItem[];
}

export interface AutoModeMetadata {
  mode: "auto";
  data: AutoModePageData[];
}

// Union type for both metadata formats
export type WorksheetMetadata = RegionsModeMetadata | AutoModeMetadata;

// Type guards to distinguish between metadata formats
export function isAutoModeMetadata(metadata: WorksheetMetadata): metadata is AutoModeMetadata {
  return 'mode' in metadata && metadata.mode === 'auto';
}

export function isRegionsModeMetadata(metadata: WorksheetMetadata): metadata is RegionsModeMetadata {
  return 'documentName' in metadata && 'regions' in metadata;
}