
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 为 TypeScript 声明 process 变量，防止 tsc 报错
declare const process: {
  env: {
    API_KEY?: string;
    [key: string]: string | undefined;
  };
};

export default defineConfig({
  plugins: [react()],
  define: {
    // 确保构建时将环境变量注入到前端代码中
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
