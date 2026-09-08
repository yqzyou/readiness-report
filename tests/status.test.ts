import { describe, expect, it } from 'vitest'
import { sectionStatus } from '@/lib/status'

describe('sectionStatus', () => {
  it('returns good at ratio >= 0.8', () => {
    expect(sectionStatus(80, 100)).toBe('good')
    expect(sectionStatus(4, 5)).toBe('good')
  })

  it('returns warning for 0.5 <= ratio < 0.8', () => {
    expect(sectionStatus(50, 100)).toBe('warning')
    expect(sectionStatus(79, 100)).toBe('warning')
  })

  it('returns critical below 0.5', () => {
    expect(sectionStatus(49, 100)).toBe('critical')
    expect(sectionStatus(0, 15)).toBe('critical')
  })

  it('never divides by zero', () => {
    expect(sectionStatus(0, 0)).toBe('good')
  })
})
