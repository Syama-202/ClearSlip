// Retrieval evaluation set for Ask ClearSlip. Each question lists the
// knowledge-base document(s) that answer it (file names in src/rag/corpus).
// Many are phrased the way a first-time employee would ask, without the
// document's own keywords, to test retrieval by meaning.
export const EVAL_QUESTIONS = [
  { q: 'How much tax will I pay on a 10 lakh salary in the new regime?', docs: ['new-tax-regime'] },
  { q: 'Is income up to 12 lakh tax free?', docs: ['new-tax-regime'] },
  { q: 'What is the standard deduction for salaried people?', docs: ['new-tax-regime', 'old-tax-regime'] },
  { q: 'Which deductions can I not claim if I opt for the new regime?', docs: ['new-tax-regime'] },
  { q: 'What happens if I earn slightly more than 12 lakh?', docs: ['new-tax-regime'] },
  { q: 'What are the old regime tax slabs?', docs: ['old-tax-regime'] },
  { q: 'Should I pick the old or new regime?', docs: ['choosing-regime', 'old-tax-regime'] },
  { q: 'Can I change my tax regime every year?', docs: ['choosing-regime'] },
  { q: "My employer asked me to choose a regime, what if I don't reply?", docs: ['choosing-regime', 'new-tax-regime'] },
  { q: 'How do I calculate HRA exemption?', docs: ['hra-exemption'] },
  { q: 'Is Bangalore considered a metro city for house rent?', docs: ['hra-exemption'] },
  { q: 'Can I claim rent paid to my mother?', docs: ['hra-exemption'] },
  { q: "Do I need my landlord's PAN?", docs: ['hra-exemption'] },
  { q: 'What investments save tax under 80C?', docs: ['section-80c'] },
  { q: 'How much more can I invest after my PF deduction?', docs: ['section-80c'] },
  { q: 'Which tax saving option has the shortest lock-in?', docs: ['section-80c'] },
  { q: 'Is there any extra deduction for NPS beyond 1.5 lakh?', docs: ['nps'] },
  { q: "Can I save tax in the new regime through my employer's pension contribution?", docs: ['nps'] },
  { q: 'Why is 12% of my basic cut every month?', docs: ['epf'] },
  { q: 'How do I check my provident fund balance?', docs: ['epf'] },
  { q: 'What interest does EPF give?', docs: ['epf'] },
  { q: 'Who has to pay ESI?', docs: ['esi'] },
  { q: 'Why is ₹200 deducted as professional tax?', docs: ['professional-tax'] },
  { q: 'Is professional tax deductible in income tax?', docs: ['professional-tax'] },
  { q: 'Why did my TDS increase a lot in February?', docs: ['tds-on-salary'] },
  { q: 'How will I get back extra tax deducted from my salary?', docs: ['tds-on-salary', 'form-16-and-itr'] },
  { q: 'When will my company give me Form 16?', docs: ['form-16-and-itr'] },
  { q: 'What is the last date to file my return and what if I miss it?', docs: ['form-16-and-itr'] },
  { q: 'How many times can I claim travel allowance?', docs: ['lta'] },
  { q: 'Why is my take-home much less than CTC divided by 12?', docs: ['salary-components'] },
  { q: 'Is special allowance taxable?', docs: ['salary-components'] },
  { q: 'How is gratuity calculated?', docs: ['gratuity'] },
  { q: "Can I deduct my parents' health insurance premium?", docs: ['section-80d'] },
  { q: 'Do I get tax benefit on my home loan interest?', docs: ['home-loan'] },
  { q: 'What is dearness allowance?', docs: ['salary-components'] },
]

// Nothing in the knowledge base answers these — the assistant should refuse
export const OFF_TOPIC_QUESTIONS = [
  'Who won the cricket world cup in 2011?',
  'Give me a recipe for chicken biryani',
  'What is the capital of France?',
  "How do I fix my laptop's wifi?",
]
