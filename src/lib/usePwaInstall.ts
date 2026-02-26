import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Module-level store — survives React re-renders and captures early events
let _storedPrompt: BeforeInstallPromptEvent | null = null
let _listeners: Array<(e: BeforeInstallPromptEvent) => void> = []

export function storePwaPrompt(e: Event) {
  _storedPrompt = e as BeforeInstallPromptEvent
  _listeners.forEach((fn) => fn(_storedPrompt!))
}

export function usePwaInstall() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(_storedPrompt)
  const [isInstalled, setIsInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches
  )

  useEffect(() => {
    if (isInstalled) return

    // If already stored before this component mounted, pick it up
    if (_storedPrompt && !prompt) {
      setPrompt(_storedPrompt)
    }

    // Also subscribe to future events (e.g. on re-mount)
    const handler = (e: BeforeInstallPromptEvent) => setPrompt(e)
    _listeners.push(handler)

    const installedHandler = () => {
      setIsInstalled(true)
      setPrompt(null)
      _storedPrompt = null
    }
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      _listeners = _listeners.filter((fn) => fn !== handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const install = async () => {
    if (!prompt) return false
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setPrompt(null)
      setIsInstalled(true)
      _storedPrompt = null
    }
    return outcome === 'accepted'
  }

  return { canInstall: !!prompt && !isInstalled, isInstalled, install }
}
