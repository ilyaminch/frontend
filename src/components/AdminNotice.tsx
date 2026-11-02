import { Icon } from './Icon'
import type { AdminOperation } from '../types'

export function AdminNotice({ operation }: { operation: AdminOperation }) {
  return <div className={`admin-notice admin-notice-${operation.kind}`} role={operation.kind === 'error' ? 'alert' : 'status'}>
    <Icon name={operation.kind === 'success' ? 'admin-verified' : operation.kind === 'unknown' ? 'admin-alert' : 'admin-alert-red'} size={16} />
    <div><strong>{operation.title}</strong><p>{operation.message}</p>
      {operation.code && <small>{operation.code}</small>}
      {operation.requestId && <small>Код обращения: {operation.requestId}</small>}
      {operation.beforeVersion && <small>Версия до операции: {operation.beforeVersion}{operation.afterVersion ? ` · Сейчас: ${operation.afterVersion}` : ''}</small>}
      {!!operation.details?.length && <ul>{operation.details.map((detail, index) => <li key={index}>{detail.path}: {detail.code}</li>)}</ul>}
    </div>
  </div>
}
