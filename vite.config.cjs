const path = require('path');

module.exports = {
  plugins: [
    require('@vitejs/plugin-react')
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client', 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
      '@assets': path.resolve(__dirname, 'attached_assets'),
    },
  },
  root: path.resolve(__dirname, 'client'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist', 'public'),
    emptyOutDir: true,
  },
};
