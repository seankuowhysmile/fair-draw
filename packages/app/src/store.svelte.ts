import {
  createState,
  draw as coreDraw,
  eligible,
  parseTables,
  prizeById,
  remaining,
  validateState,
  validResults,
  voidResult as coreVoidResult,
  type EventState,
  type ParsedEvent,
  type Settings,
  type WinnerRecord,
} from '@fairdraw/core';
import { readWorkbook, writeWorkbook } from '@fairdraw/xlsx-io';
import { StageAudio } from './lib/audio.js';
import { WebFileSystemBackupAdapter, type BackupAdapter } from './lib/backupAdapter.js';
import { TEMPLATE_BASE64 } from './generated/template.js';
import { downloadBlob, fileStamp, dateText } from './lib/format.js';
import { demoTables } from './demoData.js';
import { loadPersisted, savePersisted, watchForeignChange } from './lib/persistence.js';
import { toastStore } from './lib/toast.svelte.js';

export type Phase = 'idle' | 'spinning' | 'slowing' | 'revealed';

const BACKUP_FORMAT = 'FAIRDRAW-BACKUP';
export const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function resultRows(state: EventState, records: WinnerRecord[]) {
  return [
    ['紀錄編號', '獎項', '獎品說明', '姓名', '人員編號', '部門', '抽出時間（台灣）', '狀態', '作廢理由', '作廢時間（台灣）', '抽獎輪次', '當輪合格人數', '當輪抽出人數'],
    ...records.map((r) => {
      const p = state.people.find((x) => x.id === r.personId)!;
      const q = prizeById(state, r.prizeId)!;
      return [
        r.id,
        q.name,
        q.description,
        p.name,
        p.id,
        p.dept,
        dateText(r.drawnAt),
        r.status === 'valid' ? '有效' : '已作廢',
        r.voidReason || '',
        r.voidAt ? dateText(r.voidAt) : '',
        r.batchId,
        r.eligibleCount,
        r.batchSize,
      ];
    }),
  ];
}

/**
 * The single owner of `EventState`. Every mutation goes through `@fairdraw/core`'s
 * validated functions (draw / voidResult / createState / validateState) — UI
 * components only ever call methods here, never touch `state` fields directly
 * except for the free-standing `selectedPrize`/settings assignments that core
 * itself treats as plain UI state.
 */
class DrawStore {
  state = $state<EventState>(this.recoverInitialState());
  phase = $state<Phase>('idle');
  loading = $state(false);
  foreignChange = $state(false);
  storageOkay = $state(true);
  winnerPage = $state(0);
  historyQuery = $state('');
  batchInput = $state(1);

  pendingImport = $state<ParsedEvent | null>(null);
  pendingImportError = $state<string | null>(null);
  pendingImportSource = $state('');
  pendingRestore = $state<EventState | null>(null);
  unreadableBackup: string | null = null;

  private stopWatching: (() => void) | null = null;
  private revealTimer: ReturnType<typeof setTimeout> | null = null;
  audio = new StageAudio(() => this.state.settings.sound);

  backupAdapter: BackupAdapter = new WebFileSystemBackupAdapter();
  continuousBackupEnabled = $state(false);

  private recoverInitialState(): EventState {
    let saved: unknown = null;
    try {
      saved = loadPersisted();
    } catch {
      this.storageOkay = false;
    }
    if (saved) {
      try {
        return validateState(saved);
      } catch (e) {
        this.unreadableBackup = JSON.stringify(saved);
        this.storageOkay = false;
        this.foreignChange = true;
        setTimeout(() => {
          toastStore.push('原暫存無法驗證，已停止抽獎以免覆寫資料。請先使用有效 JSON 備份還原。', true, 8500);
          toastStore.showError(e);
        }, 300);
        return createState(parseTables(demoTables()));
      }
    }
    return createState(parseTables(demoTables()));
  }

  init(): void {
    this.phase = this.state.lastBatchId ? 'revealed' : 'idle';
    this.setBatch();
    if (!this.foreignChange) this.persist();
    this.stopWatching = watchForeignChange(
      () => this.state,
      () => {
        this.foreignChange = true;
        this.audio.stop();
        toastStore.push('偵測到另一個抽獎視窗更新進度；請停止操作並重新整理核對。', true, 8500);
      },
    );
  }

  dispose(): void {
    this.stopWatching?.();
  }

  selected() {
    return prizeById(this.state, this.state.selectedPrize)!;
  }

  remainingCount(prizeId = this.state.selectedPrize) {
    return remaining(this.state, prizeId);
  }

