import { PasskeySettings, PasskeySignIn } from "next-passkey-webauthn/react";
import { demoAccounts, demoSession } from "../lib/demo-auth";

export default async function Page({ searchParams }: PageProps<"/">) {
  const [session, { error }] = await Promise.all([demoSession(), searchParams]);
  const invalidCredentials = error === "credentials";

  return (
    <div className="demo">
      <header className="masthead">
        <span className="wordmark">
          <span className="wordmark-icon" aria-hidden="true" />
          next-passkey
        </span>
        <span className="demo-label">Local demo</span>
      </header>

      <main className="workspace">
        <div className="workspace-content">
          {session ? (
            <>
              <h1>Your account</h1>
              <div className="account-header">
                <p>Signed in as {session.account.name}</p>
                <form action="/api/demo-session" method="post">
                  <button name="operation" value="sign-out">Sign out</button>
                </form>
              </div>
              <div className="passkey-settings">
                <PasskeySettings />
              </div>
            </>
          ) : (
            <>
              <div className="sign-in-header">
                <h1>Sign in</h1>
                <p>Use a passkey or sign in with a demo account.</p>
              </div>
              <div className="passkey-sign-in">
                <PasskeySignIn autofill />
              </div>

              <p className="divider">or use a password</p>

              <form className="password-form" action="/api/demo-session" method="post">
                {invalidCredentials && <p role="alert">That email and password didn’t match. Try again.</p>}
                <label htmlFor="demo-email">Email</label>
                <input id="demo-email" type="email" name="email" autoComplete="username webauthn" required />
                <label htmlFor="demo-password">Password</label>
                <input id="demo-password" type="password" name="password" autoComplete="current-password" required />
                <button type="submit">Sign in with password</button>
              </form>
              <div className="demo-accounts">
                <p>Demo accounts</p>
                <ul>
                  {demoAccounts.map(({ id, name }) => <li key={id}><code>{name}</code></li>)}
                </ul>
                <p>Use the value you set for <code>DEMO_PASSWORD</code>.</p>
              </div>
            </>
          )}
        </div>

        <aside className="intro" aria-labelledby="intro-title">
          <h2 id="intro-title">Try passkey sign-in.</h2>
          <p>Sign in with a demo account and add a passkey. Then sign out and try it.</p>
        </aside>
      </main>
    </div>
  );
}
