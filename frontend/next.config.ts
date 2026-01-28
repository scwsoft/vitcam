import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
     images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '192.168.68.109',
        port: '54321',
        pathname: '/storage/**',
      },
    ],
  },
  output: 'standalone', // Keep this if using Docker
   async headers() {
        return [
            {
                source: '/:live*',
                headers: [
                        {
                          key: 'cache-control', value: 'no-cache',
                        },
                       ],
            },
            {
                source: '/:settings*',
                headers: [
                        {
                          key: 'cache-control', value: 'no-cache',
                        },
                ],
            },
            {
                source: '/:tools*',
                headers: [
                        {
                          key: 'cache-control', value: 'no-cache',
                        },
                        { key: "Access-Control-Allow-Origin", value: 'https://httpbin.org/bytes/1048576'

                         }, 

                ],
            },
        ]
    },
 webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
};


export default nextConfig;






