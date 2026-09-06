/**
 * project_style.json をそのまま Tailwind のテーマへ写したもの。
 * ここに無い色・フォントを UI ファイルへ直書きしないこと。
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/index.html',
    './src/renderer/finder.html',
    './src/renderer/drawing.html',
    './src/renderer/pointer.html',
    './src/renderer/src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        base: {
          DEFAULT: '#0b0f19',
          alt: '#060d18',
          deep: '#040812'
        },
        tally: {
          rec: '#f43f5e',
          pause: '#f59e0b'
        },
        // 保存先フォルダのアイコン専用。警告の amber とは役割が別。
        folder: '#fbbf24'
      },
      fontFamily: {
        // 欧文グロテスク + 和文グロテスクの混植。順序を入れ替えると和文がぶら下がりで崩れる。
        display: ['"Archivo Variable"', '"IBM Plex Sans JP"', 'sans-serif'],
        sans: ['"Archivo Variable"', '"IBM Plex Sans JP"', 'sans-serif'],
        mono: ['"Chivo Mono"', 'ui-monospace', 'monospace']
      },
      fontSize: {
        // ウィンドウリサイズにガクつかず追従させるための流体スケール
        'fluid-2xs': ['clamp(0.6875rem, 0.64rem + 0.18vw, 0.75rem)', { lineHeight: '1.35' }],
        'fluid-xs': ['clamp(0.75rem, 0.68rem + 0.3vw, 0.875rem)', { lineHeight: '1.45' }],
        'fluid-sm': ['clamp(0.8125rem, 0.74rem + 0.32vw, 0.9375rem)', { lineHeight: '1.5' }],
        'fluid-base': ['clamp(0.9375rem, 0.86rem + 0.36vw, 1.0625rem)', { lineHeight: '1.55' }],
        'fluid-lg': ['clamp(1.125rem, 1rem + 0.55vw, 1.375rem)', { lineHeight: '1.3' }],
        'fluid-timecode': ['clamp(1.5rem, 1.15rem + 1.6vw, 2.25rem)', { lineHeight: '1' }]
      },
      letterSpacing: {
        widestest: '0.18em'
      },
      boxShadow: {
        'accent-glow': '0 0 15px rgba(20,184,166,0.2)',
        'tally-glow': '0 0 12px rgba(244,63,94,0.55)',
        'inset-well': 'inset 0 1px 3px rgba(0,0,0,0.5)',
        panel:
          'inset 0 1px 0 0 rgba(255,255,255,0.03), 0 8px 24px -12px rgba(0,0,0,0.8)'
      },
      backgroundImage: {
        'accent-gradient':
          'linear-gradient(135deg, theme(colors.teal.600), theme(colors.emerald.600) 55%, theme(colors.emerald.700))'
      },
      keyframes: {
        // 矩形波の点滅は安っぽいので使わない。呼吸で存在を主張させる。
        'tally-breathe': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 12px rgba(244,63,94,0.55)' },
          '50%': { opacity: '0.45', boxShadow: '0 0 4px rgba(244,63,94,0.25)' }
        }
      },
      animation: {
        'tally-breathe': 'tally-breathe 1.6s ease-in-out infinite'
      }
    }
  },
  plugins: []
}
