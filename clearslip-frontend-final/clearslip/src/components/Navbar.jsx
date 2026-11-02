import { useState } from 'react'
import { C } from '../utils/colors'

export default function Navbar({ activeTab, setActiveTab, onPrivacy, onHome }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav style={{
      background: C.saffron, position: 'sticky', top: 0, zIndex: 50,
      height: 56, display: 'flex', alignItems: 'center', padding: '0 24px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
    }}>
      {/* Logo */}
      <button onClick={onHome} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: 0 }}>
        <div style={{
          width: 28, height: 28, background: '#fff', borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13, color: C.saffron, flexShrink: 0,
        }}>C</div>
        <span style={{ color: '#fff', fontSize: 17, fontWeight: 600, letterSpacing: '-0.3px' }}>ClearSlip</span>
      </button>

      {/* Desktop tabs */}
      <div style={{ display: 'flex', gap: 2, marginLeft: 28 }} className="hidden md:flex">
        <TabBtn active={activeTab === 'payslip'} onClick={() => setActiveTab('payslip')}>Payslip Decoder</TabBtn>
        <TabBtn active={activeTab === 'govtdocs'} onClick={() => setActiveTab('govtdocs')}>
          Govt Docs <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.25)', borderRadius: 4, padding: '1px 5px', marginLeft: 4 }}>Beta</span>
        </TabBtn>
      </div>

      {/* Desktop right buttons */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }} className="hidden md:flex">
        <button style={{ color: 'rgba(255,255,255,0.8)', background: 'none', border: 'none', fontSize: 13, cursor: 'pointer', padding: '4px 8px' }}>
          Sign in
        </button>
        <button style={{
          background: C.maroon, color: '#fff', border: 'none', borderRadius: 6,
          fontSize: 13, fontWeight: 500, padding: '6px 14px', cursor: 'pointer',
        }}>
          Get started
        </button>
      </div>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMenuOpen(o => !o)}
        style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 22, padding: 4 }}
        className="block md:hidden"
        aria-label="Menu"
      >
        {menuOpen ? '✕' : '☰'}
      </button>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div style={{
          position: 'absolute', top: 56, left: 0, right: 0,
          background: C.saffronDark, padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 4,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }} className="block md:hidden">
          <MobileTab active={activeTab === 'payslip'} onClick={() => { setActiveTab('payslip'); setMenuOpen(false) }}>Payslip Decoder</MobileTab>
          <MobileTab active={activeTab === 'govtdocs'} onClick={() => { setActiveTab('govtdocs'); setMenuOpen(false) }}>Govt Docs (Beta)</MobileTab>
          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.15)', margin: '6px 0' }} />
          <MobileTab active={false} onClick={() => { onPrivacy(); setMenuOpen(false) }}>Privacy Policy</MobileTab>
        </div>
      )}
    </nav>
  )
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: active ? '#fff' : 'transparent',
      color: active ? C.saffron : 'rgba(255,255,255,0.8)',
      border: 'none', borderRadius: 6, padding: '5px 12px',
      fontSize: 13, fontWeight: active ? 500 : 400, cursor: 'pointer',
      display: 'flex', alignItems: 'center', transition: 'all 0.15s',
    }}>
      {children}
    </button>
  )
}

function MobileTab({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: active ? 'rgba(255,255,255,0.15)' : 'none',
      color: '#fff', border: 'none', borderRadius: 6,
      padding: '10px 12px', fontSize: 14, fontWeight: active ? 500 : 400,
      cursor: 'pointer', textAlign: 'left',
    }}>
      {children}
    </button>
  )
}
