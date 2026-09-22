<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { store, reducedMotion } from '../store.svelte.js';
  import { NameGlobe } from '../lib/nameGlobe.js';
  import { fireConfetti } from '../lib/confetti.js';
  import { fmt } from '../lib/format.js';

  let stageEl: HTMLElement;
  let heroEl: HTMLElement;
  let controlsEl: HTMLElement;
  let canvasEl: HTMLCanvasElement;
  let fxCanvasEl: HTMLCanvasElement;
  let globe: NameGlobe | null = null;

  const prize = $derived(store.selected());
  const remain = $derived(store.remainingCount());
  const pool = $derived(store.eligiblePeople());
  const locked = $derived(store.busy());

  const records = $derived(store.currentBatchRecords());
  const perPage = $derived(store.winnerPerPage());
  const pages = $derived(store.winnerPages());
  const page = $derived(records.slice(store.winnerPage * perPage, (store.winnerPage + 1) * perPage));

  let hint = $derived.by(() => {
    if (store.phase === 'spinning') return '姓名球旋轉中，按停止即可揭曉';
    if (store.phase === 'slowing') return '幸運名單已鎖定，正在揭曉';
    if (store.phase === 'revealed') return '本輪 ' + records.length + ' 位得獎者 · 結果已記錄';
    if (remain === 0) return store.state.prizes.every((q) => store.remainingCount(q.id) === 0) ? '全部獎項已完成，請匯出得獎名單' : '請從側欄選擇下一個獎項';
    if (pool.length === 0) return '名額尚未抽完，但符合資格的人員已用盡';
    return '本獎剩餘 ' + fmt(remain) + ' 位 · 可抽人數 ' + fmt(pool.length) + ' 人';
  });

  let buttonLabel = $derived.by(() => {
    if (store.phase === 'spinning') return '停止・揭曉';
    if (store.phase === 'slowing') return '揭曉中…';
    if (store.phase === 'revealed') {
      if (store.state.prizes.every((q) => store.remainingCount(q.id) === 0)) return '完成本輪';
      return remain ? '繼續抽獎' : '下一個獎項';
    }
    if (remain === 0) return '此獎項已抽完';
    if (pool.length === 0) return '沒有可抽人員';
    return '開始抽獎';
  });

  const buttonDisabled = $derived(store.loading || store.foreignChange || store.phase === 'slowing' || (store.phase === 'idle' && (remain === 0 || pool.length === 0)));
  const allDone = $derived(store.state.prizes.every((q) => store.remainingCount(q.id) === 0));

  onMount(() => {
    globe = new NameGlobe(canvasEl, {
      getPhase: () => store.phase,
      reducedMotion,
      getBounds: () => {
        const canvasRect = canvasEl.getBoundingClientRect();
        return {
          top: heroEl.getBoundingClientRect().bottom - canvasRect.top + 10,
          bottom: controlsEl.getBoundingClientRect().top - canvasRect.top - 13,
        };
      },
    });
  });

  onDestroy(() => globe?.destroy());

  $effect(() => {
    globe?.setPool(pool.length ? pool : store.state.people.filter((p) => p.active));
  });

  let lastPhase = store.phase;
  $effect(() => {
    if (store.phase === 'revealed' && lastPhase !== 'revealed') {
      fireConfetti(fxCanvasEl, stageEl.getBoundingClientRect(), reducedMotion);
    }
    lastPhase = store.phase;
  });

  function onDraw() {
    store.drawAction();
  }
</script>

