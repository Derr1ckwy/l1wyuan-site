import { Routes, Route, Navigate } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { CategoryPage } from './pages/CategoryPage'
import { ContentPage } from './pages/ContentPage'
import { Starfield } from './components/Starfield'
import './App.css'

function App() {
  return (
    <>
      <Starfield />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/c/:categoryId" element={<CategoryPage />} />
        <Route path="/p/*" element={<ContentPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App
