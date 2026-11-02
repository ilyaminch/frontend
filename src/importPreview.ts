// This is a local preview only. The original File is sent unchanged; full
// attribute, topology, source and database conflict checks belong to the API.
export type ImportPreview = { count: number; geometries: string; ids: string }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
export function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МиБ` : `${(bytes / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} КиБ`
}
export async function inspectImport(file: File, maxBytes: number): Promise<ImportPreview> {
  if (!/\.(geojson|json)$/i.test(file.name)) throw new Error('Выберите файл .geojson или .json.')
  if (!file.size) throw new Error('Файл пуст. Выберите GeoJSON с объектами.')
  if (file.size > maxBytes) throw new Error(`Размер файла превышает ${fileSize(maxBytes)}.`)
  let root: unknown
  try { root = JSON.parse(await file.text()) }
  catch { throw new Error('Не удалось прочитать JSON. Проверьте содержимое файла и кодировку UTF-8.') }
  if (!record(root) || root.type !== 'FeatureCollection' || !Array.isArray(root.features)) throw new Error('Ожидается GeoJSON FeatureCollection с массивом features.')
  if (!root.features.length) throw new Error('Пустой слой нельзя импортировать. Добавьте объекты в файл.')
  const ids = new Set<string>(); const counts = new Map<string, number>()
  for (const [index, feature] of root.features.entries()) {
    if (!record(feature) || feature.type !== 'Feature' || !record(feature.geometry)) throw new Error(`features.${index}: ожидается Feature с геометрией.`)
    if (typeof feature.id !== 'string' || !/^(0|-?[1-9][0-9]*)$/.test(feature.id)) throw new Error(`features.${index}.id: ID должен быть десятичной строкой, а не числом.`)
    if (ids.has(feature.id)) throw new Error(`features.${index}.id: повторяющийся ID внутри файла.`)
    ids.add(feature.id)
    const type = feature.geometry.type
    if (typeof type !== 'string' || !['Point', 'LineString', 'Polygon', 'MultiPolygon'].includes(type)) throw new Error(`features.${index}.geometry: неподдерживаемый тип геометрии.`)
    counts.set(type, (counts.get(type) ?? 0) + 1)
  }
  return { count: root.features.length, geometries: [...counts].map(([type, count]) => `${count} ${type}`).join(', '), ids: `Строковых ID: ${ids.size}, без повторов в файле` }
}
