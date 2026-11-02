import { useEffect, useRef } from 'react'
import type { CardResponse } from '../types'
import { Icon } from './Icon'

function display(value: unknown): string {
  if (value === null || value === undefined) return 'Нет данных'
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет'
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'Нет'
  return String(value)
}
const date = (value: string | null) => value ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tomsk' }).format(new Date(value)) : null
const timestamp = (value: string) => new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tomsk', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value))
export function ObjectCard({ card, onClose }: { card: CardResponse; onClose: () => void }) {
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => { title.current?.focus() }, [card.feature.id])
  const { feature, source_info: source } = card
  const p = feature.properties
  const rows: [string, unknown][] = 'category_code' in p ? [
    ['Тип', p.category_name], ['Код категории', p.category_code], ['Геометрия', p.geometry_type],
    ['Статус', { active: 'Действующий', closed: 'Закрыт', unknown: 'Неизвестен' }[p.status]],
    ['Рейтинг', p.rating], ['Вместимость', p.capacity],
    ['Площадь, м²', p.area_m2?.toLocaleString('ru-RU') ?? null],
    ['Длина, м', p.length_m?.toLocaleString('ru-RU') ?? null],
    ['Дата открытия', date(p.opening_date)], ['Доступная среда', p.is_accessible],
    ['Источник', p.source], ['ID источника', p.source_id], ['Обновлено', timestamp(p.updated_at)],
    ['Синтетические поля', p.synthetic_fields],
  ] : [['Тип', 'Район'], ['Геометрия', feature.geometry.type], ['Источник', p.source], ['ID источника', p.source_id]]
  return <section className="left-panel object-panel" aria-label="Карточка объекта" onKeyDown={e => { if (e.key === 'Escape') onClose() }}>
    <div className="panel-heading"><h2>Информация об объекте</h2><button className="icon-button" aria-label="Закрыть карточку" onClick={onClose}><Icon name="close" size={16} /></button></div>
    <div className="card-content">
      <div className="object-title"><p>{'category_code' in p ? p.category_name : 'Район'} · № {feature.id}</p><h3 tabIndex={-1} ref={title}>{p.name}</h3></div>
      <dl className="attributes">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={value === null ? 'missing' : ''}>{display(value)}</dd></div>)}</dl>
      {feature.geometry.type === 'Point' && <p className="coordinates"><Icon name="crosshair" size={13} />{feature.geometry.coordinates[1].toFixed(4)}, {feature.geometry.coordinates[0].toFixed(4)} · EPSG:4326</p>}
      <div className="source-info"><h4>Источник данных</h4><p>{source.title}</p><p>{source.usage_note}</p><p>Дата: {date(source.snapshot_date)}</p><p>Версия данных: {card.dataset_version}</p></div>
    </div>
  </section>
}
