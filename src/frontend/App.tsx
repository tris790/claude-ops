import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { MainLayout } from "./layouts/MainLayout";
import { SetupPage } from "./pages/SetupPage";

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return isAuthenticated ? <Outlet /> : <Navigate to="/setup" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/setup" element={<SetupPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout><Outlet /></MainLayout>}>
          <Route path="/repos" element={
            <div className="text-zinc-400 p-4">
              <h2 className="text-xl text-white font-bold">Repositories</h2>
              <p>Repository list will appear here.</p>
            </div>
          } />
          <Route path="/" element={<Navigate to="/repos" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
