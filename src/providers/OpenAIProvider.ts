import type { AIProvider, AIModel, GenerationParams, GenerationResult } from "./AIProvider";
import { ImageUtils } from "../services/ImageUtils";

export class OpenAIProvider implements AIProvider {
  public readonly id = "openai";
  public readonly name = "OpenAI (DALL-E)";
  public readonly description = "Modelos DALL-E 3 (alta fidelidade) e DALL-E 2 (com suporte a edição/inpainting).";
  public readonly requiresApiKey = true;
  public readonly keyPlaceholder = "sk-proj-...";
  public readonly helpUrl = "https://platform.openai.com/api-keys";

  getModels(): AIModel[] {
    return [
      {
        id: "dall-e-3",
        name: "DALL-E 3 (Ultra HD)",
        description: "Melhor qualidade e aderência detalhada a prompts textuais.",
        capabilities: { textToImage: true, imageToImage: false, inpainting: false },
        supportedSizes: ["1024x1024", "1792x1024", "1024x1792"]
      },
      {
        id: "dall-e-2",
        name: "DALL-E 2 (Edição & Inpaint)",
        description: "Rápido e otimizado para modificação e inpainting de áreas selecionadas.",
        capabilities: { textToImage: true, imageToImage: false, inpainting: true },
        supportedSizes: ["1024x1024", "512x512", "256x256"]
      }
    ];
  }

  async generate(params: GenerationParams, apiKey: string): Promise<GenerationResult> {
    const request: typeof fetch = (input, init) => fetch(input, { ...init, signal: params.signal });
    const size = `${params.width}x${params.height}`;
    const payload: any = {
      model: params.model,
      prompt: params.prompt,
      n: 1,
      size: size,
      response_format: "b64_json"
    };

    if (params.model === "dall-e-3") {
      payload.quality = "standard";
    }

    const response = await request("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API Error (${response.status}): ${err?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const b64 = data.data[0]?.b64_json;
    if (!b64) throw new Error("A API da OpenAI não retornou dados de imagem.");

    const blob = ImageUtils.base64ToBlob(b64, "image/png");
    return {
      imageBlob: blob,
      metadata: { revisedPrompt: data.data[0]?.revised_prompt }
    };
  }

  async inpaint(params: GenerationParams, apiKey: string): Promise<GenerationResult> {
    const request: typeof fetch = (input, init) => fetch(input, { ...init, signal: params.signal });
    if (!params.referenceImage || !params.maskImage) {
      throw new Error("O fluxo de Inpainting da OpenAI requer uma imagem de referência e uma máscara de seleção.");
    }

    // OpenAI DALL-E 2 requer imagens exatamente quadradas (ex: 1024x1024)
    const normalizedImage = await ImageUtils.resizeImageBlob(params.referenceImage, 1024, 1024);
    const normalizedMask = await ImageUtils.prepareOpenAIMask(params.maskImage, 1024, 1024);

    const formData = new FormData();
    formData.append("image", normalizedImage, "image.png");
    formData.append("mask", normalizedMask, "mask.png");
    formData.append("prompt", params.prompt);
    formData.append("model", "dall-e-2");
    formData.append("n", "1");
    formData.append("size", "1024x1024");
    formData.append("response_format", "b64_json");

    const response = await request("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`
      },
      body: formData
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`OpenAI Inpaint Error (${response.status}): ${err?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const b64 = data.data[0]?.b64_json;
    if (!b64) throw new Error("Falha ao recuperar imagem editada da OpenAI.");

    return {
      imageBlob: ImageUtils.base64ToBlob(b64, "image/png")
    };
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { "Authorization": `Bearer ${apiKey.trim()}` }
      });
      return res.status === 200;
    } catch {
      return false;
    }
  }
}
