<script setup>
// Email verification gate (6-digit code).
// A user reaches here right after registering. They cannot enter the app until
// the code we emailed is confirmed — a mistyped or non-existent address simply
// never receives a code, so the account stays locked.
definePageMeta({ layout: false })

const { apiFetch, token } = useApi()
const { isDark, toggleTheme } = useTheme()
const router = useRouter()

const user = ref(null)
const checking = ref(true)
const code = ref('')
const verifying = ref(false)
const resending = ref(false)
const error = ref('')
const notice = ref('')
const cooldown = ref(0)
let timer = null

const email = computed(() => user.value?.email ?? 'your email')

onMounted(async () => {
  if (!token.value) return router.replace('/login')
  try {
    user.value = await apiFetch('/user')
  } catch {
    token.value = null
    return router.replace('/login')
  }
  if (user.value.email_verified_at) return routeOnward()
  checking.value = false

  // Send a code on arrival, but not again if one went out in the last minute
  // (guards against page refreshes hammering the endpoint).
  const last = Number(sessionStorage.getItem('verify_code_sent_at') || 0)
  const elapsed = (Date.now() - last) / 1000
  if (elapsed > 55) sendCode(true)
  else startCooldown(Math.ceil(60 - elapsed))
})

onBeforeUnmount(() => { if (timer) clearInterval(timer) })

function startCooldown(seconds) {
  cooldown.value = Math.max(0, seconds)
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0) { clearInterval(timer); timer = null }
  }, 1000)
}

async function sendCode(silent = false) {
  if (resending.value) return
  resending.value = true
  error.value = ''
  notice.value = ''
  try {
    await apiFetch('/email/verification-code', { method: 'POST' })
    sessionStorage.setItem('verify_code_sent_at', String(Date.now()))
    startCooldown(60)
    if (!silent) notice.value = `A new code is on its way to ${email.value}.`
  } catch (err) {
    const status = err?.status ?? err?.statusCode
    if (status === 429) {
      const retry = Number(err?.data?.retry_after ?? 60)
      startCooldown(retry)
      if (!silent) error.value = `Please wait ${retry}s before requesting another code.`
    } else if (!silent) {
      error.value = err?.data?.message || 'Could not send the code. Please try again shortly.'
    }
  } finally {
    resending.value = false
  }
}

async function verify() {
  if (code.value.length !== 6 || verifying.value) return
  verifying.value = true
  error.value = ''
  notice.value = ''
  try {
    await apiFetch('/email/verify', { method: 'POST', body: { code: code.value } })
    sessionStorage.removeItem('verify_code_sent_at')
    await routeOnward()
  } catch (err) {
    error.value = err?.data?.message || 'That code is invalid or has expired. Request a new one below.'
    code.value = ''
  } finally {
    verifying.value = false
  }
}

async function routeOnward() {
  try { user.value = await apiFetch('/user') } catch {}
  const isProvider = user.value?.role?.name === 'provider'
  const isNewSignup = import.meta.client && sessionStorage.getItem('skilllink_new_provider_signup') === 'true'
  const onboarded = user.value && checkIsProviderOnboarded(user.value)
  return router.replace(isProvider && !onboarded ? '/provider/onboarding' : '/dashboard')
}

async function startOver() {
  try { await apiFetch('/logout', { method: 'POST' }) } catch {}
  token.value = null
  sessionStorage.removeItem('verify_code_sent_at')
  router.replace('/register')
}
</script>

<template>
  <div class="min-h-screen bg-canvas dark:bg-canvas-dark flex flex-col">
    <header class="border-b border-mist dark:border-mist-dark">
      <div class="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
        <NuxtLink to="/" class="transition-transform hover:scale-[1.02]"><BrandLogo /></NuxtLink>
        <button @click="toggleTheme" class="text-ink/50 dark:text-white/50 hover:text-ink dark:hover:text-white transition" aria-label="Toggle dark mode">
          {{ isDark ? '☀️' : '🌙' }}
        </button>
      </div>
    </header>

    <div v-if="checking" class="flex-1 flex items-center justify-center text-ink/50 dark:text-white/50 text-sm">
      Loading…
    </div>

    <div v-else class="flex-1 flex items-center justify-center px-6 py-12">
      <div class="w-full max-w-md text-center">
        <div class="w-14 h-14 mx-auto rounded-2xl bg-clay/10 flex items-center justify-center text-2xl mb-5">✉️</div>
        <h1 class="font-display text-3xl font-semibold text-ink dark:text-[#F0EDE6] mb-2">Verify your email</h1>
        <p class="text-ink/60 dark:text-white/60 mb-8">
          We sent a 6-digit code to <span class="font-medium text-ink dark:text-[#F0EDE6]">{{ email }}</span>.
          Enter it below to activate your account.
        </p>

        <form @submit.prevent="verify" class="space-y-5">
          <div class="flex justify-center">
            <CodeInput v-model="code" :disabled="verifying" @complete="verify" />
          </div>

          <p v-if="error" class="text-clay text-sm">{{ error }}</p>
          <p v-else-if="notice" class="text-emerald-600 dark:text-emerald-400 text-sm">{{ notice }}</p>

          <button
            type="submit" :disabled="verifying || code.length !== 6"
            class="w-full bg-clay hover:bg-clay/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-full transition"
          >
            {{ verifying ? 'Verifying…' : 'Verify email' }}
          </button>
        </form>

        <div class="mt-6 text-sm text-ink/60 dark:text-white/60">
          Didn't get it?
          <button
            v-if="cooldown === 0"
            @click="sendCode(false)" :disabled="resending"
            class="text-clay font-medium hover:underline disabled:opacity-50"
          >
            {{ resending ? 'Sending…' : 'Resend code' }}
          </button>
          <span v-else class="text-ink/40 dark:text-white/40">Resend in {{ cooldown }}s</span>
        </div>

        <p class="mt-8 text-xs text-ink/40 dark:text-white/40">
          Wrong address?
          <button @click="startOver" class="text-clay hover:underline">Start over with a different email</button>
        </p>
      </div>
    </div>
  </div>
</template>
