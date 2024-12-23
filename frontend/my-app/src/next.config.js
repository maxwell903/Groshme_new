/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['page.js', 'page.tsx'],
  
  // Specify the source directory for pages
  experimental: {
    pagesDir: './src/pages'
  }
}

module.exports = nextConfig