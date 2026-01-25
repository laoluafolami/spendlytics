import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ThemeProvider } from './contexts/ThemeContext'
import { CurrencyProvider } from './contexts/CurrencyContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { AuthProvider } from './contexts/AuthContext'
import { initSyncService, performFullSync } from './lib/syncService'
import './index.css'

// Enhanced Service Worker Registration with aggressive updates
const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service workers not supported')
    return
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none'
    })

    console.log('[SW] Registered:', registration.scope)

    // Check for updates immediately
    registration.update()

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      console.log('[SW] Update found, installing...')

      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New content available - show notification with auto-update
            console.log('[SW] New content available')
            showUpdateNotification(registration, true) // Auto-update enabled
          }
        })
      }
    })

    // Check for updates more frequently (every 5 minutes)
    setInterval(() => {
      registration.update()
      console.log('[SW] Checking for updates...')
    }, 5 * 60 * 1000)

    // Handle controller change (when new SW takes over)
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true
        console.log('[SW] Controller changed, reloading...')
        // Clear any stale data before reload
        sessionStorage.setItem('sw_just_updated', 'true')
        window.location.reload()
      }
    })

    // Register for background sync if supported
    if ('sync' in registration) {
      try {
        await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('sync-transactions')
        console.log('[SW] Background sync registered')
      } catch {
        console.log('[SW] Background sync not available')
      }
    }

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SYNC_REQUIRED') {
        console.log('[SW] Sync required, triggering sync...')
        performFullSync().catch(console.error)
      }

      // Handle SW_UPDATED message - force reload
      if (event.data && event.data.type === 'SW_UPDATED') {
        console.log('[SW] Service worker updated to', event.data.version)
        if (!refreshing) {
          refreshing = true
          sessionStorage.setItem('sw_just_updated', 'true')
          window.location.reload()
        }
      }
    })

    // If we just updated, show a toast
    if (sessionStorage.getItem('sw_just_updated') === 'true') {
      sessionStorage.removeItem('sw_just_updated')
      showUpdateSuccessToast()
    }

  } catch (error) {
    console.error('[SW] Registration failed:', error)
  }
}

// Show success toast after update
const showUpdateSuccessToast = () => {
  const toast = document.createElement('div')
  toast.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 12px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
      z-index: 10000;
      font-size: 14px;
      font-weight: 500;
      animation: slideDown 0.3s ease, fadeOut 0.3s ease 2.7s forwards;
    ">
      ✓ App updated to latest version!
    </div>
    <style>
      @keyframes slideDown {
        from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    </style>
  `
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 3000)
}

// Show update notification with optional auto-update countdown
const showUpdateNotification = (registration: ServiceWorkerRegistration, autoUpdate = false) => {
  // Remove any existing notification
  document.getElementById('sw-update-notification')?.remove()

  const AUTO_UPDATE_SECONDS = 5 // Auto-update after 5 seconds

  // Create a notification element
  const notification = document.createElement('div')
  notification.id = 'sw-update-notification'
  notification.innerHTML = `
    <div style="
      position: fixed;
      bottom: 80px;
      left: 16px;
      right: 16px;
      max-width: 400px;
      margin: 0 auto;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      color: white;
      padding: 16px;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(59, 130, 246, 0.4);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      animation: slideUp 0.3s ease;
    ">
      <div style="flex: 1;">
        <p style="margin: 0; font-weight: 600; font-size: 14px;">New version available!</p>
        <p id="sw-update-subtext" style="margin: 4px 0 0; font-size: 12px; opacity: 0.9;">
          ${autoUpdate ? `Updating in <span id="sw-countdown">${AUTO_UPDATE_SECONDS}</span>s...` : 'Tap update for the latest features.'}
        </p>
      </div>
      <button id="sw-update-btn" style="
        background: white;
        color: #3b82f6;
        border: none;
        padding: 10px 20px;
        border-radius: 10px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        white-space: nowrap;
      ">Update Now</button>
      <button id="sw-dismiss-btn" style="
        background: rgba(255,255,255,0.2);
        color: white;
        border: none;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      ">&times;</button>
    </div>
    <style>
      @keyframes slideUp {
        from { transform: translateY(100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    </style>
  `

  document.body.appendChild(notification)

  // Function to trigger update
  const triggerUpdate = () => {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    }
    notification.remove()
  }

  // Auto-update countdown
  let countdownInterval: number | null = null
  if (autoUpdate) {
    let secondsLeft = AUTO_UPDATE_SECONDS
    countdownInterval = window.setInterval(() => {
      secondsLeft--
      const countdownEl = document.getElementById('sw-countdown')
      if (countdownEl) {
        countdownEl.textContent = secondsLeft.toString()
      }
      if (secondsLeft <= 0) {
        if (countdownInterval) clearInterval(countdownInterval)
        triggerUpdate()
      }
    }, 1000)
  }

  // Handle update click
  document.getElementById('sw-update-btn')?.addEventListener('click', () => {
    if (countdownInterval) clearInterval(countdownInterval)
    triggerUpdate()
  })

  // Handle dismiss click - stops auto-update
  document.getElementById('sw-dismiss-btn')?.addEventListener('click', () => {
    if (countdownInterval) clearInterval(countdownInterval)
    notification.remove()
  })
}

// Register service worker when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', registerServiceWorker)
} else {
  registerServiceWorker()
}

// Initialize sync service
initSyncService().catch(console.error)

// Handle online/offline status
window.addEventListener('online', () => {
  console.log('[Network] Back online')
  // Dispatch custom event for components to react
  window.dispatchEvent(new CustomEvent('app-online'))
  // Trigger sync
  performFullSync().catch(console.error)
})

window.addEventListener('offline', () => {
  console.log('[Network] Gone offline')
  // Dispatch custom event for components to react
  window.dispatchEvent(new CustomEvent('app-offline'))
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <CurrencyProvider>
            <SettingsProvider>
              <App />
            </SettingsProvider>
          </CurrencyProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
