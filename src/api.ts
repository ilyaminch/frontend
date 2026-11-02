import type { AuthResponse, CardResponse, LayersResponse, LayerCode, MessageResponse, ResultResponse, SessionResponse } from './types'
import type { ErrorDetail, ImportResponse, QueryCapabilities, RestoreResponse } from './types'

export class ApiError extends Error {
  constructor(message: string, readonly code: string, readonly status = 0, readonly requestId?: string, readonly details: ErrorDetail[] = []) { super(message) }
}
export function errorText(error: unknown): string {
  return error instanceof ApiError ? `${error.message}${error.requestId ? ` Код обращения: ${error.requestId}.` : ''}` : 'Не удалось выполнить запрос. Повторите действие.'
}
export function isAborted(error: unknown) { return error instanceof DOMException && error.name === 'AbortError' }

type RequestOptions = { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown; form?: FormData; signal?: AbortSignal; timeout?: number; authFailure?: boolean }
export class ApiClient {
  private csrf: string | null = null
  private epoch = 0
  onUnauthorized: (() => void) | null = null
  setSession(auth: AuthResponse) { this.csrf = auth.csrf_token; this.epoch++ }
  clearSession() { this.csrf = null; this.epoch++ }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const requestEpoch = this.epoch
    const abort = new AbortController()
    const timer = window.setTimeout(() => abort.abort(), options.timeout ?? 20_000)
    const signal = options.signal ? AbortSignal.any([options.signal, abort.signal]) : abort.signal
    const method = options.method ?? 'GET'
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    if (method !== 'GET' && this.csrf) headers['X-CSRF-Token'] = this.csrf
    try {
      const response = await fetch(`/api/v1${path}`, {
        method, credentials: 'include', headers, cache: 'no-store', signal,
        body: options.form ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
      })
      if (response.status === 401 && options.authFailure !== false && requestEpoch === this.epoch) this.onUnauthorized?.()
      if (response.status === 204) return undefined as T
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new ApiError(
          typeof payload?.error?.message === 'string' ? payload.error.message : 'Сервис недоступен. Повторите действие позже.',
          typeof payload?.error?.code === 'string' ? payload.error.code : 'SERVICE_UNAVAILABLE', response.status,
          typeof payload?.request_id === 'string' ? payload.request_id : undefined,
          Array.isArray(payload?.error?.details) ? payload.error.details.filter((detail: unknown): detail is ErrorDetail => typeof detail === 'object' && detail !== null && 'path' in detail && typeof detail.path === 'string' && 'code' in detail && typeof detail.code === 'string') : [],
        )
      }
      if (!payload || typeof payload !== 'object') throw new ApiError('Сервис вернул некорректный ответ.', 'INVALID_RESPONSE')
      return payload as T
    } catch (error) {
      if (options.signal?.aborted) throw new DOMException('Запрос отменён', 'AbortError')
      if (abort.signal.aborted) throw new ApiError('Сервис не ответил вовремя. Повторите действие вручную.', 'REQUEST_TIMEOUT')
      if (error instanceof ApiError) throw error
      throw new ApiError('Нет связи с сервером. Проверьте подключение и повторите действие.', 'NETWORK_ERROR')
    } finally { clearTimeout(timer) }
  }

  me(signal: AbortSignal) { return this.request<AuthResponse>('/auth/me', { signal, authFailure: false }) }
  login(login: string, password: string) { return this.request<AuthResponse>('/auth/login', { method: 'POST', body: { login, password }, authFailure: false }) }
  logout() { return this.request<void>('/auth/logout', { method: 'POST' }) }
  layers(signal: AbortSignal) { return this.request<LayersResponse>('/layers', { signal }) }
  capabilities(signal: AbortSignal) { return this.request<QueryCapabilities>('/query-capabilities', { signal }) }
  importLayer(code: LayerCode, file: File, signal: AbortSignal) {
    const form = new FormData(); form.append('file', file)
    return this.request<ImportResponse>(`/admin/layers/${encodeURIComponent(code)}/import`, { method: 'POST', form, signal, timeout: 320_000 })
  }
  restore(signal: AbortSignal) { return this.request<RestoreResponse>('/admin/demo/restore', { method: 'POST', body: { confirm: true }, signal, timeout: 320_000 }) }
  layer(code: LayerCode, signal: AbortSignal) { return this.request<ResultResponse>(`/layers/${encodeURIComponent(code)}/features`, { signal }) }
  card(id: string, version: string, region: boolean, signal: AbortSignal) {
    return this.request<CardResponse>(`/${region ? 'regions' : 'objects'}/${encodeURIComponent(id)}?dataset_version=${encodeURIComponent(version)}`, { signal })
  }
  createDialogue(signal: AbortSignal) { return this.request<SessionResponse>('/chat/sessions', { method: 'POST', signal }) }
  deleteDialogue(id: string) { return this.request<void>(`/chat/sessions/${encodeURIComponent(id)}`, { method: 'DELETE', timeout: 10_000 }) }
  message(dialogueId: string, requestId: string, text: string, signal: AbortSignal) {
    return this.request<MessageResponse>(`/chat/sessions/${encodeURIComponent(dialogueId)}/messages`, {
      method: 'POST', body: { client_request_id: requestId, text }, signal, timeout: 320_000,
    })
  }
}
