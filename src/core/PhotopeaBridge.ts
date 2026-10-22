import type { PhotopeaDocumentInfo, PendingCommand } from "./types";

export class PhotopeaBridge {
  private static instance: PhotopeaBridge;
  private queue: PendingCommand[] = [];
  private isProcessing = false;
  private currentBuffer: ArrayBuffer | null = null;
  private currentEcho: string | null = null;
  private isInsidePhotopea: boolean = false;

  private parentOrigin = "https://www.photopea.com";
  private failed = false;
  private targetWindow: Window;
  private verified = false;
  private sequence = 0;
  private acknowledged = false;
  private currentError: Error | null = null;

  private failQueue(error: Error) {
    this.failed = true;
    for (const command of this.queue.splice(0)) {
      window.clearTimeout(command.timeoutId);
      command.reject(error);
    }
    this.currentBuffer = null;
    this.currentEcho = null;
    this.currentError = null;
    this.acknowledged = false;
    this.isProcessing = false;
  }

  private constructor(target?: Window) {
    this.targetWindow = target ?? window.parent;
    this.isInsidePhotopea = !!target || window.self !== window.top;
    if (!target) {
    try {
      const origin = new URL(document.referrer).origin;
      if (["https://www.photopea.com", "https://photopea.com"].includes(origin)) this.parentOrigin = origin;
    } catch { /* Referrer can be empty on HTTPS-to-localhost frames. */ }
    }
    window.addEventListener("message", this.handleIncomingMessage.bind(this));
  }

  /** Host-side integration tests and applications embedding Photopea themselves. */
  public static forEmbeddedPhotopea(target: Window): PhotopeaBridge {
    return new PhotopeaBridge(target);
  }

  public static getInstance(): PhotopeaBridge {
    if (!PhotopeaBridge.instance) {
      PhotopeaBridge.instance = new PhotopeaBridge();
    }
    return PhotopeaBridge.instance;
  }

  public isConnectedToPhotopea(): boolean {
    return this.verified && !this.failed;
  }

  public isEmbedded(): boolean {
    return this.isInsidePhotopea;
  }

  private handleIncomingMessage(event: MessageEvent) {
    if (event.source !== this.targetWindow || event.origin !== this.parentOrigin) return;
    this.verified = true;
    if (!this.isProcessing) return;
    const data = event.data;

    // Buffer binário recebido de saveToOE()
    if (data instanceof ArrayBuffer) {
      this.currentBuffer = data;
      return;
    }

    // Mensagens de texto do Photopea
    if (typeof data === "string") {
      const command = this.queue[0];
      if (command.marker && data === command.marker) {
        this.acknowledged = true;
        return;
      }
      if (command.marker && data.startsWith(`${command.marker}:error:`)) {
        this.currentError = new Error(data.slice(command.marker.length + 7));
        return;
      }
      if (data === "done") {
        if (command.marker && !this.acknowledged) return;
        this.finishCurrentCommand();
      } else {
        this.currentEcho = data;
      }
    }
  }

  private finishCurrentCommand() {
    if (this.queue.length === 0) return;
    const current = this.queue.shift()!;

    if (current.timeoutId) {
      window.clearTimeout(current.timeoutId);
    }

    if (this.currentError) {
      current.reject(this.currentError);
    } else if (current.expectBuffer) {
      current.resolve(this.currentBuffer);
    } else {
      current.resolve(this.currentEcho);
    }

    this.currentBuffer = null;
    this.currentEcho = null;
    this.currentError = null;
    this.acknowledged = false;
    this.isProcessing = false;

    // Processa o próximo item na fila
    this.processQueue();
  }

  private processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const next = this.queue[0];

    if (!this.isInsidePhotopea) {
      this.failQueue(new Error("Abra o plugin dentro do Photopea para acessar o documento."));
      return;
    }

    // Timeout de segurança para evitar travar a fila caso Photopea não responda
    next.timeoutId = window.setTimeout(() => {
      console.warn("[PhotopeaBridge] Timeout ao aguardar resposta do script.");
      this.failQueue(new Error("Photopea não respondeu. Reabra o painel antes de tentar novamente."));
    }, 30000);

