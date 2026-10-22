// src/components/SettingsModal.tsx
import React, { useState } from "react";
import { X, Key, Check, Eye, EyeOff, ExternalLink, ShieldCheck, Trash2 } from "lucide-react";
import { ProviderRegistry } from "../providers/ProviderRegistry";
import { KeyVault } from "../services/KeyVault";
import type { ProviderId } from "../providers/AIProvider";

interface SettingsModalProps {
  isOpen: boolean;
  initialProviderId?: ProviderId;
  onClose: () => void;
  onKeysUpdated: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, initialProviderId, onClose, onKeysUpdated }) => {

  const providers = ProviderRegistry.getAll();
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId>(initialProviderId || providers[0]?.id || "nvidia");
  const [keyInput, setKeyInput] = useState(KeyVault.getKey(selectedProviderId) || "");
  const [customEndpoint, setCustomEndpoint] = useState(KeyVault.getCustomEndpoint("custom") || "");
  const [customModel, setCustomModel] = useState(KeyVault.getCustomEndpoint("custom_model") || "");
  const [showKey, setShowKey] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);
  const [rememberKey, setRememberKey] = useState(false);
  const [validationError, setValidationError] = useState("");

  if (!isOpen) return null;

  const currentProvider = ProviderRegistry.get(selectedProviderId);

  const handleSelectProvider = (id: typeof selectedProviderId) => {
    setSelectedProviderId(id);
    setKeyInput(KeyVault.getKey(id) || "");
    setShowKey(false);
    setSavedMessage(false);
    setValidationError("");
  };

  const handleSave = () => {
    if (selectedProviderId === "free_inpaint" && keyInput.trim() && !/^hf_\S+$/.test(keyInput.trim())) {
      setValidationError("O SDXL usa um token Hugging Face iniciado por hf_. A chave NVIDIA deve ficar no provedor NVIDIA.");
      return;
    }
    setValidationError("");
    try {
    if (rememberKey) KeyVault.setKey(selectedProviderId, keyInput);
    else KeyVault.setSessionKey(selectedProviderId, keyInput);
    if (selectedProviderId === "custom") {
      KeyVault.setCustomEndpoint("custom", customEndpoint);
      KeyVault.setCustomEndpoint("custom_model", customModel);
    }
    } catch {
      KeyVault.setSessionKey(selectedProviderId, keyInput);
      onKeysUpdated();
      setValidationError("O navegador bloqueou o armazenamento. A chave será usada somente nesta sessão; configurações persistentes não foram confirmadas.");
      return;
    }
    setSavedMessage(true);
    onKeysUpdated();
    setTimeout(() => setSavedMessage(false), 2000);
  };

  const handleClear = () => {
    let persistedRemoval = true;
    try { KeyVault.removeKey(selectedProviderId); }
    catch {
      persistedRemoval = false;
      setValidationError("Chave desativada nesta sessão. O navegador bloqueou a remoção da cópia persistida; apague os dados deste site para removê-la definitivamente.");
    }
    setKeyInput("");
    setSavedMessage(persistedRemoval);
    onKeysUpdated();
    setTimeout(() => setSavedMessage(false), 2000);
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.75)",
      backdropFilter: "blur(4px)",
      zIndex: 999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "12px"
    }}>
      <div style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-md)",
        width: "100%",
        maxWidth: "320px",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)"
      }}>
        {/* Header do Modal */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "1px solid var(--border-color)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Key size={15} style={{ color: "var(--accent)" }} />
            <h2 style={{ fontSize: "13px", fontWeight: "600" }}>Chaves de API (BYOK)</h2>
          </div>
          <button className="btn btn-icon" onClick={onClose} aria-label="Fechar configurações">
            <X size={15} />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div style={{ padding: "12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            backgroundColor: "rgba(59, 130, 246, 0.08)",
            padding: "8px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid rgba(59, 130, 246, 0.2)",
            display: "flex",
            gap: "6px"
          }}>
            <ShieldCheck size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
            <span>A chave é usada somente nesta sessão. Marque a opção abaixo para guardá-la no navegador (sem criptografia). A chave, as imagens e os prompts são enviados ao provedor escolhido.</span>
          </div>

          {/* Abas de Provedores */}
          <div>
            <label style={{ fontSize: "11px", fontWeight: "500", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
              Escolha o Provedor:
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
              {providers.map((p) => {
                const isSelected = p.id === selectedProviderId;
                const hasKey = KeyVault.hasKey(p.id);
                return (
                  <button
                    key={p.id}
                    className="btn"
                    onClick={() => handleSelectProvider(p.id)}
                    style={{
                      justifyContent: "space-between",
                      padding: "6px 8px",
                      fontSize: "11px",
                      backgroundColor: isSelected ? "var(--accent)" : "var(--bg-app)",
                      color: isSelected ? "white" : "var(--text-main)",
                      border: "1px solid",
                      borderColor: isSelected ? "var(--accent)" : "var(--border-color)"
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name.split(" ")[0]}
                    </span>
                    <span style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: hasKey ? "var(--success)" : "var(--border-color)",
                      flexShrink: 0
                    }} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input da Chave */}
          {currentProvider && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span>{selectedProviderId === "free_inpaint" ? "Token Hugging Face (opcional):" : `Chave para ${currentProvider.name}:`}</span>
                  <a
                    href={currentProvider.helpUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--accent)", display: "flex", alignItems: "center", gap: "2px", textDecoration: "none", fontSize: "10px" }}
                  >
                    Obter Chave <ExternalLink size={10} />
                  </a>
                </label>

                <div style={{ position: "relative" }}>
                  <input
                    type={showKey ? "text" : "password"}
                    placeholder={currentProvider.keyPlaceholder}
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    style={{ paddingRight: "32px", fontSize: "11px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    style={{
                      position: "absolute",
                      right: "6px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      padding: "2px"
                    }}
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {selectedProviderId === "custom" && (
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                    Endpoint Customizado:
                  </label>
                  <input
                    type="text"
                    placeholder="https://api.together.xyz/v1/images/generations"
                    value={customEndpoint}
                    onChange={(e) => setCustomEndpoint(e.target.value)}
                    style={{ fontSize: "11px" }}
                  />
                  <label>Identificador do modelo:</label>
                  <input value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder="organização/modelo" />
                </div>
              )}

              {selectedProviderId === "free_inpaint" && <div style={{fontSize: "11px", lineHeight: 1.5}}><p>Crie um token pessoal de leitura no Hugging Face e cole aqui. Ele autentica as chamadas do SDXL para usar a cota gratuita da sua conta; não libera uso ilimitado. Não use a chave NVIDIA neste campo.</p><a href="https://huggingface.co/join" target="_blank" rel="noreferrer">Criar conta gratuita</a> · <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer">Criar token</a></div>}
              {validationError && <p role="alert" style={{color: "var(--danger)", fontSize: "11px"}}>{validationError}</p>}
              <label style={{display: "flex", gap: "6px", fontSize: "11px"}}><input type="checkbox" checked={rememberKey} onChange={event => setRememberKey(event.target.checked)} style={{width: "auto"}} />Guardar chave neste navegador</label>
              {/* Botões de Ação */}
              <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  style={{ flex: 1 }}
                >
                  <Check size={14} /> {rememberKey ? "Salvar Chave" : "Usar nesta sessão"}
                </button>
                {KeyVault.hasKey(selectedProviderId) && (
                  <button
                    className="btn btn-secondary"
                    onClick={handleClear}
                    title="Remover chave"
                  >
                    <Trash2 size={14} style={{ color: "var(--danger)" }} />
                  </button>
                )}
              </div>

              {savedMessage && (
                <div style={{ fontSize: "11px", color: "var(--success)", textAlign: "center", fontWeight: "500" }}>
                  Configuração salva com sucesso!
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
