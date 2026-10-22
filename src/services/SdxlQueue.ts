import { Client, handle_file } from "@gradio/client";
import { resultURL } from "./GradioEvents";

export const SDXL_URL = "https://diffusers-stable-diffusion-xl-inpainting.hf.space";

export function sdxlError(title?: string, message?: unknown): Error {
  const detail = typeof message === "string" ? message : message ? JSON.stringify(message) : "";
  if (/quota|runs limit/i.test(`${title} ${detail}`)) {
    return new Error("A cota gratuita de GPU do Hugging Face acabou. Configure um token hf_ nas configurações do SDXL para usar a cota da sua conta. Se já estiver autenticado, aguarde a renovação da cota indicada pelo serviço. " + detail);
  }
  return new Error([title, detail].filter(Boolean).join(": ") || "O SDXL falhou sem informar detalhes. Verifique a disponibilidade do Space.");
}

/** Official queue protocol: exposes ZeroGPU errors hidden by /call/predict. */
export async function runSdxlQueue(
  image: Blob, mask: Blob, prompt: string, negative: string, steps: number, guidance: number,
  signal: AbortSignal, token?: string, onProgress?: (message: string) => void,
  connect: typeof Client.connect = (reference, options) => Client.connect(reference, options),
): Promise<string> {
  if (token && !/^hf_\S+$/.test(token)) throw new Error("Use um token Hugging Face (hf_) no SDXL. A chave NVIDIA pertence somente ao provedor NVIDIA.");
  signal.throwIfAborted();
  onProgress?.("Conectando ao SDXL…");
  // No Gradio input/output history in localStorage, including uploaded documents.
  const connecting = connect(SDXL_URL, { events: ["status", "data"], record_history: false, ...(token ? {token: token as `hf_${string}`} : {}) });
  let abortHandler: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    abortHandler = () => reject(signal.reason ?? new DOMException("Operação cancelada.", "AbortError"));
    signal.addEventListener("abort", abortHandler, {once: true});
    if (signal.aborted) abortHandler();
  });
  let client: Client | undefined;
  let job: ReturnType<Client["submit"]> | undefined;
  let completed = false;
  // A connection that finishes after cancellation must not leave a stream open.
  void connecting.then(value => { if (signal.aborted) value.close(); }, () => {});
  try {
    client = await Promise.race([connecting, aborted]);
    signal.throwIfAborted();
    onProgress?.("Enviando imagem e máscara…");
    job = client.submit("/predict", [
      {background: handle_file(image), layers: [handle_file(mask)], composite: null},
      prompt, negative, guidance, steps, 0.99, "EulerDiscreteScheduler",
    ]);
    const result = async () => {
      for await (const event of job!) {
        signal.throwIfAborted();
        if (event.type === "status") {
          if (event.stage === "error" || event.success === false) throw sdxlError(event.title, event.message);
          if (event.stage === "generating" || event.original_msg === "process_starts") onProgress?.("A IA está editando a seleção…");
          else if (event.stage === "pending") onProgress?.(event.position == null ? "Aguardando GPU…" : `Na fila: posição ${event.position + 1}${event.eta ? ` · cerca de ${Math.ceil(event.eta)} s` : ""}`);
        } else if (event.type === "data") return resultURL(event.data, SDXL_URL);
      }
      throw new Error("O SDXL encerrou a fila sem entregar uma imagem.");
    };
    const url = await Promise.race([result(), aborted]);
    completed = true;
    return url;
  } finally {
    if (abortHandler) signal.removeEventListener("abort", abortHandler);
    // Cancel the queued job remotely as well as closing the local stream.
    if (job && !completed) void job.cancel().catch(() => {});
    client?.close();
  }
}
