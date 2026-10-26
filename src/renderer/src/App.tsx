import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import AppLayout from './layout/AppLayout'
import AddTitle from './pages/AddTitle'
import Dashboard from './pages/Dashboard'
import Library from './pages/Library'
import Settings from './pages/Settings'
import Statistics from './pages/Statistics'
import TitleDetails from './pages/TitleDetails'
import WatchHistory from './pages/WatchHistory'
import PagePlaceholder from './pages/PagePlaceholder'
import { CalendarDays, Compass } from 'lucide-react'

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="collection" element={<Library />} />
          <Route path="journal" element={<WatchHistory />} />
          <Route path="insights" element={<Statistics />} />
          <Route
            path="discover"
            element={
              <PagePlaceholder
                eyebrow="Find your next feeling"
                title="Discover"
                description="Mood-based recommendations will appear here."
                icon={Compass}
              />
            }
          />
          <Route
            path="timeline"
            element={
              <PagePlaceholder
                eyebrow="Your watching life"
                title="My Timeline"
                description="Your chronological viewing timeline will appear here."
                icon={CalendarDays}
              />
            }
          />
          <Route path="add" element={<AddTitle />} />
          <Route path="library" element={<Navigate to="/collection" replace />} />
          <Route path="add-title" element={<Navigate to="/add" replace />} />
          <Route path="titles/:titleId" element={<TitleDetails />} />
          <Route path="title/:titleId" element={<LegacyTitleRedirect />} />
          <Route path="watch-history" element={<Navigate to="/journal" replace />} />
          <Route path="statistics" element={<Navigate to="/insights" replace />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

function LegacyTitleRedirect(): React.JSX.Element {
  const { titleId } = useParams()
  return <Navigate to={`/titles/${titleId ?? ''}`} replace />
}

export default App
