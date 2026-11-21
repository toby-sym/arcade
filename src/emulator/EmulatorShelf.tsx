export function EmulatorShelf({ onOpenGba }: { onOpenGba: () => void }) {
  return (
    <section className="emulator-section" aria-labelledby="emulator-title">
      <div className="section-heading emulator-section-heading">
        <div>
          <p className="eyebrow">YOUR FILES · YOUR DEVICE</p>
          <h2 id="emulator-title">Local console cabinets</h2>
        </div>
        <span className="section-count">BRING YOUR OWN GAMES</span>
      </div>
      <p className="emulator-section-intro">Choose a console, then open a game file from your device. Game files stay in your browser and are never uploaded.</p>

      <div className="emulator-card-grid">
        <article className="game-card emulator-card emulator-card-gba">
          <div className="card-art emulator-card-art gba-console-art" aria-hidden="true">
            <svg viewBox="0 0 320 180" role="presentation">
              <path d="M48 46q0-17 18-17h188q18 0 18 17v88q0 17-18 17H66q-18 0-18-17z" fill="#4a4559" stroke="#a69bb7" strokeWidth="3" />
              <rect x="105" y="48" width="112" height="76" rx="5" fill="#0d1020" stroke="#4edcf0" strokeWidth="3" />
              <path d="M112 109h98" stroke="#caff40" strokeWidth="3" />
              <path d="M121 103l18-24 17 15 18-28 29 37" fill="none" stroke="#ff6682" strokeWidth="4" strokeLinejoin="round" />
              <path d="M65 78h22m-11-11v22" stroke="#171422" strokeWidth="10" strokeLinecap="round" />
              <circle cx="254" cy="79" r="11" fill="#ff6682" /><circle cx="234" cy="101" r="11" fill="#caff40" />
              <circle cx="132" cy="137" r="5" fill="#181522" /><circle cx="151" cy="137" r="5" fill="#181522" />
              <rect x="31" y="67" width="17" height="27" rx="8" fill="#8b7ae4" /><rect x="272" y="67" width="17" height="27" rx="8" fill="#8b7ae4" />
            </svg>
            <span className="card-art-index">01</span>
          </div>
          <div className="card-info">
            <div className="card-heading-line"><span className="game-number">01</span><span className="game-category">HANDHELD CLASSIC</span></div>
            <h3>Game Boy Advance</h3>
            <p>Open a GBA game from your device and play with keyboard, touch, or a controller.</p>
            <div className="card-bottom"><span className="controls-label">KEYBOARD · TOUCH · GAMEPAD</span><button className="play-card-button" type="button" onClick={onOpenGba}>Open GBA <span className="arrow-mark" aria-hidden="true" /></button></div>
          </div>
        </article>

        <article className="game-card emulator-card emulator-card-nds">
          <div className="card-art emulator-card-art ds-console-art" aria-hidden="true">
            <svg viewBox="0 0 320 180" role="presentation">
              <g transform="rotate(-5 160 90)">
                <path d="M78 31q0-13 14-13h136q14 0 14 13v45H78z" fill="#423850" stroke="#b8a9c9" strokeWidth="3" />
                <rect x="99" y="31" width="122" height="39" rx="2" fill="#101020" stroke="#4edcf0" strokeWidth="2" />
                <path d="M85 78h150" stroke="#ff6682" strokeWidth="7" strokeLinecap="round" />
                <path d="M60 86q0-10 12-10h176q12 0 12 10v59q0 12-14 12H74q-14 0-14-12z" fill="#51475e" stroke="#b8a9c9" strokeWidth="3" />
                <rect x="129" y="91" width="100" height="44" rx="2" fill="#101020" stroke="#caff40" strokeWidth="2" />
                <path d="M83 108h20m-10-10v20" stroke="#171422" strokeWidth="9" strokeLinecap="round" />
                <circle cx="244" cy="105" r="7" fill="#ff6682" /><circle cx="231" cy="119" r="7" fill="#caff40" />
                <circle cx="116" cy="143" r="3.5" fill="#181522" /><circle cx="130" cy="143" r="3.5" fill="#181522" />
              </g>
            </svg>
            <span className="card-art-index">02</span>
          </div>
          <div className="card-info">
            <div className="card-heading-line"><span className="game-number">02</span><span className="game-category">DUAL SCREEN</span></div>
            <h3>Nintendo DS</h3>
            <p>Play a DS game with touch-screen stylus controls, keyboard, or a standard controller.</p>
            <div className="card-bottom"><span className="controls-label">KEYBOARD · TOUCH · GAMEPAD</span><a className="play-card-button" href="/nds/">Open DS <span className="arrow-mark" aria-hidden="true" /></a></div>
          </div>
        </article>

        <article className="game-card emulator-card emulator-card-wii">
          <div className="card-art emulator-card-art wii-console-art" aria-hidden="true">
            <svg viewBox="0 0 320 180" role="presentation">
              <path d="M76 31q0-9 9-9h83q9 0 9 9v126q0 9-9 9H85q-9 0-9-9z" fill="#e9e5ee" stroke="#4edcf0" strokeWidth="3" />
              <path d="M91 47h70" stroke="#221b2d" strokeWidth="5" strokeLinecap="round" />
              <circle cx="153" cy="67" r="4" fill="#ff6682" /><circle cx="140" cy="67" r="3" fill="#8b7ae4" />
              <rect x="195" y="37" width="32" height="101" rx="14" transform="rotate(16 195 37)" fill="#f7f2e8" stroke="#bdafcc" strokeWidth="2" />
              <circle cx="215" cy="61" r="5" fill="#ff6682" /><circle cx="209" cy="83" r="5" fill="#caff40" />
              <path d="M205 104h13m-6.5-6.5v13" stroke="#51466f" strokeWidth="3" strokeLinecap="round" />
              <path d="M218 136l9 25" stroke="#f7f2e8" strokeWidth="5" strokeLinecap="round" />
              <path d="M53 49a48 48 0 0 1 0 83" fill="none" stroke="#8b7ae4" strokeWidth="2" opacity=".7" />
              <circle cx="54" cy="90" r="4" fill="#caff40" />
            </svg>
            <span className="card-art-index">03</span>
          </div>
          <div className="card-info">
            <div className="card-heading-line"><span className="game-number">03</span><span className="game-category emulator-experimental-label">EXPERIMENTAL · DESKTOP CHROME</span></div>
            <h3>Wii &amp; GameCube</h3>
            <p>Try a GameCube or Wii disc on the experimental browser core. Requires desktop Chromium; Wii Remote input is not supported.</p>
            <div className="card-bottom"><span className="controls-label">GAMEPAD · WEBGPU · DESKTOP</span><a className="play-card-button" href="/wii/">Open Wii <span className="arrow-mark" aria-hidden="true" /></a></div>
          </div>
        </article>
      </div>
    </section>
  )
}
