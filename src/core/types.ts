// src/core/types.ts

export interface PhotopeaDocumentInfo {
  exists: boolean;
  name?: string;
  source?: string;
  id?: string;
  width?: number;
  height?: number;
  hasSelection?: boolean;
  selectionBounds?: [number, number, number, number]; // [left, top, right, bottom]
}

export interface PendingCommand {
  script: string | ArrayBuffer;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  expectBuffer?: boolean;
  timeoutId?: number;
  marker?: string;
}
