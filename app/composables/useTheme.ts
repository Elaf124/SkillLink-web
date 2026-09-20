export const useTheme = () => {
  const isDark = useState('theme-dark', () => false)

  const applyTheme = () => {
    if (import.meta.client) {
      document.documentElement.classList.toggle('dark', isDark.value)
    }
  }

  const toggleTheme = () => {
    isDark.value = !isDark.value
    localStorage.setItem('skilllink_theme', isDark.value ? 'dark' : 'light')
    applyTheme()
  }

  const initTheme = () => {
    if (import.meta.client) {
      const saved = localStorage.getItem('skilllink_theme')
      isDark.value = saved === 'dark'
      applyTheme()
    }
  }

  return { isDark, toggleTheme, initTheme }
}