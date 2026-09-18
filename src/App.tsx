import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent } from 'react'
import { PACK_META } from './data/pack'
import {
  accuracy,
  backspace,
  blockPaste,
  canAdvanceWord,
  createInitialState,
  currentWord,
  elapsedMs,
  endSession,
  finalPromptFor,
  fromPersist,
  nextWord,
  pause,
  requestHint,
  requiredFor,
  resume,
  sessionWpm,
  setMotion,
  setSound,
  setSpeech,
  settlement,
  startReview,
  startSiege,
  stageTitle,
  typeChar,
  visibleTarget,
  wpm,
} from './engine/machine'
import { displayContext, displayGloss, displayIpa } from './data/pack'
import type { EngineEvent, EngineState, MotionPref, StageId } from './engine/types'
import { initAudio, playBad, playMaster, playOk, playStage } from './audio'
import { inspectSpeech, speakWord } from './speech'
import { loadState, saveState } from './persist'
import { STORAGE_KEY } from './persist'
import {
  homeStats,
  importBackup,
  loadCurrent,
  migrateLocalStorage,
  onReviewFailed,
  onWordMastered,
  saveCurrent,
  snapshot,
} from './db/repository'
import { WORDS as TEST_WORDS } from './data/pack'
import type { WordRecord } from './review/schedule'
import { applyUpdate, registerPwa } from './pwa'
import { loadSettings, saveSettings, type AppSettings } from './settings'
import { clearLearningData } from './db/repository'
import './App.css'

const STAGE_DOTS: StageId[] = [
  'understand',
  'copy',
  'fadePartial',
  'chinese',
  'listen',
  'context',
  'final',
]

