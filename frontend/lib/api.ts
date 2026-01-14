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
 * Get the URL for a detail file
 */
export function getDetailFileUrl(filename: string): string {
  // Check if it's a PDF, if so use the PDF-to-image endpoint
  if (filename.toLowerCase().endsWith('.pdf')) {
    return `${API_BASE_URL}/api/pdf-to-image/${filename}?page=0`;
  }
  return `${API_BASE_URL}/files/${filename}`;
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
