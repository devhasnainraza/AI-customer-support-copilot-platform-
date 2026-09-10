import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js requires inline styles; scripts stay self + eval for dev HMR.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Google Fonts (Outfit + Plus Jakarta Sans used on login page)
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      // API + WebSocket + Supabase (supports local, Hugging Face Spaces, Render, and Supabase)
      "connect-src 'self' https://*.hf.space wss://*.hf.space https://*.onrender.com wss://*.onrender.com https://*.supabase.co wss://*.supabase.co http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const API_DESTINATION = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: `${API_DESTINATION.replace(/\/$/, '')}/v1/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
