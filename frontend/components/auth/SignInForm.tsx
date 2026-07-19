"use client";

import Link from "next/link";
import Image from "next/image";
import React, { useState, useEffect } from "react";
import { login } from "./actions";
import { createClient } from "@/utils/supabase/client";

/** Official ViTCam logo assets (same ones the old brand column used). */
const LOGO_MARK = "/images/logo/vitcam.svg"; // eagle emblem
const LOGO_TEXT = "/images/logo/ViTCam-Logo.png"; // "ViTCam" wordmark image

/**
 * VitCam — Sign In (two-panel, refined)
 *
 * Left: the viewfinder — a live-feed vignette with detection boxes, HUD
 * telemetry, and a slow scan pass. Right: a quiet, precise form.
 *
 * Sophistication pass over v1:
 *  - Orchestrated entrance (staggered fade-rise, reduced-motion aware)
 *  - Fine-grain film noise + vignette on the feed for depth
 *  - HUD telemetry row (FPS / bitrate / codec) in the feed chrome
 *  - Hairline gradient borders and inset highlights instead of flat rings
 *  - Focus states with a soft amber bloom; button with sheen sweep on hover
 *
 * Functional behavior unchanged: `login` server action, Supabase OAuth
 * gated by NEXT_PUBLIC_*_ENABLED flags, /auth/callback redirect.
 */

