import { Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { CreateSchedulePageV2 as CreateSchedulePage } from './pages/v2/CreateSchedulePage.v2'
import { ManageSchedulesPageV2 as ManageSchedulesPage } from './pages/v2/ManageSchedulesPage.v2'
import { IngredientsPage } from './pages/IngredientsPage'
import { PrepsPage } from './pages/PrepsPage'
import { RequireAuth } from './components/RequireAuth'
import { AuthProvider } from './auth/AuthContext'
import './leedeli-home.css'

export default function App() {
  return (
    <AuthProvider>
    <Routes>
      {/* 로그인 페이지: 인증 불필요 */}
      <Route path="/login" element={<LoginPage />} />

      {/* 아래 모든 페이지: 로그인 필수 (RequireAuth로 보호) */}
      <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
      <Route path="/create" element={<RequireAuth><CreateSchedulePage /></RequireAuth>} />
      <Route path="/manage" element={<RequireAuth><ManageSchedulesPage /></RequireAuth>} />
      <Route path="/ingredients" element={<RequireAuth><IngredientsPage /></RequireAuth>} />
      <Route path="/preps" element={<RequireAuth><PrepsPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </AuthProvider>
  )
}
