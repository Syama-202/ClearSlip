import { useState } from 'react'
import { Menu, X } from 'lucide-react'

export default function Navbar({ activeTab, setActiveTab, onPrivacy, onHome }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 bg-saffron-500 shadow-sm print:hidden">
      <div className="relative mx-auto flex h-16 max-w-screen-2xl items-center px-4 md:px-8">
        {/* Logo */}
        <button onClick={onHome} className="flex items-center gap-2.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-lg font-bold text-saffron-500">C</span>
          <span className="text-xl font-semibold tracking-tight text-white">ClearSlip</span>
        </button>

        {/* Desktop tabs */}
        <div className="ml-10 hidden gap-1 md:flex">
          <TabBtn active={activeTab === 'payslip'} onClick={() => setActiveTab('payslip')}>Payslip Decoder</TabBtn>
          <TabBtn active={activeTab === 'ask'} onClick={() => setActiveTab('ask')}>Ask ClearSlip</TabBtn>
        </div>

        {/* Desktop right link */}
        <div className="ml-auto hidden items-center md:flex">
          <button onClick={onPrivacy} className="rounded-lg px-3 py-2 text-base text-white/90 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
            Privacy
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="ml-auto rounded-lg p-2 text-white md:hidden"
          aria-label="Menu"
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="absolute left-0 right-0 top-16 flex flex-col gap-1 bg-saffron-600 px-4 py-3 shadow-lg md:hidden">
            <MobileTab active={activeTab === 'payslip'} onClick={() => { setActiveTab('payslip'); setMenuOpen(false) }}>Payslip Decoder</MobileTab>
            <MobileTab active={activeTab === 'ask'} onClick={() => { setActiveTab('ask'); setMenuOpen(false) }}>Ask ClearSlip</MobileTab>
            <hr className="my-1.5 border-white/20" />
            <MobileTab active={false} onClick={() => { onPrivacy(); setMenuOpen(false) }}>Privacy Policy</MobileTab>
          </div>
        )}
      </div>
    </nav>
  )
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center rounded-lg px-4 py-2 text-base transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
        active ? 'bg-white font-medium text-saffron-600' : 'text-white/90 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function MobileTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-3 text-left text-base text-white ${active ? 'bg-white/15 font-medium' : ''}`}
    >
      {children}
    </button>
  )
}
