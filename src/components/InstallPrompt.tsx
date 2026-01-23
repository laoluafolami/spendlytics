import { useState, useEffect, useCallback } from 'react';
import { Download, X, Share, Plus, Smartphone, ChevronUp, Sparkles, Check, ArrowRight } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type PromptType = 'banner' | 'modal' | 'ios-instructions' | null;

// Storage keys
const STORAGE_KEYS = {
  lastDismissed: 'pwa-install-last-dismissed',
  dismissCount: 'pwa-install-dismiss-count',
  installed: 'pwa-installed',
  neverShow: 'pwa-install-never-show'
};

// Timing configuration
const TIMING = {
  initialDelay: 3000, // Show first prompt after 3 seconds
  dismissCooldown: 24 * 60 * 60 * 1000, // 24 hours after dismiss
  maxDismisses: 5, // Stop showing after 5 dismisses
  reEngageDelay: 7 * 24 * 60 * 60 * 1000, // Re-engage after 7 days
  sessionInteractions: 3 // Show after 3 interactions in session
};

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [promptType, setPromptType] = useState<PromptType>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [, setInteractionCount] = useState(0);

  // Detect platform and standalone mode
  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(ios);

    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // Mark as installed if in standalone mode
    if (standalone) {
      localStorage.setItem(STORAGE_KEYS.installed, 'true');
    }
  }, []);

  // Check if we should show the prompt
  const shouldShowPrompt = useCallback((): boolean => {
    // Never show if already installed
    if (isStandalone || localStorage.getItem(STORAGE_KEYS.installed) === 'true') {
      return false;
    }

    // Never show if user opted out
    if (localStorage.getItem(STORAGE_KEYS.neverShow) === 'true') {
      return false;
    }

    const lastDismissed = parseInt(localStorage.getItem(STORAGE_KEYS.lastDismissed) || '0');
    const dismissCount = parseInt(localStorage.getItem(STORAGE_KEYS.dismissCount) || '0');

    // Don't show if dismissed too many times
    if (dismissCount >= TIMING.maxDismisses) {
      // But re-engage after long period
      if (Date.now() - lastDismissed < TIMING.reEngageDelay) {
        return false;
      }
    }

    // Don't show if recently dismissed
    if (lastDismissed && Date.now() - lastDismissed < TIMING.dismissCooldown) {
      return false;
    }

    return true;
  }, [isStandalone]);

  // Handle beforeinstallprompt event
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      console.log('[InstallPrompt] beforeinstallprompt captured');

      // Show banner after initial delay if conditions are met
      if (shouldShowPrompt()) {
        setTimeout(() => {
          if (shouldShowPrompt()) {
            setPromptType('banner');
          }
        }, TIMING.initialDelay);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Handle successful app install
    window.addEventListener('appinstalled', () => {
      console.log('[InstallPrompt] App installed');
      localStorage.setItem(STORAGE_KEYS.installed, 'true');
      setInstallSuccess(true);
      setPromptType(null);
      setDeferredPrompt(null);

      // Show success message briefly
      setTimeout(() => setInstallSuccess(false), 3000);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [shouldShowPrompt]);

  // Track user interactions to show prompt at right time
  useEffect(() => {
    const trackInteraction = () => {
      setInteractionCount((prev: number) => {
        const newCount = prev + 1;
        // Show prompt after certain interactions if not shown yet
        if (newCount === TIMING.sessionInteractions && shouldShowPrompt() && !promptType) {
          if (isIOS) {
            setPromptType('ios-instructions');
          } else if (deferredPrompt) {
            setPromptType('banner');
          }
        }
        return newCount;
      });
    };

    // Track meaningful interactions
    window.addEventListener('click', trackInteraction, { passive: true });
    window.addEventListener('touchend', trackInteraction, { passive: true });

    return () => {
      window.removeEventListener('click', trackInteraction);
      window.removeEventListener('touchend', trackInteraction);
    };
  }, [deferredPrompt, isIOS, promptType, shouldShowPrompt]);

  // iOS detection - show instructions after delay
  useEffect(() => {
    if (isIOS && !isStandalone && shouldShowPrompt()) {
      setTimeout(() => {
        if (shouldShowPrompt()) {
          setPromptType('ios-instructions');
        }
      }, TIMING.initialDelay);
    }
  }, [isIOS, isStandalone, shouldShowPrompt]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('[InstallPrompt] User accepted install');
        localStorage.setItem(STORAGE_KEYS.installed, 'true');
      } else {
        console.log('[InstallPrompt] User dismissed install');
        handleDismiss();
      }
    } catch (error) {
      console.error('[InstallPrompt] Install error:', error);
    }

    setDeferredPrompt(null);
    setPromptType(null);
  };

  const handleDismiss = () => {
    const dismissCount = parseInt(localStorage.getItem(STORAGE_KEYS.dismissCount) || '0');
    localStorage.setItem(STORAGE_KEYS.dismissCount, (dismissCount + 1).toString());
    localStorage.setItem(STORAGE_KEYS.lastDismissed, Date.now().toString());
    setPromptType(null);
  };

  const handleNeverShow = () => {
    localStorage.setItem(STORAGE_KEYS.neverShow, 'true');
    setPromptType(null);
  };

  const showModal = () => {
    setPromptType('modal');
  };

  // Success notification
  if (installSuccess) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-slide-up">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-2xl p-4">
          <div className="flex items-center gap-3 text-white">
            <div className="p-2 bg-white/20 rounded-xl">
              <Check size={24} />
            </div>
            <div>
              <p className="font-bold">App Installed!</p>
              <p className="text-sm text-white/90">WealthPulse is now on your home screen</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Don't render if conditions not met
  if (isStandalone) return null;
  if (!promptType) return null;
  if (!deferredPrompt && !isIOS) return null;

  // iOS Installation Instructions
  if (promptType === 'ios-instructions') {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
        <div className="w-full max-w-md animate-slide-up">
          <div className="bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <Smartphone size={28} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Install WealthPulse</h2>
                    <p className="text-sm text-white/80">Add to your home screen</p>
                  </div>
                </div>
                <button
                  onClick={handleDismiss}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                  aria-label="Close"
                >
                  <X size={24} />
                </button>
              </div>
              <p className="text-sm text-white/90">
                Install WealthPulse for the best experience with offline access and instant receipt sharing.
              </p>
            </div>

            {/* Instructions */}
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">1</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">Tap the Share button</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                    <Share size={16} className="text-blue-500" /> at the bottom of your screen
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                  <span className="text-purple-600 dark:text-purple-400 font-bold">2</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">Scroll down and tap</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                    <Plus size={16} className="text-purple-500" /> "Add to Home Screen"
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                  <span className="text-green-600 dark:text-green-400 font-bold">3</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">Tap "Add" to install</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    WealthPulse will appear on your home screen
                  </p>
                </div>
              </div>

              {/* Visual indicator */}
              <div className="flex justify-center pt-4">
                <div className="flex flex-col items-center animate-bounce">
                  <ChevronUp size={24} className="text-blue-500" />
                  <Share size={32} className="text-blue-500" />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={handleNeverShow}
                className="flex-1 px-4 py-3 text-gray-600 dark:text-gray-400 text-sm font-medium"
              >
                Don't show again
              </button>
              <button
                onClick={handleDismiss}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-xl font-semibold shadow-lg"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Modal view
  if (promptType === 'modal') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
        <div className="w-full max-w-md animate-slide-up">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <Sparkles size={28} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Install WealthPulse</h2>
                    <p className="text-sm text-white/80">Your finances, always accessible</p>
                  </div>
                </div>
                <button
                  onClick={handleDismiss}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                  aria-label="Close"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Benefits */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Download size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Works Offline</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Access your data anytime</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Share size={20} className="text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Share Receipts Instantly</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Log expenses from any app</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Smartphone size={20} className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Native App Experience</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Fast, smooth, and responsive</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 space-y-3">
              <button
                onClick={handleInstallClick}
                className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white py-4 px-6 rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Download size={20} />
                Install Now
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleNeverShow}
                  className="flex-1 px-4 py-2 text-gray-500 dark:text-gray-400 text-sm"
                >
                  Don't show again
                </button>
                <button
                  onClick={handleDismiss}
                  className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 text-sm font-medium"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Banner view (default)
  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-slide-up">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Gradient accent */}
        <div className="h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600"></div>

        <div className="p-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl">
              <Download className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    Install WealthPulse
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                    Quick access & offline support
                  </p>
                </div>
                <button
                  onClick={handleDismiss}
                  className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  aria-label="Dismiss"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleInstallClick}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  Install
                  <ArrowRight size={16} />
                </button>
                <button
                  onClick={showModal}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-sm transition-colors"
                >
                  Learn more
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
