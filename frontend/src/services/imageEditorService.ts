import { imageEditorAPI, processingAPI } from './api';

export interface Layer {
  id: number;
  visible: boolean;
  active: boolean;
  transform: {
    x: number;
    y: number;
    rotation: number;
    opacity: number;
    scale: number;
  };
}

export const imageEditorService = {
  /**
   * Load images into the editor API
   */
  async loadImages() {
    const response = await imageEditorAPI.post('/load');
    return response.data;
  },

  /**
   * Convert image to green with transparent white background
   */
  async convertToGreenTransparent(layerId: number) {
    const response = await imageEditorAPI.post('/convert-green-transparent', {
      layer_id: layerId,
    });
    return response.data;
  },

  /**
   * Crop image
   */
  async cropImage(layerId: number, x: number, y: number, width: number, height: number) {
    const response = await imageEditorAPI.post('/crop', {
      layer_id: layerId,
      x,
      y,
      width,
      height,
    });
    return response.data;
  },

  /**
   * Transform image (rotate, scale, translate)
   */
  async transformImage(layerId: number, rotation: number, scale: number, tx: number, ty: number) {
    const response = await imageEditorAPI.post('/transform', {
      layer_id: layerId,
      rotation,
      scale,
      tx,
      ty,
    });
    return response.data;
  },

  /**
   * Get processed image
   */
  getImageUrl(layerId: number): string {
    return `${imageEditorAPI.defaults.baseURL}/get-image/${layerId}?t=${Date.now()}`;
  },

  /**
   * Reset layer to original
   */
  async resetLayer(layerId: number) {
    const response = await imageEditorAPI.post(`/reset/${layerId}`);
    return response.data;
  },

  /**
   * Create final overlay of both layers
   */
  async createOverlay(outputPath?: string) {
    const response = await imageEditorAPI.post('/overlay', {
      output_path: outputPath,
    });
    return response.data;
  },

  /**
   * Get image from processing API
   */
  getProcessedImageUrl(jobId: string, fileNum: number): string {
    return `${processingAPI.defaults.baseURL}/image/${jobId}/${fileNum}?t=${Date.now()}`;
  },
};
