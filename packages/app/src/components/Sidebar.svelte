<script lang="ts">
  import { store } from '../store.svelte.js';
  import { validResults } from '@fairdraw/core';

  const locked = $derived(store.busy());
</script>

<aside class="sidebar">
  <h2>獎項</h2>
  <ul>
    {#each store.state.prizes as prize, i (prize.id)}
      {@const won = validResults(store.state, prize.id).length}
      {@const active = prize.id === store.state.selectedPrize}
      <li>
        <button class="prize" class:selected={active} disabled={locked} onclick={() => store.selectPrize(prize.id)}>
          <span class="top">
            <span class="num">{String(i + 1).padStart(2, '0')}</span>
            <span class="status">{won >= prize.quantity ? '已完成' : active ? '目前獎項' : '待抽出'}</span>
          </span>
          <span class="name">{prize.name}</span>
          <span class="desc">{prize.description || '一起迎接幸運時刻'}</span>
          <span class="progress">
            <span>得獎名額</span>
            <strong>{won} / {prize.quantity} 位</strong>
          </span>
          <span class="track"><i style={`width:${(won / prize.quantity) * 100}%`}></i></span>
        </button>
      </li>
    {/each}
  </ul>
</aside>

<style>
  .sidebar {
    width: 260px;
    flex-shrink: 0;
    min-height: 0;
    overflow-y: auto;
  }
  .sidebar h2 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-muted);
    margin: 0 0 var(--space-3);
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .prize {
    width: 100%;
    text-align: left;
    cursor: pointer;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    color: inherit;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    transition: border-color 0.15s, background-color 0.15s, transform 0.15s;
  }
  .prize:hover:not(:disabled) {
    border-color: var(--border-strong);
    transform: translateY(-1px);
  }
  .prize.selected {
    border-color: var(--accent);
    background: var(--bg-elevated-2);
    box-shadow: 0 0 0 1px var(--accent-soft);
  }
  .prize:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  .top {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-muted);
  }
  .name {
    font-size: 16px;
    font-weight: 600;
  }
  .desc {
    font-size: 12px;
    color: var(--text-muted);
  }
  .progress {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    margin-top: 2px;
  }
  .track {
    height: 4px;
    background: var(--border);
    border-radius: 999px;
    overflow: hidden;
  }
  .track i {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--accent-strong), var(--accent));
    transition: width 0.3s ease;
  }

  @media (max-width: 760px) {
    .sidebar {
      width: 100%;
    }
    ul {
      flex-direction: row;
      overflow-x: auto;
      padding-bottom: var(--space-1);
    }
    .prize {
      min-width: 220px;
    }
  }
</style>
