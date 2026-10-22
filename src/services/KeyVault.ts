// src/services/KeyVault.ts

export class KeyVault {
  private static readonly PREFIX = "ai_studio_key_";
  private static readonly ENDPOINT_PREFIX = "ai_studio_endpoint_";

  private static sessionKeys = new Map<string, string>();

  public static setSessionKey(providerId: string, key: string): void {
    // Empty is an explicit session override; do not revive an old saved key.
    this.sessionKeys.set(providerId, key.trim());
  }

  public static setKey(providerId: string, apiKey: string): void {
    if (!apiKey || !apiKey.trim()) {
      this.removeKey(providerId);
      return;
    }
    const encoded = btoa(encodeURIComponent(apiKey.trim()));
    localStorage.setItem(this.PREFIX + providerId, encoded);
    this.sessionKeys.delete(providerId);
  }

  public static getKey(providerId: string): string | null {
    if (this.sessionKeys.has(providerId)) return this.sessionKeys.get(providerId) || null;
    try {
      const raw = localStorage.getItem(this.PREFIX + providerId);
      if (!raw) return null;
      return decodeURIComponent(atob(raw));
    } catch {
      return null;
    }
  }

  public static removeKey(providerId: string): void {
    this.sessionKeys.set(providerId, '');
    localStorage.removeItem(this.PREFIX + providerId);
  }

  public static hasKey(providerId: string): boolean {
    return !!this.getKey(providerId);
  }

  // Endpoints customizados (para OpenAI-compatible)
  public static setCustomEndpoint(providerId: string, url: string): void {
    if (!url || !url.trim()) {
      localStorage.removeItem(this.ENDPOINT_PREFIX + providerId);
    } else {
      localStorage.setItem(this.ENDPOINT_PREFIX + providerId, url.trim());
    }
  }

  public static getCustomEndpoint(providerId: string): string | null {
    try { return localStorage.getItem(this.ENDPOINT_PREFIX + providerId); }
    catch { return null; }
  }
}
