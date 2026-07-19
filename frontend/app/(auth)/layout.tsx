import { ThemeProvider } from "@/context/ThemeContext";
import React from "react";

/**
 * Auth layout — brand column removed.
 *
 * Diff vs your previous version:
 *  - Deleted the lg:w-1/2 brand column (vitcam.svg + ViTCam-Logo.png +
 *    tagline). That branding now lives inside SignInForm's left panel.
 *  - Deleted ThemeTogglerTwo — the sign-in screen is a fixed dark design,
 *    so a light/dark toggle here only breaks the theme.
 *  - Removed GridShape/Image/Link imports (no longer used).
 *  - Shell is bg-[#0A101F] instead of bg-white, so there's no white flash
 *    or padding gutter around the page.
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <div className="relative min-h-screen w-full bg-[#0A101F]">
        {children}
      </div>
    </ThemeProvider>
  );
}