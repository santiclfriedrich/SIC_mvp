/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.elit.com.ar" },
      { protocol: "https", hostname: "masnet.com.ar" },
      { protocol: "https", hostname: "www.gruponucleo.app" },
      { protocol: "https", hostname: "corcisa.com.ar" },
      { protocol: "https", hostname: "via.placeholder.com" },
    ],
  },
};

export default nextConfig;
