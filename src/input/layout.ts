export type KeyboardKey =
  | { id: string; kind: 'letter'; label: string; char: string }
  | { id: string; kind: 'delete'; label: string }
  | { id: string; kind: 'confirm'; label: string }

export const KEYBOARD_ROWS: KeyboardKey[][] = [
  'qwertyuiop'.split('').map((char) => ({ id: char, kind: 'letter', label: char.toUpperCase(), char })),
  'asdfghjkl'.split('').map((char) => ({ id: char, kind: 'letter', label: char.toUpperCase(), char })),
  'zxcvbnm'.split('').map((char) => ({ id: char, kind: 'letter', label: char.toUpperCase(), char })),
  [
    { id: 'delete', kind: 'delete', label: '删除' },
    { id: 'confirm', kind: 'confirm', label: '确认' },
  ],
]

export const LETTER_KEY_COUNT = KEYBOARD_ROWS.flat().filter((key) => key.kind === 'letter').length
