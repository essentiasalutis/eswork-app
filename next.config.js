/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Impedisce che la pagina venga caricata in un iframe (clickjacking)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Il browser non indovina il tipo di file — previene MIME sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Non passa l'URL di provenienza a siti esterni
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Forza HTTPS per 1 anno
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Limita cosa il browser può fare (disabilita features non usate)
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};
