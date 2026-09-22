<script lang="ts">
  import { confirmStore } from '../lib/confirm.svelte.js';

  let dialogEl: HTMLDialogElement;
  let reason = $state('');
  let checked = $state(false);

  const request = $derived(confirmStore.request);

  $effect(() => {
    if (request) {
      reason = '';
      checked = false;
      dialogEl?.showModal();
    } else {
      dialogEl?.close();
    }
  });

  function ok() {
    if (!request) return;
    if (request.options.input) {
      const trimmed = reason.trim();
      if (!trimmed) return;
      confirmStore.resolve(trimmed);
    } else {
      confirmStore.resolve(true);
    }
  }

  function cancel() {
    confirmStore.resolve(false);
  }

  const okDisabled = $derived(
    !!request && ((request.options.input && !reason.trim()) || (request.options.check && !checked)),
  );
</script>

<dialog bind:this={dialogEl} onclose={cancel} oncancel={cancel}>
  {#if request}
    <h2>{request.title}</h2>
    <p class="message">{request.message}</p>
    {#if request.options.input}
      <label class="field">
        <span class="small-label">請輸入作廢理由（必填）</span>
        <textarea maxlength="200" bind:value={reason} placeholder="例如：現場唱名後未到場，依活動規則補抽"></textarea>
      </label>
    {/if}
    {#if request.options.check}
      <label class="checkline">
        <input type="checkbox" bind:checked />
        我已理解此操作將建立新活動，舊進度不會接續。
      </label>
    {/if}
    <div class="actions">
      <button class="btn" onclick={cancel}>取消</button>
      <button class="btn" class:danger={request.options.danger} class:solid={!request.options.danger} disabled={okDisabled} onclick={ok}>
        {request.options.ok}
      </button>
    </div>
  {/if}
</dialog>

<style>
  dialog {
    border: none;
    border-radius: 12px;
    padding: 20px;
    max-width: 420px;
    width: calc(100% - 32px);
    background: var(--bg-elevated);
    color: var(--text);
  }
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.55);
  }
  .message {
    white-space: pre-line;
    font-size: 13px;
    color: var(--text-muted);
  }
  .field {
    display: block;
    margin: 12px 0;
  }
  textarea {
    width: 100%;
    min-height: 64px;
    margin-top: 4px;
  }
  .checkline {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    font-size: 13px;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }
  .btn {
    cursor: pointer;
    padding: 6px 14px;
    border-radius: 8px;
    border: 1px solid var(--border-strong);
    background: transparent;
    color: inherit;
  }
  .btn.solid {
    background: linear-gradient(135deg, var(--accent), var(--accent-strong));
    border-color: var(--accent-strong);
    color: #16211d;
    font-weight: 600;
  }
  .btn.danger {
    background: var(--danger-border);
    border-color: var(--danger-border);
  }
</style>
