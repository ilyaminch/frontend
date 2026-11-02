import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiClient, ApiError, errorText, isAborted } from './api'
import { Login } from './components/Login'
import { LayerPanel } from './components/LayerPanel'
import { ObjectCard } from './components/ObjectCard'
import { MapView } from './components/MapView'
import { ChatPanel } from './components/ChatPanel'
import { Icon } from './components/Icon'
import { AdminWorkspace } from './components/AdminWorkspace'
import { quantity } from './format'
import { combineLayers, featureKey } from './mapLayers'
import type { AuthResponse, CardResponse, ChatEntry, Layer, LayerCode, MapFeature, SearchResult } from './types'

// Empty rendering state only; never used as a server response or a card version.
const emptyMap: SearchResult = { kind: 'objects', dataset_version: '0', category: null, count: 0, feature_collection: { type: 'FeatureCollection', features: [] }, region_counts: null, matched_object_count: 0, map_action: 'replace' }
type RequestKind = 'auth' | 'catalog' | 'layer' | 'card' | 'dialogue' | 'message'

export default function LiveApp() {
  const [route, setRoute] = useState(() => window.location.hash)
  const [dataNotice, setDataNotice] = useState<string | null>(null)
  const [api] = useState(() => new ApiClient())
  const [auth, setAuth] = useState<AuthResponse | null>(null)
  const [checking, setChecking] = useState(true)
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const [logoutFailed, setLogoutFailed] = useState(false)
  const [layers, setLayers] = useState<Layer[]>([])
  const [enabled, setEnabled] = useState<LayerCode[]>(['park'])
  const [result, setResult] = useState<SearchResult>(emptyMap)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [card, setCard] = useState<CardResponse | null>(null)
  const [cardBusy, setCardBusy] = useState(false)
  const [cardError, setCardError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatEntry[]>([])
  const [chatBusy, setChatBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [chatReady, setChatReady] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const pending = useRef<Partial<Record<RequestKind, AbortController>>>({})
  const epoch = useRef(0)
  const mapGeneration = useRef(0)
  const cardGeneration = useRef(0)
  const dialogueGeneration = useRef(0)
  const dialogue = useRef<string | null>(null)
  const sending = useRef(false)
  const creatingSession = useRef(false)
  const loggingOut = useRef(false)
  const enabledRef = useRef<LayerCode[]>(['park'])
  const snapshots = useRef<Partial<Record<LayerCode, SearchResult>>>({})
  const resultRef = useRef<SearchResult>(emptyMap)
  const lastFeature = useRef<string | null>(null)
  const mapSessionEpoch = useRef<number | null>(null)
  const page = route === '#/map' ? 'map' : route === '#/admin/import' ? 'import' : route === '#/admin/layers' ? 'layers' : auth?.user.role === 'admin' ? 'layers' : 'map'
  useEffect(() => {
    const updateRoute = () => setRoute(window.location.hash)
    window.addEventListener('hashchange', updateRoute)
    return () => window.removeEventListener('hashchange', updateRoute)
  }, [])
  function navigate(target: 'map' | 'layers' | 'import') { window.location.hash = target === 'map' ? '/map' : `/admin/${target}` }

  const startRequest = useCallback((kind: RequestKind) => {
    pending.current[kind]?.abort()
    const controller = new AbortController(); pending.current[kind] = controller
    return controller
  }, [])
  const invalidate = useCallback(() => {
    for (const controller of Object.values(pending.current)) controller.abort()
    epoch.current++; mapGeneration.current++; cardGeneration.current++; dialogueGeneration.current++
    dialogue.current = null; sending.current = false; creatingSession.current = false
  }, [])
  const clearProtected = useCallback(() => {
    invalidate(); api.clearSession()
    setAuth(null); setLayers([]); setResult(emptyMap); resultRef.current = emptyMap
    setEnabled(['park']); enabledRef.current = ['park']; snapshots.current = {}; setCard(null); setCardBusy(false); setCardError(null)
    setBusy(false); setError(null); setMessages([]); setChatBusy(false); setCreating(false)
    setChatReady(false); setSessionError(null); setChecking(false)
    setDataNotice(null)
  }, [api, invalidate])

  useEffect(() => {
    api.onUnauthorized = () => { clearProtected(); setAuthNotice('Сеанс завершён. Войдите снова.') }
    const controller = startRequest('auth')
    void api.me(controller.signal).then(response => {
      if (controller.signal.aborted) return
      api.setSession(response); setAuth(response); setAuthNotice(null)
    }).catch(cause => {
      if (isAborted(cause)) return
      if (!(cause instanceof ApiError && cause.status === 401)) setAuthNotice(errorText(cause))
    }).finally(() => { if (!controller.signal.aborted) setChecking(false) })
    return () => { api.onUnauthorized = null; invalidate() }
  }, [api, clearProtected, invalidate, startRequest])

  const loadLayers = useCallback(async (codes: LayerCode[], reload = false) => {
    const controller = startRequest('layer')
    pending.current.card?.abort(); cardGeneration.current++
    const request = ++mapGeneration.current; const authEpoch = epoch.current
    enabledRef.current = codes; setEnabled(codes); setError(null)
    setCard(null); setCardBusy(false); setCardError(null)
    const cached = reload ? {} : snapshots.current
    // Remove disabled geometry immediately, even if another layer is still loading.
    const previous = codes.flatMap(code => cached[code] ? [cached[code]!] : [])
    const shown = combineLayers(previous, emptyMap)
    resultRef.current = shown; setResult(shown)
    const missing = codes.filter(code => !cached[code])
    setBusy(missing.length > 0)
    try {
      const responses = await Promise.all(missing.map(async code => [code, (await api.layer(code, controller.signal)).result] as const))
      if (controller.signal.aborted || request !== mapGeneration.current || authEpoch !== epoch.current) return
      const next = { ...cached, ...Object.fromEntries(responses) }
      const combined = combineLayers(codes.map(code => next[code]!), emptyMap)
      snapshots.current = Object.fromEntries(codes.map(code => [code, next[code]])); resultRef.current = combined; setResult(combined)
    } catch (cause) {
      if (!isAborted(cause) && request === mapGeneration.current && authEpoch === epoch.current) {
        if (cause instanceof Error && cause.message === 'DATA_CHANGED') {
          snapshots.current = {}; resultRef.current = emptyMap; setResult(emptyMap)
          setError('Версия данных изменилась. Обновите включённые слои, чтобы загрузить их из одной версии.')
        } else setError(errorText(cause))
      }
    } finally { if (request === mapGeneration.current && authEpoch === epoch.current) setBusy(false) }
  }, [api, startRequest])
  function toggleLayer(code: LayerCode) {
    const codes = enabledRef.current.includes(code) ? enabledRef.current.filter(item => item !== code) : [...enabledRef.current, code]
    void loadLayers(codes)
  }

  const loadCatalog = useCallback(async () => {
    const controller = startRequest('catalog'); const authEpoch = epoch.current
    const mapRequest = ++mapGeneration.current
    pending.current.layer?.abort(); pending.current.card?.abort(); cardGeneration.current++
    setCard(null); setCardBusy(false); setCardError(null)
    setBusy(true); setError(null)
    try {
      const response = await api.layers(controller.signal)
      if (controller.signal.aborted || authEpoch !== epoch.current) return
      setLayers(response.layers)
      if (mapRequest !== mapGeneration.current) return
      const codes = enabledRef.current.filter(code => response.layers.some(layer => layer.code === code))
      if (response.layers.length) await loadLayers(codes, true)
      else { setError('Реестр слоёв пуст. Повторите загрузку позже.'); setBusy(false) }
    } catch (cause) {
      if (!isAborted(cause) && authEpoch === epoch.current && mapRequest === mapGeneration.current) { setError(errorText(cause)); setBusy(false) }
    }
  }, [api, loadLayers, startRequest])

  const newDialogue = useCallback(async () => {
    if (creatingSession.current) return
    creatingSession.current = true
    pending.current.message?.abort()
    const controller = startRequest('dialogue')
    const previous = dialogue.current; dialogue.current = null
    const request = ++dialogueGeneration.current; const authEpoch = epoch.current
    sending.current = false; setChatBusy(false); setMessages([]); setCreating(true); setChatReady(false); setSessionError(null)
    try {
      if (previous) {
        try { await api.deleteDialogue(previous) }
        catch (cause) {
          if (cause instanceof ApiError && cause.status === 401) return
          if (!(cause instanceof ApiError && [404, 409].includes(cause.status)) && authEpoch === epoch.current && request === dialogueGeneration.current) {
            setMessages([{ id: crypto.randomUUID(), sender: 'assistant', error: true, text: 'Не удалось подтвердить закрытие прежнего диалога. Его поздние ответы не будут применены.' }])
          }
        }
      }
      if (controller.signal.aborted || authEpoch !== epoch.current || request !== dialogueGeneration.current) return
      const response = await api.createDialogue(controller.signal)
      if (controller.signal.aborted || request !== dialogueGeneration.current || authEpoch !== epoch.current) {
        if (authEpoch === epoch.current) void api.deleteDialogue(response.dialogue_id).catch(() => {})
        return
      }
      dialogue.current = response.dialogue_id; setChatReady(true)
    } catch (cause) {
      if (!isAborted(cause) && request === dialogueGeneration.current && authEpoch === epoch.current) setSessionError(errorText(cause))
    } finally { if (request === dialogueGeneration.current && authEpoch === epoch.current) { creatingSession.current = false; setCreating(false) } }
  }, [api, startRequest])

  useEffect(() => {
    if (!auth || page !== 'map') return
    void loadCatalog()
    if (mapSessionEpoch.current !== epoch.current) { mapSessionEpoch.current = epoch.current; void newDialogue() }
  }, [auth, page, loadCatalog, newDialogue])
  useEffect(() => {
    if (!auth) return
    const timer = window.setTimeout(() => { clearProtected(); setAuthNotice('Сеанс завершён. Войдите снова.') }, Math.max(0, Date.parse(auth.expires_at) - Date.now()))
    return () => clearTimeout(timer)
  }, [auth, clearProtected])

  async function authenticate(login: string, password: string) {
    const response = await api.login(login, password)
    api.setSession(response); setAuthNotice(null); setLogoutFailed(false); setAuth(response)
  }
  async function logout() {
    if (loggingOut.current) return
    loggingOut.current = true
    window.history.replaceState(null, '', window.location.pathname + window.location.search); setRoute('')
    invalidate(); setAuth(null); setLayers([]); setResult(emptyMap); resultRef.current = emptyMap
    setCard(null); setCardBusy(false); setCardError(null); setMessages([]); setChatBusy(false)
    setChatReady(false); setCreating(false); setSessionError(null); setChecking(true); setAuthNotice(null)
    try { await api.logout(); clearProtected(); setLogoutFailed(false) }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { clearProtected(); setLogoutFailed(false) }
      else { setLogoutFailed(true); setAuthNotice(`Выход не подтверждён сервером. ${errorText(cause)}`) }
    } finally { loggingOut.current = false; setChecking(false) }
  }
  function dataChanged() {
    pending.current.catalog?.abort(); pending.current.layer?.abort(); pending.current.card?.abort()
    mapGeneration.current++; cardGeneration.current++; snapshots.current = {}
    resultRef.current = emptyMap; setResult(emptyMap); setCard(null); setCardBusy(false); setCardError(null); setError(null); setBusy(false)
    setDataNotice('Данные могли обновиться. Повторите поиск, чтобы получить актуальный результат.')
  }
  async function selectFeature(feature: MapFeature) {
    if (busy || error) return
    const snapshot = resultRef.current; const mapRequest = mapGeneration.current; const authEpoch = epoch.current
    const controller = startRequest('card'); const request = ++cardGeneration.current
    lastFeature.current = featureKey(feature); setCard(null); setCardBusy(true); setCardError(null)
    try {
      const response = await api.card(feature.id, snapshot.dataset_version, !('category_code' in feature.properties), controller.signal)
      if (controller.signal.aborted || request !== cardGeneration.current || mapRequest !== mapGeneration.current || authEpoch !== epoch.current) return
      if (response.dataset_version !== snapshot.dataset_version) throw new ApiError('Данные изменились. Обновите слой.', 'DATA_CHANGED', 409)
      setCard(response)
    } catch (cause) {
      if (!isAborted(cause) && request === cardGeneration.current && authEpoch === epoch.current) setCardError(errorText(cause))
    } finally { if (request === cardGeneration.current && authEpoch === epoch.current) setCardBusy(false) }
  }
  function closeCard() {
    pending.current.card?.abort(); cardGeneration.current++; setCard(null); setCardBusy(false); setCardError(null)
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-feature-id="${CSS.escape(lastFeature.current ?? '')}"]`)?.focus())
  }
  async function send(text: string) {
    const id = dialogue.current
    if (sending.current || !id || !text.trim()) return
    const clientRequestId = crypto.randomUUID(); const request = dialogueGeneration.current
    const authEpoch = epoch.current; const mapRequest = mapGeneration.current
    const controller = startRequest('message')
    sending.current = true; setChatBusy(true)
    setMessages(current => [...current, { id: clientRequestId, sender: 'user', text: text.trim() }])
    try {
      const response = await api.message(id, clientRequestId, text.trim(), controller.signal)
      if (controller.signal.aborted || authEpoch !== epoch.current || request !== dialogueGeneration.current || dialogue.current !== id) return
      if (response.dialogue_id !== id || response.client_request_id !== clientRequestId) throw new ApiError('Получен ответ другого запроса. Создайте новый диалог.', 'INVALID_RESPONSE')
      const mapPreserved = response.outcome === 'result' && mapRequest !== mapGeneration.current
      if (response.outcome === 'result' && !mapPreserved) {
        pending.current.layer?.abort(); pending.current.card?.abort(); mapGeneration.current++; cardGeneration.current++
        resultRef.current = response.result; setResult(response.result); setError(null); setBusy(false)
        setCard(null); setCardBusy(false); setCardError(null)
        const code = response.result.kind === 'objects' ? response.result.category as LayerCode : 'regions'
        if (code) { enabledRef.current = [code]; setEnabled([code]); snapshots.current = { [code]: response.result } }
      }
      setMessages(current => [...current, {
        id: crypto.randomUUID(), sender: 'assistant', text: response.message,
        options: response.outcome === 'clarification' ? response.options : undefined, mapPreserved,
        regionCounts: response.outcome === 'result' ? response.result.region_counts : null,
      }])
    } catch (cause) {
      if (isAborted(cause) || authEpoch !== epoch.current || request !== dialogueGeneration.current) return
      setMessages(current => [...current, { id: crypto.randomUUID(), sender: 'assistant', text: cause instanceof ApiError ? cause.message : errorText(cause), error: true, code: cause instanceof ApiError ? cause.code : undefined, requestId: cause instanceof ApiError ? cause.requestId : undefined }])
      if (cause instanceof ApiError && ['CHAT_SESSION_NOT_FOUND', 'CHAT_SESSION_CLOSED'].includes(cause.code)) {
        dialogue.current = null; setChatReady(false); setSessionError('Диалог недоступен. Создайте новый диалог для продолжения.')
      }
    } finally { if (authEpoch === epoch.current && request === dialogueGeneration.current) { sending.current = false; setChatBusy(false) } }
  }

  if (!auth) return <Login authenticate={authenticate} checking={checking} initialError={authNotice} retryLogout={logoutFailed ? () => void logout() : undefined} />
  if (page !== 'map') return <AdminWorkspace key={auth.user.id} api={api} user={auth.user} page={page} navigate={navigate} logout={() => void logout()} onChanged={dataChanged} />
  const layerNames = layers.filter(item => enabled.includes(item.code)).map(item => item.name).join(', ')
  return <div className="app-shell">
    <header className="topbar">
      <div className="product-project"><div className="product"><span className="brand-mark"><Icon name="brand" size={19} /></span><div><strong>ГИС-помощник</strong><p>Единая карта объектов</p></div></div><div className="project"><span>Проект</span><strong>Городская инфраструктура Томска</strong></div></div>
      <div className="topbar-right"><button className="outline registry-link" onClick={() => navigate('layers')}><Icon name="admin-layers-inactive" size={14} />{auth.user.role === 'admin' ? 'Администрирование' : 'Реестр слоёв'}</button><span className="api-status"><i />Подключено к API</span><div className="current-user"><span className="avatar">{auth.user.role === 'admin' ? 'АД' : 'ПЛ'}</span><strong title={auth.user.login}>{auth.user.login}<small className="user-role">{auth.user.role === 'admin' ? 'Администратор' : 'Пользователь'}</small></strong><button className="icon-button logout" onClick={() => void logout()} aria-label="Выйти"><Icon name="logout" size={14} /></button></div></div>
    </header>
    <main className="workspace">
      {card ? <ObjectCard card={card} onClose={closeCard} /> : cardBusy || cardError ? <section className="left-panel"><div className="panel-heading"><h2>Информация об объекте</h2><button className="icon-button" aria-label="Закрыть карточку" onClick={closeCard}><Icon name="close" size={16} /></button></div><div className="panel-state" role={cardError ? 'alert' : 'status'}>{cardBusy ? <span className="spinner" /> : <Icon name="alert" size={20} />}<p>{cardError || 'Загружаем карточку…'}</p>{cardError && <button className="outline" onClick={() => void loadCatalog()}>Обновить слой</button>}</div></section> : <LayerPanel layers={layers} enabled={enabled} result={result} busy={busy} error={error} onLayer={toggleLayer} onSelect={feature => void selectFeature(feature)} onReload={() => void loadCatalog()} />}
      <section className="map-panel" aria-label="Карта и включённые слои"><div className="map-toolbar"><div><Icon name="filter" size={14} /><span>Слои:</span><strong>{error ? 'Последняя загрузка не выполнена' : `${layerNames || 'Слои выключены'} · ${busy ? 'загрузка…' : quantity(result.count, ['объект', 'объекта', 'объектов'])}`}</strong></div><span className="projection">EPSG:3857</span></div><MapView result={result} selected={card ? featureKey(card.feature) : null} onSelect={feature => void selectFeature(feature)} simulateTileError={false} />{error && <div className="map-data-error" role="status">{result === emptyMap ? 'Данные не загружены. Обновите включённые слои.' : 'Часть слоёв не загружена. Обновите включённые слои.'}</div>}{dataNotice && !error && <div className="map-data-notice" role="status"><span>{dataNotice}</span><button className="icon-button" aria-label="Закрыть уведомление" onClick={() => setDataNotice(null)}><Icon name="close" size={14} /></button></div>}</section>
      <ChatPanel live={{ messages, busy: chatBusy, creating, ready: chatReady, sessionError, onSend: text => void send(text), onNew: () => void newDialogue() }} />
    </main>
  </div>
}
