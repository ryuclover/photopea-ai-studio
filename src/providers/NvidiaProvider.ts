import type { AIProvider, AIModel, GenerationParams, GenerationResult } from "./AIProvider";
import { ImageUtils } from "../services/ImageUtils";

export class NvidiaProvider implements AIProvider {
  public readonly id = "nvidia";
  public readonly name = "NVIDIA NIM API";
  public readonly description = "Endpoints acelerados em GPUs NVIDIA (FLUX.1 Dev) via build.nvidia.com.";
  public readonly requiresApiKey = true;
  public readonly keyPlaceholder = "nvapi-...";
  public readonly helpUrl = "https://build.nvidia.com";

  getModels(): AIModel[] {
    return [
      {
        id: "black-forest-labs/flux.1-dev",
        name: "FLUX.1 Dev (NVIDIA NIM)",
        description: "Geração a partir de texto. Requer chave própria e acesso ao modelo na NVIDIA.",
        capabilities: { textToImage: true, imageToImage: false, inpainting: false },
        supportedSizes: ["1024x1024"]
      },
      {
        id: "black-forest-labs/flux.1-schnell",
        name: "FLUX.1 Schnell (rápido)",
        description: "Geração NVIDIA em quatro passos. Requer acesso ao modelo na conta.",
        capabilities: { textToImage: true, imageToImage: false, inpainting: false },
        supportedSizes: ["1024x1024"]
      }
    ];
  }

  async generate(params: GenerationParams, apiKey: string): Promise<GenerationResult> {
    const request: typeof fetch = (input, init) => fetch(input, { ...init, signal: params.signal });
    const isDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const endpoint = isDev
      ? `/api/nvidia/v1/genai/${params.model}`
      : `https://ai.api.nvidia.com/v1/genai/${params.model}`;

    const payload: Record<string, any> = {
      prompt: params.prompt,
      mode: "base",
      width: 1024,
      height: 1024,
      steps: params.model.endsWith("schnell") ? 4 : Math.min(100, Math.max(5, params.steps ?? 28)),
      cfg_scale: params.model.endsWith("schnell") ? 0 : Math.min(9, Math.max(1, params.cfgScale ?? 5))
    };

    if (params.seed && params.seed > 0) {
      payload.seed = params.seed;
    }

    const response = await request(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`NVIDIA NIM API Error (${response.status}): ${err}`);
    }

    const data = await response.json();

    let base64Image = "";
    if (data.artifacts && data.artifacts[0]?.base64) {
      base64Image = data.artifacts[0].base64;
    } else if (data.data && data.data[0]?.b64_json) {
      base64Image = data.data[0].b64_json;
    } else if (data.image) {
      base64Image = data.image;
    } else {
      throw new Error("Formato de resposta inesperado retornado pelo endpoint da NVIDIA.");
    }

    const blob = ImageUtils.base64ToBlob(base64Image, "image/jpeg");
    return {
      imageBlob: blob,
      seed: data.artifacts?.[0]?.seed || params.seed
    };
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    return apiKey.trim().startsWith("nvapi-") && apiKey.trim().length > 25;
  }
}
