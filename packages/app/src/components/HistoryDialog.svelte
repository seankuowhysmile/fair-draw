<script lang="ts">
  import { store } from '../store.svelte.js';
  import { prizeById, validResults } from '@fairdraw/core';
  import { confirmStore } from '../lib/confirm.svelte.js';
  import { toastStore } from '../lib/toast.svelte.js';

  let { open = $bindable(false) }: { open: boolean } = $props();
  let dialogEl: HTMLDialogElement;
  let query = $state('');
  const hiddenByConfirm = $derived(open && !!confirmStore.request);

  $effect(() => {
    if (open) {
      query = '';
      dialogEl?.showModal();
    } else {
      dialogEl?.close();
    }
  });

  function close() {
    open = false;
  }

  const validCount = $derived(validResults(store.state).length);
  const voidCount = $derived(store.state.results.length - validCount);

  const matches = $derived(
    store.state.results
      .filter((r) => {
        const p = store.state.people.find((x) => x.id === r.personId);
        const q = prizeById(store.state, r.prizeId);
        if (!p || !q) return false;
        return (p.name + ' ' + p.id + ' ' + p.dept + ' ' + q.name).toLowerCase().includes(query.toLowerCase());
      })
      .slice()
      .reverse()
      .slice(0, 200),
  );

  async function voidRecord(id: number) {
    const r = store.state.results.find((x) => x.id === id);
    if (!r) return;
    const p = store.state.people.find((x) => x.id === r.personId)!;
    const q = prizeById(store.state, r.prizeId)!;
    const reason = await confirmStore.ask(
      '作廢此筆得獎？',
      q.name + '｜' + p.name + '（' + p.id + '）\n\n作廢後會保留原紀錄並釋出名額。此人不會重新加入後續抽選，且無法在本介面復原。',
      { input: true, ok: '記錄作廢，釋出名額', danger: true },
    );
    if (!reason || typeof reason !== 'string') return;
    try {
      store.voidWinner(id, reason);
      toastStore.push('已作廢並保留紀錄。請回到該獎項，補抽釋出的名額。');
    } catch (e) {
      toastStore.showError(e);
    }
  }
</script>

<dialog bind:this={dialogEl} class:confirm-hidden={hiddenByConfirm} onclose={close} oncancel={close}>
  <h2>得獎紀錄</h2>
  <div class="history-count">
    <span>有效 {validCount} 位</span>
    <span>已作廢 {voidCount} 位</span>
    <span>總紀錄 {store.state.results.length} 筆</span>
  </div>
  <div class="history-top">
    <input class="search" placeholder="搜尋姓名、編號、部門或獎項" bind:value={query} />
    <button class="btn small" onclick={() => store.exportResults()}>匯出 Excel</button>
  </div>
  <div class="table-wrap">
    {#if matches.length}
      <table>
        <thead><tr><th>序號</th><th>獎項</th><th>得獎者</th><th>部門</th><th>狀態／操作</th></tr></thead>
        <tbody>
          {#each matches as r (r.id)}
            {@const p = store.state.people.find((x) => x.id === r.personId)}
            {@const q = prizeById(store.state, r.prizeId)}
            <tr class:muted-row={r.status === 'void'}>
              <td>{r.id}</td>
              <td>{q?.name}</td>
              <td>{p?.name}<br /><span class="subtle">{p?.id}</span></td>
              <td>{p?.dept}</td>
              <td>
                {#if r.status === 'valid'}
                  <button class="btn small danger" onclick={() => voidRecord(r.id)}>作廢／補抽</button>
                {:else}
                  已作廢<br /><span class="subtle">{r.voidReason}</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <div class="notice">目前沒有符合的開獎紀錄。</div>
    {/if}
  </div>
  <div class="notice">作廢不會刪除原紀錄，並會釋出該獎名額。已作廢人員仍排除於後續抽選，請填寫理由後再補抽。</div>
  <p class="subtle">已顯示最近 200 筆符合紀錄；完整資料請匯出。</p>
  <div class="actions">
    <button class="btn solid" onclick={close}>關閉</button>
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
    max-width: 640px;
    width: calc(100% - 32px);
    background: var(--bg-elevated);
    color: var(--text);
  }
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.55);
  }
  .history-count {
    display: flex;
    gap: 16px;
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .history-top {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }
  .search {
    flex: 1;
  }
  .table-wrap {
    max-height: 320px;
    overflow: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th,
  td {
    text-align: left;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  tr.muted-row {
    opacity: 0.55;
  }
  .subtle {
    font-size: 10px;
    color: var(--text-muted);
  }
  .notice {
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
    margin-top: 8px;
  }
  .btn {
    cursor: pointer;
    padding: 6px 14px;
    border-radius: 8px;
    border: 1px solid var(--border-strong);
    background: transparent;
    color: inherit;
  }
  .btn.small {
    padding: 4px 10px;
    font-size: 12px;
  }
  .btn.solid {
    background: linear-gradient(135deg, var(--accent), var(--accent-strong));
    border-color: var(--accent-strong);
    color: #16211d;
    font-weight: 600;
  }
  .btn.danger {
    border-color: var(--danger-border);
    color: var(--danger);
  }
</style>
