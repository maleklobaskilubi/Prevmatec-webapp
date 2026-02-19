import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../ctx/AuthContext'
import { Map, User, LogOut } from 'lucide-react'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4 z-10 shadow-sm">
        <span className="font-bold text-brand-700 text-lg mr-2">Prevmatec</span>

        <NavLink
          to="/map"
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive ? 'bg-brand-100 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
            }`
          }
        >
          <Map size={16} /> Mapa
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive ? 'bg-brand-100 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
            }`
          }
        >
          <User size={16} /> Profil
        </NavLink>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-gray-500 hidden sm:inline">{user?.name}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Odhlásiť</span>
          </button>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
