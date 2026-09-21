<script setup>
definePageMeta({ layout: false })

const config = useRuntimeConfig()
const { apiFetch, token } = useApi()
const { isDark, toggleTheme } = useTheme()
const router = useRouter()
const route = useRoute()

const form = ref({ email: '', password: '' })
const error = ref('')
const loading = ref(false)
const showPassword = ref(false)

const user = useState('skilllink_auth_user', () => null)

const googleAuthUrl = `${config.public.apiBase}/auth/google/redirect`

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    const res = await apiFetch('/login', { method: 'POST', body: form.value })
    token.value = res.token
    if (res.user) {
      user.value = res.user
      if (import.meta.client && res.user.id && res.user.profile_photo) {
        try { localStorage.setItem(`skilllink_user_photo_${res.user.id}`, res.user.profile_photo) } catch {}
      }
    }
    if (import.meta.client) {
      sessionStorage.removeItem('skilllink_new_provider_signup')
    }
    const isProvider = res.user?.role?.name === 'provider'
    const onboarded = res.user && checkIsProviderOnboarded(res.user)
    router.push(isProvider && !onboarded ? '/provider/onboarding' : '/dashboard')
  } catch (err) {
    error.value = err?.data?.message || 'Login failed. Please check your credentials.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-canvas dark:bg-canvas-dark flex flex-col">
    <!-- Top nav -->
    <header class="border-b border-mist dark:border-mist-dark">
      <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <NuxtLink to="/" class="transition-transform hover:scale-[1.02]"><BrandLogo /></NuxtLink>
        <div class="flex items-center gap-4">
          <button @click="toggleTheme" class="text-ink/50 dark:text-white/50 hover:text-ink dark:hover:text-white transition" aria-label="Toggle dark mode">
            {{ isDark ? '☀️' : '🌙' }}
          </button>
          <NuxtLink to="/login" class="text-sm font-medium text-ink dark:text-[#F0EDE6]">Sign in</NuxtLink>
          <NuxtLink to="/register" class="text-sm font-semibold bg-clay hover:bg-clay/90 text-white px-4 py-2 rounded-full transition">
            Get started
          </NuxtLink>
        </div>
      </div>
    </header>

    <div class="flex-1 grid grid-cols-1 lg:grid-cols-2">
      <!-- Left: editorial image + testimonial -->
      <div class="hidden lg:flex relative bg-ink">
        <img
          src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=1200&auto=format&fit=crop"
          alt=""
          class="absolute inset-0 w-full h-full object-cover opacity-70"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent"></div>
        <div class="relative mt-auto p-10">
          <p class="font-display text-2xl italic text-white leading-snug mb-6">
            "I went from freelancing on three different platforms to running my business entirely through SkillLink. The quality of clients is just better."
          </p>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gold flex items-center justify-center font-display font-semibold text-ink">AO</div>
            <div>
              <p class="text-white font-medium text-sm">Amara Osei</p>
              <p class="text-white/60 text-xs">UX Designer — 214 jobs completed</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: form -->
      <div class="flex items-center justify-center px-6 py-16">
        <div class="w-full max-w-sm">
          <!-- Deletion success banner -->
          <div
            v-if="route.query.deleted"
            class="mb-6 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2.5 shadow-xs"
          >
            <span class="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">✓</span>
            <span>Your account and all associated data have been permanently deleted.</span>
          </div>

          <h1 class="font-display text-4xl font-semibold text-ink dark:text-[#F0EDE6] mb-2">Welcome back</h1>
          <p class="text-ink/60 dark:text-white/60 mb-8">
            Don't have an account?
            <NuxtLink to="/register" class="text-clay font-medium hover:underline">Sign up free</NuxtLink>
          </p>

          <a
            :href="googleAuthUrl"
            class="w-full flex items-center justify-center gap-3 border border-mist dark:border-white/15 rounded-lg py-3 px-4 mb-6 hover:bg-white dark:hover:bg-white/5 transition bg-white dark:bg-transparent"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span class="text-ink dark:text-[#F0EDE6] font-medium text-sm">Continue with Google</span>
          </a>

          <div class="flex items-center gap-3 mb-6">
            <div class="flex-1 h-px bg-mist dark:bg-white/10"></div>
            <span class="text-ink/40 dark:text-white/40 text-xs">or sign in with email</span>
            <div class="flex-1 h-px bg-mist dark:bg-white/10"></div>
          </div>

          <form @submit.prevent="handleLogin" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">Email address</label>
              <input
                v-model="form.email" type="email" required placeholder="you@example.com"
                class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] placeholder:text-ink/30 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition"
              />
            </div>

            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6]">Password</label>
                <NuxtLink to="/forgot-password" class="text-xs text-clay font-medium cursor-pointer hover:underline">Forgot password?</NuxtLink>
              </div>
              <div class="relative">
                <input
                  v-model="form.password" :type="showPassword ? 'text' : 'password'" required
                  class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition"
                />
                <button type="button" @click="showPassword = !showPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 dark:text-white/40 text-sm">
                  {{ showPassword ? '🙈' : '👁' }}
                </button>
              </div>
            </div>

            <p v-if="error" class="text-clay text-sm">{{ error }}</p>

            <button
              type="submit" :disabled="loading"
              class="w-full bg-clay hover:bg-clay/90 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition"
            >
              {{ loading ? 'Signing in…' : 'Sign in' }}
            </button>

            <p class="text-xs text-center text-ink/40 dark:text-white/40 pt-2">
              By signing in you agree to our
              <span class="text-clay">Terms of Service</span> and <span class="text-clay">Privacy Policy</span>.
            </p>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
