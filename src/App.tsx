import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { CreateSchedulePage } from './pages/CreateSchedulePage';
import { ManageSchedulesPage } from './pages/ManageSchedulesPage';
import { PrepManagementPage } from './pages/PrepManagementPage';
import { IngredientManagementPage } from './pages/IngredientManagementPage';

function App() {
  return (
    <HashRouter>
      <div className="min-h-dvh bg-slate-100 text-slate-900">
        <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-3 py-2">
            <Link to="/" className="text-center text-sm font-semibold tracking-tight text-sky-600">
              leedeli management
            </Link>
            <div className="flex w-full flex-nowrap gap-2 overflow-x-auto pb-1 text-xs [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Link className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600 active:bg-slate-50" to="/">홈</Link>
              <Link className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600 active:bg-slate-50" to="/create">스케줄 생성</Link>
              <Link className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600 active:bg-slate-50" to="/manage">스케줄 관리/조회</Link>
              <Link className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600 active:bg-slate-50" to="/preps">프렙/소스 관리</Link>
              <Link className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600 active:bg-slate-50" to="/ingredients">재료 관리</Link>
            </div>
          </div>
        </nav>

        <main className="py-3">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/create" element={<CreateSchedulePage />} />
            <Route path="/manage" element={<ManageSchedulesPage />} />
            <Route path="/preps" element={<PrepManagementPage />} />
            <Route path="/ingredients" element={<IngredientManagementPage />} />
          </Routes>
        </main>

        <footer className="border-t border-slate-200 bg-white/60 py-4">
          <p className="text-center text-[11px] text-slate-400">&copy; 2025 leedeli management</p>
        </footer>
      </div>
    </HashRouter>
  );
}

export default App;