function reduceMotionRequested(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function motionClass(motion: MotionPref, reduced: boolean): string {
  if (reduced || motion === 'off') return 'motion-off'
  return motion === 'vivid' ? 'motion-vivid' : 'motion-calm'
}

export default function App() {
  const [state, setState] = useState<EngineState>(() => loadState() ?? createInitialState())
  const [screen, setScreen] = useState<'home' | 'siege' | 'settle' | 'lexicon' | 'source'>(() => {
    const saved = loadState()
    return saved && saved.stage !== 'understand' ? 'siege' : 'home'
  })
  const [shake, setShake] = useState(0)
  const [ghost, setGhost] = useState('')
  const [popIndex, setPopIndex] = useState(-1)
  const [speechMsg, setSpeechMsg] = useState('')
  const [reduced, setReduced] = useState(false)
  const [kbPad, setKbPad] = useState(0)
  const [glow, setGlow] = useState(false)
  const [dueCount, setDueCount] = useState(0)
  const [dueList, setDueList] = useState<WordRecord[]>([])
  const [longCount, setLongCount] = useState(0)
  const [todayMastered, setTodayMastered] = useState(0)
  const [backupMsg, setBackupMsg] = useState('')
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [query, setQuery] = useState('')
  const [updateReady, setUpdateReady] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const composing = useRef(false)
  const audioReady = useRef(false)
  const hydrated = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    setReduced(reduceMotionRequested())
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMq = () => setReduced(mq.matches)
    mq.addEventListener?.('change', onMq)
    const onVp = () => {
      const vp = window.visualViewport
      if (!vp) return
      const hidden = Math.max(0, window.innerHeight - vp.height - vp.offsetTop)
      setKbPad(hidden)
    }
    window.visualViewport?.addEventListener('resize', onVp)
    window.visualViewport?.addEventListener('scroll', onVp)
    return () => {
      mq.removeEventListener?.('change', onMq)
      window.visualViewport?.removeEventListener('resize', onVp)
      window.visualViewport?.removeEventListener('scroll', onVp)
    }
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    saveState(state)
    void saveCurrent(state)
  }, [state])

  useEffect(() => {
    void (async () => {
      const idb = await loadCurrent()
      if (idb) {
        setState(idb)
        if (idb.stage !== 'understand') setScreen('siege')
      } else {
        const migrated = migrateLocalStorage(localStorage.getItem(STORAGE_KEY))
        if (migrated) {
          const next = fromPersist(migrated)
          setState(next)
          await saveCurrent(next)
        }
      }
      const stats = await homeStats()
      setDueCount(stats.due)
      setDueList(stats.dueList)
      setLongCount(stats.long)
      setTodayMastered(stats.todayMastered)
      hydrated.current = true
    })()
    registerPwa(() => setUpdateReady(true))
  }, [])

  useEffect(() => {
    saveSettings(settings)
    document.documentElement.classList.toggle('theme-light', settings.theme === 'light')
    document.documentElement.classList.remove('font-s', 'font-m', 'font-l')
    document.documentElement.classList.add(`font-${settings.fontScale}`)
  }, [settings])

  const word = currentWord(state)
  const target = word.word
  const prompt = finalPromptFor(state.wordIndex)
  const effectiveMotion = reduced ? 'off' : state.motion

  function applyEvents(prev: EngineState, events: EngineEvent[]) {
    for (const ev of events) {
      if (ev.type === 'letter-ok' && ev.char) {
        playOk(prev.soundEnabled)
        setPopIndex(prev.typed.length)
        window.setTimeout(() => setPopIndex(-1), 140)
      }
      if (ev.type === 'letter-bad') {
        playBad(prev.soundEnabled)
        if (prev.mode === 'review' && prev.stage === 'final') {
          void onReviewFailed(prev.reviewWordId ?? currentWord(prev).id)
        }
        setGhost(ev.char)
        setShake((n) => n + 1)
        window.setTimeout(() => setGhost(''), 150)
      }
      if (ev.type === 'stage-cleared') {
        playStage(prev.soundEnabled)
        setGlow(true)
        window.setTimeout(() => setGlow(false), 280)
      }
      if (ev.type === 'word-mastered') {
        playMaster(prev.soundEnabled)
        if (settings.speakAfterMaster) speakWord(currentWord(prev).word, prev.speechEnabled, settings.speechRate)
        void onWordMastered({ ...prev, stage: 'mastered' }).then(() =>
          homeStats().then((stats) => {
            setDueCount(stats.due)
            setDueList(stats.dueList)
            setLongCount(stats.long)
            setTodayMastered(stats.todayMastered)
          }),
        )
      }
      if (ev.type === 'speech-replay' || (ev.type === 'help' && ev.kind === 'speech')) {
        const status = speakWord(currentWord(prev).word, prev.speechEnabled, settings.speechRate)
        setSpeechMsg(status.message)
      }
    }
  }

  async function ensureAudio() {
    if (audioReady.current) return
    await initAudio()
    audioReady.current = true
  }

  function speak(current: EngineState) {
    const status = speakWord(currentWord(current).word, current.speechEnabled, settings.speechRate)
    setSpeechMsg(status.message)
    if (!status.hasEnglish && (current.stage === 'listen' || (current.stage === 'final' && prompt === 'audio'))) {
      setSpeechMsg(status.message || '没有可用的美式英语系统语音，无法只靠发音完成本关。')
    }
  }

  async function onStartFromUnderstand(current: EngineState) {
    await ensureAudio()
    inspectSpeech()
    setScreen('siege')
    let next = current
    if (current.paused) next = resume(current).next
    if (next.stage === 'understand') next = startSiege(next).next
    setState(next)
    if (settings.autoSpeak) speak(next)
    queueMicrotask(() => inputRef.current?.focus())
  }

  function handleKeys(e: KeyboardEvent<HTMLInputElement>) {
    if (composing.current) return
    if (e.key === 'Backspace') {
      e.preventDefault()
      setState(backspace)
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (composing.current) return
    const value = e.target.value
    const prev = stateRef.current
    if (value.length <= prev.typed.length) {
      setState((s) => ({
        ...s,
        typed: value.replace(/[^a-zA-Z]/g, '').toLowerCase().slice(0, currentWord(s).word.length),
      }))
      return
    }
    const added = value.slice(prev.typed.length)
    if (added.length > 1 && added.toLowerCase() === currentWord(prev).word.toLowerCase()) {
      const blocked = blockPaste(prev)
      applyEvents(prev, blocked.events)
      setState(blocked.next)
      return
    }
    const chars = added.toLowerCase().replace(/[^a-z]/g, '')
    let cur = prev
    const events: EngineEvent[] = []
    for (const ch of chars) {
      const r = typeChar(cur, ch)
      events.push(...r.events)
      cur = r.next
      if (r.events.some((ev) => ev.type === 'letter-bad')) break
    }
    applyEvents(prev, events)
    setState(cur)
  }

  const shown = visibleTarget(state)
  const letters = useMemo(() => {
    const display = shown || (state.stage === 'copy' || state.stage === 'understand' ? target : '')
    const source = display || target
    return source.split('').map((_ch, i) => {
      const typedCh = state.typed[i]
      let cls = 'letter'
      if (typedCh) cls += typedCh.toLowerCase() === target[i]?.toLowerCase() ? ' ok' : ' bad'
      else if (!display) cls += ' hidden'
      else if (display[i] === '_') cls += ' mask'
      if (i === popIndex) cls += ' pop'
      const glyph =
        typedCh && typedCh.toLowerCase() === target[i]?.toLowerCase()
          ? target[i]
          : display
            ? display[i]
            : typedCh
              ? typedCh
              : '·'
      return { ch: glyph, cls, key: i }
    })
  }, [state.typed, state.stage, shown, target, popIndex])

  const showIpa =
    state.showIpa &&
    state.stage !== 'listen' &&
    !(state.stage === 'final' && prompt === 'audio' && !state.showIpa)
  const showGloss = state.stage !== 'listen' && !(state.stage === 'final' && prompt === 'audio')
  const showContext = state.stage === 'understand' || state.stage === 'context' || (state.stage === 'final' && prompt === 'context')
  const typing =
    state.stage !== 'understand' && state.stage !== 'mastered' && !state.allDone && !state.paused
  const card = settlement(state)
  const sparkCount = effectiveMotion === 'off' ? 0 : effectiveMotion === 'vivid' ? 12 : 6

  return (
    <div className={`app ${motionClass(state.motion, reduced)}`} style={{ paddingBottom: kbPad ? kbPad + 12 : undefined }}>
      {updateReady ? (
        <button className="primary" onClick={() => void applyUpdate()}>发现新版本，点此更新</button>
      ) : null}
      {screen === 'home' ? (
        <main className="home">
          <p className="kicker">Word Siege TEM-8 · 本地学习</p>
          <h1>专八单词攻坚</h1>
          <p className="notice">{PACK_META.notice} {PACK_META.attribution} 清理 Safari 网站数据可能丢失进度，请定期导出备份。</p>
          <dl className="stats">
            <div>
              <dt>当前词</dt>
              <dd>{state.allDone ? '全部完成' : `${state.wordIndex + 1}/${PACK_META.learnableCount} ${word.word}`}</dd>
            </div>
            <div>
              <dt>TEM8 词目总数</dt>
              <dd>{PACK_META.lemmaCount}</dd>
            </div>
            <div>
              <dt>可完整学习</dt>
              <dd>{PACK_META.learnableCount}</dd>
            </div>
            <div>
              <dt>资料待完善</dt>
              <dd>{PACK_META.incompleteCount}</dd>
            </div>
            <div>
              <dt>今日到期复习</dt>
              <dd>{dueCount}</dd>
            </div>
            <div>
              <dt>今日已攻克</dt>
              <dd>{todayMastered}</dd>
            </div>
            <div>
              <dt>长期掌握</dt>
              <dd>{longCount}</dd>
            </div>
            <div>
              <dt>当前关卡</dt>
              <dd>{stageTitle(state.stage)}</dd>
            </div>
          </dl>
          <div className="actions">
            <button className="primary" onClick={() => void onStartFromUnderstand(state)}>
              {state.stage === 'understand' && state.wordIndex === 0 && state.attempts === 0 ? '开始学习' : '继续当前单词'}
            </button>
            <button onClick={() => setScreen('settle')}>学习结算</button>
            <button onClick={() => setScreen('lexicon')}>词库与章节</button>
            <button onClick={() => setScreen('source')}>数据来源</button>
            {dueList[0] ? (
              <button
                className="primary"
                onClick={() => {
                  const idx = TEST_WORDS.findIndex((w) => w.id === dueList[0].wordId)
                  if (idx < 0) return
                  setState((s) => startReview(s, idx))
                  setScreen('siege')
                }}
              >
                复习到期词：{dueList[0].word}
              </button>
            ) : null}
            <button
              onClick={() => {
                setState(endSession)
                setScreen('home')
              }}
            >
              结束并保存
            </button>
          </div>
          <section className="settings">
            <h2>设置</h2>
            <label>
              动效
              <select
                value={state.motion}
                onChange={(e) => setState((s) => setMotion(s, e.target.value as MotionPref))}
              >
                <option value="off">关闭</option>
                <option value="calm">舒缓</option>
                <option value="vivid">动感</option>
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={state.soundEnabled}
                onChange={(e) => setState((s) => setSound(s, e.target.checked))}
              />
              音效
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={state.speechEnabled}
                onChange={(e) => setState((s) => setSpeech(s, e.target.checked))}
              />
              美式系统发音
            </label>
            <label className="check">
              <input type="checkbox" checked={settings.autoSpeak} onChange={(e) => setSettings((s) => ({ ...s, autoSpeak: e.target.checked }))} />
              自动播放美式系统发音
            </label>
            <label className="check">
              <input type="checkbox" checked={settings.speakAfterMaster} onChange={(e) => setSettings((s) => ({ ...s, speakAfterMaster: e.target.checked }))} />
              攻克后再播放美式系统发音
            </label>
            <label>
              美式系统发音速度
              <input type="range" min="0.7" max="1.2" step="0.05" value={settings.speechRate} onChange={(e) => setSettings((s) => ({ ...s, speechRate: Number(e.target.value) }))} />
            </label>
            <label>
              主题
              <select value={settings.theme} onChange={(e) => setSettings((s) => ({ ...s, theme: e.target.value as AppSettings['theme'] }))}>
                <option value="dark">深色</option>
                <option value="light">浅色</option>
              </select>
            </label>
            <label>
              字号
              <select value={settings.fontScale} onChange={(e) => setSettings((s) => ({ ...s, fontScale: e.target.value as AppSettings['fontScale'] }))}>
                <option value="s">小</option>
                <option value="m">中</option>
                <option value="l">大</option>
              </select>
            </label>
            <label>
              每日目标
              <input type="number" min={1} max={50} value={settings.dailyGoal} onChange={(e) => setSettings((s) => ({ ...s, dailyGoal: Number(e.target.value) || 1 }))} />
            </label>
            {reduced ? <p className="hint">系统已开启减少动态效果。</p> : null}
            <p className="hint">词书音标为 UK IPA，浏览器系统发音优先使用美国英语，两者不一定是同一口音。</p>
            <p className="hint">iPhone 安装：Safari 打开本页 → 分享 → 添加到主屏幕。首次联网加载后可离线学习。本应用无账号、无广告、数据只在本机。</p>
            <button
              onClick={async () => {
                if (!window.confirm('将清除本机学习记录，且无法恢复。确定吗？')) return
                await clearLearningData()
                setState(createInitialState({ motion: state.motion, soundEnabled: state.soundEnabled, speechEnabled: state.speechEnabled }))
                const stats = await homeStats()
                setDueCount(stats.due)
                setDueList(stats.dueList)
                setLongCount(stats.long)
                setTodayMastered(stats.todayMastered)
                setBackupMsg('本地学习数据已清除。')
              }}
            >
              清除本地数据
            </button>
            <h2>数据备份</h2>
            <div className="actions">
              <button
                onClick={async () => {
                  const file = await snapshot(state)
                  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'word-siege-backup.json'
                  a.click()
                  URL.revokeObjectURL(url)
                  setBackupMsg('已导出 JSON。数据只保存在本机。')
                }}
              >
                导出 JSON
              </button>
              <label className="check">
                导入 JSON
                <input
                  type="file"
                  accept="application/json"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    const text = await file.text()
                    if (!window.confirm('导入将覆盖当前学习数据，确定吗？')) {
                      setBackupMsg('已取消导入，原数据未改。')
                      return
                    }
                    const result = await importBackup(text, true)
                    if (!result.ok) {
                      setBackupMsg(result.error)
                      return
                    }
                    const loaded = await loadCurrent()
                    if (loaded) setState(loaded)
                    const stats = await homeStats()
                    setDueCount(stats.due)
                    setDueList(stats.dueList)
                    setLongCount(stats.long)
                    setTodayMastered(stats.todayMastered)
                    setBackupMsg('导入成功。')
                  }}
                />
              </label>
            </div>
            {backupMsg ? <p className="hint">{backupMsg}</p> : null}
          </section>
        </main>
      ) : screen === 'source' ? (
        <main className="home">
          <p className="kicker">数据来源</p>
          <h1>TEM8 词库</h1>
          <p className="notice">{PACK_META.notice}</p>
          <dl className="stats">
            <div><dt>TEM8 词目总数</dt><dd>{PACK_META.lemmaCount}</dd></div>
            <div><dt>可完整学习</dt><dd>{PACK_META.learnableCount}</dd></div>
            <div><dt>资料待完善</dt><dd>{PACK_META.incompleteCount}</dd></div>
            <div><dt>EPUB 精确匹配</dt><dd>{PACK_META.exactMatched}</dd></div>
            <div><dt>章节</dt><dd>{PACK_META.chapterCount} 章，每章 {PACK_META.chapterSize} 词</dd></div>
            <div><dt>代码许可证</dt><dd>{PACK_META.codeLicense}</dd></div>
            <div><dt>数据许可证</dt><dd>{PACK_META.dataLicense}</dd></div>
            <div><dt>署名</dt><dd>{PACK_META.attribution}</dd></div>
            <div><dt>仓库</dt><dd>{PACK_META.sourceRepo}</dd></div>
          </dl>
          <button className="primary" onClick={() => setScreen('home')}>返回首页</button>
        </main>
      ) : screen === 'lexicon' ? (
        <main className="home">
          <p className="kicker">词库与章节</p>
          <h1>TEM8</h1>
          <p className="notice">词目 {PACK_META.lemmaCount}，可完整学习 {PACK_META.learnableCount}，资料待完善 {PACK_META.incompleteCount}。章节按每 {PACK_META.chapterSize} 词固定划分。</p>
          <input className="spell" placeholder="搜索单词" value={query} onChange={(e) => setQuery(e.target.value.toLowerCase())} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          {query ? (
            <dl className="stats">
              {TEST_WORDS.filter((w) => w.word.includes(query)).slice(0, 20).map((w) => (
                <div key={w.id}><dt>{w.word}</dt><dd>第 {w.chapter} 章</dd></div>
              ))}
            </dl>
          ) : null}
          <dl className="stats">
            {Array.from({ length: Math.min(8, PACK_META.chapterCount) }, (_, i) => (
              <div key={i}>
                <dt>第 {i + 1} 章</dt>
                <dd>{TEST_WORDS[i * PACK_META.chapterSize]?.word} …</dd>
              </div>
            ))}
          </dl>
          <p className="hint">共 {PACK_META.chapterCount} 章。完整列表可搜索后续阶段继续完善。</p>
          <button className="primary" onClick={() => setScreen('home')}>返回首页</button>
        </main>
      ) : screen === 'settle' ? (
        <main className="home">
          <p className="kicker">学习结算</p>
          <h1>本次进度</h1>
          <dl className="stats">
            <div><dt>当场掌握</dt><dd>{card.wordsMastered} 词</dd></div>
            <div><dt>复习完成</dt><dd>{card.reviewsDone} 词</dd></div>
            <div><dt>学习时间</dt><dd>{Math.round(card.studyMs / 1000)} 秒</dd></div>
            <div><dt>输入字符</dt><dd>{card.charsTyped}</dd></div>
            <div><dt>正确 / 错误</dt><dd>{card.charCorrect} / {card.charWrong}</dd></div>
            <div><dt>WPM</dt><dd>{card.wpm}（仅统计，不判定掌握）</dd></div>
            <div><dt>正确率</dt><dd>{card.accuracy}%</dd></div>
            <div><dt>高频错误字母</dt><dd>{card.hotErrorLetters.length ? card.hotErrorLetters.map((x) => `${x.letter}×${x.count}`).join(' ') : '无'}</dd></div>
            <div><dt>当场掌握词</dt><dd>{card.masteredWords.join(', ') || '无'}</dd></div>
            <div><dt>长期掌握</dt><dd>{card.longMastered}（阶段3启用）</dd></div>
            <div><dt>当前未完成</dt><dd>{card.unfinished ?? '无'}</dd></div>
            <div><dt>下次复习</dt><dd>{card.nextReviewLabel}</dd></div>
          </dl>
          <button className="primary" onClick={() => setScreen('home')}>返回首页</button>
        </main>
      ) : (
        <main className="siege">
          <header className="top">
            <button
              className="text"
              onClick={() => {
                setState(endSession)
                setScreen('home')
              }}
            >
              退出并保存
            </button>
            <p className="stage">{stageTitle(state.stage)}</p>
            <p className="count">{state.wordIndex + 1}/{PACK_META.learnableCount}</p>
          </header>
          <ol className="dots" aria-label="七关进度">
            {STAGE_DOTS.map((id, i) => {
              const activeId = state.stage === 'fadeHidden' ? 'fadePartial' : state.stage
              const activeIndex = STAGE_DOTS.indexOf(activeId)
              const done = state.stage === 'mastered' || (activeIndex >= 0 && activeIndex > i)
              const current = id === activeId
              return <li key={id} className={`${done ? 'done' : ''} ${current ? 'current' : ''}`} />
            })}
          </ol>
          <section key={shake} className={`word-panel ${shake ? 'shake' : ''} ${glow ? 'glow' : ''}`}>
            <div className="letters">
              {letters.map((l) => (
                <span key={l.key} className={l.cls}>
                  {l.ch}
                </span>
              ))}
              {ghost ? <span className="ghost">{ghost}</span> : null}
            </div>
            {showIpa ? <p className="ipa">{displayIpa(word)}</p> : null}
            {state.showSyllable ? <p className="meta">音节 {word.syllable || '缺失'}</p> : null}
            {state.showRoot ? <p className="meta">构词 {word.root || '缺失'}</p> : null}
            {showGloss ? (
              <p className="gloss">
                {word.pos ? `${word.pos} ` : ''}{displayGloss(word)}
              </p>
            ) : (
              <p className="gloss muted">听美式系统发音拼写 · 不显示中文</p>
            )}
            {showContext ? <p className="context">{displayContext(word)}</p> : null}
            {state.stage === 'final' ? (
              <p className="meta">最终提示：{prompt === 'chinese' ? '中文' : prompt === 'audio' ? '美式系统发音' : '语境'}</p>
            ) : null}
            {state.showInitial ? <p className="meta">首字母 {target[0]}</p> : null}
          </section>
          {state.stage === 'understand' ? (
            <button className="primary" onClick={() => void onStartFromUnderstand(state)}>
              开始攻坚
            </button>
          ) : null}
          {state.paused ? (
            <section className="mastered">
              <h2>已暂停</h2>
              <p>当前词未完成，不会切换到其他词。</p>
              <button
                className="primary"
                onClick={() => {
                  const r = resume(state)
                  setState(r.next)
                  queueMicrotask(() => inputRef.current?.focus())
                }}
              >
                继续当前词
              </button>
            </section>
          ) : null}
          {typing || state.paused ? (
            <div className="hint-row" style={{ marginTop: 8 }}>
              {state.paused ? null : (
                <button
                  type="button"
                  onClick={() => {
                    const r = pause(state)
                    setState(r.next)
                  }}
                >
                  暂停
                </button>
              )}
            </div>
          ) : null}
          {typing ? (
            <section className="input-dock">
              <p className="progress">
                连续正确 {state.consecutiveCorrect}/{requiredFor(state.stage)} · 本关尝试 {state.stageAttempts} · 正确率 {accuracy(state)}% · {wpm(state)} WPM
              </p>
              <input
                ref={inputRef}
                value={state.typed}
                onChange={handleChange}
                onKeyDown={handleKeys}
                onPaste={(e) => {
                  e.preventDefault()
                  const blocked = blockPaste(state)
                  applyEvents(state, blocked.events)
                  setState(blocked.next)
                }}
                onCompositionStart={() => {
                  composing.current = true
                }}
                onCompositionEnd={(e) => {
                  composing.current = false
                  const extra = e.data?.toLowerCase().replace(/[^a-z]/g, '') ?? ''
                  if (!extra) return
                  const prev = stateRef.current
                  let cur = prev
                  const events: EngineEvent[] = []
                  for (const ch of extra) {
                    const r = typeChar(cur, ch)
                    events.push(...r.events)
                    cur = r.next
                  }
                  applyEvents(prev, events)
                  setState(cur)
                }}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                enterKeyHint="done"
                lang="en"
                aria-label="拼写输入"
                className="spell"
              />
              <div className="hint-row">
                <button
                  type="button"
                  onClick={() => {
                    const r = requestHint(state, 'speech')
                    applyEvents(state, r.events)
                    setState(r.next)
                    speak(r.next)
                  }}
                >
                  重播美式系统发音
                </button>
                {state.stage === 'chinese' || state.stage === 'final' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const r = requestHint(state, 'ipa')
                        applyEvents(state, r.events)
                        setState(r.next)
                      }}
                    >
                      显示 UK IPA
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const r = requestHint(state, 'initial')
                        applyEvents(state, r.events)
                        setState(r.next)
                      }}
                    >
                      首字母
                    </button>
                  </>
                ) : null}
              </div>
            </section>
          ) : null}
          {state.stage === 'mastered' ? (
            <section className="mastered">
              <div className="burst" aria-hidden>
                {Array.from({ length: sparkCount }, (_, i) => (
                  <i key={i} style={{ '--i': i } as CSSProperties} />
                ))}
              </div>
              <h2>本词已攻克</h2>
              <p>
                用时 {Math.round(elapsedMs(state) / 1000)} 秒 · 错误 {state.errors} 次 · 正确率 {accuracy(state)}% · {wpm(state)} WPM
              </p>
              <p className="meta">本次已攻克 {state.session.wordsMastered} 词 · 会话 {sessionWpm(state)} WPM</p>
              <button
                className="primary"
                disabled={!canAdvanceWord(state)}
                onClick={() => {
                  const r = nextWord(state)
                  if (!r.ok) return
                  setState(r.next)
                  if (r.next.allDone) setScreen('home')
                  else {
                    setScreen('siege')
                    queueMicrotask(() => inputRef.current?.focus())
                  }
                }}
              >
                继续下一个词
              </button>
            </section>
          ) : null}
          <p className="message">{state.message || speechMsg}</p>
        </main>
      )}
    </div>
  )
}
