import Link from "next/link";
import { Footer, Header } from "../page";

export default function LoginPage() {
  return (
    <main>
      <Header />
      <section className="login-shell shell">
        <div className="login-copy">
          <p className="eyebrow">Demo access</p>
          <h1>Log in to continue planning.</h1>
          <p className="lede">
            This local merge uses a lightweight demo login so you can review the post-login trip workspace before account logic is connected.
          </p>
        </div>
        <form className="login-panel">
          <label>
            Email
            <input defaultValue="organizer@tripsync.demo" type="email" />
          </label>
          <label>
            Password
            <input defaultValue="demo-password" type="password" />
          </label>
          <Link className="button dark" href="/trip">
            Enter trip workspace
          </Link>
          <p>Demo only. Authentication is not wired yet.</p>
        </form>
      </section>
      <Footer />
    </main>
  );
}
