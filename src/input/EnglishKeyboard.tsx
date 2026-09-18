import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { KEYBOARD_ROWS, type KeyboardKey } from './layout'
import type { InputAction, InputSource } from './actions'

type Props = {
  disabled?: boolean
  largeKeys?: boolean
  source?: InputSource
  onAction: (action: InputAction) => void
}

const REPEAT_DELAY_MS = 420
const REPEAT_EVERY_MS = 90

export function EnglishKeyboard({ disabled = false, largeKeys = false, source = 'app-keyboard', onAction }: Props) {
  const [downId, setDownId] = useState<string | null>(null)
  const delayRef = useRef<number | null>(null)
  const intervalRef = useRef<number | null>(null)
  const pointerRef = useRef<number | null>(null)

  useEffect(() => () => stopRepeat(), [])

  function stopRepeat() {
    if (delayRef.current != null) {
      window.clearTimeout(delayRef.current)
      delayRef.current = null
    }
    if (intervalRef.current != null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  function fire(key: KeyboardKey) {
    if (disabled) return
    if (key.kind === 'letter') onAction({ type: 'insertCharacter', char: key.char, source })
    else if (key.kind === 'delete') onAction({ type: 'deleteCharacter', source })
    else onAction({ type: 'submitAnswer', source })
  }

  const fromPointer = useRef(false)

  function onPointerDown(key: KeyboardKey, event: ReactPointerEvent<HTMLButtonElement>) {
    if (disabled) return
    event.preventDefault()
    fromPointer.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    pointerRef.current = event.pointerId
    setDownId(key.id)
    fire(key)
    stopRepeat()
    if (key.kind === 'delete') {
      delayRef.current = window.setTimeout(() => {
        intervalRef.current = window.setInterval(() => fire(key), REPEAT_EVERY_MS)
      }, REPEAT_DELAY_MS)
    }
  }

  function onPointerEnd(event: ReactPointerEvent<HTMLButtonElement>) {
    if (pointerRef.current != null && event.pointerId !== pointerRef.current) return
    pointerRef.current = null
    setDownId(null)
    stopRepeat()
  }

  return (
    <div className={`english-kb ${largeKeys ? 'large' : ''}`} role="group" aria-label="英语 QWERTY 键盘">
      {KEYBOARD_ROWS.map((row, index) => (
        <div className={`kb-row ${index === 1 ? 'offset' : ''} ${index === 3 ? 'actions' : ''}`} key={index}>
          {row.map((key) => (
            <button
              key={key.id}
              type="button"
              className={`kb-key ${key.kind} ${downId === key.id ? 'down' : ''}`}
              aria-label={key.label}
              disabled={disabled}
              tabIndex={0}
              onPointerDown={(event) => onPointerDown(key, event)}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
              onLostPointerCapture={onPointerEnd}
              onClick={(event) => {
                if (fromPointer.current) {
                  fromPointer.current = false
                  event.preventDefault()
                  return
                }
                fire(key)
              }}
              onContextMenu={(event) => event.preventDefault()}
            >
              {key.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
