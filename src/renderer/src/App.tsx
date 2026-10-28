import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import DataFolderMissing from './components/DataFolderMissing'
import AppLayout from './layout/AppLayout'
import AddTitle from './pages/AddTitle'
import Dashboard from './pages/Dashboard'
import Library from './pages/Library'
import Settings from './pages/Settings'
import Insights from './pages/Insights'
import TitleDetails from './pages/TitleDetails'
import Journal from './pages/Journal'
import Discover from './pages/Discover'
import Timeline from './pages/Timeline'

function App(): React.JSX.Element {
  // The data folder wasn't found at startup: nothing else can work, so only this screen.
  const startup = window.api.dataLocation.startup
  if (startup.state !== 'ok') return <DataFolderMissing startup={startup} />
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="collection" element={<Library />} />
          <Route path="journal" element={<Journal />} />
          <Route path="insights" element={<Insights />} />
          <Route path="discover" element={<Discover />} />
          <Route path="timeline" element={<Timeline />} />
          <Route path="add" element={<AddTitle />} />
          <Route path="library" element={<Navigate to="/collection" replace />} />
          <Route path="add-title" element={<Navigate to="/add" replace />} />
          <Route path="title/:titleId" element={<TitleDetailsRoute />} />
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

/** A fresh page per title, so switching titles closes dialogs and resets page state. */
function TitleDetailsRoute(): React.JSX.Element {
  const { titleId } = useParams()
  return <TitleDetails key={titleId} />
}

function LegacyTitleRedirect(): React.JSX.Element {
  const { titleId } = useParams()
  return <Navigate to={`/title/${titleId ?? ''}`} replace />
}

export default App
