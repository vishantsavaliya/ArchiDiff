/**
 * WebGL Renderer for high-performance canvas rendering
 * Handles large images with viewport culling and GPU acceleration
 */

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
  width: number;
  height: number;
}

export interface LayerData {
  texture: WebGLTexture | null;
  transform: {
    x: number;
    y: number;
    rotation: number;
    scale: number;
    opacity: number;
  };
  visible: boolean;
}

export class WebGLRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  private viewport: ViewportState;
  private layers: Map<number, LayerData> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      desynchronized: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });

    if (!gl) {
      throw new Error('WebGL not supported');
    }

    this.gl = gl;
    this.viewport = {
      x: 0,
      y: 0,
      zoom: 1.0,
      width: canvas.width,
      height: canvas.height
    };

    this.initShaders();
    this.initBuffers();
  }

  private initShaders() {
    const gl = this.gl;

    // Vertex shader with transform support
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      
      uniform vec2 u_resolution;
      uniform vec2 u_translation;
      uniform vec2 u_rotation; // cos, sin
      uniform vec2 u_scale;
      uniform vec2 u_viewport;
      uniform float u_zoom;
      
      varying vec2 v_texCoord;
      
      void main() {
        // Apply layer transform
        vec2 scaled = a_position * u_scale;
        vec2 rotated = vec2(
          scaled.x * u_rotation.x - scaled.y * u_rotation.y,
          scaled.x * u_rotation.y + scaled.y * u_rotation.x
        );
        vec2 transformed = rotated + u_translation;
        
        // Apply viewport transform (pan and zoom)
        vec2 viewportPos = (transformed - u_viewport) * u_zoom;
        
        // Convert to clip space
        vec2 clipSpace = (viewportPos / u_resolution) * 2.0 - 1.0;
        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
        
        v_texCoord = a_texCoord;
      }
    `;

    // Fragment shader with opacity support
    const fragmentShaderSource = `
      precision mediump float;
      
      uniform sampler2D u_texture;
      uniform float u_opacity;
      
      varying vec2 v_texCoord;
      
      void main() {
        vec4 texColor = texture2D(u_texture, v_texCoord);
        gl_FragColor = vec4(texColor.rgb, texColor.a * u_opacity);
      }
    `;

    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) {
      throw new Error('Failed to create shaders');
    }

    this.program = gl.createProgram();
    if (!this.program) {
      throw new Error('Failed to create shader program');
    }

    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(this.program);
      throw new Error('Failed to link program: ' + info);
    }
  }

  private createShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  private initBuffers() {
    const gl = this.gl;

    // Position buffer (quad)
    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    const positions = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      0, 1,
      1, 0,
      1, 1
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // Texture coordinate buffer
    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    const texCoords = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      0, 1,
      1, 0,
      1, 1
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
  }

  public loadImageToTexture(layerId: number, image: HTMLImageElement | HTMLCanvasElement): WebGLTexture | null {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) return null;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    // Use linear filtering for better quality
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const layerData = this.layers.get(layerId) || {
      texture: null,
      transform: { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 },
      visible: true
    };

    layerData.texture = texture;
    this.layers.set(layerId, layerData);

    return texture;
  }

  public updateLayerTransform(layerId: number, transform: Partial<LayerData['transform']>) {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.transform = { ...layer.transform, ...transform };
    }
  }

  public setLayerVisibility(layerId: number, visible: boolean) {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.visible = visible;
    }
  }

  public setViewport(viewport: Partial<ViewportState>) {
    this.viewport = { ...this.viewport, ...viewport };
  }

  public render(layerOrder: number[]) {
    const gl = this.gl;
    if (!this.program) return;

    gl.useProgram(this.program);

    // Clear with black background
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Get uniform locations
    const resolutionLoc = gl.getUniformLocation(this.program, 'u_resolution');
    const translationLoc = gl.getUniformLocation(this.program, 'u_translation');
    const rotationLoc = gl.getUniformLocation(this.program, 'u_rotation');
    const scaleLoc = gl.getUniformLocation(this.program, 'u_scale');
    const opacityLoc = gl.getUniformLocation(this.program, 'u_opacity');
    const viewportLoc = gl.getUniformLocation(this.program, 'u_viewport');
    const zoomLoc = gl.getUniformLocation(this.program, 'u_zoom');

    // Set viewport uniforms
    gl.uniform2f(resolutionLoc, this.viewport.width, this.viewport.height);
    gl.uniform2f(viewportLoc, this.viewport.x, this.viewport.y);
    gl.uniform1f(zoomLoc, this.viewport.zoom);

    // Render each layer
    layerOrder.forEach(layerId => {
      const layer = this.layers.get(layerId);
      if (!layer || !layer.visible || !layer.texture) return;

      // Set transform uniforms
      const rad = (layer.transform.rotation * Math.PI) / 180;
      gl.uniform2f(translationLoc, layer.transform.x, layer.transform.y);
      gl.uniform2f(rotationLoc, Math.cos(rad), Math.sin(rad));
      gl.uniform2f(scaleLoc, layer.transform.scale, layer.transform.scale);
      gl.uniform1f(opacityLoc, layer.transform.opacity);

      // Bind texture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, layer.texture);
      gl.uniform1i(gl.getUniformLocation(this.program, 'u_texture'), 0);

      // Bind position buffer
      const positionLoc = gl.getAttribLocation(this.program, 'a_position');
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

      // Bind texCoord buffer
      const texCoordLoc = gl.getAttribLocation(this.program, 'a_texCoord');
      gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
      gl.enableVertexAttribArray(texCoordLoc);
      gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

      // Draw
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    });
  }

  public pan(dx: number, dy: number) {
    this.viewport.x += dx / this.viewport.zoom;
    this.viewport.y += dy / this.viewport.zoom;
  }

  public zoom(delta: number, centerX: number, centerY: number) {
    const oldZoom = this.viewport.zoom;
    const newZoom = Math.max(0.1, Math.min(10, oldZoom + delta));

    // Zoom towards the center point
    this.viewport.x += (centerX - this.viewport.width / 2) * (1 / oldZoom - 1 / newZoom);
    this.viewport.y += (centerY - this.viewport.height / 2) * (1 / oldZoom - 1 / newZoom);
    this.viewport.zoom = newZoom;
  }

  public resetViewport() {
    this.viewport.x = 0;
    this.viewport.y = 0;
    this.viewport.zoom = 1.0;
  }

  public dispose() {
    const gl = this.gl;
    
    // Delete textures
    this.layers.forEach(layer => {
      if (layer.texture) {
        gl.deleteTexture(layer.texture);
      }
    });

    // Delete buffers
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    if (this.texCoordBuffer) gl.deleteBuffer(this.texCoordBuffer);

    // Delete program
    if (this.program) gl.deleteProgram(this.program);

    this.layers.clear();
  }
}
