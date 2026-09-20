export default defineNuxtRouteMiddleware(async () => {
  const token = useCookie('skilllink_token')
  if (!token.value) return navigateTo('/login')

  const config = useRuntimeConfig()
  try {
    const user = await $fetch(`${config.public.apiBase}/user`, {
      headers: { Authorization: `Bearer ${token.value}` },
    })
    if (user.role?.name !== 'provider') {
      return navigateTo('/dashboard')
    }
  } catch (e) {
    return navigateTo('/login')
  }
})