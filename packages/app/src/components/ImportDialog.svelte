<script lang="ts">
  import { store } from '../store.svelte.js';
  import { fmt } from '../lib/format.js';

  let dialogEl: HTMLDialogElement;
  let checked = $state(false);
  let fileInput: HTMLInputElement;

  const pending = $derived(store.pendingImport);
  const error = $derived(store.pendingImportError);

  $effect(() => {
    if (pending || error) dialogEl?.showModal();
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
    if (file) store.startImportFromFile(file);
  }

  function confirm() {
    store.confirmImport();
    checked = false;
  }

  function cancel() {
    store.cancelImport();
    checked = false;
  }
</script>

<input type="file" accept=".xlsx" bind:this={fileInput} onchange={onFileChosen} hidden />
<button class="toolbar-btn" onclick={pickFile} disabled={store.busy()}>匯入 Excel</button>

<dialog bind:this={dialogEl} onclose={cancel} oncancel={cancel}>
  {#if error}
    <h2>Excel 匯入未完成</h2>
    <div class="notice warn">{error}</div>
    <p class="subtle">原本的活動與得獎紀錄沒有變更。請修正檔案後，再次匯入。</p>
    <div class="actions">
      <button class="btn" onclick={() => store.downloadTemplate()}>下載正確範本</button>
      <button class="btn solid" onclick={cancel}>關閉</button>
    </div>
  {:else if pending}
    <h2>核對名單與獎項</h2>
    <p class="subtle">來源：{store.pendingImportSource}</p>
    <div class="summary-grid">
      <div class="summary-box"><strong>{fmt(pending.active)}</strong><span>符合抽獎資格的人員</span></div>
      <div class="summary-box"><strong>{fmt(pending.prizes.length)}</strong><span>獎項數</span></div>
      <div class="summary-box"><strong>{fmt(pending.total)}</strong><span>總得獎名額</span></div>
    </div>
    <div class="notice">
      <b>{pending.settings.title}</b><br />
      {pending.settings.allowRepeat ? '可中不同獎項；同一獎項不重複。' : '每位人員在本次活動中最多中獎一次。'}
      名單共 {pending.people.length} 人，其中 {pending.people.length - pending.active} 人不參加。
    </div>
    {#each pending.warnings as w}
      <div class="notice warn">{w}</div>
    {/each}
    <div class="table-wrap">
      <table>
        <thead><tr><th>順序</th><th>獎項</th><th>總名額</th><th>每輪人數</th></tr></thead>
        <tbody>
          {#each pending.prizes as q}
            <tr><td>{q.order}</td><td>{q.name}</td><td>{q.quantity}</td><td>{q.batch}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if store.state.results.length}
      <div class="notice warn">目前活動已有 {store.state.results.length} 筆開獎紀錄。確認後會先下載現有進度備份，再建立新活動；不會接續舊活動。</div>
    {/if}
    <label class="checkline">
      <input type="checkbox" bind:checked />
      我已核對名單、抽獎資格及獎項人數，確認建立這個新活動。
    </label>
    <div class="actions">
      <button class="btn" onclick={cancel}>取消</button>
      <button class="btn solid" disabled={!checked} onclick={confirm}>確認匯入，進入舞台</button>
    </div>
  {/if}
</dialog>

<style>
  dialog {
    border: none;
    border-radius: 12px;
    padding: 20px;
    max-width: 560px;
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
  .summary-grid {
    display: flex;
    gap: 12px;
    margin: 12px 0;
  }
  .summary-box {
    flex: 1;
    background: var(--bg-elevated-2);
    border-radius: 8px;
    padding: 10px;
    text-align: center;
  }
  .summary-box strong {
    display: block;
    font-size: 20px;
  }
  .notice {
    background: var(--bg-elevated-2);
    border-radius: 8px;
    padding: 10px;
    margin: 8px 0;
    font-size: 13px;
  }
  .notice.warn {
    background: #2f2418;
    color: var(--accent);
  }
  .table-wrap {
    max-height: 220px;
    overflow: auto;
    margin: 8px 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th,
  td {
    text-align: left;
    padding: 4px 8px;
    border-bottom: 1px solid var(--border);
  }
  .checkline {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    font-size: 13px;
    margin: 12px 0;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
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
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
