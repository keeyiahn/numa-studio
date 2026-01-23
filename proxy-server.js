// Simple CORS proxy server for Git operations in development
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());

// Proxy middleware for Git operations
app.use('/', createProxyMiddleware({
    target: 'https://github.com',
    changeOrigin: true,
    pathRewrite: {
        '^/': '/', // Keep the path as is
    },
    onProxyReq: (proxyReq, req, res) => {
        // Add necessary headers for Git operations
        proxyReq.setHeader('User-Agent', 'git/2.0');
    },
    onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.status(500).json({ error: 'Proxy error', message: err.message });
    },
    logLevel: 'debug'
}));

app.listen(PORT, () => {
    console.log(`CORS proxy server running on http://localhost:${PORT}`);
    console.log('Use this URL as your proxy: http://localhost:3001');
});

