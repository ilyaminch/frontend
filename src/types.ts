import type { Point, LineString, Polygon, MultiPolygon } from 'geojson'

export type Geometry = Point | LineString | Polygon | MultiPolygon

export type LayerCode = 'school' | 'hospital' | 'pharmacy' | 'park' | 'improvement_zone' | 'regions'
export type User = { id: string; login: string; role: 'user' | 'admin' }
export type Layer = {
  code: LayerCode; name: string; kind: 'thematic' | 'regions';
  geometry_types: string[]; feature_count: number; updated_at: string | null; can_import: boolean
}
export type ObjectProperties = {
  name: string; category_code: string; category_name: string; geometry_type: string;
  status: 'active' | 'closed' | 'unknown'; rating: number | null; capacity: number | null;
  area_m2: number | null; length_m: number | null; opening_date: string | null;
  is_accessible: boolean | null; source: string; source_id: string | null;
  synthetic_fields: string[]; updated_at: string
}
export type RegionProperties = { name: string; source: string; source_id: string | null }
export type MapFeature = {
  type: 'Feature'; id: string; geometry: Geometry;
  properties: ObjectProperties | RegionProperties
}
export type SearchResult = {
  kind: 'objects' | 'regions' | 'region_counts'; dataset_version: string; category: string | null;
  count: number; feature_collection: { type: 'FeatureCollection'; features: MapFeature[] };
  region_counts: { region_id: string; name: string; count: number }[] | null;
  matched_object_count: number | null; map_action: 'replace'
}
export type CardResponse = {
  request_id: string; dataset_version: string; feature: MapFeature;
  source_info: { code: string; title: string; url: string | null; usage_note: string; snapshot_date: string }
}
export type PreviewState = 'normal' | 'loading' | 'empty' | 'error' | 'changed' | 'expired' | 'tiles'

export type AuthResponse = { request_id: string; user: User; expires_at: string; csrf_token: string }
export type LayersResponse = { request_id: string; dataset_version: string; layers: Layer[] }
export type ResultResponse = { request_id: string; result: SearchResult }
export type SessionResponse = { request_id: string; dialogue_id: string }
export type Option = { value: string; label: string }
type MessageIdentity = { request_id: string; dialogue_id: string; client_request_id: string; message: string }
export type MessageResponse = MessageIdentity & (
  { outcome: 'result'; result: SearchResult; validated_filter: Record<string, unknown> }
  | { outcome: 'clarification'; options: Option[]; result: null; map_action: 'preserve' }
  | { outcome: 'unsupported'; result: null; map_action: 'preserve' }
)
export type ChatEntry = {
  id: string; sender: 'user' | 'assistant'; text: string; error?: boolean;
  code?: string; requestId?: string; options?: Option[]; mapPreserved?: boolean;
  regionCounts?: SearchResult['region_counts']
}
export type LiveChat = {
  messages: ChatEntry[]; busy: boolean; creating: boolean; sessionError: string | null;
  ready: boolean; onSend: (text: string) => void; onNew: () => void
}

export type ImportResponse = { request_id: string; layer_code: string; imported_count: number; dataset_version: string; message: string; suggest_repeat_search: true }
export type RestoreResponse = { request_id: string; dataset_version: string; object_count: number; region_count: number; layer_counts: Record<LayerCode, number>; message: string; suggest_repeat_search: true }
export type QueryCapabilities = { limits: Record<string, number> }
export type ErrorDetail = { path: string; code: string }
export type AdminOperation = { kind: 'success' | 'error' | 'unknown'; title: string; message: string; code?: string; requestId?: string; details?: ErrorDetail[]; beforeVersion?: string; afterVersion?: string }
