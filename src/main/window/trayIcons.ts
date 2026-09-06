/**
 * タスクトレイのアイコン。
 *
 * 画像をファイルとして持たず、ここへ PNG のまま埋め込んでいる。トレイのアイコンは
 * Main プロセスが読むもので、パッケージ後は asar の中に入る。asar 越しのファイル読み込みは
 * 経路の作り方ひとつで壊れるうえ、壊れても「アイコンが出ない」としか分からない。
 * 32×32 の丸が 2 枚だけなので、経路そのものを無くしてしまうほうが確実に映る。
 *
 * 色は project_style.json の tally_rec（#f43f5e）と tally_pause（#f59e0b）。
 * 撮っている間だけ赤、待機中は黄で、録画機材のタリーランプと同じ読み方をさせる。
 */

/** 定期キャプチャーの実行中。 */
export const TRAY_ICON_ACTIVE =
  'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJ' +
  'cEhZcwAADsMAAA7DAcdvqGQAAAN6SURBVFhH7VfdSxRRFDeKoogoioqgKAgKxSjKPlx1crMswTXJxY9dd9Vc03QV' +
  'pBVJTVM0d9VVULbUXW0jRHqIHnqth/6CnnroJQhffNF0587MGnTjDK7dObPuzkz51g9+D7Pc+Z2Pe86Zsykp/2EQ' +
  '36+W7F7krHtjhGd85p+CptBtNKvigGCqPBHJqUiPZDnOxeMy5zy5klF5kFqt27GGYYDgapYtFRtLSJMjbZUrPwSO' +
  'Yz3NgCh+cPbTKnEdXMm0naGp1p1YOyngJYlznsWC/M3a82JfwEz8L1vE4dm+GNdGwp6f3uAN3uK+gN+BbECdYBub' +
  'AiKPZ3ytYyJH7J+cE1xPFkixm5LChj+820SFms5FsWf8ndQ7UYDfBSd+3XbvwrZUgDvDaYeoxOFZt/jw6Vc+r4by' +
  'nGNzmqspX9u1IAzNdJIyzyVWB4JKWpxQONi4MDA5FSlujqqMJSCxNFLSNT5PqtozWD2SWXMM29wARI+rHSLXa3zD' +
  'icIGCvXB6kELU657B7YtA9qNPSzfOaQ9jrhWEnvbkjQYKlFklXMexbZliNn2UxuHoNr7J+eS3nky5jqp1Db8ibi6' +
  'rsS0oTWxbbny2QkHLQVVrRI0wEhpazQ6+rqUzYKqI+jFuj2K9I+EPdBaWMwIyZ06KgyFxhQOXLbtUzgAP7AHJG8w' +
  'wOe7VGKGmOukgjf4ltWHblM4gAtQ9E2/+uv7Zyh4p96z+hHz/SMKB5Y5535FBnzBIH+rViVklCoHrtkPKxyAWc0e' +
  'kCeZpVElZIj5LgpXyupDwAoHYDgoMuAPFxGbh1eJGSC510zFsXA9qw9Fr3AAwH4DYIQKj0c/QgFhQb0k9T3fxO7n' +
  '12PaMG2xbRlQGIpreDZtJ+WeJSyoh5Gipqjkm3mk0M2uOo5ty5CvgRlGMA2FgRd+UvBAJayJeTVU6A28wTtCwv0R' +
  'vlbsYRihUvvoB90zAYy3DHwWPP5sVg92RmxTAcgC/iIK7sFM+CSTslZNRRmxNEYhcmwcsqsawfEgj2W0+cJ1RIdm' +
  'K4m7/wtUtWpImaspbEmwLQm+UAdO+3r0ytZLBHkwxVm/ISpoKZiUMFxilHyheXlP7AuY8Tsy8eTTAnk4mRxpKjE9' +
  'zKlI1xU5BtSE/GcEC2sgFJymO9cCaB3oX1ygKpocaeCwrjVcL6BI5eUVBtc64XlLjW4VfgOO4qN2q+mjmAAAAABJ' +
  'RU5ErkJggg=='

/** 定期キャプチャーは有効だが、いまは撮っていない。 */
export const TRAY_ICON_IDLE =
  'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJ' +
  'cEhZcwAADsMAAA7DAcdvqGQAAANtSURBVFhH7VdNSFRRFH5R5M/MaJk/FWYmQuFfBka/RtmicBOUIPSDLhSa0UEX' +
  'ucpd66JFBIXNOKMzI46FiUhkajM6Kq1atWgThBs3Wjrv3jcG3Tg3x+477+m898pdH3yLkfu+83PPOfcoSf9hEV8f' +
  'ShmLT/LsScJvfOafgjFpBwtk7yW+9KJVj61ytddWpcdlb1rxd59jHxuUdmINywDBlRf2MmwsBctXAvZccBzrGQZE' +
  '8c2fVaojbpjfexxH2aC0G2unBHykeO3HsGC8P6+aRlrq5FhnB511P0hybb6j60fMdTkePnwCfwPZgDrBNjYFRK5n' +
  'fC1y8wKNtAbp63MLJFTCSKDwD4PFjAyfXqRTTcPK++Z6/C048XNMSsO2NIA7w2mHqOis201HL32WfTlM9tg2Z282' +
  'I8NnFpS59m45XFEj6kBQKYsTCgcbJ5HW5/FQaUJjbAuSYBGjE7cG5JGak6Ke3JNxENvcAESPqx0iN2t8w4lAIYP6' +
  'EPWghdmUtAvb5oB2Ew/zO4e064gbJXlZvaTE3A2qrHoz92PbHNSfdmTjEK/21mDKO09Fr4Mpb69H5dHzp5La0JrY' +
  'Nq98ccJBS0FVawQtMB6uSCQ+dDWKWdB0BHsmZarSP9/RBa2FxayQ9BUwOuN6rHKgLydL5QD8QTygTLc9lf35GjFL' +
  '9DoYjTpfifrQbSoHcAEq007/X9+/QBJ1jYr6q0FbgcqBZW/2HpUDM64e2ZerEbJKjQN+W77KAZjVKgfm2rthmGAh' +
  'S/TnM7hSUR8CVjkAw0HlwHznNTJ0PK4Rs0AyUMrobOddUR+KXuUAQHwDYISS8cZJKCAsaJZkpPYLnWq6mNSGaYtt' +
  'c0BhiF6SqPM2GapawoJmGA+VJJRY2z2Vrif9ELbNwa9BGEbrb/8j0n9AI2yIvhxGJ5sH8Y6w5f4Ir5V4GEaoMt4w' +
  'YXomgPGxqx/Juxu1oh7sjNimCpAF/CKSN/Vn4Ukm4TJDRRkPFicgcmwcsqsZwXrgYxltvnAdiZj7Dhm78gmqWjOk' +
  'YBEJlTC+Lc047+O0/44etd5W4INJZ/2GqKClYFLCcElSmXYN8D0x0lKHv+HEk88I1odTuUbMDD22SlORY0BN8H9G' +
  'sLABQsEZunMjgNaB/sUFqsNycNjUGm4WUKR8eYXBtU74va1Gtwu/ABRrx5BrsSmGAAAAAElFTkSuQmCC'
