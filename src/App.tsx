import { lazy, Suspense } from 'react'
import LiveApp from './LiveApp'

const FixtureApp = lazy(() => import('./FixtureApp'))
export default function App() {
  if (import.meta.env.VITE_DATA_MODE === 'api') return <LiveApp />
  if (import.meta.env.VITE_DATA_MODE === 'fixtures') return <Suspense fallback={<main className="setup-state">Загрузка примеров…</main>}><FixtureApp /></Suspense>
  return <main className="setup-state"><h1>Выберите источник данных</h1><p>Укажите VITE_DATA_MODE=api для сервера или fixtures для явно обозначенных примеров.</p></main>
}