<section class="stage" class:revealed={store.phase === 'revealed'} bind:this={stageEl}>
  <canvas class="globe" bind:this={canvasEl}></canvas>

  <div class="hero" bind:this={heroEl}>
    <p class="eyebrow">{store.phase === 'revealed' ? 'CONGRATULATIONS' : store.phase === 'spinning' ? 'THE MOMENT IS YOURS' : 'YOUR LUCKY MOMENT'}</p>
    <h2>{prize.name}</h2>
    {#if prize.description}<p class="desc">{prize.description}</p>{/if}
  </div>

  {#if store.phase === 'revealed'}
    <div class="winners" class:single={page.length === 1} class:many={page.length > 6}>
      {#each page as winner, i (winner.id)}
        {@const p = store.state.people.find((x) => x.id === winner.personId)}
        <article class="winner-card" class:void={winner.status === 'void'} style={`--delay:${Math.min(i * 0.08, 0.65)}s`}>
          <span class="index">WINNER {String(store.winnerPage * perPage + i + 1).padStart(2, '0')}{winner.status === 'void' ? ' · 已作廢' : ''}</span>
          <h3>{p?.name}</h3>
          {#if store.state.settings.showDept && p?.dept}<div class="dept">{p.dept}</div>{/if}
          {#if store.state.settings.showId}<div class="person-id">{p?.id}</div>{/if}
        </article>
      {/each}
    </div>
    {#if pages > 1}
      <div class="pagination">
        <button class="btn small" disabled={store.winnerPage === 0} onclick={() => store.prevWinnerPage()}>← 上一頁</button>
        <span>第 {store.winnerPage + 1} / {pages} 頁 · 共 {records.length} 位</span>
        <button class="btn small" disabled={store.winnerPage === pages - 1} onclick={() => store.nextWinnerPage()}>下一頁 →</button>
      </div>
    {/if}
  {/if}

  <div class="controls" bind:this={controlsEl}>
    {#if store.phase === 'idle' && allDone}
      <div class="completed">
        <p class="completed-title">🎉 全部獎項已完成</p>
        <p class="completed-sub">所有名額都已抽出，記得匯出得獎名單並保存備份。</p>
        <div class="completed-actions">
          <button class="btn-export" onclick={() => store.exportResults()}>匯出得獎結果</button>
          <button class="btn-export secondary" onclick={() => store.backup()}>備份進度</button>
        </div>
      </div>
    {:else}
      {#if store.phase !== 'revealed'}
        <label class="batch-wrap">
          本輪抽出人數
          <input type="number" min="1" max={Math.min(remain, pool.length) || 1} disabled={locked || remain === 0} bind:value={store.batchInput} />
        </label>
      {/if}
      <button class="draw-btn" class:spinning={store.phase === 'spinning'} disabled={buttonDisabled} onclick={onDraw}>{buttonLabel}</button>
      <p class="hint">{hint}</p>
    {/if}
  </div>

  <canvas class="fx-overlay" bind:this={fxCanvasEl}></canvas>
</section>

<style>
  .stage {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-lg);
    background:
      radial-gradient(ellipse at 50% 15%, var(--accent-soft), transparent 60%),
      radial-gradient(ellipse at 50% 20%, var(--bg-elevated-2), #0a1210);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-md);
    overflow: hidden;
    padding: var(--space-4);
  }
  .hero {
    position: relative;
    z-index: 1;
    text-align: center;
    flex-shrink: 0;
    pointer-events: none;
  }
  .eyebrow {
    letter-spacing: 0.35em;
    font-size: 11px;
    color: var(--accent);
    text-transform: uppercase;
    opacity: 0.9;
  }
  .hero h2 {
    margin: var(--space-1) 0;
    font-size: clamp(22px, 3.4vw, 36px);
    font-weight: 700;
    background: linear-gradient(180deg, #fff, var(--text) 60%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .desc {
    color: var(--text-muted);
    font-size: 13px;
  }
  .globe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
  }
  .controls {
    position: relative;
    z-index: 2;
    flex-shrink: 0;
    margin-top: auto;
    text-align: center;
    padding-top: var(--space-1);
  }
  .batch-wrap {
    display: block;
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: var(--space-1);
  }
  .batch-wrap input {
    display: block;
    margin: 2px auto 0;
    width: 80px;
    text-align: center;
    background: var(--bg-elevated);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    color: var(--text);
    padding: 4px;
  }
  .draw-btn {
    cursor: pointer;
    padding: 12px 40px;
    border-radius: 999px;
    border: none;
    background: linear-gradient(135deg, var(--accent), var(--accent-strong));
    color: #16211d;
    font-weight: 700;
    font-size: 16px;
    letter-spacing: 0.02em;
    box-shadow: 0 8px 24px rgba(227, 195, 131, 0.25);
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .draw-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 10px 28px rgba(227, 195, 131, 0.35);
  }
  .draw-btn:active:not(:disabled) {
    transform: translateY(0);
  }
  .draw-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    box-shadow: none;
  }
  .draw-btn.spinning {
    animation: pulse 0.8s infinite alternate;
  }
  @keyframes pulse {
    from {
      transform: scale(1);
      box-shadow: 0 8px 24px rgba(227, 195, 131, 0.25);
    }
    to {
      transform: scale(1.045);
      box-shadow: 0 12px 32px rgba(227, 195, 131, 0.4);
    }
  }
  .hint {
    margin-top: var(--space-1);
    font-size: 12px;
    color: var(--text-muted);
  }
  .completed {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }
  .completed-title {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: var(--accent);
  }
  .completed-sub {
    margin: 0;
    font-size: 13px;
    color: var(--text-muted);
  }
  .completed-actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-1);
  }
  .btn-export {
    cursor: pointer;
    padding: 10px 28px;
    border-radius: 999px;
    border: none;
    background: linear-gradient(135deg, var(--accent), var(--accent-strong));
    color: #16211d;
    font-weight: 700;
    font-size: 14px;
  }
  .btn-export.secondary {
    background: transparent;
    border: 1px solid var(--border-strong);
    color: var(--text);
    font-weight: 500;
  }
  .winners {
    position: absolute;
    inset: 0;
    display: flex;
    flex-wrap: wrap;
    align-content: center;
    justify-content: center;
    gap: var(--space-4);
    padding: 32px;
    background: rgba(8, 14, 12, 0.92);
    backdrop-filter: blur(2px);
  }
  .winner-card {
    background: linear-gradient(160deg, var(--bg-elevated-2), var(--bg-elevated));
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    padding: 20px 24px;
    min-width: 170px;
    text-align: center;
    box-shadow: var(--shadow-md);
    animation: rise 0.4s ease both;
    animation-delay: var(--delay, 0s);
  }
  .winner-card.void {
    opacity: 0.5;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  .index {
    font-size: 10px;
    letter-spacing: 0.15em;
    color: var(--accent);
  }
  .winner-card h3 {
    margin: 8px 0 4px;
    font-size: 22px;
    font-weight: 700;
  }
  .dept,
  .person-id {
    font-size: 11px;
    color: var(--text-muted);
  }
  .pagination {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: var(--space-3);
    align-items: center;
    font-size: 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-strong);
    padding: 6px 14px;
    border-radius: 999px;
  }
  .btn.small {
    cursor: pointer;
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-strong);
    background: transparent;
    color: inherit;
  }
  .btn.small:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .fx-overlay {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 40;
  }

  @media (max-width: 760px) {
    .stage {
      min-height: 420px;
      padding: var(--space-4);
    }
    .draw-btn {
      padding: 12px 28px;
      font-size: 14px;
    }
    .winner-card {
      min-width: 140px;
      padding: 16px;
    }
  }
</style>
