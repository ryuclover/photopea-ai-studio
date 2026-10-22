// src/services/ImageUtils.ts

export interface PixelRect { x: number; y: number; width: number; height: number; }
export interface InpaintCrop { rect: PixelRect; targetWidth: number; targetHeight: number; }

const toPNG = (canvas: HTMLCanvasElement, error: string) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(error)), "image/png"));

function context2d(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas indisponível.");
  ctx.imageSmoothingQuality = "high";
  return [canvas, ctx];
}

export class ImageUtils {
  /** Bounds of every pixel with any selection weight; null for an empty selection. */
  public static async selectionBounds(mask: Blob): Promise<{ bounds: PixelRect | null; width: number; height: number }> {
    const bitmap = await createImageBitmap(mask);
    try {
      const [, ctx] = context2d(bitmap.width, bitmap.height);
      ctx.drawImage(bitmap, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      let minX = width, minY = height, maxX = -1, maxY = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (data[(y * width + x) * 4 + 3] === 0) continue;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
      return { width, height, bounds: maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } };
    } finally { bitmap.close(); }
  }

  /**
   * Context crop around the selection, inside the document, plus model dimensions.
   * Margin is proportional to the selection; tiny selections grow to limit upscaling;
   * aspect stays within 1:2 and the model receives ~1 MP in multiples of 8.
   */
  public static planInpaintCrop(bounds: PixelRect, docWidth: number, docHeight: number, contextRatio = 0.5, minSide = 512, targetArea = 1024 * 1024): InpaintCrop {
    const margin = Math.max(32, Math.round(Math.max(bounds.width, bounds.height) * contextRatio));
    let width = bounds.width + margin * 2;
    let height = bounds.height + margin * 2;
    // Avoid extreme strips: the model composes better with some context on the short axis.
    width = Math.max(width, height / 2);
    height = Math.max(height, width / 2);
    const longSide = Math.max(width, height);
    if (longSide < minSide) { width *= minSide / longSide; height *= minSide / longSide; }
    width = Math.min(docWidth, Math.round(width));
    height = Math.min(docHeight, Math.round(height));
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    const x = Math.min(Math.max(0, Math.round(centerX - width / 2)), docWidth - width);
    const y = Math.min(Math.max(0, Math.round(centerY - height / 2)), docHeight - height);
    const scale = Math.sqrt(targetArea / (width * height));
    const snap = (value: number) => Math.min(1536, Math.max(256, Math.round(value / 8) * 8));
    return { rect: { x, y, width, height }, targetWidth: snap(width * scale), targetHeight: snap(height * scale) };
  }

