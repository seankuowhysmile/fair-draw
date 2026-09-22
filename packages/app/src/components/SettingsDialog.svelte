<script lang="ts">
  import { store } from '../store.svelte.js';
  import { confirmStore } from '../lib/confirm.svelte.js';
  import { toastStore } from '../lib/toast.svelte.js';

  let { open = $bindable(false) }: { open: boolean } = $props();
  let dialogEl: HTMLDialogElement;

  let title = $state('');
  let subtitle = $state('');
  let allowRepeat = $state(false);
  let showDept = $state(false);
  let showId = $state(false);
  let sound = $state(false);

  const locked = $derived(store.state.results.length > 0);
  // Hide (not close) this dialog's panel while a confirm prompt from it is pending,
  // so two native <dialog> panels never visibly overlap.
  const hiddenByConfirm = $derived(open && !!confirmStore.request);

  $effect(() => {
    if (open) {
      const s = store.state.settings;
      title = s.title;
      subtitle = s.subtitle;
      allowRepeat = s.allowRepeat;
      showDept = s.showDept;
      showId = s.showId;
      sound = s.sound;
      dialogEl?.showModal();
    } else {
      dialogEl?.close();
    }
  });

  function close() {
    open = false;
  }

  function save() {
    try {
      if (!title.trim()) throw new Error('活動名稱不可空白。');
      store.updateSettings({ title: title.trim(), subtitle: subtitle.trim(), allowRepeat, showDept, showId, sound });
      toastStore.push('設定已儲存。');
      close();
    } catch (e) {
      toastStore.showError(e);
    }
  }

  async function reset() {
    const yes = await confirmStore.ask(
      '重設並重新開始？',
      '這會清除目前活動的全部得獎進度，所有人員重新取得抽獎資格。\n現有紀錄會先交給瀏覽器下載為備份。\n\n正式活動中請勿使用此功能來更換不滿意的抽獎結果。',
      { ok: '備份並重設', danger: true, check: true },
    );
    if (!yes) return;
    try {
      store.resetEvent();
      toastStore.push('已建立全新的抽獎活動，原進度不再接續。');
      close();
    } catch (e) {
      toastStore.showError(e);
    }
  }
</script>

<dialog bind:this={dialogEl} class:confirm-hidden={hiddenByConfirm} onclose={close} oncancel={close}>
  <h2>活動設定</h2>
  <label class="field">
    <span class="small-label">活動名稱</span>
    <input type="text" maxlength="100" bind:value={title} />
  </label>
  <label class="field">
    <span class="small-label">活動副標</span>
    <input type="text" maxlength="140" bind:value={subtitle} />
  </label>

  <label class="switch-row">
    <div><strong>允許跨獎項重複中獎</strong><p>{locked ? '已有開獎紀錄，規則已鎖定。' : '開啟後可中不同獎項；同一獎項仍不可重複。'}</p></div>
    <input type="checkbox" bind:checked={allowRepeat} disabled={locked} />
  </label>
  <label class="switch-row">
    <div><strong>顯示部門</strong><p>得獎卡片上顯示人員的部門或單位。</p></div>
    <input type="checkbox" bind:checked={showDept} />
  </label>
  <label class="switch-row">
    <div><strong>顯示人員編號</strong><p>同名者建議保留編號，避免現場混淆。</p></div>
    <input type="checkbox" bind:checked={showId} />
  </label>
  <label class="switch-row">
    <div><strong>抽獎音效</strong><p>包含旋轉節奏與開獎提示音，可由上方喇叭按鈕靜音。</p></div>
    <input type="checkbox" bind:checked={sound} />
  </label>

  <div class="notice">匯入 Excel 是「建立新活動」，不是接續進度。中途繼續請使用「還原備份」。</div>
  <div class="audit-note">此為本機離線工具，程式與 JSON 備份皆可由電腦使用者修改。操作紀錄方便核對，但不代表防竄改認證。正式抽獎請由工作人員共同見證。</div>

  <div class="danger-zone">
    <button class="btn danger" onclick={reset}>⚠ 重設本活動</button>
    <p>清除全部得獎進度，建立全新活動。無法復原。</p>
  </div>
  <div class="actions">
    <button class="btn" onclick={close}>取消</button>
    <button class="btn solid" onclick={save}>儲存設定</button>
  </div>
</dialog>

<style>
  dialog.confirm-hidden,
  dialog.confirm-hidden::backdrop {
    visibility: hidden;
  }
  dialog {
    border: none;
    border-radius: 12px;
    padding: 20px;
    max-width: 480px;
    width: calc(100% - 32px);
    background: var(--bg-elevated);
    color: var(--text);
  }
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.55);
  }
  .field {
    display: block;
    margin: 10px 0;
  }
  .field input {
    width: 100%;
    margin-top: 4px;
  }
  .small-label {
    font-size: 12px;
    color: var(--text-muted);
  }
  .switch-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    border-top: 1px solid var(--border);
  }
  .switch-row p {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--text-muted);
  }
  .notice,
  .audit-note {
    background: var(--bg-elevated-2);
    border-radius: 8px;
    padding: 10px;
    margin: 8px 0;
    font-size: 12px;
    color: var(--text-muted);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
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
    background: transparent;
    border-color: var(--danger-border);
    color: var(--danger);
  }
  .danger-zone {
    margin-top: var(--space-4, 16px);
    padding-top: var(--space-3, 12px);
    border-top: 1px dashed var(--danger-border);
    display: flex;
    align-items: center;
    gap: var(--space-3, 12px);
  }
  .danger-zone p {
    margin: 0;
    font-size: 11px;
    color: var(--text-muted);
  }
</style>
