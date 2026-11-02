import { useState } from 'react'
import Navbar from './components/Navbar.jsx'
import Home from './pages/Home.jsx'
import GovtDocs from './pages/GovtDocs.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
import Ask from './pages/Ask.jsx'

// The Govt Docs page is UI only — its "Get guide" button has no content
// behind it yet — so it stays hidden until the guides exist
const SHOW_GOVT_DOCS = false

export default function App() {
  const [page, setPage] = useState('main')       // 'main' | 'privacy'
  const [activeTab, setActiveTab] = useState('payslip') // 'payslip' | 'ask' | 'govtdocs'

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => { setActiveTab(tab); setPage('main') }}
        onPrivacy={() => setPage('privacy')}
        onHome={() => { setPage('main'); setActiveTab('payslip') }}
        showGovtDocs={SHOW_GOVT_DOCS}
      />
      <main className="flex flex-1 flex-col">
        {page === 'privacy' && <PrivacyPolicy onBack={() => setPage('main')} />}
        {page === 'main' && activeTab === 'payslip' && <Home />}
        {page === 'main' && activeTab === 'ask' && <Ask />}
        {page === 'main' && activeTab === 'govtdocs' && SHOW_GOVT_DOCS && <GovtDocs />}
      </main>
      <footer className="border-t border-line bg-peach px-4 py-4 text-center text-sm text-muted">
        ClearSlip does not store your payslip data. Analysis is session-only and not saved. This is not financial advice.{' '}
        <button onClick={() => setPage('privacy')} className="font-medium text-saffron-600 underline underline-offset-2 hover:text-saffron-700">
          Privacy Policy
        </button>
      </footer>
    </div>
  )
}
