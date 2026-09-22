<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { store } from './store.svelte.js';
  import { toastStore } from './lib/toast.svelte.js';
  import Sidebar from './components/Sidebar.svelte';
  import Stage from './components/Stage.svelte';
  import ImportDialog from './components/ImportDialog.svelte';
  import RestoreDialog from './components/RestoreDialog.svelte';
  import SettingsDialog from './components/SettingsDialog.svelte';
  import HistoryDialog from './components/HistoryDialog.svelte';
  import ConfirmDialog from './components/ConfirmDialog.svelte';
  import Toasts from './components/Toasts.svelte';

  let settingsOpen = $state(false);
  let historyOpen = $state(false);
  let presentation = $state(false);
  let sidebarOpen = $state(true);

  onMount(() => {
    store.init();
    setTimeout(() => {
      if (store.state.results.length || store.state.lastBatchId) {
        toastStore.push('已恢復此瀏覽器的上次活動；請核對名單與得獎紀錄後繼續。', false, 7000);
      }
    }, 700);

    document.title = store.state.settings.title + '｜幸運抽獎';

    function onKeydown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      const dialogOpen = document.querySelector('dialog[open]') !== null;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || dialogOpen || inField) return;
      if (e.code === 'Space') {
        e.preventDefault();
        store.drawAction();
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        togglePanel();
      } else if (store.phase === 'revealed' && e.key === 'ArrowRight') {
        store.nextWinnerPage();
      } else if (store.phase === 'revealed' && e.key === 'ArrowLeft') {
        store.prevWinnerPage();
      }
    }

    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (store.state.results.length || store.phase === 'spinning' || store.phase === 'slowing') {
        e.preventDefault();
        e.returnValue = '';
      }
    }

    window.addEventListener('keydown', onKeydown);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('keydown', onKeydown);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  });

  onDestroy(() => store.dispose());

  $effect(() => {
    document.title = store.state.settings.title + '｜幸運抽獎';
  });

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else toastStore.push('此瀏覽器未提供全螢幕功能，請改用電腦 Chrome／Edge。', true);
    } catch {
      toastStore.showError(new Error('瀏覽器未允許全螢幕。請用電腦直接開啟 HTML，或按瀏覽器的 F11。'));
    }
  }

  function togglePanel() {
    if (innerWidth <= 760) sidebarOpen = !sidebarOpen;
    else presentation = !presentation;
  }
</script>

