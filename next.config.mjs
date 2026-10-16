/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // pdfjs-dist tenta importar "canvas" (Node) — não é necessário no navegador.
    config.resolve.alias.canvas = false;
    return config;
  },
};
export default nextConfig;
