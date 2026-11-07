// Luvdex design tokens. See LUVDEX_PLAN.md section 3.1.
export const colors = {
  luvRed: '#E23A4E', // device shell, primary buttons
  deepShell: '#9E1B32', // shadows, headers, page background
  screenMint: '#D8F3E3', // LCD screen panels
  screenEdge: '#A9D9BE', // screen border
  ink: '#1E2230', // text
  inkSoft: '#4A5064', // secondary text
  lensPink: '#FF7AA8', // "in range" glow, hearts
  sparkYellow: '#FFD34E', // highlights, badges
  cream: '#FFF8EE', // light surfaces
  white: '#FFFFFF',
} as const;

export const fonts = {
  pixel: 'Silkscreen_400Regular', // small labels and numbers only
  pixelBold: 'Silkscreen_700Bold',
  body: 'Nunito_400Regular',
  bodySemi: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  bodyHeavy: 'Nunito_800ExtraBold',
} as const;
