import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import AppLayout from './layout/AppLayout'
import AddTitle from './pages/AddTitle'
import Dashboard from './pages/Dashboard'
import Library from './pages/Library'
import Settings from './pages/Settings'
import Insights from './pages/Insights'
import TitleDetails from './pages/TitleDetails'
import Journal from './pages/Journal'
import Discover from './pages/Discover'
import PagePlaceholder from './pages/PagePlaceholder'
import { CalendarDays } from 'lucide-react'

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="collection" element={<Library />} />
          <Route path="journal" element={<Journal />} />
          <Route path="insights" element={<Insights />} />
          <Route path="discover" element={<Discover />} />
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
          <Route path="title/:titleId" element={<TitleDetails />} />
          <Route path="title/:titleId/edit" element={<AddTitle />} />
          <Route path="titles/:titleId" element={<LegacyTitleRedirect />} />
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
  return <Navigate to={`/title/${titleId ?? ''}`} replace />
}

export default App
