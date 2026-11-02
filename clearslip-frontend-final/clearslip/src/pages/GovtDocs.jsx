import { useState } from 'react'
import { C } from '../utils/colors'

const STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal',
  '— UTs —',
  'Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli','Daman & Diu',
  'Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry',
]

const DOCS = [
  { key: 'aadhaar', label: '📋 Aadhaar', desc: 'Name/DOB/address update, mobile linking, new enrolment' },
  { key: 'passport', label: '🛂 Passport', desc: 'Fresh, renewal, Tatkal, minor passport' },
  { key: 'caste', label: '📜 Caste Certificate', desc: 'OBC/SC/ST certificate, sub-caste' },
  { key: 'income', label: '💼 Income Certificate', desc: 'Annual income certificate for scholarships, govt schemes' },
  { key: 'domicile', label: '🏠 Domicile', desc: 'Residence/domicile certificate' },
  { key: 'dl', label: '🚗 Driving Licence', desc: 'Fresh DL, renewal, address change' },
  { key: 'birth', label: '📅 Birth Certificate', desc: 'New registration, correction, duplicate' },
]

export default function GovtDocs() {
  const [selectedState, setSelectedState] = useState('')
  const [selectedDoc, setSelectedDoc] = useState('')
  const [description, setDescription] = useState('')

  const selectStyle = {
    width: '100%', padding: '9px 12px', fontSize: 13,
    border: `1px solid ${C.amberBorder}`, borderRadius: 8,
    background: '#fff', color: C.textDark, fontFamily: 'inherit',
    outline: 'none', cursor: 'pointer', appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2392400e' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
    paddingRight: 32,
  }

  return (
    <div style={{ display: 'flex', flex: 1, height: 'calc(100vh - 56px - 41px)', overflow: 'hidden' }}>

      {/* Left panel */}
      <aside style={{ width: 300, flexShrink: 0, background: C.peach, borderRight: `1px solid ${C.amberBorder}`, overflowY: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.terra }}>Government Document Guide</div>
          <span style={{ fontSize: 10, background: C.saffron, color: '#fff', padding: '2px 7px', borderRadius: 99, fontWeight: 500 }}>Beta</span>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: '#92400e', fontWeight: 500, display: 'block', marginBottom: 5 }}>Your state</label>
          <select value={selectedState} onChange={e => setSelectedState(e.target.value)} style={selectStyle}>
            <option value="">Select your state / UT</option>
            {STATES.map(s => (
              <option key={s} value={s} disabled={s.startsWith('—')} style={{ color: s.startsWith('—') ? C.textFaint : C.textDark }}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: '#92400e', fontWeight: 500, display: 'block', marginBottom: 5 }}>Document type</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {DOCS.map(doc => (
              <button key={doc.key} onClick={() => setSelectedDoc(doc.key)} style={{
                padding: '8px 10px', borderRadius: 8, textAlign: 'left', border: `1px solid ${selectedDoc === doc.key ? C.saffron : C.amberBorder}`,
                background: selectedDoc === doc.key ? C.yellowCard : '#fff',
                cursor: 'pointer', transition: 'all 0.1s',
              }}>
                <div style={{ fontSize: 13, fontWeight: selectedDoc === doc.key ? 500 : 400, color: C.terra }}>{doc.label}</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{doc.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: '#92400e', fontWeight: 500, display: 'block', marginBottom: 5 }}>Describe your situation (optional)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="e.g. I need to update my Aadhaar address after moving to Bangalore. Not sure which documents to bring."
            style={{ width: '100%', height: 80, border: `1px solid ${C.amberBorder}`, borderRadius: 8, padding: 10, fontSize: 12, resize: 'none', fontFamily: 'inherit', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <button
          disabled={!selectedState || !selectedDoc}
          style={{
            width: '100%', padding: '10px 0', border: 'none', borderRadius: 8,
            background: selectedState && selectedDoc ? C.maroon : '#d1d5db',
            color: '#fff', fontSize: 14, fontWeight: 500,
            cursor: selectedState && selectedDoc ? 'pointer' : 'not-allowed',
          }}
        >
          Get step-by-step guide →
        </button>
      </aside>

      {/* Right panel */}
      <section style={{ flex: 1, overflowY: 'auto', padding: '32px 24px', background: C.cream, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>📑</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: C.terra, marginBottom: 10 }}>Step-by-step guide coming here</div>
          <div style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, marginBottom: 24 }}>
            Select your state and document type on the left, then click "Get guide" to receive exact steps, documents needed, office location, and time estimate — all specific to your state.
          </div>

          <div style={{ background: C.yellowCard, border: `1px solid ${C.amberBorder}`, borderRadius: 10, padding: 16, textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 10 }}>What your guide will include:</div>
            {['Step-by-step process in plain English', 'Documents you need to carry', 'Online vs in-person steps', 'Correct office name and how to find it', 'Estimated time and fee', 'Common mistakes to avoid'].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ color: C.saffron, fontSize: 14 }}>✓</span>
                <span style={{ fontSize: 13, color: C.textMid }}>{item}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, fontSize: 12, color: C.textFaint }}>
            🔒 We do not store your personal details
          </div>
        </div>
      </section>
    </div>
  )
}
