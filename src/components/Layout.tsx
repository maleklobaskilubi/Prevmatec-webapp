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
    <div className="flex flex-col h-svh">
      {/* Slim top header — just branding + logout */}
      <header className="bg-white border-b border-gray-200 px-4 flex items-center gap-3 z-10 shadow-sm flex-shrink-0" style={{ height: '48px' }}>
        <span className="font-bold text-brand-700 text-base flex-1">Prevmatec</span>
        <span className="text-sm text-gray-400 hidden sm:inline truncate max-w-[160px]">{user?.name}</span>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Odhlásiť</span>
        </button>
      </header>

      {/* Page content — fills remaining space */}
      <main className="flex-1 overflow-hidden min-h-0">
        <Outlet />
      </main>

      {/* Bottom tab bar */}
      <nav className="bg-white border-t border-gray-200 flex-shrink-0 safe-bottom" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex">
          <NavLink
            to="/map"
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
                isActive ? 'text-brand-700' : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Map size={22} strokeWidth={isActive ? 2.5 : 1.75} />
                <span>Mapa</span>
              </>
            )}
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
                isActive ? 'text-brand-700' : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <User size={22} strokeWidth={isActive ? 2.5 : 1.75} />
                <span>Profil</span>
              </>
            )}
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
