import type { AIProvider, AIModel, GenerationParams, GenerationResult } from "./AIProvider";

export class StabilityProvider implements AIProvider {
  public readonly id = "stability";
  public readonly name = "Stability AI";
  public readonly description = "Criadores do Stable Diffusion. Suporta SD 3.5 Large/Medium e Inpainting de precisão.";
  public readonly requiresApiKey = true;
  public readonly keyPlaceholder = "sk-...";
  public readonly helpUrl = "https://platform.stability.ai/account/keys";

  getModels(): AIModel[] {
    return [
      {
        id: "sd3.5-large",
        name: "Stable Diffusion 3.5 Large",
        description: "Modelo flagship com 8B parâmetros, realismo fotográfico e alta resolução.",
        capabilities: { textToImage: true, imageToImage: false, inpainting: true },
        supportedSizes: ["1024x1024", "16:9", "9:16", "3:2", "2:3"]
      },
      {
        id: "sd3.5-medium",
        name: "Stable Diffusion 3.5 Medium",
        description: "Equilíbrio perfeito entre velocidade de resposta e qualidade visual.",
        capabilities: { textToImage: true, imageToImage: false, inpainting: true },
        supportedSizes: ["1024x1024", "16:9", "9:16"]
      },
      {
        id: "core",
        name: "Stable Image Core",
        description: "Serviço balanceado da Stability AI otimizado para produção rápida.",
        capabilities: { textToImage: true, imageToImage: false, inpainting: false },
        supportedSizes: ["1024x1024", "16:9", "9:16"]
      }
    ];
  }

  private mapAspectRatio(width: number, height: number): string {
    const ratio = width / height;
    if (Math.abs(ratio - 1) < 0.15) return "1:1";
    if (Math.abs(ratio - (16 / 9)) < 0.15) return "16:9";
    if (Math.abs(ratio - (9 / 16)) < 0.15) return "9:16";
    if (Math.abs(ratio - (3 / 2)) < 0.15) return "3:2";
    if (Math.abs(ratio - (2 / 3)) < 0.15) return "2:3";
    return "1:1";
  }

  async generate(params: GenerationParams, apiKey: string): Promise<GenerationResult> {
    const request: typeof fetch = (input, init) => fetch(input, { ...init, signal: params.signal });
    const isCore = params.model === "core";
    const endpoint = isCore
      ? "https://api.stability.ai/v2beta/stable-image/generate/core"
      : "https://api.stability.ai/v2beta/stable-image/generate/sd3";

    const formData = new FormData();
    formData.append("prompt", params.prompt);
    formData.append("output_format", "png");
    formData.append("aspect_ratio", this.mapAspectRatio(params.width, params.height));

    if (!isCore) {
      formData.append("model", params.model);
    }

    if (params.negativePrompt && params.negativePrompt.trim()) {
      formData.append("negative_prompt", params.negativePrompt.trim());
    }

    if (params.seed && params.seed > 0) {
      formData.append("seed", params.seed.toString());
    }

    const response = await request(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`,
        "Accept": "image/*"
      },
      body: formData
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Stability AI Error (${response.status}): ${err}`);
    }

    const blob = await response.blob();
    return { imageBlob: blob };
  }

  async inpaint(params: GenerationParams, apiKey: string): Promise<GenerationResult> {
    const request: typeof fetch = (input, init) => fetch(input, { ...init, signal: params.signal });
    if (!params.referenceImage || !params.maskImage) {
      throw new Error("Stability Inpaint requer imagem de referência e máscara de seleção.");
    }

    const endpoint = "https://api.stability.ai/v2beta/stable-image/edit/inpaint";
    const formData = new FormData();
    formData.append("prompt", params.prompt);
    formData.append("image", params.referenceImage, "image.png");
    formData.append("mask", params.maskImage, "mask.png");
    formData.append("output_format", "png");

    if (params.negativePrompt && params.negativePrompt.trim()) {
      formData.append("negative_prompt", params.negativePrompt.trim());
    }

    const response = await request(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`,
        "Accept": "image/*"
      },
      body: formData
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Stability Inpaint Error (${response.status}): ${err}`);
    }

    const blob = await response.blob();
    return { imageBlob: blob };
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const res = await fetch("https://api.stability.ai/v1/user/account", {
        headers: { "Authorization": `Bearer ${apiKey.trim()}` }
      });
      return res.status === 200;
    } catch {
      return false;
    }
  }
}
