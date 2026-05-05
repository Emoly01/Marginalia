export default function SignIn({ onSignIn }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      padding: 'var(--space-xl)',
      textAlign: 'center'
    }}>
      <h1 style={{
        fontSize: '3rem',
        fontWeight: 'normal',
        fontStyle: 'italic',
        color: 'var(--accent)',
        marginBottom: 'var(--space-sm)',
        letterSpacing: '0.02em'
      }}>
        Marginalia
      </h1>
      <p style={{
        color: 'var(--ink-muted)',
        marginBottom: 'var(--space-xl)',
        maxWidth: '32rem',
        fontStyle: 'italic'
      }}>
        notes in the margins of someone else's story
      </p>
      <button
        onClick={onSignIn}
        style={{
          background: 'var(--accent)',
          color: 'var(--bg)',
          padding: 'var(--space-sm) var(--space-lg)',
          borderRadius: 'var(--radius)',
          fontWeight: 600,
          fontFamily: 'var(--font-ui)',
        }}
      >
        Sign in with Google
      </button>
    </div>
  )
}
