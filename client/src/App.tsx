import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CalendarPage from './pages/CalendarPage';
import TasksPage from './pages/TasksPage';
import BudgetPage from './pages/BudgetPage';
import ProjectsPage from './pages/ProjectsPage';
import PackagesPage from './pages/PackagesPage';
import NotesPage from './pages/NotesPage';
import GroceryPage from './pages/GroceryPage';
import SharedGroceryPage from './pages/SharedGroceryPage';
import MealPlanPage from './pages/MealPlanPage';
import KitchenPage from './pages/KitchenPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/shared/:token" element={<SharedGroceryPage />} />
      <Route path="/*" element={
        user ? (
          <Layout user={user}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/budget" element={<BudgetPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/packages" element={<PackagesPage />} />
              <Route path="/notes" element={<NotesPage />} />
              <Route path="/grocery" element={<GroceryPage />} />
              <Route path="/meals" element={<MealPlanPage />} />
              <Route path="/kitchen" element={<KitchenPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        ) : (
          <LoginPage />
        )
      } />
    </Routes>
  );
}
