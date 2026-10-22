import React, { useState, useRef, useEffect } from "react";
import { Header } from "./components/Header";
import { SettingsModal } from "./components/SettingsModal";
import { ProviderSelector } from "./components/ProviderSelector";
import { ModeSelector } from "./components/ModeSelector";
import type { GenerationMode } from "./components/ModeSelector";
import { PromptSection } from "./components/PromptSection";
import { InpaintSection } from "./components/InpaintSection";
import { PreviewSection } from "./components/PreviewSection";
import { ProviderRegistry } from "./providers/ProviderRegistry";
import type { ProviderId } from "./providers/AIProvider";
import { ImageUtils } from "./services/ImageUtils";
import { KeyVault } from "./services/KeyVault";
import { PhotopeaBridge } from "./core/PhotopeaBridge";
import { Sparkles, AlertCircle, X } from "lucide-react";

export const App: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId>("free_inpaint");
  const [selectedModelId, setSelectedModelId] = useState<string>("diffusers-sdxl-inpaint");
  const [mode, setMode] = useState<GenerationMode>("inpaint");
  const [showInpaintHelp, setShowInpaintHelp] = useState(false);

  // Parâmetros de Geração
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [steps, setSteps] = useState(28);
  const [cfgScale, setCfgScale] = useState(7.0);

  // Dados de Inpainting / Img2Img
  const [referenceImage, setReferenceImage] = useState<Blob | null>(null);
  const [maskImage, setMaskImage] = useState<Blob | null>(null);
  // Transição interna da borda (px do documento); 0 mantém a borda exata da seleção.
  const [featherPx, setFeatherPx] = useState(24);
  const [harmonizeEdges, setHarmonizeEdges] = useState(true);

  // Estado de Execução
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [layerBlob, setLayerBlob] = useState<Blob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const controller = useRef<AbortController | null>(null);
  const lastEdit = useRef<{ original: Blob; generated: Blob; mask: Blob } | null>(null);
  const compositionVersion = useRef(0);
  const [isCompositing, setIsCompositing] = useState(false);

  // Finishing controls reuse the model output: no extra request or GPU quota.
  const updateFinishing = async (feather: number, harmonize: boolean) => {
    const edit = lastEdit.current;
    if (!edit) return;
    const version = ++compositionVersion.current;
    setIsCompositing(true);
    try {
      const mask = await ImageUtils.featherMask(edit.mask, feather);
      if (version !== compositionVersion.current) return;
      const layer = await ImageUtils.inpaintLayer(edit.generated, mask, harmonize ? edit.original : undefined);
      if (version !== compositionVersion.current) return;
      const preview = await ImageUtils.compositeLayer(edit.original, layer);
      if (version !== compositionVersion.current) return;
      setLayerBlob(layer);
      setGeneratedBlob(preview);
    } catch (error) {
      if (version === compositionVersion.current) setErrorMessage(error instanceof Error ? error.message : "Falha ao ajustar acabamento.");
    } finally {
      if (version === compositionVersion.current) setIsCompositing(false);
    }
  };

  const [referenceSource, setReferenceSource] = useState<string>();
  const [resultSource, setResultSource] = useState<string>();

  const bridge = PhotopeaBridge.getInstance();
  const [connected, setConnected] = useState(bridge.isConnectedToPhotopea());
  const [, refreshKeys] = useState(0);
  useEffect(() => {
    if (bridge.isEmbedded()) {
      void bridge.runScript('app.echoToOE("ai-studio-ready");').then(() => setConnected(true)).catch(() => setConnected(false));
    }
  }, [bridge]);
  const currentProvider = ProviderRegistry.get(selectedProviderId);
  const currentModel = currentProvider?.getModels().find((m) => m.id === selectedModelId);
  const supportsInpaint = !!currentModel?.capabilities.inpainting && !!currentProvider?.inpaint;
  const supportsImg2Img = !!currentModel?.capabilities.imageToImage && !!currentProvider?.imageToImage;

  // Atualiza modelo padrão ao trocar de provedor
  const handleSelectProvider = (id: ProviderId) => {
    setSelectedProviderId(id);
    if (mode === "variation") setMode("textToImage");
    const p = ProviderRegistry.get(id);
    if (p) {
      const firstModel = p.getModels()[0];
      if (firstModel) {
        setSelectedModelId(firstModel.id);
        if (!firstModel.capabilities.inpainting && mode === "inpaint") {
          setMode("textToImage");
        } else if (!firstModel.capabilities.textToImage && firstModel.capabilities.inpainting && mode === "textToImage") {
          setMode("inpaint");
        }
      }
    }
    setShowInpaintHelp(false);
  };

  const handleSelectModel = (modelId: string) => {
    setSelectedModelId(modelId);
    const m = currentProvider?.getModels().find((item) => item.id === modelId);
    if (m) {
      if (!m.capabilities.inpainting && mode === "inpaint") {
        setMode("textToImage");
      } else if (!m.capabilities.textToImage && m.capabilities.inpainting && mode === "textToImage") {
        setMode("inpaint");
      }
    }
    setShowInpaintHelp(false);
  };

  const handleGenerate = async () => {
    if (controller.current) return;
    if (!prompt.trim()) {
      setErrorMessage("Por favor, digite um prompt para a IA.");
      return;
    }

    const requiresKey = currentProvider?.requiresApiKey ?? true;
    const apiKey = KeyVault.getKey(selectedProviderId) || "";

    if (requiresKey && !apiKey) {
      setErrorMessage(`Nenhuma chave de API configurada para ${currentProvider?.name}. Abra as configurações.`);
      setIsSettingsOpen(true);
      return;
    }

    lastEdit.current = null;
    compositionVersion.current++;
    setIsCompositing(false);
    const operation = new AbortController();
    controller.current = operation;
    const timeout = window.setTimeout(() => operation.abort(new Error("Tempo limite de três minutos excedido. O serviço pode estar ocupado.")), 180000);
    setErrorMessage(null);
    setIsGenerating(true);
    setProgress("Preparando imagem…");
    setGeneratedBlob(null);
    setLayerBlob(null);

    try {
      if (!currentProvider) throw new Error("Provedor não encontrado.");

      let result;
      let source: string | undefined;
      const supported = currentModel?.supportedSizes?.filter(size => /^\d+x\d+$/.test(size)) ?? [];
      const requestedSize = `${width}x${height}`;
      const [requestWidth, requestHeight] = supported.length && !supported.includes(requestedSize)
        ? supported[0].split("x").map(Number) : [width, height];
      if (mode === "inpaint") {
        if (!currentProvider.inpaint) {
          throw new Error("Este provedor não possui suporte a Inpainting.");
        }
        if (!referenceImage || !maskImage) {
          throw new Error("Faça uma seleção no Photopea e clique em 'Capturar Seleção' antes de prosseguir.");
        }

        const document = await bridge.getDocumentInfo();
        if (!document.exists || (document.id ?? document.source) !== referenceSource) throw new Error("Volte ao documento capturado ou capture uma nova seleção.");
        const capturedSize = await ImageUtils.getImageDimensions(referenceImage);
        if (document.width !== capturedSize.width || document.height !== capturedSize.height) throw new Error("O tamanho do documento mudou. Capture a seleção novamente.");
        source = referenceSource;
        result = await currentProvider.inpaint({
          signal: operation.signal,
          onProgress: setProgress,
          prompt,
          negativePrompt,
          model: selectedModelId,
          width: requestWidth,
          height: requestHeight,
          steps,
          cfgScale,
          referenceImage,
          maskImage
        }, apiKey);
      } else if (mode === "variation") {
        throw new Error("Variação não está disponível neste modelo. Use edição por seleção.");
      } else {
        result = await currentProvider.generate({
          signal: operation.signal,
          onProgress: setProgress,
          prompt,
          negativePrompt,
          model: selectedModelId,
          width: requestWidth,
          height: requestHeight,
          steps,
          cfgScale
        }, apiKey);
      }

      operation.signal.throwIfAborted();
      // A mesma máscara de composição alimenta a prévia e a camada inserida.
      const compositeMask = mode === "inpaint" && maskImage ? await ImageUtils.featherMask(maskImage, featherPx) : null;
      const patch = compositeMask
        ? await ImageUtils.inpaintLayer(result.imageBlob, compositeMask, harmonizeEdges ? referenceImage ?? undefined : undefined)
        : result.imageBlob;
      operation.signal.throwIfAborted();
      const blob = mode === "inpaint" && referenceImage
        ? await ImageUtils.compositeLayer(referenceImage, patch)
        : result.imageBlob;
      operation.signal.throwIfAborted();
      if (mode === "inpaint" && referenceImage && maskImage) {
        lastEdit.current = { original: referenceImage, generated: result.imageBlob, mask: maskImage };
      }
      setGeneratedBlob(blob);
      setLayerBlob(patch);
      setResultSource(source);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(operation.signal.aborted ? (operation.signal.reason?.message || "Operação cancelada.") : err.message || "Ocorreu um erro durante a geração.");
    } finally {
      window.clearTimeout(timeout);
      controller.current = null;
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: "var(--bg-app)" }}>
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        isConnected={connected}
      />

      <main style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "10px", flex: 1, overflowY: "auto" }}>
        {!bridge.isEmbedded() && <a className="btn btn-primary" href={`https://www.photopea.com/#${encodeURIComponent(JSON.stringify({ environment: { plugins: [{ name: "AI Studio", url: new URL(import.meta.env.BASE_URL, location.href).href, icon: new URL(`${import.meta.env.BASE_URL}icon.svg`, location.href).href }] } }))}`} target="_blank" rel="noreferrer">Abrir no Photopea</a>}
        <fieldset disabled={isGenerating} style={{ border: 0, padding: 0, margin: 0, display: "contents" }}>
        {/* Seletor de Provedor e Modelo */}
        <ProviderSelector
          selectedProviderId={selectedProviderId}
          onSelectProvider={handleSelectProvider}
          selectedModelId={selectedModelId}
          onSelectModel={handleSelectModel}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Seletor de Modo (Texto, Inpaint ou Variação) */}
        <ModeSelector
          mode={mode}
          onChangeMode={(newMode) => {
            setMode(newMode);
            setShowInpaintHelp(false);
          }}
          supportsText={!!currentModel?.capabilities.textToImage}
          supportsInpaint={supportsInpaint}
          supportsImg2Img={supportsImg2Img}
          onInpaintUnavailableClick={() => setShowInpaintHelp(true)}
        />

        {/* Notificação/Ajuda de Inpainting quando o modelo não suportar */}
        {showInpaintHelp && !supportsInpaint && (
          <div style={{
            padding: "10px",
            backgroundColor: "rgba(245, 158, 11, 0.12)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "var(--radius-sm)",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            position: "relative"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--warning)", fontWeight: "600", fontSize: "11px" }}>
                <AlertCircle size={14} />
                <span>Escolha um modelo para Generative Fill</span>
              </div>
              <button
                className="btn btn-icon"
                onClick={() => setShowInpaintHelp(false)}
                style={{ padding: "2px" }}
              >
                <X size={12} />
              </button>
            </div>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.3" }}>
              O modelo <b>{currentModel?.name || "FLUX.1 Dev"}</b> não oferece edição por máscara. Para preencher uma área, escolha:
            </p>
            <div style={{ display: "flex", gap: "5px", marginTop: "2px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  handleSelectProvider("free_inpaint");
                  handleSelectModel("diffusers-sdxl-inpaint");
                  setMode("inpaint");
                  setShowInpaintHelp(false);
                }}
                style={{ fontSize: "10px", padding: "5px 8px" }}
              >
                <Sparkles size={11} /> Usar SDXL público (sem chave)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  handleSelectProvider("stability");
                  handleSelectModel("sd3.5-large");
                  setMode("inpaint");
                  setShowInpaintHelp(false);
                }}
                style={{ fontSize: "10px", padding: "5px 8px" }}
              >
                Stability AI (SD 3.5)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  handleSelectProvider("openai");
                  handleSelectModel("dall-e-2");
                  setMode("inpaint");
                  setShowInpaintHelp(false);
                }}
                style={{ fontSize: "10px", padding: "4px 8px" }}
              >
                OpenAI (DALL-E 2)
              </button>
            </div>
          </div>
        )}

        {/* Área de Inpainting (exibida apenas quando em modo Inpaint) */}
        {mode === "inpaint" && (
          <InpaintSection
            onCaptureSelection={(img, msk, source) => {
              lastEdit.current = null;
              compositionVersion.current++;
              setIsCompositing(false);
              setGeneratedBlob(null);
              setLayerBlob(null);
              setReferenceSource(source);
              setReferenceImage(img);
              setMaskImage(msk);
              setErrorMessage(null);
            }}
            hasCapturedData={!!referenceImage && !!maskImage}
            harmonizeEdges={harmonizeEdges}
            onChangeHarmonize={value => { setHarmonizeEdges(value); void updateFinishing(featherPx, value); }}
            featherPx={featherPx}
            onChangeFeather={value => { setFeatherPx(value); void updateFinishing(value, harmonizeEdges); }}
          />
        )}

        {/* Seção de Prompt e Dimensões */}
        <PromptSection
          isEditing={mode === "inpaint"}
          supportedSizes={currentModel?.supportedSizes}
          prompt={prompt}
          onChangePrompt={setPrompt}
          negativePrompt={negativePrompt}
          onChangeNegativePrompt={setNegativePrompt}
          width={width}
          height={height}
          onChangeDimensions={(w, h) => {
            setWidth(w);
            setHeight(h);
          }}
          steps={steps}
          onChangeSteps={setSteps}
          cfgScale={cfgScale}
          onChangeCfg={setCfgScale}
        />

        {/* Mensagem de Erro / Alerta */}
        {errorMessage && (
          <div style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "6px",
            padding: "8px",
            backgroundColor: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "var(--radius-sm)",
            color: "var(--danger)",
            fontSize: "11px"
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: "2px" }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {errorMessage && selectedProviderId === "free_inpaint" && /cota|token|hf_|autentic/i.test(errorMessage) && <button className="btn btn-secondary" onClick={() => setIsSettingsOpen(true)}>Configurar token Hugging Face</button>}
        {isGenerating && <p role="status" style={{fontSize: "12px"}}>{progress}</p>}
        {/* Botão de Disparo */}
        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          style={{ width: "100%", padding: "10px", fontSize: "12px" }}
        >
          <Sparkles size={15} />
          {isGenerating
            ? "Processando com IA..."
            : mode === "inpaint"
            ? "Aplicar Generative Fill"
            : mode === "variation"
            ? "Gerar Variação Artística"
            : "Gerar Imagem"}
        </button>

        {/* Pré-visualização e Ações */}
        <PreviewSection
          imageBlob={generatedBlob}
          layerBlob={layerBlob}
          isGenerating={isGenerating || isCompositing}
          onClear={() => { lastEdit.current = null; compositionVersion.current++; setIsCompositing(false); setGeneratedBlob(null); setLayerBlob(null); }}
          promptText={prompt}
          expectedSource={resultSource}
        />
        </fieldset>
        {isGenerating && <button className="btn btn-secondary" onClick={() => controller.current?.abort(new Error("Operação cancelada."))}>Cancelar espera</button>}
        {selectedProviderId === "free_inpaint" && <p style={{fontSize: "11px", color: "var(--text-muted)"}}>A imagem e a seleção serão enviadas ao Space público do Hugging Face. Serviço sujeito a fila, cota e indisponibilidade. Descreva o resultado desejado, preferencialmente em inglês. Cancelar interrompe a espera local; o servidor pode continuar processando.</p>}
      </main>

      {/* Modal de Configurações das Chaves de API */}
      <SettingsModal
        key={`${selectedProviderId}-${isSettingsOpen}`}
        initialProviderId={selectedProviderId}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onKeysUpdated={() => refreshKeys(value => value + 1)}
      />
    </div>
  );
};

export default App;
