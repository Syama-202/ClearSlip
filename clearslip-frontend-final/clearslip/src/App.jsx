import { useState } from 'react'
import Navbar from './components/Navbar.jsx'
import Home from './pages/Home.jsx'
import GovtDocs from './pages/GovtDocs.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'

export default function App() {
  const [page, setPage] = useState('main')       // 'main' | 'privacy'
  const [activeTab, setActiveTab] = useState('payslip') // 'payslip' | 'govtdocs'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#fffbeb' }}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => { setActiveTab(tab); setPage('main') }}
        onPrivacy={() => setPage('privacy')}
        onHome={() => { setPage('main'); setActiveTab('payslip') }}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {page === 'privacy' && <PrivacyPolicy onBack={() => setPage('main')} />}
        {page === 'main' && activeTab === 'payslip' && <Home />}
        {page === 'main' && activeTab === 'govtdocs' && <GovtDocs />}
      </div>
      <footer style={{
        background: '#fff7ed', borderTop: '1px solid #fde68a',
        padding: '10px 24px', textAlign: 'center', fontSize: 12, color: '#92400e',
      }}>
        ClearSlip does not store your payslip data. Analysis is session-only and not saved. This is not financial advice.{' '}
        <button onClick={() => setPage('privacy')} style={{ color: '#ea580c', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, textDecoration: 'underline', padding: 0 }}>
          Privacy Policy
        </button>
      </footer>
    </div>
  )
}
