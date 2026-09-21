export const useApi = () => {
  const config = useRuntimeConfig()

  const token = useCookie('skilllink_token', { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' })

  const apiFetch = async <T>(endpoint: string, options: any = {}): Promise<T> => {
    const activeToken = token.value || (import.meta.client ? localStorage.getItem('skilllink_token') : null)

    return await $fetch<T>(`${config.public.apiBase}${endpoint}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        ...options.headers,
      },
    })
  }

  return { apiFetch, token }
}
