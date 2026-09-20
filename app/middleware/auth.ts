export default defineNuxtRouteMiddleware((to) => {
  const token = useCookie('skilllink_token')

  if (!token.value) {
    return navigateTo('/login')
  }
})