  /** Crop a region and scale it to the model size. Masks are binarized (diffusers uses alpha ≥ 50%). */
  public static async cropScaled(blob: Blob, rect: PixelRect, width: number, height: number, asMask = false): Promise<Blob> {
    const bitmap = await createImageBitmap(blob);
    try {
      const [canvas, ctx] = context2d(width, height);
      ctx.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height);
      if (asMask) {
        const pixels = ctx.getImageData(0, 0, width, height);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const on = pixels.data[i + 3] >= 128 ? 255 : 0;
          pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = pixels.data[i + 3] = on;
        }
        ctx.putImageData(pixels, 0, 0);
      }
      return await toPNG(canvas, "Falha ao recortar a imagem.");
    } finally { bitmap.close(); }
  }

  /** Place a model result back at its crop rectangle over the full-resolution original. */
  public static async pasteCrop(original: Blob, generated: Blob, rect: PixelRect): Promise<Blob> {
    const [base, edit] = await Promise.all([createImageBitmap(original), createImageBitmap(generated)]);
    try {
      const [canvas, ctx] = context2d(base.width, base.height);
      ctx.drawImage(base, 0, 0);
      ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
      ctx.drawImage(edit, rect.x, rect.y, rect.width, rect.height);
      return await toPNG(canvas, "Falha ao reposicionar o resultado.");
    } finally { base.close(); edit.close(); }
  }

  /**
   * Composite mask with a gradual transition *inside* the selection.
   * Weight = selection alpha × smoothstep(distance to the nearest unselected pixel / feather).
   * Unselected pixels keep weight 0, so nothing outside the selection can change.
   * Document edges do not count as a border. featherPx 0 returns the selection unchanged.
   */
  public static async featherMask(mask: Blob, featherPx: number): Promise<Blob> {
    if (featherPx <= 0) return mask;
    const bitmap = await createImageBitmap(mask);
    try {
      const [canvas, ctx] = context2d(bitmap.width, bitmap.height);
      ctx.drawImage(bitmap, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data, width, height } = pixels;
      const INF = 1e9;
      const distance = new Float32Array(width * height);
      let minX = width, minY = height, maxX = -1, maxY = -1;
      for (let i = 0, p = 0; p < distance.length; p++, i += 4) {
        const selected = data[i + 3] > 0;
        distance[p] = selected ? INF : 0;
        if (selected) {
          const x = p % width, y = (p - x) / width;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
      if (maxX < 0) return mask;
      // Narrow selections would otherwise become fully translucent.
      const feather = Math.max(1, Math.min(featherPx, Math.min(maxX - minX + 1, maxY - minY + 1) / 4));
      const D = Math.SQRT2;
      // Two-pass chamfer distance transform (8-neighbourhood).
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const p = y * width + x;
          let d = distance[p];
          if (d === 0) continue;
          if (x > 0) d = Math.min(d, distance[p - 1] + 1);
          if (y > 0) {
            d = Math.min(d, distance[p - width] + 1);
            if (x > 0) d = Math.min(d, distance[p - width - 1] + D);
            if (x < width - 1) d = Math.min(d, distance[p - width + 1] + D);
          }
          distance[p] = d;
        }
      }
      for (let y = height - 1; y >= 0; y--) {
        for (let x = width - 1; x >= 0; x--) {
          const p = y * width + x;
          let d = distance[p];
          if (d === 0) continue;
          if (x < width - 1) d = Math.min(d, distance[p + 1] + 1);
          if (y < height - 1) {
            d = Math.min(d, distance[p + width] + 1);
            if (x < width - 1) d = Math.min(d, distance[p + width + 1] + D);
            if (x > 0) d = Math.min(d, distance[p + width - 1] + D);
          }
          distance[p] = d;
        }
      }
      for (let i = 0, p = 0; p < distance.length; p++, i += 4) {
        const alpha = data[i + 3];
        if (alpha === 0) { data[i] = data[i + 1] = data[i + 2] = 0; continue; }
        const t = Math.min(1, distance[p] / feather);
        const weight = t * t * (3 - 2 * t);
        data[i] = data[i + 1] = data[i + 2] = 255;
        // Keep at least 1 so every selected pixel still receives part of the edit.
        data[i + 3] = Math.max(1, Math.round(alpha * weight));
      }
      ctx.putImageData(pixels, 0, 0);
      return await toPNG(canvas, "Falha ao suavizar a máscara.");
    } finally { bitmap.close(); }
  }

  /** Transparent patch for a new layer: no duplicated pixels outside the selection, with harmonized background. */
  public static async inpaintLayer(generated: Blob, mask: Blob, original?: Blob): Promise<Blob> {
    const [image, selection] = await Promise.all([createImageBitmap(generated), createImageBitmap(mask)]);
    try {
      const [canvas, ctx] = context2d(selection.width, selection.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      if (original) {
        const origBitmap = await createImageBitmap(original);
        try {
          const [, origCtx] = context2d(selection.width, selection.height);
          origCtx.drawImage(origBitmap, 0, 0);
          const origPixels = origCtx.getImageData(0, 0, canvas.width, canvas.height).data;
          const genPixels = ctx.getImageData(0, 0, canvas.width, canvas.height);

          const [, maskCtx] = context2d(selection.width, selection.height);
          maskCtx.drawImage(selection, 0, 0);
          const maskPixels = maskCtx.getImageData(0, 0, canvas.width, canvas.height).data;

          let sumDr = 0, sumDg = 0, sumDb = 0, count = 0;
          for (let i = 0; i < maskPixels.length; i += 16) {
            const a = maskPixels[i + 3];
            if (a > 10 && a < 200) {
              sumDr += (origPixels[i] - genPixels.data[i]);
              sumDg += (origPixels[i + 1] - genPixels.data[i + 1]);
              sumDb += (origPixels[i + 2] - genPixels.data[i + 2]);
              count++;
            }
          }
          if (count >= 16) {
            const clamp = (v: number) => Math.max(-12, Math.min(12, v));
            const dr = clamp(Math.round(sumDr / count));
            const dg = clamp(Math.round(sumDg / count));
            const db = clamp(Math.round(sumDb / count));
            for (let i = 0; i < genPixels.data.length; i += 4) {
              const weight = maskPixels[i + 3] / 255;
              if (weight === 0) continue;
              const adj = (1 - weight) * (1 - weight);
              genPixels.data[i] = Math.min(255, Math.max(0, genPixels.data[i] + Math.round(dr * adj)));
              genPixels.data[i + 1] = Math.min(255, Math.max(0, genPixels.data[i + 1] + Math.round(dg * adj)));
              genPixels.data[i + 2] = Math.min(255, Math.max(0, genPixels.data[i + 2] + Math.round(db * adj)));
            }
            ctx.putImageData(genPixels, 0, 0);
          }
        } finally { origBitmap.close(); }
      }

      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(selection, 0, 0);
      return await toPNG(canvas, "Falha ao criar camada editada.");
    } finally { image.close(); selection.close(); }
  }

  /** Preview and export are rendered from the exact PNG patch inserted in Photopea. */
  public static async compositeLayer(original: Blob, layer: Blob): Promise<Blob> {
    const [base, patch] = await Promise.all([createImageBitmap(original), createImageBitmap(layer)]);
    try {
      const [canvas, ctx] = context2d(base.width, base.height);
      ctx.drawImage(base, 0, 0);
      ctx.drawImage(patch, 0, 0);
      return await toPNG(canvas, "Falha ao compor resultado.");
    } finally { base.close(); patch.close(); }
  }

  public static async compositeInpaint(original: Blob, generated: Blob, mask: Blob, harmonize = false): Promise<Blob> {
    const layer = await this.inpaintLayer(generated, mask, harmonize ? original : undefined);
    return this.compositeLayer(original, layer);
  }

  /** DALL-E edits transparent pixels; the capture uses opaque pixels for selection. */
  public static async prepareOpenAIMask(mask: Blob, width: number, height: number): Promise<Blob> {
    const bitmap = await createImageBitmap(mask);
    try {
      const [canvas, ctx] = context2d(width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      const pixels = ctx.getImageData(0, 0, width, height);
      for (let i = 0; i < pixels.data.length; i += 4) pixels.data[i + 3] = 255 - pixels.data[i + 3];
      ctx.putImageData(pixels, 0, 0);
      return await toPNG(canvas, "Falha ao preparar máscara.");
    } finally { bitmap.close(); }
  }

  public static arrayBufferToBlob(buffer: ArrayBuffer, mimeType = "image/png"): Blob {
    return new Blob([buffer], { type: mimeType });
  }

  public static async blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return await blob.arrayBuffer();
  }

  public static blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  public static base64ToBlob(base64: string, defaultMime = "image/png"): Blob {
    let clean = base64;
    let mime = defaultMime;
    if (base64.startsWith("data:")) {
      const match = base64.match(/^data:([^;]+);base64,/);
      if (match) {
        mime = match[1];
        clean = base64.substring(match[0].length);
      }
    }
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  }

  /** Obtém as dimensões de um Blob usando createImageBitmap direto */
  public static async getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
    const bitmap = await createImageBitmap(blob);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  }

  /** Redimensiona imagem Blob de forma limpa e performática */
  public static async resizeImageBlob(blob: Blob, targetWidth: number, targetHeight: number): Promise<Blob> {
    const bitmap = await createImageBitmap(blob);
    try {
      const [canvas, ctx] = context2d(targetWidth, targetHeight);
      ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
      return await toPNG(canvas, "Falha ao redimensionar imagem.");
    } finally { bitmap.close(); }
  }
}
