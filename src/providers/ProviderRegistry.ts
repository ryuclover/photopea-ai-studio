import type { AIProvider, ProviderId } from "./AIProvider";
import { NvidiaProvider } from "./NvidiaProvider";
import { FreeInpaintProvider } from "./FreeInpaintProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { StabilityProvider } from "./StabilityProvider";
import { ReplicateProvider } from "./ReplicateProvider";
import { CustomOpenAIProvider } from "./CustomOpenAIProvider";

export class ProviderRegistry {
  private static providers: Map<ProviderId, AIProvider> = new Map();
  private static initialized = false;

  private static init() {
    if (this.initialized) return;
    this.register(new NvidiaProvider());
    this.register(new FreeInpaintProvider());
    this.register(new OpenAIProvider());
    this.register(new StabilityProvider());
    this.register(new ReplicateProvider());
    this.register(new CustomOpenAIProvider());
    this.initialized = true;
  }

  public static register(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  public static get(id: ProviderId): AIProvider | undefined {
    this.init();
    return this.providers.get(id);
  }

  public static getAll(): AIProvider[] {
    this.init();
    return Array.from(this.providers.values());
  }
}
