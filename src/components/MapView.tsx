import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import type { MapFeature, SearchResult } from '../types'
import { Icon } from './Icon'
import { featureKey } from '../mapLayers'

const initialCenter: L.LatLngExpression = [56.485, 84.965]
const tileUrl = import.meta.env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export function MapView({ result, selected, onSelect, simulateTileError }: {
  result: SearchResult; selected: string | null; onSelect: (feature: MapFeature) => void; simulateTileError: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const onSelectRef = useRef(onSelect)
  const [tileState, setTileState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retry, setRetry] = useState(0)
  const [dragging, setDragging] = useState(true)
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])
  useEffect(() => {
    if (!host.current) return
    const instance = L.map(host.current, { zoomControl: false, attributionControl: false }).setView(initialCenter, 13)
    map.current = instance
    const observer = new ResizeObserver(() => instance.invalidateSize())
    observer.observe(host.current)
    return () => { observer.disconnect(); instance.remove(); map.current = null }
  }, [])
  useEffect(() => {
    const instance = map.current
    if (!instance || simulateTileError) return
    let loaded = false
    let hadError = false
    const timeout = window.setTimeout(() => { if (!loaded) setTileState('error') }, 12000)
    const tiles = L.tileLayer(tileUrl, { maxZoom: 19, minZoom: 3 })
    tiles.on('tileload', () => { loaded = true })
    tiles.on('load', () => { if (loaded && !hadError) { setTileState('ready'); clearTimeout(timeout) } })
    tiles.on('tileerror', () => { hadError = true; setTileState('error') })
    tiles.addTo(instance)
    return () => { clearTimeout(timeout); tiles.remove() }
  }, [retry, simulateTileError])
  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const geo = L.geoJSON(result.feature_collection, {
      style: feature => ({
        color: feature && featureKey(feature as MapFeature) === selected ? '#156b73' : feature?.geometry.type === 'LineString' ? '#b77b22' : '#3f8a68',
        weight: feature && featureKey(feature as MapFeature) === selected ? 3 : 2,
        fillColor: '#b7ddc5', fillOpacity: .35,
        dashArray: feature?.geometry.type === 'LineString' ? '7 5' : undefined,
      }),
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
        radius: featureKey(feature as MapFeature) === selected ? 10 : 7,
        color: featureKey(feature as MapFeature) === selected ? '#156b73' : '#3f8a68', weight: 2,
        fillColor: '#fff', fillOpacity: 1,
      }),
      onEachFeature: (feature, layer) => {
        // Text nodes prevent feature names from being interpreted as HTML.
        const label = document.createElement('span')
        label.textContent = feature.properties.name
        layer.bindTooltip(label)
        layer.on('click', () => onSelectRef.current(feature as MapFeature))
      },
    }).addTo(instance)
    // District boundaries stay beneath points/lines even when districts are enabled last.
    geo.eachLayer(layer => { if (layer instanceof L.Polygon) layer.bringToBack() })
    return () => { geo.remove() }
  }, [result, selected])
  const failed = simulateTileError || tileState === 'error'
  return <div className="map-view">
    <div className="leaflet-host" ref={host} aria-label="Карта Томска. Объекты также доступны в списке слева." />
    <div className="map-controls" aria-label="Управление картой">
      <div className="zoom-controls"><button aria-label="Приблизить" onClick={() => map.current?.zoomIn()}><Icon name="plus" size={14} /></button><button aria-label="Отдалить" onClick={() => map.current?.zoomOut()}><Icon name="minus" size={14} /></button></div>
      <button className="floating-control" aria-label="Перемещение карты" aria-pressed={dragging} onClick={() => { if (dragging) map.current?.dragging.disable(); else map.current?.dragging.enable(); setDragging(!dragging) }}><Icon name="move" /></button>
      <button className="floating-control" aria-label="Исходный вид карты" onClick={() => map.current?.setView(initialCenter, 13)}><Icon name="maximize" /></button>
    </div>
    {failed ? <div className="tile-notice" role="status"><Icon name="alert" size={16} /><div><strong>Подложка карты недоступна</strong><p>Объекты и карточки доступны. Проверьте подключение к интернету.</p>{!simulateTileError && <button className="text-button" onClick={() => { setTileState('loading'); setRetry(v => v + 1) }}>Повторить загрузку</button>}</div></div> : tileState === 'loading' ? <div className="tile-loading" role="status"><span className="spinner" />Загрузка подложки…</div> : null}
    <div className="map-legend"><h3>Легенда</h3><div><span><i className="legend-point" />Точка</span><span><i className="legend-line" />Линия</span><span><i className="legend-polygon" />Полигон</span></div></div>
    <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
  </div>
}
