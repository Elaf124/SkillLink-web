export const useProviderAvatar = () => {
  const config = useRuntimeConfig()
  const backendBase = (config.public?.apiBase || 'http://127.0.0.1:8000/api').replace(/\/api\/?$/, '')

  // Female name dictionary for accurate Ethiopian gender detection
  const femaleNames = new Set([
    'selamawit', 'selam', 'feven', 'kalkidan', 'eyerusalem', 'almaz', 'rahel',
    'genet', 'yordanos', 'helen', 'tigist', 'marta', 'hana', 'bethlehem', 'tsion',
    'lemlem', 'meron', 'samrawit', 'hermela', 'eden', 'sara', 'meseret', 'mahlet',
    'aster', 'senait', 'hiwot', 'fekerte', 'konjit', 'bizunesh', 'tsigereda', 'hawi',
    'eleni', 'mulu', 'chaltu', 'bilen', 'soliyana', 'seble', 'fanaye', 'tsehay',
    'birtukan', 'tirhas', 'letay', 'aberash', 'worknesh', 'dinke', 'almitu',
    'yeabsira', 'danayit', 'mekdes', 'ruth', 'lidya', 'elizabeth', 'frehiwot'
  ])

  // Male name dictionary for accurate Ethiopian gender detection
  const maleNames = new Set([
    'yohannes', 'girma', 'henok', 'abel', 'tewodros', 'daniel', 'dawit', 'bekele',
    'assefa', 'wolde', 'tadesse', 'getachew', 'hailu', 'worku', 'gebre', 'alemu',
    'yared', 'tamrat', 'berhanu', 'tariku', 'solomon', 'haile', 'mulugeta', 'samuel',
    'michael', 'bereket', 'natnael', 'eyob', 'surafel', 'fitsum', 'abiy', 'amanuel',
    'kaleab', 'tesfaye', 'yosef', 'sisay', 'kassahun', 'derese', 'dagnachew',
    'negash', 'mengistu', 'tefera', 'ayele', 'kebede', 'demisse', 'biruk', 'nahom'
  ])

  const getGenderFromName = (firstName: string): 'female' | 'male' | 'unknown' => {
    const clean = firstName.toLowerCase().trim()
    if (femaleNames.has(clean)) return 'female'
    if (maleNames.has(clean)) return 'male'
    // Common Ethiopian female suffixes
    if (clean.endsWith('awit') || clean.endsWith('it') || clean.endsWith('nesh')) return 'female'
    return 'unknown'
  }

  const isFemaleName = (firstName: string): boolean => getGenderFromName(firstName) === 'female'

  const fallbackAvatar = (provider: any): string => {
    const first = provider?.user?.first_name || provider?.first_name || 'Skill'
    const last = provider?.user?.last_name || provider?.last_name || 'Provider'
    const label = `${first} ${last}`.trim()
    const initials = `${first[0] || 'S'}${last[0] || 'P'}`.toUpperCase()
    const seed = Array.from(label).reduce((sum, char) => sum + char.charCodeAt(0), 0)
    const palettes = [
      ['#0F766E', '#134E4A'], ['#2563EB', '#1E3A8A'], ['#7C3AED', '#4C1D95'],
      ['#0369A1', '#0C4A6E'], ['#047857', '#064E3B'], ['#4338CA', '#312E81'],
    ]
    const [start, end] = palettes[seed % palettes.length]
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient></defs><rect width="120" height="120" rx="60" fill="url(#g)"/><circle cx="60" cy="60" r="43" fill="none" stroke="white" stroke-opacity=".18"/><text x="60" y="69" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="38" font-weight="700">${initials}</text></svg>`
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
  }

  const portraitFor = (provider: any, gender: 'female' | 'male' | 'unknown', title: string, slot?: number): string => {
    const key = `${provider?.id || ''}-${provider?.user?.first_name || provider?.first_name || ''}-${provider?.user?.last_name || provider?.last_name || ''}`
    const hash = Array.from(key).reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) >>> 0, 7)
    if (gender === 'unknown') return fallbackAvatar(provider)

    const femalePhotos = [
      '/images/providers/expert_female.jpg',
      '/images/providers/designer.jpg',
      '/images/providers/female_technician.jpg',
      '/images/providers/female_chef.jpg',
    ]
    const malePhotos = [
      '/images/providers/expert_male.jpg',
      '/images/providers/developer.jpg',
      '/images/providers/technician.jpg',
      '/images/providers/marketing.jpg',
    ]

    // Directory pages pass a sequence slot. This guarantees the visible list never
    // repeats a portrait; after the supplied photo set is exhausted, use initials.
    if (typeof slot === 'number') {
      const pool = gender === 'female' ? femalePhotos : gender === 'male' ? malePhotos : []
      return pool[slot] || fallbackAvatar(provider)
    }

    // Give specialist roles their fitting portrait; use a stable distinct choice for
    // broader roles so every visible provider does not inherit one shared headshot.
    if (gender === 'female') {
      if (/repair|technician|phone|electric|mechanic|hardware/.test(title)) return '/images/providers/female_technician.jpg'
      if (/chef|cook|cater|baker|food/.test(title)) return '/images/providers/female_chef.jpg'
      if (/design|ui|ux|creative|art|brand/.test(title)) return '/images/providers/designer.jpg'
      return femalePhotos[hash % 2]
    }
    if (/dev|code|software|tech|python|web/.test(title)) return '/images/providers/developer.jpg'
    if (/electr|plumb|repair|mechanic|technician|paint|contract/.test(title)) return '/images/providers/technician.jpg'
    if (/market|sales|seo|ads|media|business/.test(title)) return '/images/providers/marketing.jpg'
    return malePhotos[hash % 2]
  }

  /**
   * Resolves a media / storage URL to a fully qualified URL pointing to the backend.
   * Handles relative /storage/... paths, localhost URLs, and external links.
   */
  const resolveMediaUrl = (url?: string | null): string => {
    if (!url || typeof url !== 'string') return ''
    const trimmed = url.trim()
    if (!trimmed) return ''

    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
      return trimmed
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/storage\//i.test(trimmed)) {
        return trimmed.replace(/^https?:\/\/[^\/]+(\/storage\/.*)$/i, `${backendBase}$1`)
      }
      return trimmed
    }

    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
    return `${backendBase}${cleanPath}`
  }

  /**
   * Resolves a photo URL for any provider.
   * Prioritizes user's uploaded profile picture if available.
   * Falls back accurately respecting gender and profession to prevent mismatches.
   */
  const getProviderAvatar = (provider: any, slot?: number): string => {
    if (!provider) return fallbackAvatar(provider)

    // 1. If provider has an uploaded profile photo, use it
    let photo = provider.user?.profile_photo || provider.profile_photo || provider.avatar || provider.user?.avatar
    if (!photo && import.meta.client) {
      const uId = provider.user?.id || provider.user_id || provider.id
      if (uId) photo = localStorage.getItem(`skilllink_user_photo_${uId}`)
    }
    if (photo && typeof photo === 'string' && photo.trim()) {
      return resolveMediaUrl(photo)
    }

    // 2. Otherwise use Ethiopian gender/role matched stock headshot
    const firstName = (provider.user?.first_name || provider.first_name || '').toLowerCase().trim()
    const gender = getGenderFromName(firstName)
    const title = (provider.professional_title || provider.title || provider.business_name || '').toLowerCase()
    return portraitFor(provider, gender, title, slot)
  }

  const getProviderInitials = (provider: any): string => {
    const first = provider?.user?.first_name?.[0] || provider?.first_name?.[0] || 'P'
    const last = provider?.user?.last_name?.[0] || provider?.last_name?.[0] || 'R'
    return `${first}${last}`.toUpperCase()
  }

  const handleAvatarError = (event: Event, provider?: any) => {
    const target = event.target as HTMLImageElement
    if (!target) return
    target.onerror = null // Prevent recursive error firing
    const firstName = (provider?.user?.first_name || provider?.first_name || '').toLowerCase()
    const gender = getGenderFromName(firstName)
    const title = (provider?.professional_title || provider?.title || provider?.business_name || '').toLowerCase()
    target.src = portraitFor(provider, gender, title)
  }

  return {
    getProviderAvatar,
    getProviderInitials,
    handleAvatarError,
    resolveMediaUrl,
    isFemaleName,
  }
}
