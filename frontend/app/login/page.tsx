"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function LoginPage() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const pupilsRef = useRef<HTMLDivElement[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const scene = sceneRef.current;
    const plane = planeRef.current;
    if (!scene || !plane) return;
    let frame = 0;
    let targetX = scene.clientWidth * 0.72;
    let targetY = scene.clientHeight * 0.25;
    let planeX = targetX;
    let planeY = targetY;
    let gazeX = 0;
    let gazeY = 0;
    let lastX = planeX;
    let lastY = planeY;

    const pointTo = (clientX: number, clientY: number) => {
      const bounds = scene.getBoundingClientRect();
      targetX = Math.max(28, Math.min(bounds.width - 28, clientX - bounds.left));
      targetY = Math.max(28, Math.min(bounds.height - 28, clientY - bounds.top));
    };
    const onPointerMove = (event: PointerEvent) => pointTo(event.clientX, event.clientY);
    const onPointerLeave = () => {
      targetX = scene.clientWidth * 0.72;
      targetY = scene.clientHeight * 0.25;
    };
    const animate = (time: number) => {
      planeX += (targetX - planeX) * 0.075;
      planeY += (targetY - planeY) * 0.075;
      const driftX = Math.sin(time * 0.0031) * 5;
      const driftY = Math.cos(time * 0.0038) * 4;
      const angle = Math.atan2(planeY - lastY, planeX - lastX) * (180 / Math.PI);
      plane.style.transform = `translate3d(${planeX + driftX}px, ${planeY + driftY}px, 0) rotate(${angle + 8}deg)`;

      const bounds = scene.getBoundingClientRect();
      const desiredX = Math.max(-1, Math.min(1, (planeX - bounds.width * 0.46) / (bounds.width * 0.42)));
      const desiredY = Math.max(-1, Math.min(1, (planeY - bounds.height * 0.57) / (bounds.height * 0.38)));
      gazeX += (desiredX - gazeX) * 0.045;
      gazeY += (desiredY - gazeY) * 0.045;
      pupilsRef.current.forEach((pupil) => pupil?.style.setProperty("transform", `translate(${gazeX * 7}px, ${gazeY * 5}px)`));
      scene.style.setProperty("--head-turn", `${gazeX * 5}deg`);
      scene.style.setProperty("--head-tilt", `${gazeY * 3}deg`);
      lastX = planeX;
      lastY = planeY;
      frame = requestAnimationFrame(animate);
    };
    scene.addEventListener("pointermove", onPointerMove);
    scene.addEventListener("pointerleave", onPointerLeave);
    frame = requestAnimationFrame(animate);
    return () => {
      scene.removeEventListener("pointermove", onPointerMove);
      scene.removeEventListener("pointerleave", onPointerLeave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <main className="login-page">
      <Link className="login-brand" href="/" aria-label="TripSync home">
        <span className="brand-mark">T</span><span>TripSync</span>
      </Link>
      <section className="login-experience">
        <div className="travel-scene" ref={sceneRef} aria-label="Interactive TripSync travel companion">
          <div className="route route-one" /><div className="route route-two" />
          <span className="map-label label-one">NRT</span><span className="map-label label-two">CDG</span><span className="map-label label-three">ORD</span>
          <div className="scene-copy">
            <p className="scene-kicker">Your group is waiting</p>
            <h1>Every great trip<br />starts together.</h1>
            <p>Move your cursor and let your travel companion follow the next idea.</p>
          </div>
          <div className="paper-plane" ref={planeRef} aria-hidden="true"><i /></div>
          <div className="companion-wrap" aria-hidden="true">
            <div className="companion-shadow" />
            <div className="companion-body">
              <div className="companion-pack"><span /></div>
              <div className="companion-head">
                <div className="companion-ear left" /><div className="companion-ear right" />
                <div className="companion-face">
                  <div className="companion-eye left"><i ref={(node) => { if (node) pupilsRef.current[0] = node; }} /></div>
                  <div className="companion-eye right"><i ref={(node) => { if (node) pupilsRef.current[1] = node; }} /></div>
                  <div className="companion-nose" /><div className="companion-smile" />
                </div>
              </div>
              <div className="companion-scarf" /><div className="companion-foot left" /><div className="companion-foot right" />
            </div>
          </div>
          <span className="scene-hint">Move to explore</span>
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
