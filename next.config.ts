import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "10.0.0.42",
    "192.168.18.44",
  ],
};

export default nextConfig;