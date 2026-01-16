// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Image processing types
export interface ProcessingJob {
  id: string;
  type: 'pdf_conversion' | 'upscaling' | 'text_removal' | 'sam_removal' | 'overlay' | 'line_selection';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  input: string;
  output?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

// PDF Conversion
export interface PdfConversionRequest {
  files: File[];
  dpi?: number;
}

export interface PdfConversionResponse {
  images: string[];
  count: number;
}

// Image Upscaling
export interface UpscaleRequest {
  imagePath: string;
  scale: 2 | 4;
}

export interface UpscaleResponse {
  outputPath: string;
  originalSize: { width: number; height: number };
  upscaledSize: { width: number; height: number };
}

// Text Removal
export interface TextRemovalRequest {
  imagePath: string;
  twoPass?: boolean;
}

export interface TextRemovalResponse {
  outputPath: string;
  textRegionsRemoved: number;
  detectedTexts: Array<{
    text: string;
    confidence: number;
    bbox: number[][];
  }>;
}

// SAM Annotation Removal
export interface SAMRemovalState {
  imagePath: string;
  currentImage: string; // base64
  maskPreview?: string; // base64
  isModified: boolean;
}

export interface SAMPredictRequest {
  points: { x: number; y: number; label: 0 | 1 }[]; // 0 = background, 1 = foreground
  box?: { x1: number; y1: number; x2: number; y2: number };
}

export interface SAMPredictResponse {
  maskImage: string; // base64
}

// Interactive Overlay
export interface OverlayState {
  lowerImage: string;
  upperImage: string;
  transform: {
    dx: number;
    dy: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    opacity: number;
    thickness: number;
  };
}

export interface OverlayTransformRequest {
  dx: number;
  dy: number;
  rotation: number;
  scale_x: number;
  scale_y: number;
  opacity: number;
  thickness: number;
}

export interface OverlayResponse {
  overlayImage: string; // base64
  stats: {
    redPixels: number;
    greenPixels: number;
    bluePixels: number;
  };
}

// Line Selection
export interface LineSelectionState {
  imagePath: string;
  lines: Line[];
  selectedLines: number[];
  totalLines: number;
}

export interface Line {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  selected: boolean;
}

export interface LineClickRequest {
  x: number;
  y: number;
}

export interface LineSelectionResponse {
  image: string; // base64
  totalLines: number;
  selectedLines: number;
}

// Upload types
export interface UploadedFile {
  name: string;
  size: number;
  type: string;
  path: string;
  preview?: string;
}

// Navigation
export interface NavItem {
  path: string;
  label: string;
  icon?: string;
}
