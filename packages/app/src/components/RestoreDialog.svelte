<script lang="ts">
  import { store } from '../store.svelte.js';
  import { validResults } from '@fairdraw/core';

  let dialogEl: HTMLDialogElement;
  let fileInput: HTMLInputElement;
  let fileName = $state('');

  const pending = $derived(store.pendingRestore);

  $effect(() => {
    if (pending) dialogEl?.showModal();
    else dialogEl?.close();
  });

  function pickFile() {
    if (store.busy()) return;
    fileInput.click();
  }

  function onFileChosen(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      fileName = file.name;
      store.startRestoreFromFile(file);
    }
  }

  function confirm() {
    store.confirmRestore(fileName);
  }

  function cancel() {
    store.cancelRestore();
  }
</script>

<input type="file" accept=".json" bind:this={fileInput} onchange={onFileChosen} hidden />
<button class="toolbar-btn" onclick={pickFile} disabled={store.busy()}>還原備份</button>

<dialog bind:this={dialogEl} onclose={cancel} oncancel={cancel}>
  {#if pending}
    <h2>還原抽獎進度</h2>
    <p class="message">
      活動：{pending.settings.title}
      <br />有效得獎名額：{validResults(pending).length}
      <br />總開獎紀錄：{pending.results.length}
      <br /><br />這會以備份覆蓋目前活動。現有開獎進度將先下載備份，請核對是否使用最新的備份檔。
    </p>
    <div class="actions">
      <button class="btn" onclick={cancel}>取消</button>
      <button class="btn solid" onclick={confirm}>確認還原</button>
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
  .toolbar-btn {
    cursor: pointer;
  }
  .message {
    white-space: pre-line;
    font-size: 13px;
    color: var(--text-muted);
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
</style>
