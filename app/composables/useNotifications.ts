export interface AppNotification {
  id: number
  type: string
  title: string
  message: string
  link: string | null
  isRead: boolean
  time: string
}

/**
 * In-app notification feed, backed by `/notifications`. Shared unread count for
 * the header bell; full list + mark-read for the notifications page.
 */
export const useNotifications = () => {
  const { apiFetch, token } = useApi()

  const items = useState<AppNotification[]>('notifications_items', () => [])
  const unreadCount = useState<number>('notifications_unread', () => 0)
  const loaded = useState<boolean>('notifications_loaded', () => false)

  const loadList = async () => {
    if (!token.value) { items.value = []; unreadCount.value = 0; return }
    try {
      const res: any = await apiFetch('/notifications')
      items.value = res?.data ?? []
      unreadCount.value = res?.unread_count ?? 0
    } catch {
      // keep whatever we had
    } finally {
      loaded.value = true
    }
  }

  const refreshUnread = async () => {
    if (!token.value) { unreadCount.value = 0; return }
    try {
      const res: any = await apiFetch('/notifications/unread-count')
      unreadCount.value = res?.unread_count ?? 0
    } catch {}
  }

  const markRead = async (id: number) => {
    const n = items.value.find(x => x.id === id)
    if (n && !n.isRead) {
      n.isRead = true
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
    if (!token.value) return
    try { await apiFetch(`/notifications/${id}/read`, { method: 'POST' }) } catch {}
  }

  const markAllRead = async () => {
    items.value = items.value.map(n => ({ ...n, isRead: true }))
    unreadCount.value = 0
    if (!token.value) return
    try { await apiFetch('/notifications/read-all', { method: 'POST' }) } catch {}
  }

  return { items, unreadCount, loaded, loadList, refreshUnread, markRead, markAllRead }
}
