// src/providers/AIProvider.ts

export type ProviderId = 'nvidia' | 'free_inpaint' | 'openai' | 'stability' | 'replicate' | 'custom';

export interface ModelCapability {
  textToImage: boolean;
  imageToImage: boolean;
  inpainting: boolean;
}

export interface AIModel {
  id: string;
  name: string;
  description?: string;
  capabilities: ModelCapability;
  supportedSizes?: string[];
  defaultParams?: Record<string, any>;
}

export interface GenerationParams {
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
  prompt: string;
  negativePrompt?: string;
  model: string;
  width: number;
  height: number;
  steps?: number;
  cfgScale?: number;
  seed?: number;
  referenceImage?: Blob; // Para Img2Img ou Inpaint
  maskImage?: Blob;      // Para Inpaint (máscara binária)
}

export interface GenerationResult {
  imageBlob: Blob;
  seed?: number;
  metadata?: Record<string, any>;
}

export interface AIProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly description: string;
  readonly requiresApiKey: boolean;
  readonly keyPlaceholder: string;
  readonly helpUrl: string;

  /** Retorna a lista de modelos suportados por este provedor */
  getModels(): AIModel[];

  /** Executa geração Text-to-Image */
  generate(params: GenerationParams, apiKey: string): Promise<GenerationResult>;

  /** Executa Inpainting (Edição guiada por máscara) */
  inpaint?(params: GenerationParams, apiKey: string): Promise<GenerationResult>;

  /** Executa Image-to-Image / Variação a partir de uma imagem base */
  imageToImage?(params: GenerationParams, apiKey: string): Promise<GenerationResult>;

  /** Valida a chave de API */
  validateApiKey(apiKey: string): Promise<boolean>;
}
