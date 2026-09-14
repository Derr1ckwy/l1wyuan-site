import { Routes, Route, Navigate } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { CategoryPage } from './pages/CategoryPage'
import { ContentPage } from './pages/ContentPage'
import { Starfield } from './components/Starfield'
import { AuthProvider } from './components/AuthProvider'
import { AuthBar } from './components/AuthBar'
import { NavProvider } from './components/NavContext'
import { NewNoteProvider } from './components/NewNoteProvider'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <NavProvider>
        <NewNoteProvider>
          <Starfield />
          <AuthBar />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/c/:categoryId" element={<CategoryPage />} />
            <Route path="/p/*" element={<ContentPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </NewNoteProvider>
      </NavProvider>
    </AuthProvider>
  )
}

export default App
