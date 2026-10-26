import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layout/AppLayout'
import AddTitle from './pages/AddTitle'
import Dashboard from './pages/Dashboard'
import Library from './pages/Library'
import Settings from './pages/Settings'
import Statistics from './pages/Statistics'
import TitleDetails from './pages/TitleDetails'
import WatchHistory from './pages/WatchHistory'

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="library" element={<Library />} />
          <Route path="add-title" element={<AddTitle />} />
          <Route path="titles/:titleId" element={<TitleDetails />} />
          <Route path="watch-history" element={<WatchHistory />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
