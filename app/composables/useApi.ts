export const useApi = () => {
  const config = useRuntimeConfig()

  const token = useCookie('skilllink_token')

  const apiFetch = async <T>(endpoint: string, options: any = {}): Promise<T> => {
    return await $fetch<T>(`${config.public.apiBase}${endpoint}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}),
        ...options.headers,
      },
    })
  }

  return { apiFetch, token }
}
