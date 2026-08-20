export default function SignIn({ onSignIn }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100dvh',
      padding: '40px',
      textAlign: 'center',
      background: 'var(--m-bg)',
    }}>
      <h1 style={{
        fontSize: 'clamp(44px, 9vw, 64px)',
        fontWeight: 'normal',
        fontStyle: 'italic',
        color: 'var(--m-accent)',
        letterSpacing: '0.01em',
        lineHeight: 1.05,
      }}>
        Marginalia
      </h1>
      <p style={{
        color: 'var(--m-text-3)',
        fontStyle: 'italic',
        fontSize: '18px',
        margin: '14px 0 38px',
        maxWidth: '30rem',
      }}>
        notes in the margins of someone else&rsquo;s story
      </p>
      <button className="btn-primary" onClick={onSignIn}>
        Sign in with Google
      </button>
    </div>
  )
}
