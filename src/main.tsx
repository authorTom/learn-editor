import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/primitives.css'
import './styles/shell.css'
import './styles.css'
/* Last: the canvas owns the course-themed content column, and its rules must
   win over the legacy block-editor styles still in styles.css. */
import './styles/canvas.css'
import './styles/inspector.css'
import './styles/picker.css'
import './styles/settings.css'
import './styles/dashboard.css'
import './styles/palette.css'
import './styles/flight.css'
import './styles/tools.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
