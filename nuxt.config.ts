import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },
runtimeConfig: {
    geminiApiKey: process.env.GEMINI_API_KEY ?? '',
    public: {
      apiBase: 'http://127.0.0.1:8000/api',
    },
  },
})