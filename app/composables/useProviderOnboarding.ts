/**
 * Helper to identify whether a provider has already completed profile setup
 * or is an existing account, vs a brand new provider registering for the first time.
 */
export function checkIsProviderOnboarded(user: any): boolean {
  if (!user) return true
  if (user.role?.name !== 'provider') return true

  // 1. Explicit backend flag if present
  if (
    user.provider?.onboarded === true ||
    user.onboarding_completed === true ||
    user.provider_profile?.onboarded === true
  ) {
    return true
  }

  // 2. Any existing provider profile presence (professional_title, bio, skills, services, or verified)
  const provider = user.provider || user.provider_profile || user.providerProfile
  if (provider) {
    if (
      provider.professional_title ||
      provider.title ||
      provider.bio ||
      (provider.skills && provider.skills.length > 0) ||
      (provider.services && provider.services.length > 0) ||
      provider.verification_status === 'verified'
    ) {
      return true
    }
  }

  // 3. User profile already populated (city, bio, company_name)
  if (user.city || user.bio || user.company_name) {
    return true
  }

  // 4. Check if they explicitly submitted onboarding
  if (import.meta.client && user.id) {
    if (sessionStorage.getItem(`skilllink_provider_submitted_${user.id}`) === 'true') {
      return true
    }
  }

  return false
}

export const useProviderOnboarding = () => {
  const isProviderOnboarded = (user: any) => checkIsProviderOnboarded(user)

  const markProviderOnboarded = (userId: string | number) => {
    if (import.meta.client && userId) {
      sessionStorage.setItem(`skilllink_provider_submitted_${userId}`, 'true')
      localStorage.setItem(`skilllink_provider_onboarded_${userId}`, 'true')
      sessionStorage.removeItem('skilllink_new_provider_signup')
    }
  }

  const markNewProviderSignup = () => {
    if (import.meta.client) {
      sessionStorage.setItem('skilllink_new_provider_signup', 'true')
    }
  }

  return {
    isProviderOnboarded,
    markProviderOnboarded,
    markNewProviderSignup,
  }
}
