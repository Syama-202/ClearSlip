import { useState } from 'react'
import Navbar from './components/Navbar.jsx'
import Home from './pages/Home.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
import Ask from './pages/Ask.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

export default function App() {
  const [page, setPage] = useState('main')       // 'main' | 'privacy'
  const [activeTab, setActiveTab] = useState('payslip') // 'payslip' | 'ask'

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => { setActiveTab(tab); setPage('main') }}
        onPrivacy={() => setPage('privacy')}
        onHome={() => { setPage('main'); setActiveTab('payslip') }}
      />
      <main className="flex flex-1 flex-col">
        {/* Keyed by page so moving to another page clears a crash */}
        <ErrorBoundary key={`${page}-${activeTab}`}>
          {page === 'privacy' && <PrivacyPolicy onBack={() => setPage('main')} />}
          {page === 'main' && activeTab === 'payslip' && <Home />}
          {page === 'main' && activeTab === 'ask' && <Ask />}
        </ErrorBoundary>
      </main>
      <footer className="border-t border-line bg-peach px-4 py-4 text-center text-sm text-muted print:hidden">
        ClearSlip&apos;s server never stores your payslip. If you choose &ldquo;Save to this device&rdquo;, it stays in your browser only. This is not financial advice.{' '}
        <button onClick={() => setPage('privacy')} className="font-medium text-saffron-600 underline underline-offset-2 hover:text-saffron-700">
          Privacy Policy
        </button>
      </footer>
    </div>
  )
}
