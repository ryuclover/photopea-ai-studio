import React from "react";
import { Sparkles, Settings } from "lucide-react";

interface HeaderProps {
  onOpenSettings: () => void;
  isConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings, isConnected }) => {
  return (
    <header style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 14px",
      borderBottom: "1px solid var(--border-color)",
      backgroundColor: "var(--bg-card)"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{
          width: "26px",
          height: "26px",
          borderRadius: "6px",
          background: "linear-gradient(135deg, #3b82f6, #ec4899)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white"
        }}>
          <Sparkles size={15} />
        </div>
        <div>
          <h1 style={{ fontSize: "13px", fontWeight: "700", letterSpacing: "0.2px" }}>AI Studio</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: isConnected ? "var(--success)" : "var(--warning)"
            }} />
            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
              {isConnected ? "Conectado ao Photopea" : "Modo Standalone (Dev)"}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <button
          className="btn btn-icon"
          title="Abrir configurações de Chaves de API (BYOK)"
          onClick={onOpenSettings}
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
};
