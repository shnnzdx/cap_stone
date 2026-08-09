"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import BrandLogo from "../BrandLogo";

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirmPassword")) { setError("The passwords do not match. Please try again."); return; }
    router.push("/login?created=1");
  };

  return <main className="signup-page">
    <Link className="signup-brand" href="/"><BrandLogo /></Link>
    <section className="signup-layout">
      <div className="signup-story">
        <p className="signup-kicker">PLAN TOGETHER</p>
        <h1>Join CADENSY.<br />Keep every plan.</h1>
        <p>Save decisions, revisit accepted plans, and start the next trip together.</p>
        <ul><li><i>✓</i><span><strong>Keep every version</strong>Return to accepted plans and past decisions.</span></li><li><i>✓</i><span><strong>Stay in control</strong>Your visibility choices remain attached to each preference.</span></li><li><i>✓</i><span><strong>Start the next trip</strong>Move from guest traveler to organizer whenever you are ready.</span></li></ul>
      </div>
      <div className="signup-card-wrap">
        <div className="signup-card">
          <p className="signup-kicker">CREATE YOUR ACCOUNT</p>
          <h2>Join CADENSY.</h2>
          <p className="signup-intro">Save your trips and start planning.</p>
          <form className="signup-form" onSubmit={submit}>
            <label htmlFor="name">Your name</label><input id="name" name="name" autoComplete="name" placeholder="Jiayi Chen" required />
            <label htmlFor="signup-email">Email address</label><input id="signup-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
            <label htmlFor="signup-password">Password</label><div className="signup-password"><input id="signup-password" name="password" type={showPassword ? "text" : "password"} minLength={8} autoComplete="new-password" placeholder="At least 8 characters" required /><button type="button" onClick={() => setShowPassword(v => !v)}>{showPassword ? "Hide" : "Show"}</button></div>
            <label htmlFor="confirm-password">Confirm password</label><input id="confirm-password" name="confirmPassword" type={showPassword ? "text" : "password"} minLength={8} autoComplete="new-password" required />
            {error && <p className="signup-error" role="alert">{error}</p>}
            <label className="signup-consent"><input type="checkbox" required /><span>I agree to the <Link href="/privacy">Privacy Policy</Link> and understand how CADENSY uses planning data.</span></label>
            <button className="signup-submit" type="submit">Create account <span>→</span></button>
          </form>
          <p className="signup-login">Already have an account? <Link href="/login">Log in</Link></p>
        </div>
      </div>
    </section>
  </main>;
}