    // Envia o script para o Photopea pai
    this.targetWindow.postMessage(next.script, this.parentOrigin);
  }

  /**
   * Executa um script ExtendScript no Photopea e aguarda a finalização
   */
  public runScript(script: string | ArrayBuffer, expectBuffer = false): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.failed) { reject(new Error("Reabra o painel para restabelecer a conexão com o Photopea.")); return; }
      const marker = typeof script === "string" ? `__AI_STUDIO_${Date.now()}_${++this.sequence}__` : undefined;
      const wrapped = typeof script === "string" ? `try { ${script}\n } catch(__aiError) {app.echoToOE(${JSON.stringify(marker + ":error:")} + __aiError.message);} app.echoToOE(${JSON.stringify(marker)});` : script;
      this.queue.push({ script: wrapped, resolve, reject, expectBuffer, marker });
      this.processQueue();
    });
  }

  /**
   * Inspeciona se há documento ativo e se há seleção ativa
   */
  public async getDocumentInfo(): Promise<PhotopeaDocumentInfo> {
    const documentId = `ai-studio-document:${Date.now()}-${++this.sequence}-${Math.random().toString(36).slice(2)}`;
    const script = `
      (function() {
        if (app.documents.length === 0) {
          app.echoToOE(JSON.stringify({ exists: false }));
          return;
        }
        var doc = app.activeDocument;
        if (String(doc.source).indexOf("ai-studio-document:") !== 0) doc.source = ${JSON.stringify(documentId)} + "|" + doc.source;
        var hasSel = false;
        var bounds = null;
        try {
          if (doc.selection && doc.selection.bounds) {
            hasSel = true;
            bounds = [
              doc.selection.bounds[0].value,
              doc.selection.bounds[1].value,
              doc.selection.bounds[2].value,
              doc.selection.bounds[3].value
            ];
          }
        } catch(e) {
          hasSel = false;
        }

        app.echoToOE(JSON.stringify({
          exists: true,
          name: doc.name,
          source: doc.source,
          id: doc.source,
          width: Math.round(doc.width),
          height: Math.round(doc.height),
          hasSelection: hasSel,
          selectionBounds: bounds
        }));
      })();
    `;

    const res = await this.runScript(script);
    if (!res) throw new Error("O Photopea não retornou os dados do documento.");
    return JSON.parse(res);
  }

  /**
   * Exporta a visão atual do documento ativo como ArrayBuffer PNG
   */
  public async exportActiveDocumentPNG(): Promise<ArrayBuffer | null> {
    const script = `
      if (app.documents.length > 0) {
        app.activeDocument.saveToOE("png");
      } else {
        app.echoToOE("no_document");
      }
    `;
    const buffer = await this.runScript(script, true);
    return buffer instanceof ArrayBuffer && buffer.byteLength > 0 ? buffer : null;
  }

  /**
   * Extrai a máscara da seleção atual do Photopea.
   * Cria uma camada transparente temporária preenchendo apenas a seleção ativa com branco puro (RGB 255, 255, 255).
   * O restante permanece 100% transparente (Alpha 0), perfeito para os canais de máscara do SDXL e IA.
   */
  public async exportSelectionMask(): Promise<ArrayBuffer | null> {
    const script = `
      (function() {
        if (app.documents.length === 0) {
          app.echoToOE("no_document");
          return;
        }
        var doc = app.activeDocument;
        try {
          var selBounds = doc.selection.bounds;
          if (!selBounds) {
            app.echoToOE("no_selection");
            return;
          }
        } catch(e) {
          app.echoToOE("no_selection");
          return;
        }

        var originalLayer = doc.activeLayer;
        var maskLayer = null;
        var layersVis = [];
        var maskError = null;
        try {
        // 1. Guardar a visibilidade de todas as camadas para isolar a máscara
        for (var i = 0; i < doc.layers.length; i++) {
          layersVis.push(doc.layers[i].visible);
          doc.layers[i].visible = false;
        }

        // 2. Criar camada temporária transparente para a máscara
        maskLayer = doc.artLayers.add();
        maskLayer.name = "__TEMP_AI_MASK__";

        // 3. Preencher a área selecionada com branco puro
        var white = new SolidColor();
        white.rgb.red = 255; white.rgb.green = 255; white.rgb.blue = 255;
        doc.selection.fill(white);

        // 4. Salvar imagem transparente para o plugin
        doc.saveToOE("png");

        // 5. Deletar a camada temporária
        } catch(e) { maskError = e; }
        if (maskLayer) maskLayer.remove();

        // 6. Restaurar a visibilidade das camadas originais
        for (var j = 0; j < doc.layers.length; j++) {
          if (j < layersVis.length) doc.layers[j].visible = layersVis[j];
        }
        doc.activeLayer = originalLayer;
        if (maskError) throw maskError;
      })();
    `;

    const buffer = await this.runScript(script, true);
    return buffer instanceof ArrayBuffer && buffer.byteLength > 0 ? buffer : null;
  }


  /**
   * Insere a imagem gerada como uma nova camada no documento atual do Photopea.
   * Carrega a imagem, transfere a camada para o projeto do usuário e fecha a aba temporária.
   */
  public async insertImageAsLayer(imageBuffer: ArrayBuffer, layerName = "AI Generated", expectedSource?: string, expectedSize?: { width: number; height: number }): Promise<boolean> {
    const target = await this.getDocumentInfo();
    if (!target.exists && !expectedSource) {
      // Sem documento aberto: a imagem gerada vira um novo documento.
      await this.runScript(imageBuffer);
      const opened = await this.runScript(`app.echoToOE(app.documents.length > 0 ? "opened" : "missing");`);
      if (opened !== "opened") throw new Error("O Photopea não confirmou a abertura da imagem.");
      return true;
    }
    if (!target.exists || !target.source) throw new Error("Abra o documento de destino no Photopea.");
    if (expectedSource && target.id !== expectedSource && target.source !== expectedSource) throw new Error("Volte ao documento capturado antes de inserir o resultado.");

    if (expectedSize && (target.width !== expectedSize.width || target.height !== expectedSize.height)) throw new Error("O tamanho do documento mudou. Capture a seleção novamente.");

    // Document.source is the documented read/write identity supported by Photopea.
    // Custom JS properties on document wrappers do not persist in the real editor.
    const importTag = `ai-studio-document:${Date.now()}-${++this.sequence}-existing-`;
    const beforeSources = JSON.parse(await this.runScript(`
      if (app.activeDocument.source !== ${JSON.stringify(target.source)}) throw new Error("O documento ativo mudou. Tente inserir novamente.");
      var sources = [];
      for (var i = 0; i < app.documents.length; i++) {
        var doc = app.documents[i];
        if (String(doc.source).indexOf("ai-studio-document:") !== 0) doc.source = ${JSON.stringify(importTag)} + i + "|" + doc.source;
        sources.push(doc.source);
      }
      app.echoToOE(JSON.stringify(sources));
    `));

    await this.runScript(imageBuffer);
    const response = await this.runScript(`
      (function() {
        try {
          var target = null;
          var imported = null;

          var newDocuments = 0;
          for (var i = 0; i < app.documents.length; i++) {
            var candidate = app.documents[i];
            if (candidate.source === ${JSON.stringify(target.source)}) target = candidate;
            if (${JSON.stringify(beforeSources)}.indexOf(candidate.source) === -1) {
              imported = candidate;
              newDocuments++;
            }
          }
          if (!target) throw new Error("O documento de destino foi fechado. Nenhum outro documento foi alterado.");
          if (newDocuments !== 1 || imported === target) throw new Error("Não foi possível identificar a imagem importada com segurança. Nenhum documento foi fechado.");

          if (${JSON.stringify(expectedSize ?? null)} && (Math.round(target.width) !== ${expectedSize?.width ?? 0} || Math.round(target.height) !== ${expectedSize?.height ?? 0})) throw new Error("O tamanho do documento mudou. Capture a seleção novamente.");
          imported.activeLayer.name = ${JSON.stringify(layerName)};
          imported.activeLayer.duplicate(target, ElementPlacement.PLACEATBEGINNING);
          imported.close(SaveOptions.DONOTSAVECHANGES);

          app.activeDocument = target;
          target.layers[0].name = ${JSON.stringify(layerName)};
          target.activeLayer = target.layers[0];
          app.echoToOE("inserted");
        } catch(e) { app.echoToOE("error:" + e.message); }
      })();
    `);
    if (response !== "inserted") throw new Error(response || "O Photopea não confirmou a inserção.");
    return true;
  }
}