  eligiblePeople(prizeId = this.state.selectedPrize) {
    return eligible(this.state, prizeId);
  }

  validResultsFor(prizeId?: string) {
    return validResults(this.state, prizeId);
  }

  busy(): boolean {
    return this.loading || this.phase === 'spinning' || this.phase === 'slowing';
  }

  desiredBatch(): number {
    const p = this.selected();
    return Math.max(1, Math.min(p.batch, this.remainingCount(p.id), this.eligiblePeople(p.id).length));
  }

  setBatch(): void {
    this.batchInput = this.desiredBatch();
  }

  checkFresh(): void {
    if (this.foreignChange) throw new Error('另一個抽獎視窗已變更進度。請關閉其他視窗後，重新整理並核對紀錄，避免重複抽獎。');
  }

  persist(): void {
    try {
      savePersisted(this.state);
      this.storageOkay = true;
    } catch {
      this.storageOkay = false;
      toastStore.push('無法保存本機暫存。結果仍在此視窗，請立即按「備份進度」，不要關閉視窗。', true, 8500);
    }
    this.syncContinuousBackup();
  }

  /** Fire-and-forget write to the user-picked backup file, on top of the localStorage autosave. */
  private syncContinuousBackup(): void {
    if (!this.continuousBackupEnabled || !this.backupAdapter.hasTarget()) return;
    this.backupAdapter.write(this.state).catch(() => {
      this.continuousBackupEnabled = false;
      toastStore.showError(new Error('自動寫入備份檔失敗，已停用自動備份。請改用「備份進度」手動下載，或重新設定自動備份檔案。'));
    });
  }

  async enableContinuousBackup(): Promise<void> {
    if (!this.backupAdapter.isSupported) {
      toastStore.showError(new Error('此瀏覽器不支援自動寫入備份檔，請改用「備份進度」手動下載。'));
      return;
    }
    try {
      await this.backupAdapter.pickTarget((this.state.isDemo ? '示範_' : '') + '抽獎自動備份.json');
      this.continuousBackupEnabled = true;
      await this.backupAdapter.write(this.state);
      toastStore.push('已設定自動備份檔案；之後每次開獎、作廢都會自動寫入這個檔案。');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      toastStore.showError(e);
    }
  }

  disableContinuousBackup(): void {
    this.continuousBackupEnabled = false;
    this.backupAdapter.clearTarget();
  }

  touch(action?: string, detail = ''): void {
    this.state.revision++;
    if (action) this.state.audit.push({ at: new Date().toISOString(), action, detail });
    this.persist();
  }

  selectPrize(id: string): void {
    if (this.busy()) return;
    try {
      this.checkFresh();
    } catch (e) {
      toastStore.showError(e);
      return;
    }
    if (!prizeById(this.state, id)) return;
    this.state.selectedPrize = id;
    this.state.lastBatchId = null;
    this.phase = 'idle';
    this.winnerPage = 0;
    this.touch();
    this.setBatch();
  }

  drawAction(): void {
    if (this.loading || this.foreignChange || this.phase === 'slowing') return;
    try {
      this.checkFresh();
      if (this.phase === 'revealed') {
        this.phase = 'idle';
        this.state.lastBatchId = null;
        if (this.remainingCount() === 0) {
          const index = this.state.prizes.findIndex((p) => p.id === this.state.selectedPrize);
          const ordered = [...this.state.prizes.slice(index + 1), ...this.state.prizes.slice(0, index + 1)];
          const next = ordered.find((p) => remaining(this.state, p.id) > 0);
          if (next) this.state.selectedPrize = next.id;
        }
        this.touch();
        this.setBatch();
        return;
      }
      if (this.phase === 'idle') {
        const n = this.batchInput;
        const pool = this.eligiblePeople();
        const remain = this.remainingCount();
        if (!Number.isInteger(n) || n < 1 || n > remain || n > pool.length)
          throw new Error('本輪人數必須介於 1～' + Math.min(remain, pool.length) + '，且不能超過剩餘名額。');
        if (!window.crypto?.getRandomValues) throw new Error('此瀏覽器缺少安全亂數功能，請改用電腦 Chrome 或 Edge。');
        this.phase = 'spinning';
        this.audio.start();
        return;
      }
      if (this.phase === 'spinning') {
        // The commit happens right here. The slowdown/reveal animation that follows never redraws.
        this.phase = 'slowing';
        this.audio.stop();
        const n = this.batchInput;
        coreDraw(this.state, this.state.selectedPrize, n);
        this.persist();
        const delay = reducedMotion ? 250 : 1900;
        this.revealTimer = setTimeout(() => {
          this.phase = 'revealed';
          this.winnerPage = 0;
          this.audio.celebrate();
          this.revealTimer = null;
        }, delay);
      }
    } catch (e) {
      this.audio.stop();
      if (this.phase === 'slowing' || this.phase === 'spinning') this.phase = 'idle';
      toastStore.showError(e);
    }
  }

