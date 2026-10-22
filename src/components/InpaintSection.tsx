// src/components/InpaintSection.tsx
import React, { useState } from "react";
import { PhotopeaBridge } from "../core/PhotopeaBridge";
import { ImageUtils } from "../services/ImageUtils";
import { Scan, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

interface InpaintSectionProps {
  onCaptureSelection: (imageBlob: Blob, maskBlob: Blob, source?: string) => void;
  hasCapturedData: boolean;
  harmonizeEdges: boolean;
  onChangeHarmonize: (value: boolean) => void;
  featherPx: number;
  onChangeFeather: (value: number) => void;
}

export const InpaintSection: React.FC<InpaintSectionProps> = ({
  onCaptureSelection,
  hasCapturedData,
  harmonizeEdges,
  onChangeHarmonize,
  featherPx,
  onChangeFeather
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [maskPreviewUrl, setMaskPreviewUrl] = useState<string | null>(null);

  const bridge = PhotopeaBridge.getInstance();

  const handleCapture = async () => {
    setIsCapturing(true);
    setErrorMessage(null);
    setCaptureStatus("Inspecionando documento do Photopea...");

    try {
      const docInfo = await bridge.getDocumentInfo();

      if (!docInfo.exists) {
        setErrorMessage("Nenhum documento aberto no Photopea. Crie ou abra uma imagem primeiro.");
        setIsCapturing(false);
        return;
      }

      if (!docInfo.hasSelection) {
        setErrorMessage("Nenhuma seleção encontrada no Photopea. Use a ferramenta Laço ou Retângulo de Seleção para delimitar a área que deseja alterar.");
        setIsCapturing(false);
        return;
      }

      setCaptureStatus("Exportando imagem base e máscara da seleção...");

      // 1. Exporta imagem base
      const imageBuffer = await bridge.exportActiveDocumentPNG();
      if (!imageBuffer) {
        throw new Error("Falha ao exportar imagem ativa do Photopea.");
      }

      // 2. Exporta máscara binária
      const maskBuffer = await bridge.exportSelectionMask();
      if (!maskBuffer) {
        throw new Error("Falha ao gerar máscara da seleção.");
      }

      const imgBlob = ImageUtils.arrayBufferToBlob(imageBuffer, "image/png");
      const mskBlob = ImageUtils.arrayBufferToBlob(maskBuffer, "image/png");

      const maskUrl = await ImageUtils.blobToDataURL(mskBlob);
      setMaskPreviewUrl(maskUrl);

      onCaptureSelection(imgBlob, mskBlob, docInfo.id ?? docInfo.source);
      setCaptureStatus("Seleção capturada com sucesso!");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Erro ao capturar dados do Photopea.");
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      padding: "10px",
      backgroundColor: "var(--bg-input)",
      borderRadius: "var(--radius-sm)",
      border: "1px solid var(--border-color)"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-main)" }}>
          Área de Inpainting (Seleção):
        </span>
        {hasCapturedData && (
          <span style={{ fontSize: "10px", color: "var(--success)", display: "flex", alignItems: "center", gap: "2px" }}>
            <CheckCircle2 size={12} /> Pronta
          </span>
        )}
      </div>

      <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.3" }}>
        Faça uma seleção no canvas do Photopea com o <b>Laço</b> ou <b>Varinha Mágica</b> e clique abaixo para capturar.
        Inclua o objeto inteiro, suas sombras e uma folga ao redor. Uma seleção apertada pode deixar partes do objeto antigo nas bordas.
      </p>

      <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ whiteSpace: "nowrap" }}>Suavizar borda</span>
        <input
          id="feather-range"
          type="range"
          min={0}
          max={64}
          step={2}
          value={featherPx}
          onChange={(event) => onChangeFeather(Number(event.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ minWidth: "34px", textAlign: "right" }}>{featherPx ? `${featherPx}px` : "exata"}</span>
      </label>

      <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", gap: "6px", alignItems: "center" }}>
        <input type="checkbox" checked={harmonizeEdges} onChange={event => onChangeHarmonize(event.target.checked)} />
        Ajustar cor nas bordas
      </label>

      <p style={{ fontSize: "10px", color: "var(--text-muted)" }}>Após gerar, esses ajustes atualizam a prévia sem consumir nova cota de IA.</p>

      <button
        type="button"
        className="btn btn-secondary"
        onClick={handleCapture}
        disabled={isCapturing}
        style={{ width: "100%", justifyContent: "center" }}
      >
        {isCapturing ? (
          <>
            <RefreshCw size={14} className="animate-spin" /> Capturando...
          </>
        ) : (
          <>
            <Scan size={14} /> Capturar Seleção do Canvas
          </>
        )}
      </button>

      {isCapturing && captureStatus && (
        <div style={{ fontSize: "10px", color: "var(--accent)", textAlign: "center" }}>
          {captureStatus}
        </div>
      )}

      {errorMessage && (
        <div style={{
          fontSize: "11px",
          color: "var(--danger)",
          display: "flex",
          gap: "6px",
          alignItems: "flex-start",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          padding: "6px 8px",
          borderRadius: "var(--radius-sm)"
        }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {hasCapturedData && maskPreviewUrl && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
          <img
            src={maskPreviewUrl}
            alt="Máscara capturada"
            style={{
              width: "48px",
              height: "48px",
              objectFit: "contain",
              backgroundColor: "#000",
              border: "1px solid var(--border-color)",
              borderRadius: "4px"
            }}
          />
          <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
            <b style={{ color: "var(--text-main)", display: "block" }}>Máscara delimitada:</b>
            Branco = área a gerar<br />Preto = área preservada
          </div>
        </div>
      )}
    </div>
  );
};
