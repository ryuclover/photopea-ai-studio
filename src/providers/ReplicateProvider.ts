import type { AIProvider, AIModel, GenerationParams, GenerationResult } from "./AIProvider";

export class ReplicateProvider implements AIProvider {
  public readonly id = "replicate";
  public readonly name = "Replicate";
  public readonly description = "Execução de modelos open-source (FLUX Schnell, FLUX Dev, SDXL) na nuvem com polling assíncrono.";
  public readonly requiresApiKey = true;
  public readonly keyPlaceholder = "r8_...";
  public readonly helpUrl = "https://replicate.com/account/api-tokens";

  getModels(): AIModel[] {
    return [
      {
        id: "black-forest-labs/flux-schnell",
        name: "FLUX.1 Schnell (Ultrarrápido)",
        description: "Geração em ~2 a 4 segundos com altíssima qualidade visual.",
        capabilities: { textToImage: true, imageToImage: false, inpainting: false },
        supportedSizes: ["1024x1024", "16:9", "9:16"]
      },
      {
        id: "black-forest-labs/flux-dev",
        name: "FLUX.1 Dev (Alta Precisão)",
        description: "Versão de 12B parâmetros com máxima fidelidade estética.",
        capabilities: { textToImage: true, imageToImage: false, inpainting: false },
        supportedSizes: ["1024x1024", "16:9", "9:16"]
      },
      {
        id: "stability-ai/sdxl",
        name: "Stable Diffusion XL (Base)",
        description: "Modelo clássico consagrado da comunidade open-source.",
        capabilities: { textToImage: true, imageToImage: false, inpainting: false },
        supportedSizes: ["1024x1024", "768x768"]
      }
    ];
  }

  async generate(params: GenerationParams, apiKey: string): Promise<GenerationResult> {
    const request: typeof fetch = (input, init) => fetch(input, { ...init, signal: params.signal });
    const [owner, modelName] = params.model.split("/");
    const createUrl = `https://api.replicate.com/v1/models/${owner}/${modelName}/predictions`;

    const inputPayload: Record<string, any> = {
      prompt: params.prompt,
      num_outputs: 1,
      aspect_ratio: params.width === params.height ? "1:1" : params.width > params.height ? "16:9" : "9:16"
    };

    if (params.seed && params.seed > 0) {
      inputPayload.seed = params.seed;
    }

    // 1. Iniciar previsão no Replicate
    const initRes = await request(createUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ input: inputPayload })
    });

    if (!initRes.ok) {
      const err = await initRes.text();
      throw new Error(`Replicate Init Error (${initRes.status}): ${err}`);
    }

    const initData = await initRes.json();
    const predictionId = initData.id;
    const pollUrl = `https://api.replicate.com/v1/predictions/${predictionId}`;

    // 2. Polling até completar a previsão
    let attempts = 0;
    const maxAttempts = 60; // até ~90 segundos

    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 1500));
      attempts++;

      const checkRes = await request(pollUrl, {
        headers: {
          "Authorization": `Bearer ${apiKey.trim()}`
        }
      });

      if (!checkRes.ok) continue;

      const checkData = await checkRes.json();
      if (checkData.status === "succeeded") {
        const output = Array.isArray(checkData.output) ? checkData.output[0] : checkData.output;
        if (!output) throw new Error("Replicate finalizou sem output de imagem.");

        const imgRes = await request(output);
        const blob = await imgRes.blob();
        return { imageBlob: blob };
      }

      if (checkData.status === "failed" || checkData.status === "canceled") {
        throw new Error(`Replicate Job ${checkData.status}: ${checkData.error || "Erro desconhecido"}`);
      }
    }

    throw new Error("Timeout ao aguardar geração no Replicate.");
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    return apiKey.trim().startsWith("r8_") && apiKey.trim().length > 20;
  }
}
