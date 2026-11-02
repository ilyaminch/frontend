import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { ApiClient, isAborted } from '../api'
import { failedOperation } from '../adminOperation'
import { fileSize, inspectImport } from '../importPreview'
import type { ImportPreview } from '../importPreview'
import type { AdminOperation, Layer, LayerCode, LayersResponse } from '../types'
import { Icon } from './Icon'
import { AdminNotice } from './AdminNotice'

export function ImportPanel({ api, layers, version, maxBytes, hidden, initialLayer, onBusy, onOperation, onChanged, refresh }: {
  api: ApiClient; layers: Layer[]; version: string | null; maxBytes: number | null; hidden: boolean; initialLayer: LayerCode;
  onBusy: (busy: boolean) => void; onOperation: (operation: AdminOperation) => void; onChanged: () => void;
  refresh: () => Promise<LayersResponse | null>
}) {
  const [selectedLayer, setSelectedLayer] = useState<LayerCode>(initialLayer)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [checking, setChecking] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [outcome, setOutcome] = useState<AdminOperation | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const currentFile = useRef<File | null>(null)
  const generation = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const sending = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort() } }, [])
  // The parent remounts this panel only for an explicit row selection.
  const layer = layers.find(item => item.code === selectedLayer)
  const locked = uploading || maxBytes === null || version === null
  async function checkFile(candidate = currentFile.current) {
    if (!candidate || maxBytes === null || sending.current) return
    const request = ++generation.current
    setChecking(true); setLocalError(null); setPreview(null); setConfirmed(false); setOutcome(null)
    try {
      const result = await inspectImport(candidate, maxBytes)
      if (request === generation.current && mounted.current) setPreview(result)
    } catch (cause) {
      if (request === generation.current && mounted.current) setLocalError(cause instanceof Error ? cause.message : 'Не удалось проверить файл.')
    } finally { if (request === generation.current && mounted.current) setChecking(false) }
  }
  function choose(candidate: File | null) {
    if (locked) return
    currentFile.current = candidate; setFile(candidate); setPreview(null); setConfirmed(false); setOutcome(null); setLocalError(null)
    generation.current++
    if (candidate) void checkFile(candidate)
  }
  function changeFile(event: ChangeEvent<HTMLInputElement>) { choose(event.target.files?.[0] ?? null); event.target.value = '' }
  function drop(event: DragEvent) {
    event.preventDefault(); setDragging(false)
    if (locked) return
    if (event.dataTransfer.files.length !== 1) { setLocalError('Выберите ровно один файл GeoJSON.'); return }
    choose(event.dataTransfer.files[0])
  }
  async function upload() {
    if (sending.current || !file || !preview || !confirmed || !version || !layer?.can_import || maxBytes === null || outcome?.kind === 'success' || outcome?.kind === 'unknown') return
    sending.current = true; setUploading(true); onBusy(true); setOutcome(null)
    const request = new AbortController(); controller.current = request
    const before = version
    try {
      let operation: AdminOperation
      try {
        const response = await api.importLayer(selectedLayer, file, request.signal)
        if (!mounted.current || request.signal.aborted) return
        operation = { kind: 'success', title: 'Импорт успешен', message: `Загружено объектов: ${response.imported_count}. ${response.message}`, requestId: response.request_id, beforeVersion: before, afterVersion: response.dataset_version }
        onChanged()
      } catch (cause) {
        if (isAborted(cause) || !mounted.current) return
        operation = failedOperation(cause, before)
        if (operation.kind === 'unknown') onChanged()
      }
      if (!mounted.current) return
      setOutcome(operation); onOperation(operation)
      const registry = await refresh()
      if (!mounted.current) return
      if (registry) operation = { ...operation, afterVersion: registry.dataset_version }
      else operation = { ...operation, message: `${operation.message} Реестр не удалось обновить — повторите его загрузку вручную.` }
      setOutcome(operation); onOperation(operation)
    } finally {
      if (mounted.current) { sending.current = false; setUploading(false); onBusy(false); setConfirmed(false) }
    }
  }
  const completed = outcome?.kind === 'success'
  const unknown = outcome?.kind === 'unknown'
  const ready = !!preview && !checking && !localError
  return <section className="admin-page import-page" hidden={hidden} aria-labelledby="import-title">
    <div className="admin-page-heading"><div><h1 id="import-title">Импорт GeoJSON</h1><p>Проверка и безопасная загрузка пространственных данных</p></div><span className="admin-badge"><Icon name="admin-file-json" size={12} />Форматы: .geojson и .json</span></div>
    <ol className="import-steps" aria-label="Этапы импорта"><li className={file ? 'complete' : 'current'}><b>1</b>{file ? 'Файл выбран' : 'Выберите файл'}</li><li className={ready ? 'complete' : checking ? 'current' : ''}><b>2</b>{checking ? 'Проверяем в браузере' : ready ? 'Предварительно проверен' : 'Предварительная проверка'}</li><li className={completed ? 'complete' : outcome?.kind === 'error' ? 'failed' : 'current'}><b>{outcome?.kind === 'error' ? '!' : '3'}</b>{uploading ? 'Сервер проверяет и импортирует…' : completed ? 'Импорт успешен' : unknown ? 'Проверьте результат' : 'Подтвердите замену'}</li></ol>
    <div className="import-columns">
      <div className="admin-card import-form" aria-busy={uploading}>
        <input ref={fileInput} className="sr-only" type="file" id="geojson-file" accept=".geojson,.json,application/json,application/geo+json" onChange={changeFile} disabled={locked} aria-label="Выбрать файл GeoJSON" />
        <button type="button" className={`import-dropzone ${dragging ? 'is-dragging' : ''}`} disabled={locked} onClick={() => fileInput.current?.click()} onDragOver={event => { event.preventDefault(); if (!locked) setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={drop}>
          <span className="upload-mark"><Icon name="admin-upload" size={20} /></span><strong>Перетащите файл сюда или выберите на компьютере</strong><small>Поддерживаются .geojson и .json · {maxBytes === null ? 'лимит загружается' : `до ${fileSize(maxBytes)}`}</small>
        </button>
        {file && <div className="selected-file"><span><Icon name="admin-file-selected" size={20} /></span><div><strong>{file.name}</strong><small>{fileSize(file.size)}</small></div><span className="admin-file-state">Файл выбран</span></div>}
        <label className="import-layer-label" htmlFor="import-layer">Слой для замены<select id="import-layer" value={selectedLayer} disabled={uploading} onChange={event => { setSelectedLayer(event.target.value as LayerCode); setConfirmed(false); setOutcome(null) }}>{layers.map(item => <option key={item.code} value={item.code} disabled={!item.can_import}>{item.name}</option>)}</select></label>
        <fieldset className="import-mode"><legend>Режим импорта</legend><label><input type="radio" checked readOnly />Заменить слой</label><p>Полная замена выбранного слоя. Добавление данных API не поддерживает.</p></fieldset>
        {file && <label className="replace-confirmation"><Icon name="admin-alert" size={16} /><span><strong>Подтвердите замену слоя «{layer?.name ?? selectedLayer}»</strong><small>Будут заменены все {layer?.feature_count ?? 'текущие'} объектов этого слоя.</small></span><span className="confirm-control"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={!ready || uploading || completed || unknown} />Подтверждаю</span></label>}
        {localError && <AdminNotice operation={{ kind: 'error', title: 'Файл не прошёл предварительную проверку', message: localError }} />}
        {file && <div className="import-actions"><button className="outline" onClick={() => void checkFile()} disabled={uploading || checking || !file}><Icon name="admin-scan" size={14} />Проверить файл</button><button className="primary" onClick={() => void upload()} disabled={locked || !ready || !confirmed || !layer?.can_import || completed || unknown}><Icon name="admin-import-submit" size={14} />{uploading ? 'Импортируем…' : 'Импортировать'}</button></div>}
      </div>
      {(file || outcome) && <div className="admin-card import-checks"><div className="checks-heading"><h2>Проверка файла</h2><span className={`admin-badge ${checking ? 'badge-warning' : ''}`}>{checking ? 'В процессе' : ready ? 'В браузере' : 'Требуется проверка'}</span></div>
        <dl className="preflight-checks"><div><dt>Корректность формата</dt><dd>{checking ? 'Проверяем…' : preview ? 'JSON / FeatureCollection' : 'Не проверен'}</dd></div><div><dt>Геометрии</dt><dd>{preview?.geometries ?? '—'}</dd></div><div><dt>Атрибуты и топология</dt><dd>Проверяются сервером</dd></div><div><dt>Идентификаторы</dt><dd>{preview?.ids ?? '—'}</dd></div></dl>
        {ready && <div className="preflight-note"><Icon name="admin-verified" size={16} /><p>Предварительная проверка выполнена в браузере. Полную проверку атрибутов, геометрии и конфликтов сервер выполняет при импорте.</p></div>}
        {uploading && <div className="chat-waiting" role="status"><span className="spinner" />Ожидаем результат сервера…</div>}
        {outcome && <AdminNotice operation={outcome} />}
      </div>}
    </div>
  </section>
}
