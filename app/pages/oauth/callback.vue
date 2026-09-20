<script setup>
const { token } = useApi()
const router = useRouter()
const route = useRoute()

onMounted(() => {
  const receivedToken = route.query.token

  if (receivedToken) {
    token.value = receivedToken
    router.push('/dashboard')
  } else {
    router.push('/login')
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50">
    <p class="text-slate-500">Signing you in...</p>
  </div>
</template>