/**
 * Customer "favorite providers" shortlist — backed by the API
 * (`GET/POST/DELETE /favorites`) so it persists across devices.
 *
 * Public surface is unchanged from the old localStorage version so the
 * browse / providers list pages don't need edits:
 *   favoriteIds, favoriteProviders, isLoaded, loadFavorites,
 *   isFavorite, toggleFavorite, removeFavorite
 */
export const useFavorites = () => {
  const { apiFetch, token } = useApi()
  const router = useRouter()

  const favoriteIds = useState<Set<number>>('user_favorite_provider_ids', () => new Set())
  const favoriteProviders = useState<any[]>('user_favorite_providers', () => [])
  const isLoaded = useState<boolean>('user_favorites_loaded', () => false)
  const pending = useState<Set<number>>('user_favorites_pending', () => new Set())

  const loadFavorites = async (force = false) => {
    if (isLoaded.value && !force) return
    if (!token.value) {
      favoriteIds.value = new Set()
      favoriteProviders.value = []
      isLoaded.value = true
      return
    }
    try {
      const res: any = await apiFetch('/favorites')
      const list: any[] = res?.data ?? []
      favoriteProviders.value = list
      favoriteIds.value = new Set(list.map((p: any) => Number(p.id)))
    } catch {
      // 403 for non-customers, network errors, etc. — just show nothing.
      favoriteIds.value = new Set()
      favoriteProviders.value = []
    } finally {
      isLoaded.value = true
    }
  }

  const isFavorite = (providerId: string | number): boolean =>
    favoriteIds.value.has(Number(providerId))

  const addFavorite = async (providerId: number) => {
    const next = new Set(favoriteIds.value)
    next.add(providerId)
    favoriteIds.value = next
    try {
      await apiFetch('/favorites', { method: 'POST', body: { provider_id: providerId } })
    } catch (err) {
      const revert = new Set(favoriteIds.value)
      revert.delete(providerId)
      favoriteIds.value = revert
      throw err
    }
  }

  const removeFavorite = async (providerId: string | number) => {
    const id = Number(providerId)
    const prevIds = new Set(favoriteIds.value)
    const prevList = favoriteProviders.value
    const next = new Set(favoriteIds.value)
    next.delete(id)
    favoriteIds.value = next
    favoriteProviders.value = favoriteProviders.value.filter((p: any) => Number(p.id) !== id)
    try {
      await apiFetch(`/favorites/${id}`, { method: 'DELETE' })
    } catch (err) {
      favoriteIds.value = prevIds
      favoriteProviders.value = prevList
      throw err
    }
  }

  const toggleFavorite = async (e: Event | null, providerId: string | number) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault()
      e.stopPropagation()
    }
    if (!token.value) {
      router.push('/login')
      return
    }
    const id = Number(providerId)
    if (pending.value.has(id)) return
    pending.value = new Set(pending.value).add(id)
    try {
      if (favoriteIds.value.has(id)) {
        await removeFavorite(id)
      } else {
        await addFavorite(id)
      }
    } catch {
      // optimistic state already reverted inside add/removeFavorite
    } finally {
      const p = new Set(pending.value)
      p.delete(id)
      pending.value = p
    }
  }

  return {
    favoriteIds,
    favoriteProviders,
    isLoaded,
    loadFavorites,
    isFavorite,
    toggleFavorite,
    removeFavorite,
  }
}
