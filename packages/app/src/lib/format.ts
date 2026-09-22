export const fmt = (n: number): string => Number(n).toLocaleString('zh-TW');

export const dateText = (iso: string): string =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(iso));

export function fileStamp(): string {
  return dateText(new Date().toISOString()).replace(/[-: ]/g, '').slice(0, 14);
}

export function downloadBlob(data: BlobPart, name: string, mime?: string): void {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
