import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Icon } from './Icon'
import type { LiveChat } from '../types'

export function ChatPanel({ live }: { live?: LiveChat }) {
  const [draft, setDraft] = useState('')
  const [examples, setExamples] = useState<string[]>([])
  const input = useRef<HTMLTextAreaElement>(null)
  const history = useRef<HTMLDivElement>(null)
  const messages = live?.messages
  useEffect(() => { history.current?.scrollTo({ top: history.current.scrollHeight }) }, [messages, examples, live?.busy])
  const example = 'Покажи парки с рейтингом выше 4'
  const disabled = live ? live.busy || live.creating || !live.ready : false
  function submit(e?: FormEvent) {
    e?.preventDefault()
    const text = draft.trim()
    if (!text || disabled) return
    if (live) live.onSend(text)
    else setExamples(current => [...current, text])
    setDraft(''); input.current?.focus()
  }
  function keyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) { e.preventDefault(); submit() }
  }
  const welcome = !messages?.length && !examples.length
  return <aside className="chat-panel" aria-label="Ассистент">
    <div className="panel-heading"><div className="assistant-title"><span><Icon name="sparkles" size={14} /></span><h2>Ассистент</h2></div><button className="new-dialog" aria-label="Новый диалог" title="Новый диалог" disabled={live?.creating} onClick={() => { if (live) live.onNew(); else setExamples([]); setDraft(''); input.current?.focus() }}><Icon name="reset" size={13} /><span>Новый диалог</span></button></div>
    <div className="conversation" ref={history} aria-live="polite" aria-relevant="additions">
      <div className="assistant-message"><h3>ГИС-помощник</h3><p>{live ? 'Здравствуйте! Я помогу найти объекты на карте по категории и атрибутам. Выберите слой слева или задайте вопрос.' : 'Здравствуйте! Я помогу найти объекты на карте по категории и атрибутам. Сейчас открыт режим примеров: можно выбрать слой и посмотреть карточки объектов.'}</p></div>
      {welcome && <><p className="try-label">{live ? 'Попробуйте готовый запрос:' : 'Пример запроса для будущего подключения:'}</p><button className="suggestion" onClick={() => { setDraft(example); input.current?.focus() }}><Icon name="sparkles" size={14} /><span>{example}</span><Icon name="arrow-up-right" size={13} /></button><div className="context-chips"><span>5 категорий</span><span>{live ? 'Данные сервера' : '4 примера районов'}</span><span>{live ? 'Поиск по атрибутам' : 'Без подключения к API'}</span></div></>}
      {messages?.map((message, index) => <div key={message.id} className={message.sender === 'user' ? 'user-message' : `assistant-message ${message.error ? 'chat-error' : ''}`} role={message.error ? 'alert' : undefined}>
        <h3>{message.sender === 'user' ? 'Вы' : 'ГИС-помощник'}</h3><p>{message.text}</p>
        {message.code && <small className="chat-error-code">{message.code}</small>}
        {message.requestId && <small className="chat-request-id">Код обращения: {message.requestId}</small>}
        {message.mapPreserved && <p className="map-preserved">Карта не обновлена: после отправки запроса вы выбрали другой слой.</p>}
        {message.regionCounts && <dl className="region-counts">{message.regionCounts.map(region => <div key={region.region_id}><dt>{region.name}</dt><dd>{region.count}</dd></div>)}</dl>}
        {!!message.options?.length && <div className="clarification-options">{message.options.map(option => <button className="outline" key={option.value} disabled={disabled || index !== messages.length - 1} onClick={() => live?.onSend(option.value)}>{option.label}</button>)}</div>}
      </div>)}
      {examples.map((message, index) => <div className="message-pair" key={index}><div className="user-message"><h3>Вы</h3><p>{message}</p></div><div className="assistant-message preview-message"><h3>Режим примеров</h3><p>Чат пока не подключён к API и MLChat. Запрос не выполнялся, карта не изменена. Используйте выбор слоя и карточки слева.</p></div></div>)}
      {(live?.busy || live?.creating) && <div className="chat-waiting" role="status"><span className="spinner" />{live.creating ? 'Создаём диалог…' : 'Обрабатываем запрос…'}</div>}
      {live?.sessionError && <div className="assistant-message chat-error" role="alert"><p>{live.sessionError}</p><button className="text-button" onClick={live.onNew}>Создать новый диалог</button></div>}
    </div>
    <form className="composer" onSubmit={submit}><div className="composer-field"><textarea ref={input} aria-label="Сообщение ассистенту" placeholder="Опишите, какие объекты показать…" rows={2} maxLength={8000} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={keyDown} /><button className="send-button primary" type="submit" disabled={!draft.trim() || disabled} aria-label="Отправить сообщение"><Icon name="arrow-up" /></button></div><div className="composer-hints"><span>Enter — отправить</span><span>Shift+Enter — новая строка</span></div><span className="composer-mode">{live ? 'Ответы и результаты поступают с сервера' : 'Предпросмотр · запросы не выполняются'}</span></form>
  </aside>
}
