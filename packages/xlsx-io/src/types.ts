export type Cell = string | number;
export type Row = Cell[];
export type Table = Row[];
export type Tables = Record<string, Table>;

export interface SheetSpec {
  name: string;
  rows: Table;
  /** Column widths in Excel "characters" units. */
  widths?: number[];
}
