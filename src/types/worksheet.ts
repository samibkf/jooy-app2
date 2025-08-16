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

export interface GuidanceItem {
  title: string;
  description: string;
}

export interface AutoModePageData {
  page_number: number;
  page_description: string;
  guidance: GuidanceItem[];
}

export interface WorksheetMetadata {
  documentName: string;
  documentId: string;
  drmProtectedPages: number[] | boolean;
  mode: "auto" | "regions";
  data: AutoModePageData[] | RegionData[];
}