export interface ConfirmOptions {
  input?: boolean;
  ok?: string;
  danger?: boolean;
  check?: boolean;
}

interface ConfirmRequest {
  title: string;
  message: string;
  options: Required<ConfirmOptions>;
  resolve: (value: string | boolean) => void;
}

const DEFAULTS: Required<ConfirmOptions> = { input: false, ok: '確認', danger: false, check: false };

/** Promise-based confirm/prompt dialog, mirroring v1's `ask()`. One shared <ConfirmDialog> renders whatever request is queued here. */
class ConfirmStore {
  request = $state<ConfirmRequest | null>(null);

  ask(title: string, message: string, options: ConfirmOptions = {}): Promise<string | boolean> {
    return new Promise((resolve) => {
      this.request = { title, message, options: { ...DEFAULTS, ...options }, resolve };
    });
  }

  resolve(value: string | boolean): void {
    this.request?.resolve(value);
    this.request = null;
  }
}

export const confirmStore = new ConfirmStore();
