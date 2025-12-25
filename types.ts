
export interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
}

export type DifferenceStatus = 'pending' | 'fixed' | 'verified';
export type PlatformType = 'dual' | 'ios' | 'android';

export interface Difference {
  category: 'color' | 'spacing' | 'typography' | 'layout' | 'border-radius' | 'size' | 'other';
  description: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  suggestion?: string;
  status: DifferenceStatus;
  platform: PlatformType;
  coordinates?: { x: number; y: number }; // 百分比坐标 (0-100)
}

export interface ImagePair {
  id: string;
  design: UploadedImage;
  implementation: UploadedImage;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: AuditResult;
}

export interface AuditResult {
  summary: string;
  matchScore: number;
  differences: Difference[];
}

export enum AppStep {
  UPLOAD_DESIGN = 'UPLOAD_DESIGN',
  UPLOAD_IMPLEMENTATION = 'UPLOAD_IMPLEMENTATION',
  PAIRING = 'PAIRING',
  RESULTS = 'RESULTS'
}
