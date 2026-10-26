import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

function AppLayout(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text-primary)]">
      <Sidebar />
      <div className="min-h-screen lg:pl-64">
        <TopBar />
        <main className="px-5 pb-10 pt-5 sm:px-8 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppLayout
