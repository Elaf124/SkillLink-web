export default defineNuxtRouteMiddleware(async () => {
  const token = useCookie('skilllink_token')
  if (!token.value) return navigateTo('/login')

  const config = useRuntimeConfig()
  try {
    const user: any = await $fetch(`${config.public.apiBase}/user`, {
      headers: { Authorization: `Bearer ${token.value}` },
    })
    const isUserAdmin = user.role?.name === 'admin' || user.is_admin === true
    if (!isUserAdmin) {
      return navigateTo('/dashboard')
    }
  } catch (e) {
    return navigateTo('/login')
  }
})
