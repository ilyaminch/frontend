import type { MapFeature, SearchResult } from './types'

// Region IDs and object IDs belong to different namespaces.
export function featureKey(feature: MapFeature) {
  return `${'category_code' in feature.properties ? feature.properties.category_code : 'regions'}:${feature.id}`
}

// A client-side rendering collection, never submitted as an API search result.
export function combineLayers(snapshots: SearchResult[], empty: SearchResult): SearchResult {
  if (!snapshots.length) return empty
  if (snapshots.some(item => item.dataset_version !== snapshots[0].dataset_version)) throw new Error('DATA_CHANGED')
  if (snapshots.length === 1) return snapshots[0]
  const features = snapshots.flatMap(item => item.feature_collection.features)
  return { ...snapshots[0], kind: 'objects', category: null, count: features.length,
    feature_collection: { type: 'FeatureCollection', features }, region_counts: null,
    matched_object_count: null }
}
