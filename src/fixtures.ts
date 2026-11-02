import type { Polygon } from 'geojson'
import type { CardResponse, Geometry, Layer, LayerCode, MapFeature, ObjectProperties, SearchResult } from './types'

// Entirely illustrative UI fixtures. These are not the accepted Tomsk demo dataset.
const names: Record<LayerCode, string> = {
  park: 'Парки', school: 'Школы', hospital: 'Больницы', pharmacy: 'Аптеки',
  improvement_zone: 'Зоны благоустройства', regions: 'Районы Томска',
}
const point = (lon: number, lat: number): Geometry => ({ type: 'Point', coordinates: [lon, lat] })
const polygon = (lon: number, lat: number): Polygon => ({
  type: 'Polygon', coordinates: [[[lon, lat], [lon + .006, lat], [lon + .004, lat + .004], [lon, lat + .003], [lon, lat]]],
})
function object(id: string, name: string, code: LayerCode, geometry: Geometry, attrs: Partial<ObjectProperties> = {}): MapFeature {
  return {
    type: 'Feature', id, geometry,
    properties: {
      name, category_code: code, category_name: names[code], geometry_type: geometry.type,
      status: 'active', rating: null, capacity: null, area_m2: null, length_m: null,
      opening_date: null, is_accessible: null, source: 'ui-fixtures', source_id: null,
      synthetic_fields: ['geometry', 'name', 'rating', 'capacity', 'is_accessible'],
      updated_at: '2026-10-22T03:00:00Z', ...attrs,
    },
  }
}
export const features: Record<LayerCode, MapFeature[]> = {
  park: [
    object('9007199254741421', 'Сквер студенческих отрядов', 'park', polygon(84.966, 56.469), { area_m2: 18000, capacity: 0, is_accessible: false }),
    object('9007199254741422', 'Лагерный сад', 'park', point(84.953, 56.459), { rating: 4.8, is_accessible: true }),
    object('9007199254741423', 'Буфф-сад', 'park', point(84.961, 56.476), { rating: 4.5 }),
  ],
  school: [
    object('101', 'Школа № 1', 'school', point(84.963, 56.49), { capacity: 0, rating: 4.2 }),
    object('102', 'Гимназия № 6', 'school', point(84.977, 56.477), { capacity: 650, is_accessible: true }),
    object('103', 'Школа с длинным названием — пример переноса текста в карточке', 'school', point(84.989, 56.503)),
  ],
  hospital: [
    object('201', 'Городская больница — пример', 'hospital', point(84.961, 56.483), { is_accessible: true }),
    object('202', 'Поликлиника — пример', 'hospital', point(84.981, 56.496), { status: 'closed' }),
  ],
  pharmacy: [
    object('301', 'Аптека на проспекте — пример', 'pharmacy', point(84.97, 56.486)),
    object('302', 'Аптека у сквера — пример', 'pharmacy', point(84.98, 56.472), { is_accessible: false }),
  ],
  improvement_zone: [
    object('401', 'Участок благоустройства № 1', 'improvement_zone', { type: 'LineString', coordinates: [[84.953, 56.478], [84.965, 56.486], [84.98, 56.49]] }, { length_m: 1800 }),
    object('402', 'Участок благоустройства № 2', 'improvement_zone', { type: 'LineString', coordinates: [[84.967, 56.47], [84.98, 56.475], [84.99, 56.483]] }, { length_m: 950, status: 'unknown' }),
  ],
  regions: [
    { type: 'Feature', id: '501', geometry: polygon(84.92, 56.50), properties: { name: 'Ленинский район', source: 'ui-fixtures', source_id: null } },
    { type: 'Feature', id: '502', geometry: polygon(84.995, 56.505), properties: { name: 'Октябрьский район', source: 'ui-fixtures', source_id: null } },
    { type: 'Feature', id: '503', geometry: polygon(84.99, 56.47), properties: { name: 'Советский район', source: 'ui-fixtures', source_id: null } },
    { type: 'Feature', id: '504', geometry: { type: 'MultiPolygon', coordinates: [polygon(84.94, 56.455).coordinates, polygon(84.95, 56.46).coordinates] } as Geometry, properties: { name: 'Кировский район', source: 'ui-fixtures', source_id: null } },
  ],
}
export const layers: Layer[] = (['park', 'school', 'hospital', 'pharmacy', 'improvement_zone', 'regions'] as const).map(code => ({
  code, name: names[code], kind: code === 'regions' ? 'regions' : 'thematic',
  geometry_types: [...new Set(features[code].map(f => f.geometry.type))], feature_count: features[code].length,
  updated_at: '2026-10-22T03:00:00Z', can_import: false,
}))
export function fixtureResult(code: LayerCode, empty = false): SearchResult {
  const selection = empty ? [] : features[code]
  return {
    kind: code === 'regions' ? 'regions' : 'objects', dataset_version: '9007199254740997', category: code === 'regions' ? null : code,
    count: selection.length, feature_collection: { type: 'FeatureCollection', features: selection }, region_counts: null,
    matched_object_count: code === 'regions' ? null : selection.length, map_action: 'replace',
  }
}
export function fixtureCard(feature: MapFeature, datasetVersion: string): CardResponse {
  return {
    request_id: crypto.randomUUID(), dataset_version: datasetVersion, feature,
    source_info: { code: 'ui-fixtures', title: 'Примеры для проверки интерфейса', url: null, usage_note: 'Названия, координаты и атрибуты иллюстративные. Не являются реальным демонабором.', snapshot_date: '2026-10-22' },
  }
}
