import { samAPI, overlayAPI, lineSelectorAPI } from './api';
import type {
  SAMPredictRequest,
  SAMPredictResponse,
  OverlayTransformRequest,
  OverlayResponse,
  LineClickRequest,
  LineSelectionResponse,
} from '../types';

// ============ SAM Remover Service ============
export const samService = {
  // Get current image
  async getImage(): Promise<{ image: string }> {
    const response = await samAPI.get('/get_image');
    return response.data;
  },

  // Predict mask from user clicks
  async predictMask(data: SAMPredictRequest): Promise<SAMPredictResponse> {
    const response = await samAPI.post('/predict', {
      points: data.points,
      box: data.box,
    });
    return { maskImage: response.data.mask_image };
  },

  // Apply mask and remove annotation
  async applyMask(): Promise<{ image: string }> {
    const response = await samAPI.post('/apply_mask');
    return { image: response.data.image };
  },

  // Reset to original image
  async reset(): Promise<{ image: string }> {
    const response = await samAPI.get('/reset');
    return { image: response.data.image };
  },

  // Save result
  async save(): Promise<Blob> {
    const response = await samAPI.get('/save', {
      responseType: 'blob',
    });
    return response.data;
  },
};

// ============ Interactive Overlay Service ============
export const overlayService = {
  // Get current overlay
  async getImage(): Promise<{ image: string }> {
    const response = await overlayAPI.get('/get_image');
    return { image: response.data.image };
  },

  // Update transformation
  async updateTransform(transform: OverlayTransformRequest): Promise<OverlayResponse> {
    const response = await overlayAPI.post('/update_transform', transform);
    return { 
      overlayImage: response.data.image,
      stats: {
        redPixels: 0,
        greenPixels: 0,
        bluePixels: 0,
      },
    };
  },

  // Save overlay
  async save(): Promise<Blob> {
    const response = await overlayAPI.get('/save', {
      responseType: 'blob',
    });
    return response.data;
  },
};

// ============ Line Selector Service ============
export const lineSelectorService = {
  // Get current visualization
  async getImage(): Promise<LineSelectionResponse> {
    const response = await lineSelectorAPI.get('/get_image');
    return {
      image: response.data.image,
      totalLines: response.data.total_lines,
      selectedLines: response.data.selected_lines,
    };
  },

  // Click on line to toggle selection
  async clickLine(data: LineClickRequest): Promise<{ success: boolean }> {
    const response = await lineSelectorAPI.post('/click_line', data);
    return { success: response.data.success };
  },

  // Clear all selections
  async clearSelection(): Promise<{ success: boolean }> {
    const response = await lineSelectorAPI.post('/clear_selection');
    return { success: response.data.success };
  },

  // Preview removal
  async removeSelected(): Promise<{ image: string }> {
    const response = await lineSelectorAPI.post('/remove_selected');
    return { image: response.data.image };
  },

  // Save result
  async saveResult(): Promise<{ success: boolean; path: string }> {
    const response = await lineSelectorAPI.post('/save_result');
    return {
      success: response.data.success,
      path: response.data.output_path,
    };
  },
};

// ============ Helper Functions ============

// Convert base64 to Blob for download
export function base64ToBlob(base64: string, contentType: string = 'image/png'): Blob {
  const byteCharacters = atob(base64.split(',')[1] || base64);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: contentType });
}

// Download file
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
