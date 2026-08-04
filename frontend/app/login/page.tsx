"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function LoginPage() {
  const pupilsRef = useRef<HTMLElement[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let frame = 0;
    let pointerX = window.innerWidth * 0.72;
    let pointerY = window.innerHeight * 0.35;
    const onPointerMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        pupilsRef.current.forEach((pupil) => {
          const eye = pupil.parentElement?.getBoundingClientRect();
          if (!eye) return;
          const dx = pointerX - (eye.left + eye.width / 2);
          const dy = pointerY - (eye.top + eye.height / 2);
          const distance = Math.max(1, Math.hypot(dx, dy));
          const travel = Math.min(6, distance / 45);
          pupil.style.transform = `translate(${(dx / distance) * travel}px, ${(dy / distance) * travel}px)`;
        });
      });
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  const setPupil = (index: number) => (node: HTMLElement | null) => { if (node) pupilsRef.current[index] = node; };

  return (
    <main className="login-page">
      <Link className="login-brand" href="/" aria-label="TripSync home">
        <span className="brand-mark">T</span><span>TripSync</span>
      </Link>
      <section className="login-experience">
        <div className="travel-scene" aria-label="Three TripSync travelers whose eyes follow the cursor">
          <div className="route route-one" /><div className="route route-two" />
          <span className="map-label label-one">NRT</span><span className="map-label label-two">CDG</span><span className="map-label label-three">ORD</span>
          <div className="scene-copy">
            <p className="scene-kicker">Your group is waiting</p>
            <h1>Every great trip<br />starts together.</h1>
            <p>Three travelers. Three perspectives. One shared direction.</p>
          </div>
          <div className="traveler-trio" aria-hidden="true">
            {["woman-one", "man", "woman-two"].map((kind, personIndex) => (
              <div className={`q-person ${kind}`} key={kind}>
                <div className="q-hair" />
                <div className="q-head">
                  <div className="q-hair-front" />
                  <div className="q-eye left"><i ref={setPupil(personIndex * 2)} /></div>
                  <div className="q-eye right"><i ref={setPupil(personIndex * 2 + 1)} /></div>
                  <div className="q-nose" /><div className="q-smile" />
                </div>
                <div className="q-body"><span /></div>
              </div>
            ))}
          </div>
          <span className="scene-hint">They&apos;re listening</span>
        </div>
        <div className="login-side">
          <div className="login-card">
            <div className="login-heading">
              <p className="login-kicker">Welcome back</p><h2>Continue your journey.</h2>
              <p>Sign in to bring your group&apos;s ideas back into sync.</p>
            </div>
            <form className="login-form" onSubmit={(event) => event.preventDefault()}>
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" autoComplete="email" defaultValue="organizer@tripsync.demo" type="email" />
              <div className="password-row"><label htmlFor="password">Password</label><Link href="#">Forgot password?</Link></div>
              <div className="password-field">
                <input id="password" name="password" autoComplete="current-password" defaultValue="demo-password" type={showPassword ? "text" : "password"} />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button>
              </div>
              <Link className="login-submit" href="/trip">Log in <span>→</span></Link>
            </form>
            <div className="login-divider"><span>or</span></div>
            <button className="google-button" type="button"><span>G</span> Continue with Google</button>
            <p className="signup-copy">New to TripSync? <Link href="#">Create an account</Link></p>
          </div>
          <p className="login-legal">By continuing, you agree to our <Link href="/privacy">Privacy Policy</Link>.</p>
        </div>
      </section>
    </main>
  );
}
