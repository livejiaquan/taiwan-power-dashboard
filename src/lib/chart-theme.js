import { readToken } from './tokens.js';

export function chartTokens() {
  return {
    foreground: readToken('--foreground'),
    muted: readToken('--muted-foreground'),
    subtle: readToken('--subtle-foreground'),
    border: readToken('--border'),
    grid: readToken('--grid-line'),
    card: readToken('--card'),
    popover: readToken('--popover'),
    popoverForeground: readToken('--popover-foreground'),
    accent: readToken('--accent')
  };
}

export function tooltipStyle(tokens = chartTokens()) {
  return {
    backgroundColor: tokens.popover,
    borderColor: tokens.border,
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: tokens.popoverForeground, fontFamily: 'Barlow, "PingFang TC", "Noto Sans TC", sans-serif', fontSize: 12 },
    extraCssText: 'border-radius:10px;box-shadow:0 8px 24px rgb(0 0 0 / .14);'
  };
}

export const FONT_FAMILY = '"Barlow Semi Condensed", Barlow, "PingFang TC", "Noto Sans TC", sans-serif';
