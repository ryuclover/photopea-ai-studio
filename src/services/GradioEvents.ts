/** Decode complete SSE frames only; network chunks may split JSON anywhere. */
export class GradioEvents {
  private pending = "";

  push(chunk: string): unknown[] {
    this.pending += chunk;
    const results: unknown[] = [];
    let boundary: RegExpExecArray | null;
    while ((boundary = /\r?\n\r?\n/.exec(this.pending))) {
      const frame = this.pending.slice(0, boundary.index);
      this.pending = this.pending.slice(boundary.index + boundary[0].length);
      const lines = frame.split(/\r?\n/);
      const event = lines.find(line => line.startsWith("event:"))?.slice(6).trim();
      const data = lines.filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
      if (event === "error") throw new Error(`Servidor SDXL: ${!data || data === "null" ? "serviço indisponível ou sem cota de GPU; o servidor não forneceu detalhes. Tente mais tarde ou abra o Space para verificar o acesso." : data}`);
      if (event === "complete") results.push(JSON.parse(data));
    }
    return results;
  }
}

export function resultURL(data: unknown, baseURL: string): string {
  // gr.ImageSlider serializes its pair inside the single output slot.
  const outputs = data as Array<Array<{ url?: string; path?: string }>>;
  const image = outputs?.[0]?.[1];
  if (!image || (!image.url && !image.path)) throw new Error("SDXL não retornou a imagem editada.");
  const url = new URL(image.url || `gradio_api/file=${image.path}`, `${baseURL}/`);
  if (url.origin !== new URL(baseURL).origin) throw new Error("SDXL retornou uma URL fora do servidor configurado.");
  return url.href;
}
