<script lang="ts">
  import { toastStore } from '../lib/toast.svelte.js';
</script>

<div class="toast-stack">
  {#each toastStore.items as item (item.id)}
    <div class="toast" class:error={item.error}>{item.message}</div>
  {/each}
</div>

<style>
  .toast-stack {
    position: fixed;
    right: 16px;
    bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 50;
  }
  .toast {
    background: var(--bg-elevated-2);
    border: 1px solid var(--border-strong);
    color: var(--text);
    padding: 10px 14px;
    border-radius: 10px;
    font-size: 13px;
    max-width: 320px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  }
  .toast.error {
    border-color: var(--danger-border);
    color: var(--danger);
  }
</style>
