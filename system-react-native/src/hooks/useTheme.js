/**
 * Tema noturno / ensolarado, persistido no aparelho.
 */
import { useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'zblockmap-theme'

/**
 * @returns {{ theme: 'dark' | 'light', setTheme: Function, toggleTheme: Function }}
 */
export function useTheme() {
  const [theme, setThemeState] = useState('dark')

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'day') setThemeState('light')
        if (saved === 'dark' || saved === 'night') setThemeState('dark')
      })
      .catch(() => {})
  }, [])

  const setTheme = useCallback((next) => {
    const value = next === 'light' ? 'light' : 'dark'
    setThemeState(value)
    AsyncStorage.setItem(STORAGE_KEY, value).catch(() => {})
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return { theme, setTheme, toggleTheme }
}
