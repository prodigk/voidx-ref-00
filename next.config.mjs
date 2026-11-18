/** @type {import('next').NextConfig} */
const nextConfig = {
    // Builds a fully static site into /out — host it anywhere (Vercel, Netlify, Cloudflare Pages, S3…).
    output: "export",
    trailingSlash: true,
    images: { unoptimized: true },
}

export default nextConfig
