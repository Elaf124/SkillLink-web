// Client-side gate for the authenticated app. In order:
//   1. Email not verified        -> /verify-email
//   2. Provider, not onboarded   -> /provider/onboarding
// Runs on the client only so it can read the local onboarding flag; the gate
// pages themselves repeat these checks server-side on mount.
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const token = useCookie('skilllink_token')
  if (!token.value) return

  const exempt = [
    '/', '/login', '/register',
    '/verify-email', '/forgot-password', '/reset-password',
    '/provider/onboarding',
  ]
  if (exempt.includes(to.path) || to.path.startsWith('/oauth')) return

  // Only the authenticated "app" areas are gated; public marketing pages are not.
  // /jobs and /browse are also gated so unverified providers can't skip verification.
  const gated = [
    '/dashboard', '/account', '/provider', '/bookings', '/my-jobs',
    '/jobs', '/jobs/post', '/browse', '/messages', '/notifications', '/transactions', '/favorites', '/wallet', '/admin',
  ]
  if (!gated.some(p => to.path === p || to.path.startsWith(p + '/'))) return

  const config = useRuntimeConfig()
  let user: any
  try {
    user = await $fetch(`${config.public.apiBase}/user`, {
      headers: { Authorization: `Bearer ${token.value}` },
    })
  } catch {
    return
  }
  if (!user) return

  if (!user.email_verified_at) return navigateTo('/verify-email')

  if (user.role?.name === 'provider') {
    const onboarded = checkIsProviderOnboarded(user)
    if (!onboarded) return navigateTo('/provider/onboarding')
  }
})

