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

// Update changelog - edit this when releasing new versions
const UPDATE_CHANGELOG = {
  version: '5.2',
  title: 'Smart Capture Upgrade',
  highlights: [
    { icon: '📷', text: 'Better receipt scanning accuracy' },
    { icon: '💰', text: 'Add income directly from captures' },
    { icon: '🏷️', text: 'Create custom categories on-the-fly' },
    { icon: '📱', text: 'Improved mobile experience' },
  ]
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
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      color: white;
      padding: 14px 24px;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(30, 27, 75, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 12px;
      animation: toastIn 0.4s cubic-bezier(0.16, 1, 0.3, 1), toastOut 0.3s ease 3.7s forwards;
    ">
      <div style="
        width: 28px;
        height: 28px;
        background: linear-gradient(135deg, #22d3ee 0%, #10b981 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
      ">✓</div>
      <div>
        <p style="margin: 0; font-weight: 600; font-size: 14px;">Updated to v${UPDATE_CHANGELOG.version}!</p>
        <p style="margin: 2px 0 0; font-size: 12px; opacity: 0.7;">${UPDATE_CHANGELOG.title}</p>
      </div>
    </div>
    <style>
      @keyframes toastIn {
        from { transform: translateX(-50%) translateY(-100%) scale(0.9); opacity: 0; }
        to { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
      }
      @keyframes toastOut {
        from { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
        to { transform: translateX(-50%) translateY(-20px) scale(0.95); opacity: 0; }
      }
    </style>
  `
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 4000)
}

// Show world-class update notification with changelog
const showUpdateNotification = (registration: ServiceWorkerRegistration, autoUpdate = false) => {
  // Remove any existing notification
  document.getElementById('sw-update-notification')?.remove()

  const AUTO_UPDATE_SECONDS = 8 // Give users time to read the changelog

  // Create highlights HTML
  const highlightsHTML = UPDATE_CHANGELOG.highlights
    .map(h => `
      <div style="display: flex; align-items: center; gap: 10px; padding: 8px 0;">
        <span style="font-size: 18px;">${h.icon}</span>
        <span style="font-size: 13px; color: rgba(255,255,255,0.95);">${h.text}</span>
      </div>
    `).join('')

  // Create a notification element
  const notification = document.createElement('div')
  notification.id = 'sw-update-notification'
  notification.innerHTML = `
    <div style="
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%);
      color: white;
      z-index: 10000;
      animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      border-top-left-radius: 24px;
      border-top-right-radius: 24px;
      box-shadow: 0 -10px 50px rgba(0, 0, 0, 0.3);
    ">
      <!-- Progress bar -->
      <div style="
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: rgba(255,255,255,0.2);
        border-top-left-radius: 24px;
        border-top-right-radius: 24px;
        overflow: hidden;
      ">
        <div id="sw-progress-bar" style="
          height: 100%;
          background: linear-gradient(90deg, #22d3ee, #a855f7, #ec4899);
          width: 100%;
          animation: ${autoUpdate ? `progressShrink ${AUTO_UPDATE_SECONDS}s linear forwards` : 'none'};
        "></div>
      </div>

      <!-- Handle bar -->
      <div style="
        width: 40px;
        height: 4px;
        background: rgba(255,255,255,0.3);
        border-radius: 2px;
        margin: 12px auto 0;
      "></div>

      <!-- Content -->
      <div style="padding: 16px 20px 24px;">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="
              width: 40px;
              height: 40px;
              background: linear-gradient(135deg, #22d3ee 0%, #a855f7 100%);
              border-radius: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 20px;
            ">✨</div>
            <div>
              <p style="margin: 0; font-weight: 700; font-size: 16px;">New Update Available!</p>
              <p style="margin: 2px 0 0; font-size: 12px; opacity: 0.7;">v${UPDATE_CHANGELOG.version} · ${UPDATE_CHANGELOG.title}</p>
            </div>
          </div>
          <button id="sw-dismiss-btn" style="
            background: rgba(255,255,255,0.1);
            color: white;
            border: none;
            width: 32px;
            height: 32px;
            border-radius: 10px;
            font-size: 18px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
          ">✕</button>
        </div>

        <!-- What's new section -->
        <div style="
          background: rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 12px 16px;
          margin-bottom: 16px;
        ">
          <p style="margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.6; font-weight: 600;">What's New</p>
          ${highlightsHTML}
        </div>

        <!-- Action buttons -->
        <div style="display: flex; gap: 10px;">
          <button id="sw-later-btn" style="
            flex: 1;
            background: rgba(255,255,255,0.1);
            color: white;
            border: none;
            padding: 14px 20px;
            border-radius: 14px;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.2s;
          ">Later</button>
          <button id="sw-update-btn" style="
            flex: 2;
            background: linear-gradient(135deg, #22d3ee 0%, #a855f7 50%, #ec4899 100%);
            color: white;
            border: none;
            padding: 14px 20px;
            border-radius: 14px;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 20px rgba(168, 85, 247, 0.4);
          ">
            ${autoUpdate ? `<span id="sw-countdown-text">Update Now</span> <span style="opacity: 0.8; font-weight: 500;">(<span id="sw-countdown">${AUTO_UPDATE_SECONDS}</span>s)</span>` : 'Update Now'}
          </button>
        </div>
      </div>
    </div>
    <style>
      @keyframes slideUp {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
      @keyframes progressShrink {
        from { width: 100%; }
        to { width: 0%; }
      }
      #sw-update-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 30px rgba(168, 85, 247, 0.5);
      }
      #sw-dismiss-btn:hover, #sw-later-btn:hover {
        background: rgba(255,255,255,0.2);
      }
    </style>
  `

  document.body.appendChild(notification)

  // Function to trigger update
  const triggerUpdate = () => {
    // Change button to loading state
    const btn = document.getElementById('sw-update-btn')
    if (btn) {
      btn.innerHTML = `
        <span style="display: inline-flex; align-items: center; gap: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" style="animation: spin 1s linear infinite;">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" opacity="0.3"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>
          </svg>
          Updating...
        </span>
      `
      btn.style.pointerEvents = 'none'
    }

    // Add spin animation
    const style = document.createElement('style')
    style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'
    document.head.appendChild(style)

    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    }

    // Fallback: if SW doesn't respond, force reload after 2 seconds
    setTimeout(() => {
      window.location.reload()
    }, 2000)
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

  // Handle dismiss/later click - stops auto-update
  const dismissHandler = () => {
    if (countdownInterval) clearInterval(countdownInterval)
    notification.style.animation = 'slideDown 0.3s ease forwards'
    const style = document.createElement('style')
    style.textContent = '@keyframes slideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }'
    document.head.appendChild(style)
    setTimeout(() => notification.remove(), 300)
  }

  document.getElementById('sw-dismiss-btn')?.addEventListener('click', dismissHandler)
  document.getElementById('sw-later-btn')?.addEventListener('click', dismissHandler)
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