  toggleSound(): void {
    try {
      this.checkFresh();
      this.state.settings = { ...this.state.settings, sound: !this.state.settings.sound };
      if (this.state.settings.sound && this.phase === 'spinning') this.audio.start();
      else if (!this.state.settings.sound) this.audio.stop();
      this.touch();
    } catch (e) {
      toastStore.showError(e);
    }
  }

  updateSettings(patch: Partial<Settings>): void {
    const locked = this.state.results.length > 0;
    const s = this.state.settings;
    if (locked && patch.allowRepeat !== undefined && patch.allowRepeat !== s.allowRepeat) throw new Error('開獎後不可更改中獎規則。');
    const next: Settings = { ...s, ...patch };
    if (!next.allowRepeat && this.state.prizes.reduce((n, p) => n + p.quantity, 0) > this.state.people.filter((p) => p.active).length)
      throw new Error('總得獎名額超過參加人數，無法設定每人限中一次。');
    this.checkFresh();
    this.state.settings = next;
    this.touch('變更活動顯示設定');
  }

  downloadTemplate(): void {
    const bytes = Uint8Array.from(atob(TEMPLATE_BASE64), (c) => c.charCodeAt(0));
    downloadBlob(bytes, '抽獎設定範本.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  backup(silent = false): void {
    const wrapper = { format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), state: this.state };
    downloadBlob(JSON.stringify(wrapper, null, 2), (this.state.isDemo ? '示範_' : '') + '抽獎進度_' + fileStamp() + '.json', 'application/json');
    if (!silent) toastStore.push('備份已交給瀏覽器下載。請確認下載檔存在；備份包含人員名單，請妥善保管。', false, 7000);
  }

