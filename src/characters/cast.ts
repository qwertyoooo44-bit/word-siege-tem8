export type CharacterId = 'navigator' | 'forger' | 'archivist'

export type CharacterProfile = {
  id: CharacterId
  name: string
  role: string
  pitch: number
  rate: number
}

export const CHARACTERS: Record<CharacterId, CharacterProfile> = {
  navigator: {
    id: 'navigator',
    name: '领航员岚',
    role: '美式发音与重音',
    pitch: 1.04,
    rate: 0.9,
  },
  forger: {
    id: 'forger',
    name: '锻造师衡',
    role: '字母组合与纠错',
    pitch: 0.92,
    rate: 0.94,
  },
  archivist: {
    id: 'archivist',
    name: '档案员溯',
    role: '词根、词缀与语境',
    pitch: 1,
    rate: 0.88,
  },
}

export type CharacterMode = 'auto' | CharacterId | 'hidden'
