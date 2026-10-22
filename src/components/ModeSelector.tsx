// src/components/ModeSelector.tsx
import React from "react";
import { Image as ImageIcon, Wand2, RefreshCw } from "lucide-react";

export type GenerationMode = "textToImage" | "inpaint" | "variation";

interface ModeSelectorProps {
  mode: GenerationMode;
  onChangeMode: (mode: GenerationMode) => void;
  supportsText: boolean;
  supportsInpaint: boolean;
  supportsImg2Img: boolean;
  onInpaintUnavailableClick?: () => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  mode,
  onChangeMode,
  supportsText,
  supportsInpaint,
  supportsImg2Img,
  onInpaintUnavailableClick
}) => {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: "4px",
      backgroundColor: "var(--bg-input)",
      padding: "3px",
      borderRadius: "var(--radius-sm)",
      border: "1px solid var(--border-color)"
    }}>
      {/* 1. Texto para Imagem */}
      <button
        type="button"
        className="btn"
        onClick={() => onChangeMode("textToImage")}
        disabled={!supportsText}
        style={{
          padding: "6px 4px",
          fontSize: "10.5px",
          backgroundColor: mode === "textToImage" ? "var(--bg-card)" : "transparent",
          color: mode === "textToImage" ? "var(--text-main)" : "var(--text-muted)",
          border: mode === "textToImage" ? "1px solid var(--border-color)" : "none",
          boxShadow: mode === "textToImage" ? "0 1px 4px rgba(0,0,0,0.2)" : "none"
        }}
      >
        <ImageIcon size={12} />
        Texto
      </button>

      {/* 2. Generative Fill (Inpaint com Máscara) */}
      <button
        type="button"
        className="btn"
        onClick={() => {
          if (supportsInpaint) {
            onChangeMode("inpaint");
          } else if (onInpaintUnavailableClick) {
            onInpaintUnavailableClick();
          }
        }}
        style={{
          padding: "6px 4px",
          fontSize: "10.5px",
          backgroundColor: mode === "inpaint" ? "var(--bg-card)" : "transparent",
          color: mode === "inpaint"
            ? "var(--text-main)"
            : supportsInpaint
            ? "var(--text-muted)"
            : "var(--text-dim)",
          border: mode === "inpaint" ? "1px solid var(--border-color)" : "none",
          boxShadow: mode === "inpaint" ? "0 1px 4px rgba(0,0,0,0.2)" : "none",
          cursor: "pointer"
        }}
      >
        <Wand2 size={12} />
        Inpaint {!supportsInpaint && <span style={{ fontSize: "9px", color: "var(--warning)" }}>•</span>}
      </button>

      {/* 3. Variação / Img2Img (Opção B - Funciona na NVIDIA) */}
      <button
        type="button"
        className="btn"
        onClick={() => onChangeMode("variation")}
        disabled={!supportsImg2Img}
        style={{
          padding: "6px 4px",
          fontSize: "10.5px",
          backgroundColor: mode === "variation" ? "var(--bg-card)" : "transparent",
          color: mode === "variation" ? "var(--text-main)" : "var(--text-muted)",
          border: mode === "variation" ? "1px solid var(--border-color)" : "none",
          boxShadow: mode === "variation" ? "0 1px 4px rgba(0,0,0,0.2)" : "none",
          cursor: "pointer"
        }}
        title="Gera variações artísticas do desenho atual usando o prompt"
      >
        <RefreshCw size={12} />
        Variação
      </button>
    </div>
  );
};
