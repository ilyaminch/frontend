import { useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from './Icon'
import type { User } from '../types'
import { errorText } from '../api'

export function Login({ onLogin, expired = false, authenticate, checking = false, initialError, retryLogout }: {
  onLogin?: (user: User) => void; expired?: boolean; authenticate?: (login: string, password: string) => Promise<void>;
  checking?: boolean; initialError?: string | null; retryLogout?: () => void
}) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(expired ? 'Сеанс завершён. Войдите снова.' : '')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!login.trim() || !password || busy || checking) return
    setBusy(true); setError('')
    try {
      if (authenticate) { await authenticate(login.trim(), password); setPassword('') }
      else {
        await new Promise(resolve => setTimeout(resolve, 650))
        if (login.trim() === 'demo' && password === 'demo') {
          setPassword(''); onLogin?.({ id: '00000000-0000-4000-8000-000000000001', login: 'demo', role: 'user' })
        } else setError('Неверный логин или пароль. Для примера используйте demo / demo.')
      }
    } catch (cause) { setError(errorText(cause)) }
    finally { setBusy(false) }
  }
  const message = error || initialError
  const waiting = busy || checking
  return <main className="login-page">
    <div className="login-brand"><span className="brand-mark"><Icon name="login-brand" size={21} /></span><div><strong>ГИС-помощник</strong><p>Интерактивная карта и поиск пространственных объектов</p></div></div>
    <form className="login-card" onSubmit={submit} aria-labelledby="login-heading" aria-busy={waiting}>
      <div className="login-heading"><div className="access-label"><Icon name="shield" size={14} />Защищённый вход</div><h1 id="login-heading">Вход в систему</h1><p>Введите учётные данные для продолжения</p></div>
      <div className="login-fields">
        <label htmlFor="login">Логин<span className="input-wrap"><Icon name="user" size={16} /><input id="login" autoComplete="username" placeholder="Введите логин" value={login} onChange={e => setLogin(e.target.value)} disabled={busy} required /></span></label>
        <label htmlFor="password">Пароль<span className="input-wrap"><Icon name="lock" size={16} /><input id="password" type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Введите пароль" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} required /><button className="password-toggle" type="button" aria-pressed={visible} aria-controls="password" onClick={() => setVisible(v => !v)}><Icon name="eye" size={15} />{visible ? 'Скрыть' : 'Показать'}</button></span></label>
      </div>
      <div className={`login-status ${message ? 'is-error' : waiting ? 'is-loading' : authenticate ? 'is-placeholder' : 'is-preview'}`} role={message ? 'alert' : 'status'} aria-live="polite">
        {waiting ? <><span className="spinner" />Проверяем {authenticate ? 'сеанс' : 'пример входа'}…</> : message ? <><Icon name="alert" size={16} /><span>{message}{retryLogout && <button type="button" className="text-button" onClick={retryLogout}>Повторить выход</button>}</span></> : !authenticate ? <><Icon name="shield" size={16} /><span><strong>Режим примеров · без API</strong><br />Логин: demo · пароль: demo</span></> : null}
      </div>
      <div className="login-actions"><button className="primary login-submit" type="submit" disabled={!login.trim() || !password || waiting || !!retryLogout}>{waiting ? 'Проверка…' : 'Войти'}</button><p>После входа вы будете направлены в раздел согласно вашей роли</p></div>
    </form>
    <p className="login-footer"><Icon name="lock-muted" size={13} />{authenticate ? 'Локальный вход · роль определяется сервером' : 'Локальный просмотр · используются только примеры данных'}</p>
  </main>
}