  exportResults(): void {
    const valid = validResults(this.state);
    const timestamp = new Date().toISOString();
    const sheets = [
      { name: '有效得獎名單', rows: resultRows(this.state, valid), widths: [12, 18, 28, 18, 20, 20, 25, 12, 36, 25, 14, 18, 18] },
      { name: '全部開獎紀錄', rows: resultRows(this.state, this.state.results), widths: [12, 18, 28, 18, 20, 20, 25, 12, 36, 25, 14, 18, 18] },
      {
        name: '獎項進度',
        rows: [
          ['抽獎順序', '獎項名稱', '獎品說明', '總名額', '有效得獎', '剩餘名額', '已作廢名額'],
          ...this.state.prizes.map((p) => [
            p.order,
            p.name,
            p.description,
            p.quantity,
            validResults(this.state, p.id).length,
            remaining(this.state, p.id),
            this.state.results.filter((r) => r.prizeId === p.id && r.status === 'void').length,
          ]),
        ],
        widths: [12, 18, 28, 12, 12, 12, 14],
      },
      {
        name: '活動資訊',
        rows: [
          ['項目', '內容'],
          ['活動名稱', this.state.settings.title],
          ['活動副標', this.state.settings.subtitle],
          ['資料模式', this.state.isDemo ? '示範資料，不是正式抽獎' : '正式名單'],
          ['來源檔案', this.state.sourceName],
          ['活動識別碼', this.state.eventId],
          ['匯出時間（台灣）', dateText(timestamp)],
          ['符合參加資格', this.state.people.filter((p) => p.active).length],
          ['有效得獎名額', valid.length],
          ['中獎規則', this.state.settings.allowRepeat ? '可中不同獎項，同獎不重複' : '全活動每人限中一次'],
          ['抽選方式', 'Web Crypto getRandomValues + rejection sampling + 部分 Fisher-Yates'],
          ['作廢規則', '保留紀錄、釋出名額；已作廢人員排除於後續抽選。'],
          ['紀錄性質', '本機操作紀錄，不是防竄改公證或第三方認證。'],
        ],
        widths: [26, 75],
      },
      {
        name: '操作紀錄',
        rows: [['時間（台灣）', '操作', '說明'], ...this.state.audit.map((a) => [dateText(a.at), a.action, a.detail])],
        widths: [26, 22, 75],
      },
    ];
    downloadBlob(
      new Uint8Array(writeWorkbook(sheets)),
      (this.state.isDemo ? '示範_' : '') + '抽獎結果_' + fileStamp() + '.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    toastStore.push('已匯出 Excel：有效名單、全部紀錄、獎項進度、活動資訊及操作紀錄。');
  }

  async startImportFromFile(file: File | undefined): Promise<void> {
    if (!file || this.busy()) return;
    if (!/\.xlsx$/i.test(file.name)) return toastStore.showError(new Error('請選擇 .xlsx 格式；舊版 .xls 請先在 Excel 另存為 .xlsx。'));
    if (file.size > 10 * 1024 * 1024) return toastStore.showError(new Error('檔案超過 10 MB，請移除其他工作表、圖片及多餘格式。'));
    this.loading = true;
    toastStore.push('正在讀取 Excel，請稍候…', false, 2500);
    try {
      const tables = readWorkbook(await file.arrayBuffer());
      this.pendingImport = parseTables(tables, file.name);
      this.pendingImportSource = file.name;
      this.pendingImportError = null;
    } catch (e) {
      this.pendingImport = null;
      this.pendingImportError = e instanceof Error ? e.message : String(e);
    } finally {
      this.loading = false;
    }
  }

  confirmImport(): void {
    if (!this.pendingImport) return;
    this.checkFresh();
    if (this.state.results.length) this.backup(true);
    this.state = createState(this.pendingImport);
    const isDemo = this.state.isDemo;
    this.pendingImport = null;
    this.pendingImportError = null;
    this.phase = 'idle';
    this.foreignChange = false;
    this.setBatch();
    this.persist();
    toastStore.push(isDemo ? '已匯入範例資料。請勿將範例抽獎當作正式結果。' : '正式名單已匯入，可以開始抽獎。');
  }

  cancelImport(): void {
    this.pendingImport = null;
    this.pendingImportError = null;
  }

  async startRestoreFromFile(file: File | undefined): Promise<void> {
    if (!file || this.busy()) return;
    if (file.size > 20 * 1024 * 1024) return toastStore.showError(new Error('備份檔超過 20 MB。'));
    this.loading = true;
    try {
      const data = JSON.parse(await file.text());
      if (data.format !== BACKUP_FORMAT || data.version !== 1) throw new Error('不是此程式產生的 JSON 備份檔。');
      this.pendingRestore = validateState(data.state);
    } catch (e) {
      this.pendingRestore = null;
      toastStore.showError(e);
    } finally {
      this.loading = false;
    }
  }

  confirmRestore(fileName: string): void {
    if (!this.pendingRestore) return;
    if (!this.unreadableBackup) this.checkFresh();
    if (this.unreadableBackup) {
      downloadBlob(this.unreadableBackup, '原暫存_待檢查_' + fileStamp() + '.json', 'application/json');
      this.unreadableBackup = null;
    } else if (this.state.results.length) this.backup(true);
    this.state = this.pendingRestore;
    this.pendingRestore = null;
    this.foreignChange = false;
    this.phase = this.state.lastBatchId ? 'revealed' : 'idle';
    this.setBatch();
    this.touch('從檔案還原備份', fileName);
    toastStore.push('已還原備份。已抽出的得獎者不會重新抽選，請核對紀錄後繼續。', false, 6500);
  }

  cancelRestore(): void {
    this.pendingRestore = null;
  }

  resetEvent(): void {
    this.checkFresh();
    if (this.state.results.length) this.backup(true);
    this.state = createState({
      people: this.state.people,
      prizes: this.state.prizes,
      settings: this.state.settings,
      sourceName: this.state.sourceName,
      isDemo: this.state.isDemo,
    });
    this.phase = 'idle';
    this.setBatch();
    this.persist();
  }

  currentBatchRecords(): WinnerRecord[] {
    return this.state.results.filter((r) => r.batchId === this.state.lastBatchId);
  }

  winnerPerPage(): number {
    return innerWidth <= 760 ? (innerHeight >= 880 ? 6 : 4) : innerHeight >= 980 ? 12 : 8;
  }

  winnerPages(): number {
    return Math.max(1, Math.ceil(this.currentBatchRecords().length / this.winnerPerPage()));
  }

  nextWinnerPage(): void {
    this.winnerPage = Math.min(this.winnerPage + 1, this.winnerPages() - 1);
  }

  prevWinnerPage(): void {
    this.winnerPage = Math.max(this.winnerPage - 1, 0);
  }

  voidWinner(id: number, reason: string): void {
    this.checkFresh();
    coreVoidResult(this.state, id, reason);
    this.persist();
    this.setBatch();
  }
}

export const store = new DrawStore();
