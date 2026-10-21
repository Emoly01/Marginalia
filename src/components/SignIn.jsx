import { IlluminatedTitle, Drollery, FrameCorners } from './ornament'
import { useInk } from '../lib/useInk'

export default function SignIn({ onSignIn }) {
  useInk(null, 'desk')
  return (
    <div className="frame app">
      <div className="frame-surface">
        <main className="signin">
          <div className="panel signin-card">
            <Drollery type="owl" width={180} />
            <IlluminatedTitle text="Marginalia" as="h1" size={72} variant="grand" className="signin-title" />
            <p className="signin-tagline">notes in the margins of someone else’s story</p>
            <button className="btn-primary btn--lg" onClick={onSignIn}>Sign in with Google</button>
          </div>
        </main>
        <FrameCorners />
      </div>
    </div>
  )
}
