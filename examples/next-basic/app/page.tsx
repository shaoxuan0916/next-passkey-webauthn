import { PasskeySignIn } from "next-passkey-webauthn/react";
import { PasskeyManager, PasskeySignOut } from "./passkey-manager";
import { demoAccounts, demoSession, localDemo, passkeyCacheScope } from "../lib/demo-auth";

const repository = "https://github.com/shaoxuan0916/next-passkey-webauthn";

function StartDemo({ returning = false }: { returning?: boolean }) {
  return (
    <form action="/api/demo-session" method="post">
      <button className="primary" name="operation" value="start">{returning ? "Start a new demo" : "Start demo"}</button>
    </form>
  );
}

export default async function Page({ searchParams }: PageProps<"/">) {
  const [session, params] = await Promise.all([demoSession(), searchParams]);
  const invalidCredentials = params.error === "credentials";
  const passwordForm = localDemo && (params.method === "password" || invalidCredentials);
  const returning = params.returning === "1";
  const cacheScope = session ? passkeyCacheScope(session.id) : "";

  return (
    <div className="demo">
      <header className="masthead">
        <a className="wordmark" href="/">
          <span className="brand-key" aria-hidden="true" />
          next-passkey
        </a>
        <nav aria-label="Resources">
          <a href={`${repository}/blob/main/docs/quickstart.md`} target="_blank" rel="noopener noreferrer">Guide</a>
          <a href="https://www.npmjs.com/package/next-passkey-webauthn" target="_blank" rel="noopener noreferrer">NPM</a>
          <a href={repository} target="_blank" rel="noopener noreferrer">GitHub</a>
        </nav>
      </header>

      <main>
        {session ? (
          <>
            <div className="account-heading">
              <h1>{session.usedPasskey ? "You’re in." : "Your demo account"}</h1>
              {session.usedPasskey && <p className="lede">You signed in with your passkey.</p>}
              <p className="account">Signed in as {session.account.name}</p>
              <PasskeySignOut cacheScope={cacheScope} />
            </div>
            <PasskeyManager key={cacheScope} cacheScope={cacheScope} />
          </>
        ) : (
          <div className="hero">
            <div className={returning || passwordForm ? "key-art" : "key-art key-art-enter"} aria-hidden="true" />
            <div className="hero-copy">
              {passwordForm ? (
                <>
                  <h1>Demo account</h1>
                  <p className="lede">Use a local test account and the password set in <code>DEMO_PASSWORD</code>.</p>
                  <form className="password-form" action="/api/demo-session" method="post">
                    {invalidCredentials && <p role="alert">That email and password didn’t match. Try again.</p>}
                    <label htmlFor="demo-email">Email</label>
                    <input id="demo-email" type="email" name="email" autoComplete="username webauthn"
                      defaultValue={demoAccounts[0].name} required />
                    <label htmlFor="demo-password">Password</label>
                    <input id="demo-password" type="password" name="password" autoComplete="current-password" required />
                    <button className="primary" type="submit">Sign in with password</button>
                  </form>
                  <div className="alternate"><PasskeySignIn autofill /></div>
                </>
              ) : (
                <>
                  <h1>{returning ? "Welcome back" : "Try a passkey"}</h1>
                  <p className="lede">{returning
                    ? "Use the passkey you saved for this demo."
                    : "Start the demo to create a passkey, then use it to sign back in."}</p>
                  {params.error === "rate-limit" && <p role="alert">Too many demo accounts created. Try again in a minute.</p>}
                  <div className={returning ? "actions returning" : "actions entry-actions"}>
                    {returning ? (
                      <><PasskeySignIn /><StartDemo returning /></>
                    ) : (
                      <>
                        <StartDemo />
                        <a href="/?returning=1">I already have a demo passkey</a>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <details className="guide">
          <summary>About passkeys</summary>
          <dl className="guide-content passkey-faq">
            <dt>What is a passkey?</dt>
            <dd>It lets you sign in without a password. You approve sign-in using your device’s face or fingerprint recognition, PIN, or another screen lock.</dd>
            <dt>Where is it saved?</dt>
            <dd>Your device prompt shows where it will be saved, such as Apple Passwords, Google Password Manager, or a security key. A password manager can sync it to your other devices.</dd>
            <dt>What makes it safe?</dt>
            <dd>A passkey works only with the site it was created for. This demo stores the public key and uses it to verify sign-in. Your private key stays with your passkey provider, and your device keeps your PIN and biometrics private.</dd>
          </dl>
        </details>

        <details className="guide">
          <summary>How it works</summary>
          <div className="guide-content">
            {session ? (
              <>
                <p>The example app owns the guest account and session. The settings UI calls <code>createPasskeyClient</code>, and the SDK route verifies WebAuthn and stores public credentials in PostgreSQL.</p>
                <a href={`${repository}/blob/main/docs/quickstart.md#use-your-own-ui`}>Build a custom UI</a>
              </>
            ) : (
              <p>The demo creates an account for you. Add a passkey using your device’s prompt, then sign out and use it to return to the same account.</p>
            )}
            <a href={`${repository}/tree/main/examples/next-basic`}>View example code</a>
            {localDemo && !session && !passwordForm && <a href="/?method=password">Use a local test account</a>}
          </div>
        </details>
      </main>
    </div>
  );
}
