import { ApiError, errorText } from './api'
import type { AdminOperation } from './types'

export function failedOperation(cause: unknown, beforeVersion: string): AdminOperation {
  const uncertain = !(cause instanceof ApiError) || cause.code.endsWith('_RESULT_UNKNOWN') || cause.status === 0 || cause.status >= 500
  return {
    kind: uncertain ? 'unknown' : 'error', title: uncertain ? 'Результат операции не подтверждён' : 'Операция не выполнена',
    message: uncertain ? 'Связь с сервером прервалась. Проверяем текущую версию данных; повторная отправка автоматически не выполняется. Проверьте слой перед новой загрузкой.' : cause instanceof ApiError ? cause.message : errorText(cause),
    code: cause instanceof ApiError ? cause.code : undefined,
    requestId: cause instanceof ApiError ? cause.requestId : undefined,
    details: cause instanceof ApiError ? cause.details : [], beforeVersion,
  }
}
