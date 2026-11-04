// Aadhaar numbers end in a Verhoeff check digit and never start with 0 or 1.
// Checking both means a 12-digit employee ID or reference number on a payslip is
// no longer mistaken for an Aadhaar number (about 1 in 10 random numbers still pass).
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]

/** True when the digit string ends in a correct Verhoeff check digit. */
export function verhoeffValid(digits) {
  let c = 0
  ;[...digits].reverse().forEach((d, i) => { c = D[c][P[i % 8][Number(d)]] })
  return c === 0
}

/** True if the text contains a 12-digit number (spaces allowed) that is a valid Aadhaar number. */
export function containsAadhaar(text) {
  for (const [match] of String(text).matchAll(/\b\d{4}\s?\d{4}\s?\d{4}\b/g)) {
    const digits = match.replace(/\s/g, '')
    if (/^[2-9]/.test(digits) && verhoeffValid(digits)) return true
  }
  return false
}
