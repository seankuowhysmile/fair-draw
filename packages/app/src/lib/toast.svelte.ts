interface ToastItem {
  id: number;
  message: string;
  error: boolean;
}

let nextId = 1;

class ToastStore {
  items = $state<ToastItem[]>([]);

  push(message: string, error = false, time = 5000): void {
    const id = nextId++;
    if (this.items.length >= 2) this.items.shift();
    this.items.push({ id, message, error });
    setTimeout(() => {
      this.items = this.items.filter((t) => t.id !== id);
    }, time);
  }

  showError(e: unknown): void {
    const message = e instanceof Error ? e.message : String(e);
    this.push(message, true, 8500);
    console.warn(e);
  }
}

export const toastStore = new ToastStore();
