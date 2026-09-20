<script setup>
definePageMeta({ layout: false })

const config = useRuntimeConfig()
const { apiFetch, token } = useApi()
const { isDark, toggleTheme } = useTheme()
const router = useRouter()

const fullName = ref('')
const form = ref({
  email: '', phone: '', password: '', password_confirmation: '', role: 'customer',
})
const error = ref('')
const loading = ref(false)
const showPassword = ref(false)

const googleAuthUrl = `${config.public.apiBase}/auth/google/redirect`

async function handleRegister() {
  error.value = ''
  loading.value = true

  const parts = fullName.value.trim().split(' ')
  const payload = {
    ...form.value,
    first_name: parts[0] || '',
    last_name: parts.slice(1).join(' ') || parts[0] || '',
    password_confirmation: form.value.password, // design has one password field
  }

  try {
    const res = await apiFetch('/register', { method: 'POST', body: payload })
    token.value = res.token
    if (import.meta.client && form.value.role === 'provider') {
      sessionStorage.setItem('skilllink_new_provider_signup', 'true')
    }
    // Everyone verifies their email first; the verify page then routes providers
    // to onboarding and customers to the dashboard.
    router.push('/verify-email')
  } catch (err) {
    const errors = err?.data?.errors
    error.value = errors ? Object.values(errors).flat().join(' ') : (err?.data?.message || 'Registration failed.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-canvas dark:bg-canvas-dark flex flex-col">
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

    <div class="flex-1 flex items-center justify-center px-6 py-12">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="font-display text-4xl font-semibold text-ink dark:text-[#F0EDE6] mb-2">Create your account</h1>
          <p class="text-ink/60 dark:text-white/60">
            Already have one?
            <NuxtLink to="/login" class="text-clay font-medium hover:underline">Sign in</NuxtLink>
          </p>
        </div>

        <!-- Role toggle -->
        <div class="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button" @click="form.role = 'customer'"
            :class="[
              'relative rounded-xl p-4 text-left border transition',
              form.role === 'customer'
                ? 'bg-white dark:bg-white/5 border-clay shadow-sm'
                : 'bg-mist/40 dark:bg-white/[0.02] border-transparent'
            ]"
          >
            <span v-if="form.role === 'customer'" class="absolute top-3 right-3 w-2 h-2 rounded-full bg-clay"></span>
            <p class="text-2xl mb-2">🛒</p>
            <p class="font-semibold text-sm text-ink dark:text-[#F0EDE6]">I want to find services</p>
            <p class="text-xs text-ink/50 dark:text-white/50 mt-0.5">Browse and book skilled providers</p>
          </button>

          <button
            type="button" @click="form.role = 'provider'"
            :class="[
              'relative rounded-xl p-4 text-left border transition',
              form.role === 'provider'
                ? 'bg-white dark:bg-white/5 border-clay shadow-sm'
                : 'bg-mist/40 dark:bg-white/[0.02] border-transparent'
            ]"
          >
            <span v-if="form.role === 'provider'" class="absolute top-3 right-3 w-2 h-2 rounded-full bg-clay"></span>
            <p class="text-2xl mb-2">🔧</p>
            <p class="font-semibold text-sm text-ink dark:text-[#F0EDE6]">I want to offer services</p>
            <p class="text-xs text-ink/50 dark:text-white/50 mt-0.5">Create a profile and get clients</p>
          </button>
        </div>

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
          <span class="text-ink/40 dark:text-white/40 text-xs">or sign up with email</span>
          <div class="flex-1 h-px bg-mist dark:bg-white/10"></div>
        </div>

        <form @submit.prevent="handleRegister" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">Full name</label>
              <input
                v-model="fullName" type="text" required placeholder="Sarah Miller"
                class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] placeholder:text-ink/30 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">Phone number</label>
              <input
                v-model="form.phone" type="text" required placeholder="0911 000 000"
                class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] placeholder:text-ink/30 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">Email address</label>
            <input
              v-model="form.email" type="email" required placeholder="you@example.com"
              class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] placeholder:text-ink/30 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">Password</label>
            <div class="relative">
              <input
                v-model="form.password" :type="showPassword ? 'text' : 'password'" required minlength="8"
                placeholder="At least 8 characters"
                class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] placeholder:text-ink/30 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition"
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
            {{ loading ? 'Creating account…' : `Create ${form.role} account` }}
          </button>

          <p class="text-xs text-center text-ink/40 dark:text-white/40 pt-1">
            By creating an account you agree to our
            <span class="text-clay">Terms of Service</span> and <span class="text-clay">Privacy Policy</span>.
            We may occasionally send you account-related emails.
          </p>
        </form>
      </div>
    </div>
  </div>
</template>
