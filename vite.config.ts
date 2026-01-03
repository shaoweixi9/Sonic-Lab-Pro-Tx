
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 为 TypeScript 声明 process 变量
declare const process: {
  env: {
    API_KEY?: string;
    [key: string]: string | undefined;
  };
};

export default defineConfig({
  plugins: [react()],
  // 关键修复：使用相对路径，确保在任何 URL 深度下都能正确找到 JS/CSS
  base: './',
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '')
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    // 确保清理旧文件
    emptyOutDir: true,
  }
});
