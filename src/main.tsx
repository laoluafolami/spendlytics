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

// Refresh cooldown - prevents infinite reload loops
const REFRESH_COOLDOWN_MS = 10000 // 10 seconds minimum between refreshes
const REFRESH_COOLDOWN_KEY = 'sw_refresh_cooldown'

// Check if we're in a cooldown period (just refreshed recently)
const isInCooldown = (): boolean => {
  const lastRefresh = localStorage.getItem(REFRESH_COOLDOWN_KEY)
  if (!lastRefresh) return false
  const elapsed = Date.now() - parseInt(lastRefresh, 10)
  return elapsed < REFRESH_COOLDOWN_MS
}

// Mark that we just refreshed
const markRefreshTime = () => {
  localStorage.setItem(REFRESH_COOLDOWN_KEY, Date.now().toString())
}

// Check if we just came from a force refresh
const justRefreshed = new URL(window.location.href).searchParams.has('_refresh')

// Clean up refresh parameter from URL if present (from force refresh)
const cleanRefreshParam = () => {
  const url = new URL(window.location.href)
  if (url.searchParams.has('_refresh')) {
    url.searchParams.delete('_refresh')
    window.history.replaceState({}, '', url.toString())
    // Mark that we successfully completed a refresh
    markRefreshTime()
    // Also set the update flag so we show the welcome screen
    sessionStorage.setItem('sw_just_updated', 'true')
  }
}
cleanRefreshParam()

