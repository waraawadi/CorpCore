/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permet l'accès au serveur Next.js dev via domaines locaux derrière NPM
  // (sinon HMR/WebSocket peut être refusé sur *.corpcore.local).
  allowedDevOrigins: ['corpcore.local', '*.corpcore.local'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
