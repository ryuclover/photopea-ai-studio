// src/providers/FreeInpaintProvider.ts
import type { AIProvider, AIModel, GenerationParams, GenerationResult } from "./AIProvider";
import { ImageUtils } from "../services/ImageUtils";
import { runSdxlQueue } from "../services/SdxlQueue";

export class FreeInpaintProvider implements AIProvider {
  public readonly id = "free_inpaint" as const;
  public readonly name = "SDXL público (fila e cota)";
  public readonly description = "Edição por seleção via Space público do Hugging Face. Sem cobrança pelo plugin; sujeito à disponibilidade e às cotas do serviço.";
  public readonly requiresApiKey = false;
  public readonly keyPlaceholder = "hf_… (opcional, usa a cota da sua conta)";
  public readonly helpUrl = "https://huggingface.co/settings/tokens";

  getModels(): AIModel[] {
    return [
      {
        id: "diffusers-sdxl-inpaint",
        name: "SDXL Inpainting (Space público)",
        description: "Edita a área selecionada usando a imagem como contexto. Confira o resultado antes de inserir a camada.",
        capabilities: { textToImage: true, imageToImage: false, inpainting: true },
        supportedSizes: ["1024x1024", "1024x768", "768x1024"]
      },

    ];
  }

  async generate(params: GenerationParams, apiKey?: string): Promise<GenerationResult> {
    // Full-canvas inpainting uses the same public model for text generation.
    const canvas = document.createElement("canvas");
    canvas.width = params.width; canvas.height = params.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponível.");
    const exportPNG = () => new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Falha ao criar canvas de geração.")), "image/png"));
    context.fillStyle = "#808080";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const referenceImage = await exportPNG();
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const maskImage = await exportPNG();
    return this.inpaint({ ...params, referenceImage, maskImage }, apiKey);
  }

  async inpaint(params: GenerationParams, apiKey?: string): Promise<GenerationResult> {
    if (!params.referenceImage || !params.maskImage) {
      throw new Error("Generative Fill requer a imagem base e a máscara capturada da seleção do Photopea.");
    }

    const signal = AbortSignal.any([params.signal ?? new AbortController().signal, AbortSignal.timeout(180000)]);
    const request: typeof fetch = (input, init) => fetch(input, { ...init, signal });

    // 1. Limites da seleção no documento original
    const { bounds, width: docW, height: docH } = await ImageUtils.selectionBounds(params.maskImage);
    if (!bounds) throw new Error("A seleção capturada está vazia. Selecione a área no Photopea e capture novamente.");

    // 2. Recorte com contexto ao redor da seleção, em ~1 MP para o SDXL.
    //    Seleções pequenas passam a usar a resolução do modelo em vez de uma fração do documento inteiro.
    const crop = ImageUtils.planInpaintCrop(bounds, docW, docH);
    const [cleanImageBlob, cleanMaskBlob] = await Promise.all([
      ImageUtils.cropScaled(params.referenceImage, crop.rect, crop.targetWidth, crop.targetHeight),
      ImageUtils.cropScaled(params.maskImage, crop.rect, crop.targetWidth, crop.targetHeight, true),
    ]);

    const optimizedPrompt = params.prompt.trim();
    const negativePrompt = params.negativePrompt?.trim() || "ugly, blurry, deformed, disfigured, bad anatomy, poorly drawn, lowres, watermark, text, frame, border";

    const resultImageUrl = await runSdxlQueue(
      cleanImageBlob, cleanMaskBlob, optimizedPrompt, negativePrompt,
      Math.min(30, Math.max(10, params.steps ?? 22)), params.cfgScale ?? 7.5,
      signal, apiKey?.trim(), params.onProgress,
    );
    params.onProgress?.("Baixando o resultado…");

    const finalImageResponse = await request(resultImageUrl);
    if (!finalImageResponse.ok) {
      throw new Error(`Falha ao baixar imagem gerada do servidor SDXL (${finalImageResponse.status})`);
    }
    const generatedCrop = await finalImageResponse.blob();

    // 3. Recolocar o recorte nas coordenadas originais; fora do recorte fica o original.
    const imageBlob = await ImageUtils.pasteCrop(params.referenceImage, generatedCrop, crop.rect);
    return { imageBlob, metadata: { crop: crop.rect, modelSize: [crop.targetWidth, crop.targetHeight] } };
  }

  async validateApiKey(_apiKey?: string): Promise<boolean> {
    return !_apiKey || /^hf_\S+$/.test(_apiKey);
  }
}
