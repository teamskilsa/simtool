// next.config.mjs

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    styledComponents: true,
  },
  images: {
    remotePatterns: [],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Client-side fallbacks
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'ssh2': false,
        'child_process': false,
        'fs': false,
        'net': false,
        'dns': false,
        'tls': false,
        'crypto': false,
        'stream': false,
        'util': false,
        'zlib': false,
        'events': false,
        'string_decoder': false,
        'timers': 'timers-browserify',
        'timers/promises': 'timers-browserify/lib/promises',
        'mongodb-client-encryption': false,
        'aws4': false,
        'snappy': false,
        'kerberos': false,
        '@mongodb-js/zstd': false,
        'bson-ext': false,
        'mongoose': false,
        'mongodb': false,
       //'self': true  // Add this for xterm
      };

     }

      // Prevent certain packages from being included in the client bundle
      config.module = {
        ...config.module,
        exprContextCritical: false,
        rules: [
          ...config.module.rules,
          {
            test: /mongodb|mongoose/,
            use: 'null-loader'
          }
        ]
      };
    
    // Server-side externals
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        'ssh2',
        'node-ssh',
        'mongodb-client-encryption',
        'kerberos',
        'snappy',
        '@mongodb-js/zstd',
        'bson-ext',
        'mongodb',
        'mongoose'
      ];
    }

    return config;
  },
};

export default nextConfig;