type ProviderKey = "google" | "github" | "twitter" | "discord";

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [enabledProviders, setEnabledProviders] = useState<ProviderKey[]>([]);
  const [clock, setClock] = useState("");

  useEffect(() => {
    const enabled: ProviderKey[] = [];
    if (process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true") enabled.push("google");
    if (process.env.NEXT_PUBLIC_GITHUB_ENABLED === "true") enabled.push("github");
    if (process.env.NEXT_PUBLIC_TWITTER_ENABLED === "true") enabled.push("twitter");
    if (process.env.NEXT_PUBLIC_DISCORD_ENABLED === "true") enabled.push("discord");
    setEnabledProviders(enabled);
  }, []);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setClock(
        `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
          `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const oauthSignIn = async (provider: "google" | "github" | "x" | "discord") => {
    try {
      setAuthLoading(true);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          ...(provider === "google"
            ? { queryParams: { access_type: "offline", prompt: "consent" } }
            : {}),
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error(`${provider} login error:`, error);
      setAuthLoading(false);
    }
  };

  const gridCols =
    enabledProviders.length === 1
      ? "grid-cols-1"
      : enabledProviders.length === 3
        ? "grid-cols-3"
        : enabledProviders.length >= 4
          ? "grid-cols-2 sm:grid-cols-4"
          : "grid-cols-2";

  return (
    <div className="relative flex min-h-screen w-full items-stretch bg-[#0A101F] text-slate-200 antialiased">
      {/* ================= Left: viewfinder panel (lg+) ================= */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-10 lg:flex xl:p-14">
        {/* Layered ambient background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 20% 0%, rgba(56,189,248,0.08), transparent 60%), radial-gradient(ellipse 70% 50% at 90% 100%, rgba(251,191,36,0.07), transparent 60%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(56,189,248,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.05) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 90% 80% at 50% 40%, black, transparent 85%)",
            WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 50% 40%, black, transparent 85%)",
          }}
        />
        {/* Hairline divider between panels */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent"
        />

        {/* Wordmark */}
        <div className="vc-rise relative z-10 flex items-center gap-0" style={{ animationDelay: "0ms" }}>
          <Image
            src={LOGO_MARK}
            alt=""
            width={65}
            height={65}
            priority
            style={{ height: 65, width: 65 }}
          />
          <Image
            src={LOGO_TEXT}
            alt="ViTCam"
            width={175}
            height={175}
            priority
            className="h-auto w-[175px]"
          />
        </div>

        {/* Viewfinder */}
        <div className="vc-rise relative z-10 mx-auto w-full max-w-lg" style={{ animationDelay: "120ms" }}>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-white/[0.09] to-white/[0.02] p-px shadow-2xl shadow-black/50">
            <div className="relative aspect-video overflow-hidden rounded-[calc(1rem-1px)] bg-[#0C1428]">
              {/* Shadowy night scene: dim sky, faint light pool, dark ground */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, #101a30 0%, #0b1322 46%, #05080f 74%, #030509 100%)",
                }}
              />
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse 55% 45% at 68% 18%, rgba(148,163,184,0.14), transparent 65%), radial-gradient(ellipse 90% 30% at 50% 74%, rgba(148,163,184,0.05), transparent 70%)",
                }}
              />
              {/* Faint ground line */}
              <div
                aria-hidden
                className="absolute inset-x-0 top-[72%] h-px bg-slate-400/10"
              />

              {/* Feed depth: vignette + film noise */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse 120% 100% at 50% 40%, transparent 45%, rgba(0,0,0,0.5) 100%)",
                }}
              />
              <div
                aria-hidden
                className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")",
                }}
              />

              {/* Top chrome: camera id + telemetry */}
              <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent px-4 pb-6 pt-3 font-mono text-[10px] tracking-wider text-slate-400">
                <span className="flex items-center gap-2">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/60 motion-reduce:hidden" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                  </span>
                  <span className="text-slate-200">CAM 01 · DRIVEWAY</span>
                </span>
                <span className="flex items-center gap-3">
                  <span>27 FPS</span>
                  <span className="text-slate-600">|</span>
                  <span>4.2 Mb/s</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-sky-400">H.264</span>
                </span>
              </div>

              {/* Corner brackets */}
              {[
                "left-3.5 top-3.5 border-l-2 border-t-2 rounded-tl",
                "right-3.5 top-3.5 border-r-2 border-t-2 rounded-tr",
                "bottom-3.5 left-3.5 border-b-2 border-l-2 rounded-bl",
                "bottom-3.5 right-3.5 border-b-2 border-r-2 rounded-br",
              ].map((pos) => (
                <span key={pos} aria-hidden className={`absolute z-10 h-5 w-5 border-amber-400/60 ${pos}`} />
              ))}

              {/* Detection boxes */}
              <div className="absolute left-[16%] top-[30%] z-10 h-[44%] w-[30%] rounded-md border border-sky-400/90 shadow-[0_0_18px_rgba(56,189,248,0.18)]">
                <span className="absolute -top-[22px] left-0 flex items-center gap-1 rounded bg-sky-400 px-1.5 py-[3px] font-mono text-[10px] font-semibold leading-none text-[#0A101F]">
                  person <span className="opacity-70">0.97</span>
                </span>
                <span aria-hidden className="absolute inset-0 rounded-md bg-sky-400/[0.06]" />
                {/* Detected subject: dark shadow figure */}
                <svg
                  aria-hidden
                  viewBox="0 0 24 48"
                  className="absolute bottom-0 left-1/2 h-[94%] -translate-x-1/2"
                  fill="#04070d"
                  style={{ opacity: 0.9, filter: "blur(1.2px)" }}
                >
                  <circle cx="12" cy="5.5" r="3.6" />
                  <path d="M12 10.2c-2.9 0-4.9 1.7-5.4 4.4l-1.2 7c-.2 1 .6 1.9 1.6 1.9.8 0 1.4-.5 1.6-1.3l1-4.9h.5l-1.5 9.2c-.1.7.4 1.3 1.1 1.3h.6l.6 16.2c0 .9.8 1.7 1.7 1.7s1.7-.8 1.7-1.7l.4-16.2h.6l.4 16.2c0 .9.8 1.7 1.7 1.7s1.7-.8 1.7-1.7l.6-16.2h.6c.7 0 1.2-.6 1.1-1.3l-1.5-9.2h.5l1 4.9c.2.8.8 1.3 1.6 1.3 1 0 1.8-.9 1.6-1.9l-1.2-7c-.5-2.7-2.5-4.4-5.4-4.4h-2z" />
                </svg>
              </div>
              <div className="absolute right-[12%] top-[46%] z-10 h-[28%] w-[26%] rounded-md border border-amber-400/80 shadow-[0_0_18px_rgba(251,191,36,0.15)]">
                <span className="absolute -top-[22px] left-0 flex items-center gap-1 rounded bg-amber-400 px-1.5 py-[3px] font-mono text-[10px] font-semibold leading-none text-[#0A101F]">
                  car <span className="opacity-70">0.91</span>
                </span>
                <span aria-hidden className="absolute inset-0 rounded-md bg-amber-400/[0.05]" />
                {/* Detected subject: dark shadow vehicle */}
                <svg
                  aria-hidden
                  viewBox="0 0 64 30"
                  className="absolute bottom-[6%] left-1/2 w-[88%] -translate-x-1/2"
                  fill="#04070d"
                  style={{ opacity: 0.9, filter: "blur(1.2px)" }}
                >
                  <path d="M9 20.5c0-1.2.8-2.2 2-2.5l4.6-1.2 4-5.6C20.6 9.8 22.2 9 24 9h13.4c1.8 0 3.5.9 4.5 2.4l3.4 5 7.7 1.4c1.3.2 2.2 1.3 2.2 2.6v2.1c0 1.2-1 2.2-2.2 2.2h-1.6a5.1 5.1 0 0 1-10.1 0H23.9a5.1 5.1 0 0 1-10.1 0h-2.6c-1.2 0-2.2-1-2.2-2.2v-2z" />
                  <circle cx="18.9" cy="23.5" r="3.4" />
                  <circle cx="46.4" cy="23.5" r="3.4" />
                </svg>
              </div>

              {/* Scan pass */}
              <div aria-hidden className="absolute inset-0 z-10 overflow-hidden motion-reduce:hidden">
                <div className="vc-scan absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-sky-400/[0.07] to-transparent" />
              </div>

              {/* Bottom chrome: status strip */}
              <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-4 pb-3 pt-6 font-mono text-[10px] tracking-wider text-slate-400">
                <span className="text-emerald-400">● TRACKING 2</span>
                <span suppressHydrationWarning className="text-slate-300">{clock}</span>
              </div>
            </div>
          </div>

          {/* Headline */}
          <div className="mt-10">
            <p className="text-balance text-[1.7rem] font-semibold leading-snug tracking-tight text-white xl:text-3xl">
              Give every camera a brain.
              <br />
              <span className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
                Keep every frame at home.
              </span>
            </p>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
              From plain RTSP to AI Vision Transformers — ViTCam turns any
              camera into an intelligent one, with recording, detection, and
              tracking that never leave your network.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          className="vc-rise relative z-10 flex items-center gap-4 font-mono text-[11px] tracking-wide text-slate-500"
          style={{ animationDelay: "240ms" }}
        >
          <span>AGPL-3.0</span>
          <span aria-hidden className="h-3 w-px bg-white/10" />
          <span>self-hosted</span>
          <span aria-hidden className="h-3 w-px bg-white/10" />
          <span>SCW Software</span>
        </div>
      </aside>

      {/* ================= Right: form panel ================= */}
      <main className="relative flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        {/* Soft bloom behind the form */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 45% at 50% 45%, rgba(251,191,36,0.04), transparent 70%)",
          }}
        />

        <div className="relative z-10 w-full max-w-sm">
          {/* Compact brand header on mobile */}
          <div className="vc-rise mb-10 flex items-center gap-0 lg:hidden" style={{ animationDelay: "0ms" }}>
            <Image
              src={LOGO_MARK}
              alt=""
              width={55}
              height={55}
              priority
              style={{ height: 55, width: 55 }}
            />
            <Image
              src={LOGO_TEXT}
              alt="ViTCam"
              width={148}
              height={148}
              priority
              className="h-auto w-[148px]"
            />
          </div>

          <div className="vc-rise mb-9" style={{ animationDelay: "80ms" }}>
            <p className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.25em] text-sky-400">
              Operator access
            </p>
            <h1 className="text-[1.65rem] font-semibold tracking-tight text-white">
              Sign in to your console
            </h1>
          </div>

          <form className="vc-rise space-y-5" style={{ animationDelay: "160ms" }}>
            <div>
              <label htmlFor="email" className="mb-2 block text-[13px] font-medium text-slate-300">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="vc-input w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition duration-200"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="password" className="block text-[13px] font-medium text-slate-300">
                  Password
                </label>
                <Link href="/reset-password" className="text-xs text-sky-400 transition hover:text-sky-300">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="vc-input w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 pr-11 text-sm text-white placeholder-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="2.6" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M3 3l18 18M10.6 5.8A10.8 10.8 0 0 1 12 5.7c6.4 0 10 6.3 10 6.3a17.6 17.6 0 0 1-3.2 3.8M6.4 6.5A17 17 0 0 0 2 12s3.6 6.5 10 6.5c1.3 0 2.5-.25 3.6-.66" />
                      <path d="M9.9 10a2.6 2.6 0 0 0 3.7 3.6" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer select-none items-center gap-2.5 pt-0.5 text-sm text-slate-400 transition hover:text-slate-300">
              <input
                type="checkbox"
                checked={keepLoggedIn}
                onChange={(e) => setKeepLoggedIn(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/[0.04] accent-amber-400 focus:ring-amber-400/30"
              />
              Keep me signed in
            </label>

            <button
              formAction={login}
              className="vc-cta group relative w-full overflow-hidden rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 px-4 py-3.5 text-sm font-semibold text-[#0A101F] shadow-lg shadow-amber-500/20 transition duration-200 hover:shadow-amber-400/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A101F] active:from-amber-400 active:to-amber-600"
            >
              <span className="relative z-10">Sign in</span>
              {/* Sheen sweep on hover */}
              <span
                aria-hidden
                className="absolute inset-y-0 -left-1/2 z-0 w-1/3 -skew-x-12 bg-white/30 opacity-0 blur-sm transition-all duration-500 group-hover:left-[120%] group-hover:opacity-100 motion-reduce:hidden"
              />
            </button>
          </form>

          {enabledProviders.length > 0 && (
            <div className="vc-rise" style={{ animationDelay: "240ms" }}>
              <div className="my-8 flex items-center gap-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/15" />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  or continue with
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/15" />
              </div>

              <div className={`grid ${gridCols} gap-3`}>
                {enabledProviders.includes("google") && (
                  <OAuthButton label="Google" disabled={authLoading} onClick={() => oauthSignIn("google")}>
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  </OAuthButton>
                )}

                {enabledProviders.includes("github") && (
                  <OAuthButton label="GitHub" disabled={authLoading} onClick={() => oauthSignIn("github")}>
                    <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                  </OAuthButton>
                )}

                {enabledProviders.includes("twitter") && (
                  <OAuthButton label="X" disabled={authLoading} onClick={() => oauthSignIn("x")}>
                    <svg width="17" height="17" className="text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </OAuthButton>
                )}

                {enabledProviders.includes("discord") && (
                  <OAuthButton label="Discord" disabled={authLoading} onClick={() => oauthSignIn("discord")}>
                    <svg className="h-5 w-5 text-[#5865F2]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                  </OAuthButton>
                )}
              </div>
            </div>
          )}

          <p className="vc-rise mt-9 text-center text-sm text-slate-500" style={{ animationDelay: "300ms" }}>
            New deployment?{" "}
            <Link href="/signup" className="font-medium text-amber-400 transition hover:text-amber-300">
              Create the admin account
            </Link>
          </p>
        </div>

        {/* Mobile footer */}
        <p className="relative z-10 mt-10 font-mono text-[11px] text-slate-600 lg:hidden">
          AGPL-3.0 · self-hosted · SCW Software
        </p>
      </main>

      {/* Keyframes + focus treatments */}
      <style jsx global>{`
        @keyframes vc-scan {
          0% {
            top: -12%;
          }
          100% {
            top: 108%;
          }
        }
        .vc-scan {
          animation: vc-scan 6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes vc-rise {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .vc-rise {
          animation: vc-rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .vc-input:focus {
          border-color: rgba(251, 191, 36, 0.55);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.04),
            0 0 0 3px rgba(251, 191, 36, 0.12),
            0 0 24px rgba(251, 191, 36, 0.08);
          background-color: rgba(255, 255, 255, 0.06);
        }

        @media (prefers-reduced-motion: reduce) {
          .vc-scan {
            animation: none;
            display: none;
          }
          .vc-rise {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

function OAuthButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Continue with ${label}`}
      className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-200 hover:-translate-y-px hover:border-white/20 hover:bg-white/[0.07] hover:shadow-lg hover:shadow-black/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:hover:translate-y-0"
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}