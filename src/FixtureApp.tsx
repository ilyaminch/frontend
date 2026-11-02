import { useEffect, useRef, useState } from 'react'
import { Login } from './components/Login'
import { LayerPanel } from './components/LayerPanel'
import { ObjectCard } from './components/ObjectCard'
import { MapView } from './components/MapView'
import { ChatPanel } from './components/ChatPanel'
import { Icon } from './components/Icon'
import { fixtureCard, fixtureResult, layers } from './fixtures'
import { quantity } from './format'
import { combineLayers, featureKey } from './mapLayers'
import type { CardResponse, LayerCode, MapFeature, PreviewState, User } from './types'

const mode = import.meta.env.VITE_DATA_MODE
const previewStates: [PreviewState, string][] = [['normal', 'Обычное'], ['loading', 'Загрузка слоя'], ['empty', 'Пустой слой'], ['error', 'Ошибка данных'], ['changed', 'Данные изменились'], ['tiles', 'Подложка недоступна'], ['expired', 'Вход истёк']]

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [expired, setExpired] = useState(false)
  const [active, setActive] = useState<LayerCode>('park')
  const [enabled, setEnabled] = useState<LayerCode[]>(['park'])
  const enabledRef = useRef<LayerCode[]>(['park'])
  const [result, setResult] = useState(() => fixtureResult('park'))
  const [card, setCard] = useState<CardResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardBusy, setCardBusy] = useState(false)
  const [cardError, setCardError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewState>('normal')
  const generation = useRef(0)
  const cardGeneration = useRef(0)
  const lastFeatureId = useRef<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  const cardController = useRef<AbortController | null>(null)
  useEffect(() => () => { controller.current?.abort(); cardController.current?.abort() }, [])

  async function selectLayer(code: LayerCode, state: PreviewState = 'normal', toggle = false) {
    const codes = toggle ? enabledRef.current.includes(code) ? enabledRef.current.filter(item => item !== code) : [...enabledRef.current, code] : enabledRef.current
    enabledRef.current = codes; setEnabled(codes)
    controller.current?.abort(); cardController.current?.abort()
    const request = ++generation.current
    ++cardGeneration.current
    const abort = new AbortController(); controller.current = abort
    setActive(code); setBusy(true); setError(null); setCard(null); setCardError(null); setCardBusy(false)
    await new Promise(resolve => setTimeout(resolve, state === 'loading' ? 4500 : 350))
    if (abort.signal.aborted || request !== generation.current) return
    if (state === 'error') {
      setError('Не удалось загрузить слой. Повторите загрузку.'); setBusy(false); return
    }
    setResult(combineLayers(codes.map(item => fixtureResult(item, state === 'empty')), { ...fixtureResult(code, true), category: null })); setBusy(false)
  }
  async function selectFeature(feature: MapFeature) {
    if (busy || error || preview === 'empty') return
    lastFeatureId.current = featureKey(feature)
    cardController.current?.abort()
    const abort = new AbortController(); cardController.current = abort
    const request = ++cardGeneration.current
    const layerRequest = generation.current
    setCardBusy(true); setCardError(null); setCard(null)
    await new Promise(resolve => setTimeout(resolve, 300))
    if (abort.signal.aborted || request !== cardGeneration.current || layerRequest !== generation.current) return
    setCardBusy(false)
    if (preview === 'changed') { setCardError('Данные изменились. Обновите слой, чтобы открыть актуальную карточку.'); return }
    setCard(fixtureCard(feature, result.dataset_version))
  }
  function closeCard() {
    cardController.current?.abort(); ++cardGeneration.current
    setCard(null); setCardBusy(false); setCardError(null)
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-feature-id="${CSS.escape(lastFeatureId.current ?? '')}"]`)?.focus())
  }
  function logout(isExpired = false) {
    ++generation.current; ++cardGeneration.current
    controller.current?.abort(); cardController.current?.abort()
    setUser(null); setExpired(isExpired); setCard(null); setCardError(null); setCardBusy(false)
    setResult(fixtureResult('park')); setActive('park'); setEnabled(['park']); enabledRef.current = ['park']; setBusy(false); setError(null); setPreview('normal')
  }
  function changePreview(state: PreviewState) {
    setPreview(state)
    if (state === 'expired') { logout(true); return }
    void selectLayer(active, state)
  }
  if (mode !== 'fixtures') return <main className="setup-state"><Icon name="alert" size={24} /><h1>Подключение к API ещё не настроено</h1><p>Эта версия подготовлена для просмотра интерфейса с примерами. Режим реального API будет подключён после подготовки стенда.</p><p>Для локального просмотра используйте VITE_DATA_MODE=fixtures.</p></main>
  if (!user) return <Login expired={expired} onLogin={setUser} />
  const layerNames = layers.filter(l => enabled.includes(l.code)).map(l => l.name).join(', ')
  return <div className="app-shell">
    <header className="topbar">
      <div className="product-project"><div className="product"><span className="brand-mark"><Icon name="brand" size={19} /></span><div><strong>ГИС-помощник</strong><p>Единая карта объектов</p></div></div><div className="project"><span>Проект</span><strong>Городская инфраструктура Томска</strong></div></div>
      <div className="topbar-right"><details className="preview-menu"><summary><i />Примеры данных · без API</summary><div className="preview-popover"><strong>Просмотр состояний</strong><p>Искусственные данные, запросы к серверу не выполняются.</p><label htmlFor="preview-state">Состояние интерфейса</label><select id="preview-state" value={preview} onChange={e => changePreview(e.target.value as PreviewState)}>{previewStates.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></details><div className="current-user"><span className="avatar">ДМ</span><strong>{user.login}</strong><button className="icon-button logout" onClick={() => logout()} aria-label="Выйти"><Icon name="logout" size={14} /></button></div></div>
    </header>
    <main className="workspace">
      {card ? <ObjectCard card={card} onClose={closeCard} /> : cardBusy || cardError ? <section className="left-panel"><div className="panel-heading"><h2>Информация об объекте</h2><button className="icon-button" aria-label="Закрыть карточку" onClick={closeCard}><Icon name="close" size={16} /></button></div><div className="panel-state" role={cardError ? 'alert' : 'status'}>{cardBusy ? <span className="spinner" /> : <Icon name="alert" size={20} />}<p>{cardError || 'Загружаем карточку…'}</p>{cardError && <button className="outline" onClick={() => { setPreview('normal'); void selectLayer(active) }}>Обновить слой</button>}</div></section> : <LayerPanel layers={layers} fixture enabled={enabled} result={result} busy={busy} error={error} onLayer={code => { setPreview('normal'); void selectLayer(code, 'normal', true) }} onSelect={feature => void selectFeature(feature)} onReload={() => { setPreview('normal'); void selectLayer(active) }} />}
      <section className="map-panel" aria-label="Карта и включённые слои"><div className="map-toolbar"><div><Icon name="filter" size={14} /><span>Слои:</span><strong>{error ? 'Последняя загрузка не выполнена' : `${layerNames || 'Слои выключены'} · ${busy ? 'загрузка…' : quantity(result.count, ['объект', 'объекта', 'объектов'])}`}</strong></div><span className="projection">EPSG:3857</span></div><MapView result={result} selected={card ? featureKey(card.feature) : null} onSelect={feature => void selectFeature(feature)} simulateTileError={preview === 'tiles'} />{error && <div className="map-data-error" role="status">Показана предыдущая выборка. Обновите слой для повторной загрузки.</div>}</section>
      <ChatPanel />
    </main>
  </div>
}
