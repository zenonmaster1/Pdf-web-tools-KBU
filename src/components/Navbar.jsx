import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Menu,
  X,
  Files,
  LayoutGrid,
  FilePlus,
  Share2,
  MessageSquarePlus,
  ShieldAlert,
  Home,
} from 'lucide-react'
import { PDF_TOOLS } from '../utils/constants'

const iconMap = {
  Files,
  LayoutGrid,
  FilePlus,
  Share2,
  MessageSquarePlus,
  ShieldAlert,
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()

  const closeMenu = () => setIsOpen(false)

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <Link
            to="/"
            onClick={closeMenu}
            className="flex items-center gap-2.5 min-h-[44px] group"
          >
            <span className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold text-lg flex items-center justify-center shadow-xs group-hover:bg-blue-700 transition-colors">
              PDF
            </span>
            <div>
              <span className="font-bold text-base sm:text-lg text-slate-900 tracking-tight block leading-tight">
                WebPDF Studio
              </span>
              <span className="text-[11px] text-slate-500 block leading-none">
                โครงงานเครื่องมือจัดการ PDF
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            <Link
              to="/"
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors min-h-[44px] flex items-center gap-1.5 ${
                location.pathname === '/'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>หน้าแรก</span>
            </Link>

            {PDF_TOOLS.map((tool) => {
              const Icon = iconMap[tool.iconName] || Files
              const isActive = location.pathname === tool.path
              return (
                <Link
                  key={tool.id}
                  to={tool.path}
                  className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors min-h-[44px] flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tool.title}</span>
                </Link>
              )
            })}
          </nav>

          {/* Mobile Menu Button: at least 44px min height & width */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
            className="lg:hidden min-h-[44px] min-w-[44px] p-2 rounded-xl text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Collapsible Mobile Menu Drawer */}
      {isOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 shadow-lg animate-in slide-in-from-top-2 duration-150">
          <Link
            to="/"
            onClick={closeMenu}
            className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium min-h-[44px] transition-colors ${
              location.pathname === '/'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Home className="w-5 h-5" />
            <span>หน้าแรก</span>
          </Link>

          {PDF_TOOLS.map((tool) => {
            const Icon = iconMap[tool.iconName] || Files
            const isActive = location.pathname === tool.path
            return (
              <Link
                key={tool.id}
                to={tool.path}
                onClick={closeMenu}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium min-h-[44px] transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-5 h-5 text-blue-600" />
                <div className="flex flex-col">
                  <span>{tool.title}</span>
                  <span className="text-[11px] text-slate-400 font-normal">{tool.description}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </header>
  )
}
