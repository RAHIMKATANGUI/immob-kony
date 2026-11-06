import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // pdfmake/pdfkit chargent des fichiers de polices (AFM) depuis le disque : ne pas les bundler
  serverExternalPackages: ["pdfmake", "@foliojs-fork/pdfkit", "exceljs", "bcryptjs"],
  // Fichiers chargés dynamiquement, à inclure explicitement dans la sortie « standalone » :
  //  - moteur de requêtes Prisma (WASM)  - polices standard PDF (AFM) de pdfkit
  outputFileTracingIncludes: {
    "/**/*": [
      "./node_modules/.prisma/client/*.wasm",
      "./node_modules/.prisma/client/schema.prisma",
      // condition d'export « module-sync » (Node 22) non suivie par le traçage : dépendances d'exceljs
      "./node_modules/generator-function/*.mjs",
      "./node_modules/async-function/*.mjs",
    ],
    "/api/**/*": ["./node_modules/@foliojs-fork/pdfkit/js/data/**/*"],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
