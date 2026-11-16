import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import PrivacyBanner from './components/PrivacyBanner'
import Home from './pages/Home'
import CombineTool from './tools/combine'
import OrganizeTool from './tools/organize'
import CreateTool from './tools/create'
import ExportTool from './tools/export'
import CommentsTool from './tools/comments'
import ProtectTool from './tools/protect'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800">
        <div>
          {/* Privacy Banner: Displayed across every page */}
          <PrivacyBanner />

          {/* Navigation Bar */}
          <Navbar />

          {/* Main Content Area */}
          <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/tools/combine" element={<CombineTool />} />
              <Route path="/tools/organize" element={<OrganizeTool />} />
              <Route path="/tools/create" element={<CreateTool />} />
              <Route path="/tools/export" element={<ExportTool />} />
              <Route path="/tools/comments" element={<CommentsTool />} />
              <Route path="/tools/protect" element={<ProtectTool />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>

        {/* Footer */}
        <Footer />
      </div>
    </BrowserRouter>
  )
}
