import { useEffect, useRef, useState } from 'react'
import { quantity } from '../format'
import { featureKey } from '../mapLayers'
import type { Layer, LayerCode, MapFeature, SearchResult } from '../types'
import { Icon } from './Icon'

export function LayerPanel({ enabled, result, busy, error, onLayer, onSelect, onReload, layers, fixture = false }: {
  enabled: LayerCode[]; result: SearchResult; busy: boolean; error: string | null;
  onLayer: (code: LayerCode) => void; onSelect: (feature: MapFeature) => void; onReload: () => void
  layers: Layer[]; fixture?: boolean
}) {
  const [search, setSearch] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const list = result.feature_collection.features.filter(f => f.properties.name.toLocaleLowerCase('ru-RU').includes(search.toLocaleLowerCase('ru-RU')))
  const total = result.count
  const points = result.feature_collection.features.filter(f => f.geometry.type === 'Point').length
  const lines = result.feature_collection.features.filter(f => f.geometry.type === 'LineString').length
  const polygons = result.count - points - lines
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus() } }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])
  return <section className="left-panel" aria-label="Слои и объекты">
    <div className="panel-heading"><h2>Слои и объекты</h2><Icon name="panel-left" /></div>
    <div className="layers-content">
      <label className="list-search"><Icon name="search" size={14} /><input ref={input} placeholder="Поиск в списке" aria-label="Поиск в списке объектов включённых слоёв" value={search} onChange={e => setSearch(e.target.value)} /><kbd>Ctrl K</kbd></label>
      <div className="data-summary"><div><strong>{total}</strong><span>{fixture ? 'примеров объектов' : 'объектов'}</span></div><p>{quantity(points, ['точка', 'точки', 'точек'])} · {quantity(polygons, ['полигон', 'полигона', 'полигонов'])}<br />{quantity(lines, ['линия', 'линии', 'линий'])} во включённых слоях</p></div>
      <fieldset className="layer-options"><legend className="sr-only">Видимость слоёв</legend>{layers.map(layer => <label key={layer.code} className="layer-option">
        <input type="checkbox" checked={enabled.includes(layer.code)} value={layer.code} onChange={() => { setSearch(''); onLayer(layer.code) }} />
        <Icon name={layer.code === 'pharmacy' ? 'hospital' : layer.code} /><span className="layer-name" title={layer.name}>{layer.name}</span><span className="layer-count">{layer.feature_count}</span><span className="switch-track"><span /></span>
      </label>)}</fieldset>
      <div className="list-heading"><h3>Объекты</h3><span>{busy ? 'загрузка…' : `показано ${list.length}`}</span></div>
      <div className="object-list" aria-busy={busy}>
        {busy ? <div className="panel-state" role="status"><span className="spinner" /><p>Загружаем слои…</p></div> : error ? <div className="panel-state error-state" role="alert"><Icon name="alert" size={20} /><p>{error}</p></div> : !list.length ? <div className="panel-state"><Icon name="search" size={20} /><p>{search ? 'В списке нет совпадений' : enabled.length ? 'Во включённых слоях пока нет объектов' : 'Включите слои для отображения объектов'}</p></div> : list.map(feature => <button key={featureKey(feature)} className="object-row" data-feature-id={featureKey(feature)} onClick={() => onSelect(feature)}><span className="object-pin"><Icon name="pin" size={12} /></span><span><strong>{feature.properties.name}</strong><small>{'category_name' in feature.properties ? feature.properties.category_name : 'Район'}</small></span><Icon name="chevron-right" size={12} /></button>)}
      </div>
      <button className="outline reload-layer" onClick={onReload} disabled={busy}><Icon name="reset" size={13} />Обновить слои</button>
    </div>
  </section>
}
