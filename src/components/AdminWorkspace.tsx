import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiClient, errorText, isAborted } from '../api'
import { failedOperation } from '../adminOperation'
import { quantity } from '../format'
import type { AdminOperation, LayerCode, LayersResponse, User } from '../types'
import { Icon } from './Icon'
import { AdminNotice } from './AdminNotice'
import { ImportPanel } from './ImportPanel'

const geometryNames: Record<string, string> = { Point: 'Точка', LineString: 'Линия', Polygon: 'Полигон', MultiPolygon: 'Мультиполигон' }
const colors: Record<LayerCode, string> = { park: '#3f8a68', school: '#3576a8', hospital: '#b74e48', pharmacy: '#156b73', improvement_zone: '#b77b22', regions: '#7857a4' }
const date = (value: string | null) => value ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tomsk', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Нет данных'

export function AdminWorkspace({ api, user, page, navigate, logout, onChanged }: {
  api: ApiClient; user: User; page: 'layers' | 'import'; navigate: (page: 'map' | 'layers' | 'import') => void;
  logout: () => void; onChanged: () => void
}) {
  const [registry, setRegistry] = useState<LayersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [maxBytes, setMaxBytes] = useState<number | null>(null)
  const [limitsError, setLimitsError] = useState<string | null>(null)
  const [operation, setOperation] = useState<AdminOperation | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [importLayer, setImportLayer] = useState<LayerCode>('school')
  const [formKey, setFormKey] = useState(0)
  const reader = useRef<AbortController | null>(null)
  const mutation = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const restoring = useRef(false)
  const mounted = useRef(true)
  const admin = user.role === 'admin'
  const readRegistry = useCallback(async (controller: AbortController, request: number) => {
    try {
      const response = await api.layers(controller.signal)
      if (controller.signal.aborted || request !== generation.current || !mounted.current) return null
      setRegistry(response); return response
    } catch (cause) { if (!isAborted(cause) && mounted.current && request === generation.current) setLoadError(errorText(cause)); return null }
    finally { if (mounted.current && request === generation.current) setLoading(false) }
  }, [api])
  const refresh = useCallback(() => {
    reader.current?.abort(); const controller = new AbortController(); reader.current = controller
    const request = ++generation.current; setLoading(true); setLoadError(null)
    return readRegistry(controller, request)
  }, [readRegistry])
  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    const registryController = new AbortController(); reader.current = registryController
    void readRegistry(registryController, ++generation.current)
    void api.capabilities(controller.signal).then(response => {
      const limit = response.limits.import_file_bytes
      if (!controller.signal.aborted && Number.isFinite(limit) && limit > 0) { setMaxBytes(limit); setLimitsError(null) }
      else if (!controller.signal.aborted) setLimitsError('Сервер не сообщил лимит импорта. Обновите страницу.')
    }).catch(cause => { if (!isAborted(cause)) setLimitsError(errorText(cause)) })
    return () => { mounted.current = false; controller.abort(); registryController.abort(); reader.current?.abort(); mutation.current?.abort() }
  }, [api, readRegistry])
  async function restore() {
    if (!admin || !confirmRestore || busy || restoring.current || !registry) return
    restoring.current = true; setBusy(true); setConfirmRestore(false)
    const controller = new AbortController(); mutation.current = controller
    const before = registry.dataset_version
    try {
      let outcome: AdminOperation
      try {
        const response = await api.restore(controller.signal)
        if (!mounted.current || controller.signal.aborted) return
        outcome = { kind: 'success', title: 'Демонстрационный набор восстановлен', message: response.message, beforeVersion: before, afterVersion: response.dataset_version, requestId: response.request_id }; onChanged()
      } catch (cause) {
        if (isAborted(cause) || !mounted.current) return
        outcome = failedOperation(cause, before); if (outcome.kind === 'unknown') onChanged()
      }
      setOperation(outcome)
      const fresh = await refresh()
      if (mounted.current) setOperation(fresh ? { ...outcome, afterVersion: fresh.dataset_version } : { ...outcome, message: `${outcome.message} Реестр не удалось обновить — повторите его загрузку вручную.` })
    } finally { if (mounted.current) { restoring.current = false; setBusy(false) } }
  }

  function chooseImport(code?: LayerCode) {
    if (busy) return
    if (code) { setImportLayer(code); setFormKey(key => key + 1) }
    navigate('import')
  }
  const layers = registry?.layers ?? []
  const total = layers.reduce((sum, layer) => sum + layer.feature_count, 0)
  const withData = layers.filter(layer => layer.feature_count > 0).length
  return <div className="app-shell admin-shell">
    <header className="topbar admin-topbar"><div className="product-project"><div className="product"><span className="brand-mark"><Icon name="admin-brand" size={19} /></span><div><strong>ГИС-помощник</strong><p>Единая карта объектов</p></div></div><div className="project"><span>{admin ? 'Закрытый раздел' : 'Данные проекта'}</span><strong>{admin ? 'Консоль администратора' : 'Реестр слоёв'}</strong></div></div><div className="topbar-right"><span className="api-status"><Icon name="admin-shield" size={13} />{admin ? 'Права проверены сервером' : 'Доступ к реестру'}</span><div className="current-user"><span className="avatar">{admin ? 'АД' : 'ПЛ'}</span><strong>{user.login}</strong><button className="outline admin-logout" onClick={logout}><Icon name="admin-logout" size={14} />Выйти</button></div></div></header>
    <main className="admin-workspace"><aside className="admin-sidebar"><h2>{admin ? 'Администрирование' : 'Данные проекта'}</h2><nav aria-label="Разделы данных"><button className={page === 'layers' ? 'active' : ''} aria-current={page === 'layers' ? 'page' : undefined} onClick={() => navigate('layers')}><Icon name={page === 'layers' ? 'admin-layers-active' : 'admin-layers-inactive'} size={16} /><span>Слои</span></button>{admin && <><button className={page === 'import' ? 'active' : ''} aria-current={page === 'import' ? 'page' : undefined} onClick={() => chooseImport()}><Icon name={page === 'import' ? 'admin-import-active' : 'admin-import-inactive'} size={16} /><span>Импорт данных</span></button><button disabled title="Настройки модели не входят в текущий MVP"><Icon name="admin-settings" size={16} /><span>Настройки LLM</span></button></>}</nav><button className="admin-back-map" onClick={() => navigate('map')} disabled={busy}><Icon name="regions" size={14} />Открыть карту</button><div className="admin-session"><strong><Icon name="admin-lock" size={14} />Сеанс {admin ? 'администратора' : 'пользователя'}</strong><p>Доступ разрешён после серверной проверки роли.</p></div></aside>
    <div className="admin-content">
      {loadError && <div className="admin-load-error" role="alert"><p>{loadError}</p><button className="outline" onClick={() => void refresh()}>Повторить загрузку реестра</button></div>}
      {limitsError && admin && <div className="admin-load-error" role="alert"><p>{limitsError}</p><button className="outline" onClick={() => window.location.reload()}>Обновить страницу</button></div>}
      <section className="admin-page registry-page" hidden={page !== 'layers'} aria-labelledby="registry-title">
        <div className="admin-page-heading"><div><h1 id="registry-title">Реестр слоёв</h1><p>Состав и состояние пространственных данных проекта</p></div>{admin && <div className="admin-page-actions"><button className="outline" disabled={busy || !registry} onClick={() => setConfirmRestore(true)}><Icon name="admin-restore" size={14} />Восстановить демонстрационный набор</button><button className="primary" disabled={busy || !layers.some(layer => layer.can_import)} onClick={() => chooseImport()}><Icon name="admin-import-white" size={14} />Импортировать данные</button></div>}</div>
        <div className="registry-summary"><div><strong>{quantity(layers.length, ['слой', 'слоя', 'слоёв'])} · {quantity(total, ['объект', 'объекта', 'объектов'])}</strong><p>{registry ? `Версия данных: ${registry.dataset_version}` : 'Загружаем реестр…'}</p></div><div><span className="admin-badge"><Icon name="admin-database" size={12} />{withData} с данными · {layers.length - withData} пустых</span><button className="icon-button" disabled={loading || busy} onClick={() => void refresh()} aria-label="Обновить реестр"><Icon name="admin-restore" size={14} /></button></div></div>
        <div className="registry-table-wrap" aria-busy={loading}><table className="registry-table"><thead><tr><th>Название</th><th>Тип геометрии</th><th>Количество объектов</th><th>Дата обновления</th><th>Статус</th></tr></thead><tbody>{layers.map(layer => <tr key={layer.code}><td><span className="registry-layer-name"><i style={{ background: colors[layer.code] }} />{admin && layer.can_import ? <button disabled={busy} onClick={() => chooseImport(layer.code)} title={`Импортировать слой «${layer.name}»`}>{layer.name}</button> : <strong>{layer.name}</strong>}</span></td><td>{layer.geometry_types.map(type => geometryNames[type] ?? type).join(', ') || 'Нет данных'}</td><td>{layer.feature_count}</td><td>{date(layer.updated_at)}</td><td><span className={`registry-status ${layer.feature_count ? 'has-data' : ''}`}><i />{layer.feature_count ? 'Загружен' : 'Нет объектов'}</span></td></tr>)}</tbody></table>{loading && !registry && <div className="panel-state" role="status"><span className="spinner" />Загружаем слои…</div>}</div>
        <div className="registry-bottom"><div className="admin-card last-operation"><h2>Результат последней операции</h2>{operation ? <AdminNotice operation={operation} /> : <p className="no-operations">Операции в этом сеансе ещё не выполнялись.</p>}{operation?.kind === 'success' && <button className="text-button" onClick={() => navigate('map')}>Открыть карту и повторить поиск</button>}</div>{confirmRestore && <section className="restore-confirm" aria-label="Подтверждение восстановления"><strong><Icon name="admin-alert" size={16} />Восстановить демонстрационный набор?</strong><p>Все текущие геоданные будут заменены доверенным пакетом сервера. Действие требует подтверждения.</p><div><button className="outline" onClick={() => setConfirmRestore(false)}>Отмена</button><button className="danger-button" onClick={() => void restore()} disabled={busy}>Подтвердить восстановление</button></div></section>}</div>
        {busy && <div className="chat-waiting" role="status"><span className="spinner" />Ожидаем результат операции на сервере…</div>}
      </section>
      {admin ? <ImportPanel key={formKey} api={api} layers={layers} version={registry?.dataset_version ?? null} maxBytes={maxBytes} hidden={page !== 'import'} initialLayer={importLayer} onBusy={setBusy} onOperation={setOperation} onChanged={onChanged} refresh={refresh} /> : page === 'import' && <section className="admin-page"><h1>Недостаточно прав</h1><p>Импорт данных доступен только администратору.</p><button className="outline" onClick={() => navigate('layers')}>Вернуться к реестру</button></section>}
    </div></main>
  </div>
}
