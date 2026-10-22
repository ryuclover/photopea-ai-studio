// src/components/PreviewSection.tsx
import React, { useState, useEffect } from "react";
import { Plus, Download, Trash2, Check, RefreshCw, Copy, AlertCircle } from "lucide-react";
import { ImageUtils } from "../services/ImageUtils";
import { PhotopeaBridge } from "../core/PhotopeaBridge";

interface PreviewSectionProps {
  imageBlob: Blob | null;
  layerBlob?: Blob | null;
  isGenerating: boolean;
  onClear: () => void;
  promptText: string;
  expectedSource?: string;
}

export const PreviewSection: React.FC<PreviewSectionProps> = ({
  imageBlob,
  layerBlob,
  isGenerating,
  onClear,
  promptText,
  expectedSource
}) => {
  const [isInserting, setIsInserting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const bridge = PhotopeaBridge.getInstance();
  const isConnected = bridge.isConnectedToPhotopea();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  // Blob URLs are external resources; create/release them together after commit.
  /* oxlint-disable react/set-state-in-effect */
  useEffect(() => {
    if (!imageBlob) { setImageUrl(null); return; }
    const url = URL.createObjectURL(imageBlob);
    setImageUrl(url);
    setStatusMessage(null);
    return () => URL.revokeObjectURL(url);
  }, [imageBlob]);
  /* oxlint-enable react/set-state-in-effect */

  const pngBlob = async () => {
    if (!imageBlob) throw new Error("Nenhuma imagem disponível.");
    if (imageBlob.type === "image/png") return imageBlob;
    const bitmap = await createImageBitmap(imageBlob);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponível.");
      ctx.drawImage(bitmap, 0, 0);
      return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Falha ao converter PNG.")), "image/png"));
    } finally { bitmap.close(); }
  };

  const handleInsertLayer = async () => {
    if (!imageBlob) return;
    setIsInserting(true);
    setStatusMessage(null);

    try {
      if (isConnected) {
        const inserted = await bridge.insertImageAsLayer(await (layerBlob || imageBlob).arrayBuffer(), `AI: ${promptText.slice(0, 40)}`, expectedSource, expectedSource ? await ImageUtils.getImageDimensions(imageBlob) : undefined);
        if (!inserted) throw new Error("O Photopea não confirmou a inserção.");
        setStatusMessage({ text: "Imagem inserida como nova camada no Photopea.", type: "success" });
      } else {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob() })]);
        setStatusMessage({ text: "Imagem copiada. Use Ctrl+V no Photopea.", type: "success" });
      }
    } catch (err: unknown) {
      setStatusMessage({ text: err instanceof Error ? err.message : "Não foi possível inserir ou copiar. Use Baixar PNG.", type: "error" });
    } finally {
      setIsInserting(false);
      setTimeout(() => setStatusMessage(null), 6000);
    }
  };

  const copyToClipboard = async () => {
    if (!imageBlob) return;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": pngBlob()
        })
      ]);
      setStatusMessage({
        text: "✓ Imagem copiada! Pressione Ctrl+V no Photopea para colar como nova camada.",
        type: "success"
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch {
      setStatusMessage({
        text: "Use o botão Baixar PNG para salvar a imagem.",
        type: "info"
      });
    }
  };

  const handleDownload = async () => {
    if (!imageBlob) return;
    const url = URL.createObjectURL(await pngBlob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-studio-${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!isGenerating && !imageBlob) {
    return null;
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      marginTop: "8px",
      padding: "10px",
      backgroundColor: "var(--bg-card)",
      borderRadius: "var(--radius-sm)",
      border: "1px solid var(--border-color)"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-main)" }}>
          Resultado:
        </span>
        {imageBlob && !isGenerating && (
          <button
            className="btn btn-icon"
            onClick={onClear}
            title="Limpar imagem"
            style={{ padding: "2px" }}
          >
            <Trash2 size={13} style={{ color: "var(--text-muted)" }} />
          </button>
        )}
      </div>

      {/* Caixa de Visualização */}
      <div style={{
        width: "100%",
        minHeight: "180px",
        maxHeight: "260px",
        backgroundColor: "var(--bg-input)",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border-color)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative"
      }}>
        {isGenerating ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
            <RefreshCw size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: "11px", color: "var(--text-muted)", animation: "pulseGlow 1.5s infinite" }}>
              Renderizando com IA...
            </span>
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt="Resultado gerado"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block"
            }}
          />
        ) : null}
      </div>

      {/* Mensagem de Feedback de Status */}
      {statusMessage && (
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "6px",
          padding: "6px 8px",
          borderRadius: "var(--radius-sm)",
          fontSize: "11px",
          backgroundColor: statusMessage.type === "success"
            ? "rgba(16, 185, 129, 0.12)"
            : statusMessage.type === "error"
            ? "rgba(239, 68, 68, 0.12)"
            : "rgba(59, 130, 246, 0.12)",
          border: `1px solid ${statusMessage.type === "success"
            ? "rgba(16, 185, 129, 0.3)"
            : statusMessage.type === "error"
            ? "rgba(239, 68, 68, 0.3)"
            : "rgba(59, 130, 246, 0.3)"}`,
          color: statusMessage.type === "success"
            ? "var(--success)"
            : statusMessage.type === "error"
            ? "var(--danger)"
            : "var(--accent)"
        }}>
          {statusMessage.type === "success" ? <Check size={14} style={{ flexShrink: 0, marginTop: "1px" }} /> : <AlertCircle size={14} style={{ flexShrink: 0, marginTop: "1px" }} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Ações após geração */}
      {imageBlob && !isGenerating && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <button
            className="btn btn-success"
            onClick={handleInsertLayer}
            disabled={isInserting}
            style={{ width: "100%" }}
          >
            {isInserting ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Inserindo no Photopea...
              </>
            ) : isConnected ? (
              <>
                <Plus size={14} /> Inserir como Nova Camada no Photopea
              </>
            ) : (
              <>
                <Copy size={14} /> Copiar Imagem (Ctrl+V no Photopea)
              </>
            )}
          </button>

          <div style={{ display: "grid", gridTemplateColumns: isConnected ? "1fr 1fr" : "1fr", gap: "6px" }}>
            {isConnected && (
              <button
                className="btn btn-secondary"
                onClick={copyToClipboard}
                style={{ fontSize: "11px", padding: "6px" }}
              >
                <Copy size={13} /> Copiar (Ctrl+C)
              </button>
            )}

            <button
              className="btn btn-secondary"
              onClick={handleDownload}
              style={{ fontSize: "11px", padding: "6px" }}
            >
              <Download size={13} /> Baixar PNG
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
