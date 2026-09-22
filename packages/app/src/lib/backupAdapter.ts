import type { EventState } from '@fairdraw/core';

const BACKUP_FORMAT = 'FAIRDRAW-BACKUP';

function wrap(state: EventState) {
  return { format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), state };
}

/**
 * A place FairDraw can continuously write backups to, beyond the manual
 * "備份進度" download button and the localStorage autosave. Swappable per
 * runtime: the web build uses the File System Access API (Chromium-only);
 * a future Tauri desktop build can implement the same interface over the
 * native filesystem, which isn't gated by browser support at all.
 */
export interface BackupAdapter {
  readonly isSupported: boolean;
  hasTarget(): boolean;
  pickTarget(suggestedName: string): Promise<void>;
  write(state: EventState): Promise<void>;
  clearTarget(): void;
}

type FileSystemFileHandleLike = {
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
};

type ShowSaveFilePicker = (options: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<FileSystemFileHandleLike>;

/** File System Access API adapter — Chrome/Edge only, matches the browsers this tool already targets. */
export class WebFileSystemBackupAdapter implements BackupAdapter {
  private handle: FileSystemFileHandleLike | null = null;

  get isSupported(): boolean {
    return typeof window !== 'undefined' && typeof (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function';
  }

  hasTarget(): boolean {
    return this.handle !== null;
  }

  async pickTarget(suggestedName: string): Promise<void> {
    const showSaveFilePicker = (window as unknown as { showSaveFilePicker: ShowSaveFilePicker }).showSaveFilePicker;
    this.handle = await showSaveFilePicker({
      suggestedName,
      types: [{ description: 'FairDraw 備份', accept: { 'application/json': ['.json'] } }],
    });
  }

  async write(state: EventState): Promise<void> {
    if (!this.handle) throw new Error('尚未選擇自動備份的目標檔案。');
    const writable = await this.handle.createWritable();
    await writable.write(JSON.stringify(wrap(state), null, 2));
    await writable.close();
  }

  clearTarget(): void {
    this.handle = null;
  }
}
