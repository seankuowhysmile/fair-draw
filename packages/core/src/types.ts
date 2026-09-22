export type Cell = string | number | boolean | null | undefined;
export type Row = Cell[];
export type Table = Row[];
export type Tables = Record<string, Table | undefined>;

export interface Person {
  id: string;
  name: string;
  dept: string;
  active: boolean;
}

export interface Prize {
  id: string;
  order: number;
  name: string;
  description: string;
  quantity: number;
  batch: number;
}

export interface Settings {
  title: string;
  subtitle: string;
  allowRepeat: boolean;
  sound: boolean;
  showDept: boolean;
  showId: boolean;
}

export type ResultStatus = 'valid' | 'void';

export interface WinnerRecord {
  id: number;
  batchId: string;
  prizeId: string;
  personId: string;
  drawnAt: string;
  eligibleCount: number;
  batchSize: number;
  status: ResultStatus;
  voidReason: string;
  voidAt: string;
}

export interface AuditEntry {
  at: string;
  action: string;
  detail: string;
}

export interface ParsedEvent {
  people: Person[];
  prizes: Prize[];
  settings: Settings;
  isDemo: boolean;
  sourceName: string;
  warnings: string[];
  active: number;
  total: number;
}

export interface EventState {
  version: number;
  eventId: string;
  revision: number;
  createdAt: string;
  sourceName: string;
  isDemo: boolean;
  settings: Settings;
  people: Person[];
  prizes: Prize[];
  selectedPrize: string;
  results: WinnerRecord[];
  lastBatchId: string | null;
  audit: AuditEntry[];
}

export type RandomInt = (max: number) => number;
