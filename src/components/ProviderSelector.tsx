import React from "react";
import { ProviderRegistry } from "../providers/ProviderRegistry";
import type { ProviderId } from "../providers/AIProvider";
import { KeyVault } from "../services/KeyVault";
import { AlertCircle } from "lucide-react";

interface ProviderSelectorProps {
  selectedProviderId: ProviderId;
  onSelectProvider: (id: ProviderId) => void;
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  onOpenSettings: () => void;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  selectedProviderId,
  onSelectProvider,
  selectedModelId,
  onSelectModel,
  onOpenSettings
}) => {
  const providers = ProviderRegistry.getAll();
  const currentProvider = ProviderRegistry.get(selectedProviderId);
  const models = currentProvider ? currentProvider.getModels() : [];
  const hasKey = KeyVault.hasKey(selectedProviderId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Seleção do Provedor */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)" }}>
            Provedor de IA:
          </label>
          {((!hasKey && currentProvider?.requiresApiKey) || selectedProviderId === "free_inpaint") && (
            <button
              onClick={onOpenSettings}
              style={{
                background: "none",
                border: "none",
                color: "var(--warning)",
                fontSize: "10px",
                display: "flex",
                alignItems: "center",
                gap: "2px",
                cursor: "pointer",
                padding: 0
              }}
            >
              <AlertCircle size={11} /> {selectedProviderId === "free_inpaint" ? "Token Hugging Face" : "Configurar Chave"}
            </button>
          )}
        </div>

        <select
          value={selectedProviderId}
          onChange={(e) => onSelectProvider(e.target.value as ProviderId)}
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {!p.requiresApiKey ? (KeyVault.hasKey(p.id) ? "(Com token · sujeito a cota)" : "(Sem chave · sujeito a cota)") : KeyVault.hasKey(p.id) ? "✓" : "(Requer chave)"}
            </option>
          ))}
        </select>
      </div>

      {/* Seleção do Modelo */}
      <div>
        <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
          Modelo:
        </label>
        <select
          value={selectedModelId}
          onChange={(e) => onSelectModel(e.target.value)}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        {/* Descrição do Modelo Selecionado */}
        {models.find((m) => m.id === selectedModelId)?.description && (
          <p style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "4px", lineHeight: "1.3" }}>
            {models.find((m) => m.id === selectedModelId)?.description}
          </p>
        )}
      </div>
    </div>
  );
};
