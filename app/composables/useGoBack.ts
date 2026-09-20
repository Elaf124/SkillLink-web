// Returns to wherever the user actually came from (preserving scroll position and
// any filters/search state on the previous page), instead of always landing on a
// fixed destination. Falls back to `fallback` only when there's no in-app history
// to go back to (e.g. the page was opened directly from a shared link).
export function useGoBack(fallback: string) {
  const router = useRouter()
  return () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallback)
    }
  }
}
