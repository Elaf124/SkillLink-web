export default defineNuxtRouteMiddleware(async () => {
  const token = useCookie('skilllink_token')
  if (!token.value) return navigateTo('/login')

  const config = useRuntimeConfig()
  try {
    const user: any = await $fetch(`${config.public.apiBase}/user`, {
      headers: { Authorization: `Bearer ${token.value}` },
    })
    const isAllowed = user.role?.name === 'admin_finance' || user.role?.name === 'admin' || user.is_admin === true
    if (!isAllowed) {
      return navigateTo('/dashboard')
    }
  } catch (e) {
    return navigateTo('/login')
  }
})
