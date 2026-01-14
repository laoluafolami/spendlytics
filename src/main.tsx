import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ThemeProvider } from './contexts/ThemeContext'
import { CurrencyProvider } from './contexts/CurrencyContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered:', registration)
      })
      .catch(error => {
        console.log('SW registration failed:', error)
      })
  })
}

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
