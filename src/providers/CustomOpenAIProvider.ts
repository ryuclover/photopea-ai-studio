import type { AIProvider, AIModel, GenerationParams, GenerationResult } from "./AIProvider";
import { ImageUtils } from "../services/ImageUtils";
import { KeyVault } from "../services/KeyVault";

export class CustomOpenAIProvider implements AIProvider {
  public readonly id = "custom";
  public readonly name = "OpenAI-Compatible (Custom)";
  public readonly description = "Conecte qualquer serviço que implemente a especificação /v1/images/generations (Together AI, Fireworks, etc.).";
  public readonly requiresApiKey = true;
  public readonly keyPlaceholder = "sua-chave-aqui...";
  public readonly helpUrl = "https://platform.openai.com/docs/api-reference/images";

  getModels(): AIModel[] {
    return [
      {
        id: "custom-model",
        name: "Modelo Configurado",
        description: "Modelo definido na URL customizada.",
        capabilities: { textToImage: true, imageToImage: false, inpainting: false },
        supportedSizes: ["1024x1024", "512x512"]
      }
    ];
  }

  async generate(params: GenerationParams, apiKey: string): Promise<GenerationResult> {
    const request: typeof fetch = (input, init) => fetch(input, { ...init, signal: params.signal });
    const customEndpoint = KeyVault.getCustomEndpoint("custom");
    const customModel = KeyVault.getCustomEndpoint("custom_model");
    if (!customEndpoint || !customModel) throw new Error("Configure a URL completa e o identificador do modelo nas configurações.");
    const url = new URL(customEndpoint);
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Use HTTPS para enviar sua chave ao endpoint customizado.");

    const payload: any = {
      model: customModel,
      prompt: params.prompt,
      n: 1,
      size: `${params.width}x${params.height}`,
      response_format: "b64_json"
    };

    const response = await request(customEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Custom API Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    let blob: Blob;

    if (data.data && data.data[0]?.b64_json) {
      blob = ImageUtils.base64ToBlob(data.data[0].b64_json, "image/png");
    } else if (data.data && data.data[0]?.url) {
      const imgRes = await request(data.data[0].url);
      blob = await imgRes.blob();
    } else {
      throw new Error("Formato de resposta inesperado do endpoint customizado.");
    }

    return { imageBlob: blob };
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    return apiKey.trim().length > 5;
  }
}
