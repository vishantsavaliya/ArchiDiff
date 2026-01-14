/**
 * API Integration Layer for ArchiDiff Backend
 * Handles all communication with FastAPI backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Detail metadata type matching backend structure
 */
export interface Detail {
  id: string;
  name: string;
  filename: string;
  project: string;
  scale: string;
  description: string;
}

/**
 * API Response types
 */
interface ApiResponse<T> {
  data?: T;
  error?: string;
}

/**
 * Fetch all available details from the backend
 */
export async function fetchDetails(): Promise<Detail[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/details`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch details: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.details || [];
  } catch (error) {
    console.error('Error fetching details:', error);
    throw error;
  }
}

/**
 * Fetch a specific detail by ID
 */
export async function fetchDetailById(detailId: string): Promise<Detail> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/detail/${detailId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch detail: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.detail;
  } catch (error) {
    console.error(`Error fetching detail ${detailId}:`, error);
    throw error;
  }
}

/**
 * Get the URL for a detail file.
 * Can choose between different processing modes:
 * - 'standard': Basic PDF to PNG conversion (2x resolution)
 * - 'skeleton': Skeletonized version with 1-pixel centerlines (4x resolution)
 */
export function getDetailFileUrl(filename: string, mode: 'standard' | 'skeleton' = 'skeleton'): string {
  // Check if it's a PDF, if so use appropriate endpoint
  if (filename.toLowerCase().endsWith('.pdf')) {
    if (mode === 'skeleton') {
      // Use professional skeletonization for clean single-pixel lines
      return `${API_BASE_URL}/api/skeletonize/${filename}?page=0`;
    }
    return `${API_BASE_URL}/api/pdf-to-image/${filename}?page=0`;
  }
  return `${API_BASE_URL}/files/${filename}`;
}

/**
 * Get URL for professional overlay with color-coded skeletons
 */
export function getOverlayUrl(file1: string, file2: string, color1: string = 'green', color2: string = 'pink'): string {
  return `${API_BASE_URL}/api/overlay/${file1}/${file2}?color1=${color1}&color2=${color2}`;
}

/**
 * Upload a new detail file
 */
export async function uploadDetail(file: File): Promise<ApiResponse<{ message: string; detail: Detail }>> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return { error: errorData.detail || 'Upload failed' };
    }
    
    const data = await response.json();
    return { data };
  } catch (error) {
    console.error('Error uploading detail:', error);
    return { error: 'Upload failed' };
  }
}

/**
 * Check backend health
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    return response.ok;
  } catch (error) {
    console.error('Backend health check failed:', error);
    return false;
  }
}

/**
 * SSIM Comparison Response
 */
export interface SSIMResult {
  similarity_score: number;
  similarity_percent: number;
  difference_area_percent: number;
  is_similar: boolean;
  status: 'identical' | 'very_similar' | 'similar' | 'different';
  dimensions: {
    width: number;
    height: number;
  };
}

/**
 * Compare two drawings using Structural Similarity Index (SSIM)
 * Returns mathematical similarity score and analysis
 */
export async function compareSSIM(file1: string, file2: string): Promise<SSIMResult> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/compare-ssim/${encodeURIComponent(file1)}/${encodeURIComponent(file2)}`
    );
    
    if (!response.ok) {
      throw new Error(`SSIM comparison failed: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error comparing drawings:', error);
    throw error;
  }
}

/**
 * Generate difference heatmap between two drawings
 * Returns URL to visualize where differences are located
 */
export function getHeatmapUrl(file1: string, file2: string): string {
  return `${API_BASE_URL}/api/heatmap/${encodeURIComponent(file1)}/${encodeURIComponent(file2)}`;
}

/**
 * Get auto-aligned version of file2 to match file1
 * Uses ORB feature matching for automatic alignment
 */
export function getAlignedImageUrl(file1: string, file2: string): string {
  return `${API_BASE_URL}/api/align/${encodeURIComponent(file1)}/${encodeURIComponent(file2)}`;
}
