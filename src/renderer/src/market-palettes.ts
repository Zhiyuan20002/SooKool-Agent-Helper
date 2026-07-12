import type { CSSProperties } from 'react'
import type { MarketPalette } from '@/types/ecosystem'

export interface MarketPaletteTone {
  color: string
  ink: string
}

export const MARKET_PALETTES: Record<MarketPalette, readonly MarketPaletteTone[]> = {
  memphis: [
    { color: '#E94F37', ink: '#8F281A' },
    { color: '#247BA0', ink: '#174E65' },
    { color: '#F6C445', ink: '#765900' },
    { color: '#F28BB3', ink: '#8D3D5C' },
    { color: '#27AE91', ink: '#176A58' },
    { color: '#171717', ink: '#171717' }
  ],
  macaron: [
    { color: '#A8D5BA', ink: '#4D745B' },
    { color: '#F3B6C6', ink: '#8C5363' },
    { color: '#B9D8F2', ink: '#4E708E' },
    { color: '#D7C3E8', ink: '#705B84' },
    { color: '#F6D98B', ink: '#7D671F' },
    { color: '#F2C2A2', ink: '#875A3E' }
  ],
  rococo: [
    { color: '#A8DADC', ink: '#4F7475' },
    { color: '#B8D8BA', ink: '#58725B' },
    { color: '#F4B6C2', ink: '#8D505D' },
    { color: '#FFF1D6', ink: '#806D47' },
    { color: '#C9B6E4', ink: '#66527F' },
    { color: '#C9A24D', ink: '#715719' }
  ],
  mondrian: [
    { color: '#D40920', ink: '#9C0718' },
    { color: '#1356A2', ink: '#0D407B' },
    { color: '#F7D842', ink: '#715D00' },
    { color: '#1B1B1B', ink: '#1B1B1B' },
    { color: '#B7B7B7', ink: '#555555' },
    { color: '#F5F3E8', ink: '#5D5A50' }
  ],
  morandi: [
    { color: '#A89F91', ink: '#5E574D' },
    { color: '#B6A58C', ink: '#665842' },
    { color: '#8F8A82', ink: '#4F4B45' },
    { color: '#C4B7A6', ink: '#6D6255' },
    { color: '#9AA3A0', ink: '#505B58' },
    { color: '#B49B95', ink: '#674F49' }
  ],
  matisse: [
    { color: '#1F4FA3', ink: '#173B7A' },
    { color: '#D7352A', ink: '#9D251D' },
    { color: '#F2C230', ink: '#745900' },
    { color: '#168B75', ink: '#0F6555' },
    { color: '#E86E2F', ink: '#A4471A' },
    { color: '#7B3FA1', ink: '#582B75' }
  ]
}

export function marketPaletteStyle(palette: MarketPalette): CSSProperties {
  return Object.fromEntries(
    MARKET_PALETTES[palette].flatMap((tone, index) => [
      [`--palette-color-${index}`, tone.color],
      [`--palette-ink-${index}`, tone.ink]
    ])
  ) as CSSProperties
}
