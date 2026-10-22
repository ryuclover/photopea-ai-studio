import React, { useState } from "react";
import { Sliders, ChevronDown, ChevronUp } from "lucide-react";

interface PromptSectionProps {
  isEditing?: boolean;
  supportedSizes?: string[];
  prompt: string;
  onChangePrompt: (val: string) => void;
  negativePrompt: string;
  onChangeNegativePrompt: (val: string) => void;
  width: number;
  height: number;
  onChangeDimensions: (w: number, h: number) => void;
  steps: number;
  onChangeSteps: (s: number) => void;
  cfgScale: number;
  onChangeCfg: (c: number) => void;
}

const STYLE_PRESETS = [
  { label: "Fotografia", text: ", fotografia profissional 8k, iluminação cinematográfica, lente 35mm" },
  { label: "Cyberpunk", text: ", estética cyberpunk, iluminação volumétrica neon, alta definição" },
  { label: "Anime", text: ", estilo anime de alta qualidade, ilustração digital detalhada Makoto Shinkai" },
  { label: "Conceitual", text: ", arte conceitual impressionista, atmosfera rica, render Octane" }
];

export const PromptSection: React.FC<PromptSectionProps> = ({
  isEditing,
  supportedSizes,
  prompt,
  onChangePrompt,
  negativePrompt,
  onChangeNegativePrompt,
  width,
  height,
  onChangeDimensions,
  steps,
  onChangeSteps,
  cfgScale,
  onChangeCfg
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleApplyStyle = (styleText: string) => {
    if (!prompt.includes(styleText)) {
      onChangePrompt((prompt.trim() + styleText).trim());
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Caixa de Prompt */}
      <div>
        <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
          Prompt descritivo:
        </label>
        <textarea
          rows={3}
          placeholder="Descreva detalhadamente o que você deseja gerar..."
          value={prompt}
          onChange={(e) => onChangePrompt(e.target.value)}
        />

        {/* Chips de Estilo Rápido */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
          {STYLE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="btn"
              onClick={() => handleApplyStyle(preset.text)}
              style={{
                padding: "2px 6px",
                fontSize: "10px",
                backgroundColor: "var(--bg-card)",
                color: "var(--text-muted)",
                borderRadius: "12px",
                border: "1px solid var(--border-color)"
              }}
            >
              + {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dimensões / Proporção */}
      {!isEditing && (
      <div>
        <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
          Proporção da Imagem:
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px" }}>
          {(supportedSizes?.filter(size => /^\d+x\d+$/.test(size)).length ? supportedSizes.filter(size => /^\d+x\d+$/.test(size)) : ["1024x1024", "1280x720", "720x1280"]).map(size => {
            const [w, h] = size.split("x").map(Number);
            return <button key={size} type="button" className="btn" onClick={() => onChangeDimensions(w, h)} style={{fontSize: "10px", backgroundColor: width === w && height === h ? "var(--accent)" : "var(--bg-input)"}}>{size}</button>;
          })}
        </div>
      </div>
      )}
      {isEditing && <p style={{fontSize: "10px", color: "var(--text-muted)"}}>A edição acompanha o tamanho do documento. A resolução de processamento depende do modelo.</p>}

      {/* Configurações Avançadas */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-dim)",
            fontSize: "11px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            cursor: "pointer",
            padding: "4px 0"
          }}
        >
          <Sliders size={12} />
          <span>Opções Avançadas (CFG, Passos)</span>
          {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {showAdvanced && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            padding: "8px",
            backgroundColor: "var(--bg-input)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-color)",
            marginTop: "4px"
          }}>
            <div>
              <label style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", marginBottom: "2px" }}>
                Prompt Negativo (o que evitar):
              </label>
              <input
                type="text"
                placeholder="deformidades, baixa qualidade, texto ilegível..."
                value={negativePrompt}
                onChange={(e) => onChangeNegativePrompt(e.target.value)}
                style={{ fontSize: "11px" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              <div>
                <label style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", marginBottom: "2px" }}>
                  Passos ({steps}):
                </label>
                <input
                  type="range"
                  min="15"
                  max="30"
                  value={steps}
                  onChange={(e) => onChangeSteps(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", marginBottom: "2px" }}>
                  CFG Scale ({cfgScale}):
                </label>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="0.5"
                  value={cfgScale}
                  onChange={(e) => onChangeCfg(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