// Nuclear cache clearing - ensures user sees the latest version
const forceHardRefresh = async () => {
  // Prevent infinite refresh loops
  if (isInCooldown()) {
    console.log('[Update] Skipping refresh - in cooldown period')
    return
  }

  console.log('[Update] Starting nuclear cache clear...')
  markRefreshTime() // Mark immediately to prevent race conditions

  try {
    // 1. Clear all Cache Storage caches
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      console.log('[Update] Clearing', cacheNames.length, 'caches')
      await Promise.all(cacheNames.map(name => caches.delete(name)))
    }

    // 2. Clear localStorage items that might cache old data (except user data)
    const keysToKeep = [
      'expense_tracker_session_id',
      'expense-tracker-theme',
      'expense-tracker-currency',
      'gemini_api_key',
      'sw_just_updated'
    ]
    const allKeys = Object.keys(localStorage)
    allKeys.forEach(key => {
      if (!keysToKeep.some(k => key.includes(k))) {
        // Only remove cache-related keys, not user data
        if (key.includes('cache') || key.includes('version') || key.includes('sw_')) {
          localStorage.removeItem(key)
        }
      }
    })

    // 3. Clear sessionStorage (except our update flag)
    const updateFlag = sessionStorage.getItem('sw_just_updated')
    sessionStorage.clear()
    if (updateFlag) sessionStorage.setItem('sw_just_updated', updateFlag)

    // 4. Unregister all service workers and re-register
    const registrations = await navigator.serviceWorker.getRegistrations()
    for (const registration of registrations) {
      await registration.unregister()
    }

    console.log('[Update] All caches cleared, reloading with cache bypass...')

    // 5. Force reload with cache bypass
    // Adding timestamp to URL forces browser to fetch fresh
    const url = new URL(window.location.href)
    url.searchParams.set('_refresh', Date.now().toString())
    window.location.replace(url.toString())

  } catch (error) {
    console.error('[Update] Cache clear failed:', error)
    // Fallback: simple reload
    window.location.reload()
  }
}

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
            // New content available - show notification
            // But skip if we just refreshed (prevents infinite loop)
            if (justRefreshed || isInCooldown()) {
              console.log('[SW] Skipping update notification - just refreshed')
              return
            }
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
      // Skip if we just refreshed (prevents infinite loop)
      if (justRefreshed || isInCooldown()) {
        console.log('[SW] Skipping controller change refresh - in cooldown')
        return
      }
      if (!refreshing) {
        refreshing = true
        console.log('[SW] Controller changed, forcing hard refresh...')
        // Clear any stale data before reload
        sessionStorage.setItem('sw_just_updated', 'true')
        // Force hard refresh - bypass all caches
        forceHardRefresh()
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

      // Handle SW_UPDATED message - force nuclear refresh
      if (event.data && event.data.type === 'SW_UPDATED') {
        // Skip if we just refreshed (prevents infinite loop)
        if (justRefreshed || isInCooldown()) {
          console.log('[SW] Skipping SW_UPDATED refresh - in cooldown')
          return
        }
        console.log('[SW] Service worker updated to', event.data.version, '- forcing refresh')
        if (!refreshing) {
          refreshing = true
          sessionStorage.setItem('sw_just_updated', 'true')
          // Use nuclear refresh to ensure all caches are cleared
          forceHardRefresh()
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
  version: '5.18',
  title: 'Mobile Layout & Backup Complete',
  // Short highlights for update notification
  highlights: [
    { icon: '📱', text: 'Fixed mobile overflow on Expenses & Transactions' },
    { icon: '💾', text: 'Backup now detects budgets, goals, & settings' },
    { icon: '🗂️', text: 'All data categories properly backed up' },
    { icon: '✨', text: 'Cleaner mobile experience throughout' },
  ],
  // Detailed tips for post-update welcome screen
  tips: [
    {
      icon: '📱',
      title: 'Mobile Layout Fixed',
      description: 'Expenses and All Transactions pages no longer spill horizontally on mobile - content stays within screen bounds.',
      color: '#3b82f6',
      colorEnd: '#8b5cf6'
    },
    {
      icon: '💾',
      title: 'Complete Backup',
      description: 'Backup now correctly detects all your data: expenses, income, budgets, savings goals, assets, liabilities, investments, and settings.',
      color: '#10b981',
      colorEnd: '#22d3ee'
    },
    {
      icon: '🗂️',
      title: 'Correct Table Names',
      description: 'Fixed backup config to use app_budgets, app_savings_goals, app_filter_presets, and app_settings tables.',
      color: '#f59e0b',
      colorEnd: '#ef4444'
    },
    {
      icon: '✨',
      title: 'Better User Experience',
      description: 'All containers now respect viewport width on mobile for a true native app feel.',
      color: '#22d3ee',
      colorEnd: '#3b82f6'
    }
  ]
}

// Show post-update welcome experience
const showUpdateWelcome = () => {
  const overlay = document.createElement('div')
  overlay.id = 'update-welcome-overlay'

  const tipsHTML = UPDATE_CHANGELOG.tips?.map((tip, i) => `
    <div style="
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 16px;
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      animation: tipFadeIn 0.5s ease ${0.3 + i * 0.1}s both;
    ">
      <div style="
        width: 44px;
        height: 44px;
        background: linear-gradient(135deg, ${tip.color || '#22d3ee'} 0%, ${tip.colorEnd || '#a855f7'} 100%);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        flex-shrink: 0;
      ">${tip.icon}</div>
      <div style="flex: 1; min-width: 0;">
        <p style="margin: 0; font-weight: 600; font-size: 14px; color: white;">${tip.title}</p>
        <p style="margin: 4px 0 0; font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.4;">${tip.description}</p>
      </div>
    </div>
  `).join('') || ''

  overlay.innerHTML = `
    <div style="
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.8);
      backdrop-filter: blur(8px);
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: overlayFadeIn 0.3s ease;
    ">
      <div style="
        width: 100%;
        max-width: 420px;
        max-height: 90vh;
        overflow-y: auto;
        background: linear-gradient(165deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%);
        border-radius: 28px;
        box-shadow: 0 25px 80px rgba(0,0,0,0.5);
        animation: modalSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      ">
        <!-- Celebration header -->
        <div style="
          padding: 32px 24px 24px;
          text-align: center;
          position: relative;
          overflow: hidden;
        ">
          <!-- Confetti/sparkles background -->
          <div style="
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at 20% 20%, rgba(34, 211, 238, 0.15) 0%, transparent 50%),
                        radial-gradient(circle at 80% 30%, rgba(168, 85, 247, 0.15) 0%, transparent 50%),
                        radial-gradient(circle at 50% 80%, rgba(236, 72, 153, 0.1) 0%, transparent 50%);
          "></div>

          <!-- Animated icon -->
          <div style="
            width: 80px;
            height: 80px;
            margin: 0 auto 20px;
            background: linear-gradient(135deg, #22d3ee 0%, #a855f7 50%, #ec4899 100%);
            border-radius: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            animation: iconPop 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
            box-shadow: 0 10px 40px rgba(168, 85, 247, 0.4);
          ">🎉</div>

          <h1 style="
            margin: 0;
            font-size: 24px;
            font-weight: 800;
            color: white;
            animation: textFadeIn 0.5s ease 0.3s both;
          ">You're All Set!</h1>

          <p style="
            margin: 8px 0 0;
            font-size: 15px;
            color: rgba(255,255,255,0.7);
            animation: textFadeIn 0.5s ease 0.4s both;
          ">v${UPDATE_CHANGELOG.version} · ${UPDATE_CHANGELOG.title}</p>
        </div>

        <!-- Tips section -->
        <div style="padding: 0 20px 24px;">
          <p style="
            margin: 0 0 14px 4px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: rgba(255,255,255,0.5);
            font-weight: 600;
          ">Quick Tips</p>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${tipsHTML}
          </div>
        </div>

        <!-- CTA button -->
        <div style="padding: 0 20px 28px;">
          <button id="welcome-cta-btn" style="
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #22d3ee 0%, #a855f7 50%, #ec4899 100%);
            border: none;
            border-radius: 16px;
            color: white;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 8px 30px rgba(168, 85, 247, 0.4);
            transition: transform 0.2s, box-shadow 0.2s;
            animation: btnFadeIn 0.5s ease 0.6s both;
          ">Let's Go! ✨</button>
        </div>
      </div>
    </div>

    <style>
      @keyframes overlayFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes modalSlideUp {
        from { opacity: 0; transform: translateY(40px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes iconPop {
        from { opacity: 0; transform: scale(0.5) rotate(-10deg); }
        to { opacity: 1; transform: scale(1) rotate(0deg); }
      }
      @keyframes textFadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes tipFadeIn {
        from { opacity: 0; transform: translateX(-10px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes btnFadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      #welcome-cta-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 40px rgba(168, 85, 247, 0.5);
      }
      #welcome-cta-btn:active {
        transform: translateY(0);
      }
    </style>
  `

  document.body.appendChild(overlay)

  // Handle CTA click
  document.getElementById('welcome-cta-btn')?.addEventListener('click', () => {
    overlay.style.animation = 'overlayFadeOut 0.3s ease forwards'
    const style = document.createElement('style')
    style.textContent = '@keyframes overlayFadeOut { from { opacity: 1; } to { opacity: 0; } }'
    document.head.appendChild(style)
    setTimeout(() => overlay.remove(), 300)
  })

  // Also close on overlay click (outside modal)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay.firstElementChild) {
      document.getElementById('welcome-cta-btn')?.click()
    }
  })
}

// Show success toast after update (quick toast, then welcome screen)
const showUpdateSuccessToast = () => {
  // Show welcome experience after a brief moment
  setTimeout(() => showUpdateWelcome(), 500)
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

    // Fallback: if SW doesn't respond, force nuclear refresh after 2 seconds
    setTimeout(() => {
      forceHardRefresh()
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
