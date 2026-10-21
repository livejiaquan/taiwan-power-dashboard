import { Ban, CircleCheck, OctagonAlert, Siren, TriangleAlert } from 'lucide-react';

// Taipower's five official reserve lights. Each level pairs a colour with a
// distinct icon shape and text so the status never depends on colour alone.
export const RESERVE_LEVELS = [
  { code: 'G', name: '綠燈', label: '供電充裕', rule: '備轉容量率 ≥ 10%', icon: CircleCheck, token: 'g' },
  { code: 'Y', name: '黃燈', label: '供電吃緊', rule: '6% < 備轉容量率 < 10%', icon: TriangleAlert, token: 'y' },
  { code: 'O', name: '橘燈', label: '供電警戒', rule: '備轉容量率 ≤ 6%', icon: OctagonAlert, token: 'o' },
  { code: 'R', name: '紅燈', label: '限電警戒', rule: '備轉容量 ≤ 90 萬瓩（900 MW）', icon: Siren, token: 'r' },
  { code: 'B', name: '黑燈', label: '限電準備', rule: '備轉容量 ≤ 50 萬瓩（500 MW）', icon: Ban, token: 'b' }
];

export function levelFor(code) {
  return RESERVE_LEVELS.find((level) => level.code === code) || null;
}

export function statusSurface(token, muted = false) {
  const key = muted ? 'off' : token;
  return { background: `var(--status-${key}-bg)`, color: `var(--status-${key}-on)` };
}
