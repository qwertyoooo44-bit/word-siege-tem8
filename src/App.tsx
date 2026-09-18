import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { PACK_META, loadOfficialPack } from './data/pack'
import {
  accuracy,
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
  visibleTarget,
  wpm,
} from './engine/machine'
import { displayContext, displayGloss, displayIpa } from './data/pack'
import type { EngineEvent, EngineState, MotionPref, StageId } from './engine/types'
import { configureAudio, initAudio, playBad, playConfirm, playDelete, playKey, playMaster, playOk, playStage } from './audio'
import { EnglishKeyboard } from './input/EnglishKeyboard'
import {
  applyInputAction,
  displayedInput,
  physicalKeyToAction,
  systemValueToActions,
  type InputAction,
} from './input/actions'
import { inspectSpeech, speakCoachLine, speakWord } from './speech'
import { CastPortrait } from './characters/CastPortrait'
import { characterLabel, coachForEvents, greetingForWord, type CoachLine } from './characters/coach'
import { type CharacterMode } from './characters/cast'
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
import { PACKS, SAMPLE_PACK, TEM8_PACK, chapterWordIds } from './packs/catalog'
import type { Course } from './packs/types'
import { parseCourseTable } from './courses/parse'
import { courseProgress, firstCourseCatalogIndex, nextCourseCatalogIndex } from './courses/queue'
import {
  ALL_LEARNABLE_COURSE_ID,
  ERRORS_COURSE_ID,
  REVIEW_COURSE_ID,
  SAMPLE_COURSE_ID,
  builtinCourses,
  deleteCustomCourse,
  exportCourse,
  listCustomCourses,
  saveCustomCourse,
} from './courses/store'
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
  const [errorList, setErrorList] = useState<WordRecord[]>([])
  const [longCount, setLongCount] = useState(0)
  const [todayMastered, setTodayMastered] = useState(0)
  const [masteredIds, setMasteredIds] = useState<Set<string>>(() => new Set())
  const [backupMsg, setBackupMsg] = useState('')
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [query, setQuery] = useState('')
  const [updateReady, setUpdateReady] = useState(false)
  const [draft, setDraft] = useState('')
  const [coach, setCoach] = useState<CoachLine | null>(null)
  const [courses, setCourses] = useState<Course[]>(() => builtinCourses())
  const [importText, setImportText] = useState('')
  const [importTitle, setImportTitle] = useState('我的课程')
  const inputRef = useRef<HTMLInputElement>(null)
  const composing = useRef(false)
  const audioReady = useRef(false)
  const hydrated = useRef(false)
  const stateRef = useRef(state)
  const draftRef = useRef(draft)
  const screenRef = useRef(screen)
  const settingsRef = useRef(settings)
  stateRef.current = state
  draftRef.current = draft
  screenRef.current = screen
  settingsRef.current = settings

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
      await loadOfficialPack()
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
      setErrorList(stats.errorList)
      setMasteredIds(stats.masteredIds)
      setLongCount(stats.long)
      setTodayMastered(stats.todayMastered)
      const custom = await listCustomCourses()
      setCourses([...builtinCourses(), ...custom])
      hydrated.current = true
    })()
    registerPwa(() => setUpdateReady(true))
  }, [])

  useEffect(() => {
    saveSettings(settings)
    configureAudio({
      pack: settings.soundPack,
      muted: settings.muted,
      keyVolume: settings.keyVolume,
      resultVolume: settings.resultVolume,
      keySoundEnabled: settings.keySoundEnabled,
      resultSoundEnabled: settings.resultSoundEnabled,
    })
    document.documentElement.classList.toggle('theme-light', settings.theme === 'light')
    document.documentElement.classList.remove('font-s', 'font-m', 'font-l')
    document.documentElement.classList.add(`font-${settings.fontScale}`)
  }, [settings])

  const word = currentWord(state)
  const target = word.word
  const prompt = finalPromptFor(state.wordIndex)
  const effectiveMotion = reduced ? 'off' : state.motion
  const activeCourse = courses.find((course) => course.id === settings.courseId) ?? courses[0]
  const courseWordIds =
    activeCourse?.mode === 'review'
      ? dueList.map((item) => item.wordId)
      : activeCourse?.mode === 'errors'
        ? errorList.map((item) => item.wordId)
        : activeCourse?.wordIds ?? TEST_WORDS.map((item) => item.id)
  const progress = courseProgress(courseWordIds, masteredIds)

  function jumpToCatalogIndex(index: number, review = false) {
    if (review) {
      setState((s) => startReview(s, index))
    } else {
      setState((s) => createInitialState({
        wordIndex: index,
        learnIndex: index,
        motion: s.motion,
        soundEnabled: s.soundEnabled,
        speechEnabled: s.speechEnabled,
        session: s.session,
      }))
    }
    setDraft('')
    setScreen('siege')
  }

  function startActiveCourse() {
    if (activeCourse?.mode === 'review' || activeCourse?.mode === 'errors') {
      const first = activeCourse.mode === 'review' ? dueList[0] : errorList[0]
      if (!first) return
      const idx = TEST_WORDS.findIndex((item) => item.id === first.wordId)
      if (idx >= 0) jumpToCatalogIndex(idx, activeCourse.mode === 'review')
      return
    }
    const unfinished = courseWordIds.find((id) => !masteredIds.has(id))
    const index = firstCourseCatalogIndex(unfinished ? [unfinished, ...courseWordIds] : courseWordIds)
    if (index == null) return
    jumpToCatalogIndex(index)
  }

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
        if (settings.speakAfterMaster) speakWord(currentWord(prev).word, prev.speechEnabled, settings.speechRate, settings.speechVolume)
        void onWordMastered({ ...prev, stage: 'mastered' }).then(() =>
          homeStats().then((stats) => {
            setDueCount(stats.due)
            setDueList(stats.dueList)
            setErrorList(stats.errorList)
            setMasteredIds(stats.masteredIds)
            setLongCount(stats.long)
            setTodayMastered(stats.todayMastered)
          }),
        )
      }
      if (ev.type === 'speech-replay' || (ev.type === 'help' && ev.kind === 'speech')) {
        const status = speakWord(currentWord(prev).word, prev.speechEnabled, settings.speechRate, settings.speechVolume)
        setSpeechMsg(status.message)
      }
    }
    const line = coachForEvents(prev, events, settingsRef.current.characterMode)
    if (line) {
      setCoach(line)
      const profile = line.character
      const s = settingsRef.current
      if (s.characterVoiceEnabled && !s.muted) {
        const rates = { navigator: 0.9, forger: 0.94, archivist: 0.88 } as const
        const pitches = { navigator: 1.04, forger: 0.92, archivist: 1 } as const
        speakCoachLine(line.text, true, rates[profile], pitches[profile], s.characterVolume)
      }
    }
  }

  async function ensureAudio() {
    if (audioReady.current) return
    await initAudio()
    audioReady.current = true
  }

  function speak(current: EngineState) {
    const status = speakWord(currentWord(current).word, current.speechEnabled, settings.speechRate, settings.speechVolume)
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
    setDraft('')
    setState(next)
    const hello = greetingForWord(currentWord(next).word, settings.characterMode)
    if (hello) setCoach(hello)
    if (settings.autoSpeak) speak(next)
    queueMicrotask(() => {
      if (settings.keyboardMode === 'system') inputRef.current?.focus()
    })
  }

  function routeAction(action: InputAction) {
    const prev = stateRef.current
    const currentDraft = draftRef.current
    if (action.type === 'insertCharacter' && action.char.length > 1) {
      const blocked = blockPaste(prev)
      applyEvents(prev, blocked.events)
      setState(blocked.next)
      return
    }
    const result = applyInputAction({ state: prev, draft: currentDraft }, action)
    const audioOn = prev.soundEnabled && !settingsRef.current.muted
    const liveFeedback = result.events.some((ev) => ev.type === 'letter-ok' || ev.type === 'letter-bad')
    if (result.accepted) {
      void ensureAudio()
      if (action.type === 'insertCharacter' && !liveFeedback) playKey(audioOn)
      if (action.type === 'deleteCharacter') playDelete(audioOn)
      if (action.type === 'submitAnswer') playConfirm(audioOn)
    }
    if (result.draft !== currentDraft) setDraft(result.draft)
    if (result.events.length) applyEvents(prev, result.events)
    if (result.next !== prev) setState(result.next)
    if (result.next.stage !== prev.stage) setDraft('')
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (screenRef.current !== 'siege') return
      if (settingsRef.current.keyboardMode === 'system' && document.activeElement === inputRef.current) return
      if ((e.target as HTMLElement | null)?.closest?.('.kb-key, input, textarea, select')) return
      const mapped = physicalKeyToAction(e.key, {
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        alt: e.altKey,
        shift: e.shiftKey,
      })
      if (mapped === 'passthrough' || mapped == null) return
      e.preventDefault()
      routeAction(mapped)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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
            <p className="hint">当前课程：{activeCourse?.title ?? '全部可学词'} · {progress.done}/{progress.total}</p>
            <button className="primary" onClick={() => void onStartFromUnderstand(state)}>
              {state.stage === 'understand' && state.wordIndex === 0 && state.attempts === 0 ? '开始学习' : '继续当前单词'}
            </button>
            <button onClick={() => startActiveCourse()}>学当前课程</button>
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
            <label>
              键盘
              <select
                value={settings.keyboardMode}
                onChange={(e) => setSettings((s) => ({ ...s, keyboardMode: e.target.value as AppSettings['keyboardMode'] }))}
              >
                <option value="app">应用键盘（默认）</option>
                <option value="system">系统键盘</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={settings.largeKeys} onChange={(e) => setSettings((s) => ({ ...s, largeKeys: e.target.checked }))} />
              大按键模式
            </label>
            <label>
              按键音色
              <select value={settings.soundPack} onChange={(e) => setSettings((s) => ({ ...s, soundPack: e.target.value as AppSettings['soundPack'] }))}>
                <option value="crisp">清脆</option>
                <option value="mechanical">机械</option>
                <option value="archive">词库</option>
                <option value="crystal">晶体</option>
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={state.soundEnabled && !settings.muted}
                onChange={(e) => {
                  const on = e.target.checked
                  setSettings((s) => ({ ...s, muted: !on }))
                  setState((s) => setSound(s, on))
                }}
              />
              音效
            </label>
            <label className="check">
              <input type="checkbox" checked={settings.keySoundEnabled} onChange={(e) => setSettings((s) => ({ ...s, keySoundEnabled: e.target.checked }))} />
              按键音
            </label>
            <label className="check">
              <input type="checkbox" checked={settings.resultSoundEnabled} onChange={(e) => setSettings((s) => ({ ...s, resultSoundEnabled: e.target.checked }))} />
              结果音效
            </label>
            <label>
              按键音量
              <input type="range" min="0" max="1" step="0.05" value={settings.keyVolume} onChange={(e) => setSettings((s) => ({ ...s, keyVolume: Number(e.target.value) }))} />
            </label>
            <label>
              结果音量
              <input type="range" min="0" max="1" step="0.05" value={settings.resultVolume} onChange={(e) => setSettings((s) => ({ ...s, resultVolume: Number(e.target.value) }))} />
            </label>
            <label className="check">
              <input type="checkbox" checked={settings.muted} onChange={(e) => setSettings((s) => ({ ...s, muted: e.target.checked }))} />
              全局静音
            </label>
            <label>
              单词发音音量
              <input type="range" min="0" max="1" step="0.05" value={settings.speechVolume} onChange={(e) => setSettings((s) => ({ ...s, speechVolume: Number(e.target.value) }))} />
            </label>
            <label>
              角色语音音量
              <input type="range" min="0" max="1" step="0.05" value={settings.characterVolume} onChange={(e) => setSettings((s) => ({ ...s, characterVolume: Number(e.target.value) }))} />
            </label>
            <label className="check">
              <input type="checkbox" checked={settings.ambienceEnabled} onChange={(e) => setSettings((s) => ({ ...s, ambienceEnabled: e.target.checked }))} />
              背景氛围（默认关闭）
            </label>
            <label>
              角色
              <select value={settings.characterMode} onChange={(e) => setSettings((s) => ({ ...s, characterMode: e.target.value as CharacterMode }))}>
                <option value="auto">自动轮换</option>
                <option value="navigator">固定领航员岚</option>
                <option value="forger">固定锻造师衡</option>
                <option value="archivist">固定档案员溯</option>
                <option value="hidden">完全隐藏</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={settings.characterVoiceEnabled} onChange={(e) => setSettings((s) => ({ ...s, characterVoiceEnabled: e.target.checked }))} />
              角色语音
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
                setErrorList(stats.errorList)
                setMasteredIds(stats.masteredIds)
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
                    setErrorList(stats.errorList)
                    setMasteredIds(stats.masteredIds)
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
          <p className="kicker">课程与词包</p>
          <h1>TEM8 / 抽样 / 自定义</h1>
          <p className="notice">词目 {PACK_META.lemmaCount}，可完整学习 {PACK_META.learnableCount}。美国英语 Core 1000/3000 在取得合法频率来源前不标记。抽样课程只验证架构。</p>
          <label>
            当前课程
            <select value={settings.courseId} onChange={(e) => setSettings((s) => ({ ...s, courseId: e.target.value }))}>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button className="primary" onClick={() => startActiveCourse()}>学当前课程</button>
            <button onClick={() => setSettings((s) => ({ ...s, courseId: ALL_LEARNABLE_COURSE_ID }))}>全部可学词</button>
            <button onClick={() => setSettings((s) => ({ ...s, courseId: SAMPLE_COURSE_ID }))}>{SAMPLE_PACK.title}</button>
            <button onClick={() => setSettings((s) => ({ ...s, courseId: REVIEW_COURSE_ID }))}>只做复习</button>
            <button onClick={() => setSettings((s) => ({ ...s, courseId: ERRORS_COURSE_ID }))}>只练错词</button>
          </div>
          <dl className="stats">
            {PACKS.map((pack) => (
              <div key={pack.packId}>
                <dt>{pack.title}</dt>
                <dd>{pack.readyCount}/{pack.entryCount} · {pack.license}</dd>
              </div>
            ))}
          </dl>
          <h2>导入课程</h2>
          <input className="spell" placeholder="课程名称" value={importTitle} onChange={(e) => setImportTitle(e.target.value)} />
          <textarea className="spell" rows={4} placeholder="每行一个已有单词，或 JSON" value={importText} onChange={(e) => setImportText(e.target.value)} />
          <button
            onClick={async () => {
              const parsed = parseCourseTable(importText, importTitle || '我的课程')
              if (!parsed.wordIds.length) {
                setBackupMsg(`没有可导入的已授权词。未知：${parsed.unknown.slice(0, 8).join(', ')}`)
                return
              }
              const course: Course = {
                id: `custom-${Date.now()}`,
                title: parsed.title,
                packId: TEM8_PACK.packId,
                wordIds: parsed.wordIds,
                dailyGoal: settings.dailyGoal,
                mode: 'custom',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              }
              await saveCustomCourse(course)
              const custom = await listCustomCourses()
              setCourses([...builtinCourses(), ...custom])
              setSettings((s) => ({ ...s, courseId: course.id }))
              setBackupMsg(`已保存课程，${parsed.wordIds.length} 词。未知 ${parsed.unknown.length} 个。`)
              setImportText('')
            }}
          >
            保存为个人课程
          </button>
          {courses.filter((course) => course.mode === 'custom').map((course) => (
            <div className="actions" key={course.id}>
              <button onClick={() => setSettings((s) => ({ ...s, courseId: course.id }))}>{course.title}</button>
              <button
                onClick={async () => {
                  const text = await exportCourse(course)
                  const blob = new Blob([text], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${course.title}.json`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
              >导出</button>
              <button
                onClick={async () => {
                  await deleteCustomCourse(course.id)
                  const custom = await listCustomCourses()
                  setCourses([...builtinCourses(), ...custom])
                  if (settings.courseId === course.id) setSettings((s) => ({ ...s, courseId: ALL_LEARNABLE_COURSE_ID }))
                }}
              >删除课程</button>
            </div>
          ))}
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
                <dd>
                  {TEST_WORDS[i * PACK_META.chapterSize]?.word} …
                  <button
                    type="button"
                    onClick={async () => {
                      const course: Course = {
                        id: `chapter-${i + 1}`,
                        title: `第 ${i + 1} 章`,
                        packId: TEM8_PACK.packId,
                        wordIds: chapterWordIds(i + 1),
                        dailyGoal: settings.dailyGoal,
                        mode: 'chapter',
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                      }
                      setCourses((prev) => {
                        const others = prev.filter((item) => item.id !== course.id)
                        return [...others, course]
                      })
                      setSettings((s) => ({ ...s, courseId: course.id }))
                    }}
                  >选此章</button>
                </dd>
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
        <main className={`siege ${state.stage === 'mastered' ? 'stage-mastered' : ''}`}>
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
            <p className="count">{Math.min(progress.total, progress.done + (state.stage === 'mastered' ? 0 : 1))}/{progress.total || PACK_META.learnableCount}</p>
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
              {settings.keyboardMode === 'system' ? (
                <input
                  ref={inputRef}
                  value={displayedInput(state, draft)}
                  onChange={(e) => {
                    if (composing.current) return
                    const previous = displayedInput(stateRef.current, draftRef.current)
                    for (const action of systemValueToActions(previous, e.target.value)) routeAction(action)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      routeAction({ type: 'submitAnswer', source: 'system' })
                    }
                  }}
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
                    const previous = displayedInput(stateRef.current, draftRef.current)
                    for (const action of systemValueToActions(previous, previous + (e.data ?? ''))) routeAction(action)
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
              ) : (
                <div className="spell spell-display" aria-label="拼写输入" aria-live="polite">
                  {displayedInput(state, draft) || ' '}
                </div>
              )}
              <div className="kb-toggle">
                <button type="button" onClick={() => setSettings((s) => ({ ...s, keyboardMode: s.keyboardMode === 'app' ? 'system' : 'app' }))}>
                  {settings.keyboardMode === 'app' ? '改用系统键盘' : '改用应用键盘'}
                </button>
              </div>
              {settings.keyboardMode === 'app' ? (
                <EnglishKeyboard disabled={!typing} largeKeys={settings.largeKeys} onAction={routeAction} />
              ) : null}
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
                  const nextIndex = nextCourseCatalogIndex(courseWordIds, currentWord(state).id)
                  if (nextIndex == null) {
                    const r = nextWord(state)
                    if (!r.ok) {
                      setScreen('home')
                      return
                    }
                    setState(r.next)
                    if (r.next.allDone) setScreen('home')
                    return
                  }
                  const r = nextWord(state)
                  if (!r.ok) return
                  const jumped = createInitialState({
                    ...r.next,
                    wordIndex: nextIndex,
                    learnIndex: nextIndex,
                    stage: 'understand',
                    allDone: false,
                  })
                  setState(jumped)
                  setScreen('siege')
                  queueMicrotask(() => {
                    if (settings.keyboardMode === 'system') inputRef.current?.focus()
                  })
                }}
              >
                继续下一个词
              </button>
            </section>
          ) : null}
          {coach && settings.characterMode !== 'hidden' ? (
            <aside className="coach" aria-live="polite">
              <CastPortrait id={coach.character} compact />
              <div>
                <p className="coach-name">{characterLabel(coach.character)}</p>
                <p>{coach.text}</p>
              </div>
            </aside>
          ) : null}
          <p className="message">{state.message || speechMsg}</p>
        </main>
      )}
    </div>
  )
}
