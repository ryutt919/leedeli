import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { CreateSchedulePage } from './pages/CreateSchedulePage';
import { ManageSchedulesPage } from './pages/ManageSchedulesPage';
import { PrepManagementPage } from './pages/PrepManagementPage';
import { IngredientManagementPage } from './pages/IngredientManagementPage';

function App() {
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
