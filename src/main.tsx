import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './mobile.css'
import App from './App.tsx'
import { Capacitor } from '@capacitor/core'

// Android/iOS app shell: lets the phone UI add extra top padding under the status bar
if (Capacitor.isNativePlatform()) document.documentElement.dataset.native = '1'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
