import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(),
}))

const { signInWithPopup, signInWithRedirect } = await import('firebase/auth')
const { signInWithGoogle } = await import('./signIn')

const fail = (code) => Object.assign(new Error(code), { code })

describe('signInWithGoogle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses the popup when it works', async () => {
    signInWithPopup.mockResolvedValue({ user: { uid: 'u' } })
    expect(await signInWithGoogle('auth', 'provider')).toEqual({ user: { uid: 'u' } })
    expect(signInWithRedirect).not.toHaveBeenCalled()
  })

  it('falls back to a redirect when a popup cannot open', async () => {
    for (const code of ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment']) {
      signInWithPopup.mockRejectedValueOnce(fail(code))
      expect(await signInWithGoogle('auth', 'provider')).toBeNull()
    }
    expect(signInWithRedirect).toHaveBeenCalledTimes(2)
  })

  it('does not redirect when I close the popup myself', async () => {
    signInWithPopup.mockRejectedValue(fail('auth/popup-closed-by-user'))
    await expect(signInWithGoogle('auth', 'provider')).rejects.toMatchObject({ code: 'auth/popup-closed-by-user' })
    expect(signInWithRedirect).not.toHaveBeenCalled()
  })
})
