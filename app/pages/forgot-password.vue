<script setup>
// Password reset (6-digit code), matching the email-verification style.
// Step 1: enter the account email  ->  backend emails a code.
// Step 2: enter the code + a new password.
definePageMeta({ layout: false })

const { apiFetch } = useApi()
const { isDark, toggleTheme } = useTheme()

const step = ref('request') // 'request' | 'reset' | 'done'
const loading = ref(false)
const error = ref('')
const notice = ref('')

const email = ref('')
const code = ref('')
const password = ref('')
const passwordConfirm = ref('')
const showPassword = ref(false)

const cooldown = ref(0)
let timer = null
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
function startCooldown(seconds) {
  cooldown.value = Math.max(0, seconds)
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0) { clearInterval(timer); timer = null }
  }, 1000)
}

async function requestCode(resend = false) {
  if (!email.value.trim() || loading.value) return
  loading.value = true
  error.value = ''
  notice.value = ''
  try {
    await apiFetch('/forgot-password', { method: 'POST', body: { email: email.value.trim() } })
    // The API responds the same whether or not the address exists, so we don't
    // reveal which emails are registered.
    step.value = 'reset'
    startCooldown(60)
    if (resend) notice.value = 'A new code has been sent to your email.'
  } catch (err) {
    const status = err?.status ?? err?.statusCode
    if (status === 429) {
      const retry = Number(err?.data?.retry_after ?? 60)
      startCooldown(retry)
      error.value = `Please wait ${retry}s before requesting another code.`
      step.value = 'reset'
    } else {
      error.value = err?.data?.message || 'Could not send a reset code. Please try again.'
    }
  } finally {
    loading.value = false
  }
}

async function resetPassword() {
  error.value = ''
  if (code.value.length !== 6) { error.value = 'Enter the 6-digit code from your email.'; return }
  if (password.value.length < 8) { error.value = 'Your new password must be at least 8 characters.'; return }
  if (password.value !== passwordConfirm.value) { error.value = 'The two passwords do not match.'; return }
  loading.value = true
  try {
    await apiFetch('/reset-password', {
      method: 'POST',
      body: {
        email: email.value.trim(),
        code: code.value,
        password: password.value,
        password_confirmation: passwordConfirm.value,
      },
    })
    step.value = 'done'
  } catch (err) {
    const errors = err?.data?.errors
    error.value = errors
      ? Object.values(errors).flat().join(' ')
      : err?.data?.message || 'That code is invalid or has expired. Request a new one.'
    code.value = ''
  } finally {
    loading.value = false
  }
}

const fieldClass =
  'w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] placeholder:text-ink/30 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition'
</script>

<template>
  <div class="min-h-screen bg-canvas dark:bg-canvas-dark flex flex-col">
    <header class="border-b border-mist dark:border-mist-dark">
      <div class="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
        <NuxtLink to="/" class="transition-transform hover:scale-[1.02]"><BrandLogo /></NuxtLink>
        <div class="flex items-center gap-4">
          <button @click="toggleTheme" class="text-ink/50 dark:text-white/50 hover:text-ink dark:hover:text-white transition" aria-label="Toggle dark mode">
            {{ isDark ? '☀️' : '🌙' }}
          </button>
          <NuxtLink to="/login" class="text-sm font-medium text-ink dark:text-[#F0EDE6]">Sign in</NuxtLink>
        </div>
      </div>
    </header>

    <div class="flex-1 flex items-center justify-center px-6 py-12">
      <div class="w-full max-w-md">

        <!-- Step 1: request -->
        <template v-if="step === 'request'">
          <h1 class="font-display text-3xl font-semibold text-ink dark:text-[#F0EDE6] mb-2">Reset your password</h1>
          <p class="text-ink/60 dark:text-white/60 mb-8">
            Enter the email on your account and we'll send you a 6-digit code to set a new password.
          </p>
          <form @submit.prevent="requestCode(false)" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">Email address</label>
              <input v-model="email" type="email" required placeholder="you@example.com" :class="fieldClass" />
            </div>
            <p v-if="error" class="text-clay text-sm">{{ error }}</p>
            <button
              type="submit" :disabled="loading"
              class="w-full bg-clay hover:bg-clay/90 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition"
            >
              {{ loading ? 'Sending…' : 'Send reset code' }}
            </button>
          </form>
        </template>

        <!-- Step 2: reset -->
        <template v-else-if="step === 'reset'">
          <h1 class="font-display text-3xl font-semibold text-ink dark:text-[#F0EDE6] mb-2">Enter your code</h1>
          <p class="text-ink/60 dark:text-white/60 mb-8">
            A 6-digit code has been sent to <span class="font-medium text-ink dark:text-[#F0EDE6]">{{ email }}</span>.
            Enter it along with your new password.
          </p>
          <form @submit.prevent="resetPassword" class="space-y-5">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-2">Reset code</label>
              <CodeInput v-model="code" :disabled="loading" />
            </div>

            <div>
              <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">New password</label>
              <div class="relative">
                <input
                  v-model="password" :type="showPassword ? 'text' : 'password'" required minlength="8"
                  placeholder="At least 8 characters" :class="fieldClass"
                />
                <button type="button" @click="showPassword = !showPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 dark:text-white/40 text-sm">
                  {{ showPassword ? '🙈' : '👁' }}
                </button>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">Confirm new password</label>
              <input v-model="passwordConfirm" :type="showPassword ? 'text' : 'password'" required :class="fieldClass" placeholder="Repeat the new password" />
            </div>

            <p v-if="error" class="text-clay text-sm">{{ error }}</p>
            <p v-else-if="notice" class="text-emerald-600 dark:text-emerald-400 text-sm">{{ notice }}</p>

            <button
              type="submit" :disabled="loading"
              class="w-full bg-clay hover:bg-clay/90 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition"
            >
              {{ loading ? 'Updating…' : 'Set new password' }}
            </button>

            <div class="text-center text-sm text-ink/60 dark:text-white/60">
              Didn't get a code?
              <button
                v-if="cooldown === 0" type="button" @click="requestCode(true)" :disabled="loading"
                class="text-clay font-medium hover:underline disabled:opacity-50"
              >
                Resend
              </button>
              <span v-else class="text-ink/40 dark:text-white/40">Resend in {{ cooldown }}s</span>
            </div>
          </form>
        </template>

        <!-- Step 3: done -->
        <template v-else>
          <div class="text-center">
            <div class="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 flex items-center justify-center text-2xl mb-5">✅</div>
            <h1 class="font-display text-3xl font-semibold text-ink dark:text-[#F0EDE6] mb-2">Password updated</h1>
            <p class="text-ink/60 dark:text-white/60 mb-8">You can now sign in with your new password.</p>
            <NuxtLink to="/login" class="inline-block bg-clay hover:bg-clay/90 text-white font-semibold px-6 py-3 rounded-full transition">
              Go to sign in
            </NuxtLink>
          </div>
        </template>

        <p v-if="step !== 'done'" class="text-center text-sm text-ink/50 dark:text-white/50 mt-8">
          Remembered it? <NuxtLink to="/login" class="text-clay font-medium hover:underline">Back to sign in</NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>
