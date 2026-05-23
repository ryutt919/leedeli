import { Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { CreateSchedulePage } from './pages/CreateSchedulePage'
import { ManageSchedulesPage } from './pages/ManageSchedulesPage'
import { IngredientsPage } from './pages/IngredientsPage'
import { MenuPage } from './pages/MenuPage'
import { PrepsPage } from './pages/PrepsPage'
import { UnauthorizedPage } from './pages/UnauthorizedPage'
import { UserManagementPage } from './pages/UserManagementPage'
import { RequireAuth } from './components/RequireAuth'
import { RequireAdmin } from './auth/RequireAdmin'
import { AuthProvider } from './auth/AuthContext'
import './leedeli-home.css'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route
          path="/create"
          element={<RequireAuth><RequireAdmin><CreateSchedulePage /></RequireAdmin></RequireAuth>}
        />
        <Route path="/manage" element={<RequireAuth><ManageSchedulesPage /></RequireAuth>} />
        <Route path="/ingredients" element={<RequireAuth><IngredientsPage /></RequireAuth>} />
        <Route path="/preps" element={<RequireAuth><PrepsPage /></RequireAuth>} />
        <Route path="/menu" element={<RequireAuth><MenuPage /></RequireAuth>} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route
          path="/users"
          element={<RequireAuth><RequireAdmin><UserManagementPage /></RequireAdmin></RequireAuth>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}