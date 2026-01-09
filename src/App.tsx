import { Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { CreateSchedulePageV2 as CreateSchedulePage } from './pages/v2/CreateSchedulePage.v2'
import { ManageSchedulesPageV2 as ManageSchedulesPage } from './pages/v2/ManageSchedulesPage.v2'
import { IngredientsPage } from './pages/IngredientsPage'
import { PrepsPage } from './pages/PrepsPage'
import './leedeli-home.css'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/create" element={<CreateSchedulePage />} />
      <Route path="/manage" element={<ManageSchedulesPage />} />
      <Route path="/ingredients" element={<IngredientsPage />} />

      <Route path="/preps" element={<PrepsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