<div class="app" class:presentation>
  <header>
    <div class="brand"><span class="brand-mark">FD</span>FairDraw</div>
    <div class="title-block">
      <h1>{store.state.settings.title}</h1>
      <p>{store.state.settings.subtitle}</p>
    </div>
    <div class="mode-badge" class:live={!store.state.isDemo}>
      <i class="dot"></i>{store.state.isDemo ? '示範模式 · 非正式名單' : '正式名單 · 本機離線'}
    </div>
  </header>

  {#if store.foreignChange}
    <div class="storage-warning">偵測到其他視窗的資料異動；請停止操作並重新整理核對。</div>
  {:else if !store.storageOkay}
    <div class="storage-warning">無法保存本機暫存，請立即備份，不要關閉視窗。</div>
  {/if}

  <div class="toolbar">
    <div class="toolbar-group">
      <ImportDialog />
      <RestoreDialog />
      <button onclick={() => store.downloadTemplate()}>下載範本</button>
    </div>
    <div class="toolbar-group">
      <button onclick={() => store.backup()} disabled={store.busy()}>備份進度</button>
      {#if store.backupAdapter.isSupported}
        {#if store.continuousBackupEnabled}
          <button class="active" onclick={() => store.disableContinuousBackup()}><i class="dot"></i>自動備份已啟用</button>
        {:else}
          <button onclick={() => store.enableContinuousBackup()} disabled={store.busy()}>設定自動備份檔</button>
        {/if}
      {/if}
      <button onclick={() => store.exportResults()} disabled={store.busy()}>匯出結果</button>
    </div>
    <div class="toolbar-group">
      <button onclick={() => (historyOpen = true)} disabled={store.busy()}>得獎紀錄</button>
      <button onclick={() => (settingsOpen = true)} disabled={store.busy()}>活動設定</button>
    </div>
    <div class="toolbar-group toolbar-group-end">
      <button class="icon-btn" title={store.state.settings.sound ? '音效已開啟，按一下靜音' : '音效已關閉，按一下開啟'} onclick={() => store.toggleSound()}>{store.state.settings.sound ? '🔊' : '🔈'}</button>
      <button class="icon-btn" title="全螢幕（F）" onclick={toggleFullscreen}>⛶</button>
      <button class="icon-btn" title="舞台模式（H）" onclick={togglePanel}>▤</button>
    </div>
  </div>

  <div class="layout">
    {#if sidebarOpen}<Sidebar />{/if}
    <Stage />
  </div>
</div>

<SettingsDialog bind:open={settingsOpen} />
<HistoryDialog bind:open={historyOpen} />
<ConfirmDialog />
<Toasts />

<style>
  :global(:root) {
    --bg: #0d1512;
    --bg-elevated: #16211f;
    --bg-elevated-2: #1c2a27;
    --border: #263631;
    --border-strong: #3a4c46;
    --text: #eaf2ec;
    --text-muted: #a3b5ac;
    --accent: #e3c383;
    --accent-strong: #c99a53;
    --accent-soft: rgba(227, 195, 131, 0.14);
    --danger: #e9a5a5;
    --danger-bg: #3a1f1f;
    --danger-border: #6e2f2f;
    --live: #9cd8bd;
    --live-bg: #15332b;
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 20px;
    --shadow-md: 0 12px 32px rgba(0, 0, 0, 0.35);
    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-5: 24px;
  }
  :global(html) {
    color-scheme: dark;
    height: 100%;
  }
  :global(body) {
    margin: 0;
    height: 100%;
    background: var(--bg);
    color: var(--text);
    font-family: system-ui, 'Microsoft JhengHei', sans-serif;
  }
  :global(button) {
    font-family: inherit;
  }
  :global(input[type='text']),
  :global(input[type='number']),
  :global(textarea) {
    background: var(--bg-elevated);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    color: var(--text);
    padding: 7px 10px;
    font-size: 13px;
    font-family: inherit;
  }
  :global(input[type='text']:focus),
  :global(input[type='number']:focus),
  :global(textarea:focus) {
    outline: none;
    border-color: var(--accent);
  }
  :global(input[type='checkbox']) {
    accent-color: var(--accent);
    width: 16px;
    height: 16px;
  }
  .app {
    height: 100dvh;
    box-sizing: border-box;
    overflow-y: auto;
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    max-width: 1400px;
    margin: 0 auto;
  }
  header {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--accent);
    flex-shrink: 0;
  }
  .brand-mark {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    background: var(--accent-soft);
    border: 1px solid var(--border-strong);
    font-size: 11px;
    letter-spacing: 0;
  }
  .title-block {
    border-left: 1px solid var(--border-strong);
    padding-left: var(--space-4);
  }
  .title-block h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }
  .title-block p {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--text-muted);
  }
  .mode-badge {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 11px;
    padding: 5px 12px;
    border-radius: 999px;
    background: var(--danger-bg);
    color: #e9d09a;
    flex-shrink: 0;
  }
  .mode-badge.live {
    background: var(--live-bg);
    color: var(--live);
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }
  .storage-warning {
    background: var(--danger-bg);
    color: #f2c9c9;
    padding: var(--space-3) var(--space-3);
    border-radius: var(--radius-sm);
    font-size: 12px;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .toolbar-group {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-1);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .toolbar-group-end {
    margin-left: auto;
  }
  .toolbar button,
  .toolbar :global(button) {
    cursor: pointer;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text);
    font-size: 13px;
    transition: background-color 0.15s, border-color 0.15s;
  }
  .toolbar button:hover:not(:disabled),
  .toolbar :global(button:hover:not(:disabled)) {
    background: var(--bg-elevated-2);
    border-color: var(--border-strong);
  }
  .toolbar button.active {
    color: var(--live);
  }
  .toolbar .icon-btn {
    font-size: 15px;
    line-height: 1;
    padding: 6px 10px;
  }
  .toolbar button:disabled,
  .toolbar :global(button:disabled) {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .layout {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: var(--space-5);
  }
  .app.presentation .layout > :global(.sidebar) {
    display: none;
  }

  @media (max-width: 760px) {
    .app {
      padding: var(--space-3);
    }
    header {
      flex-wrap: wrap;
    }
    .title-block {
      border-left: none;
      padding-left: 0;
    }
    .mode-badge {
      margin-left: 0;
    }
    .layout {
      flex-direction: column;
    }
    .toolbar-group-end {
      margin-left: 0;
    }
  }
</style>
