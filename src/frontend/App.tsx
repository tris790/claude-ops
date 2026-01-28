import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { MainLayout } from "./layouts/MainLayout";
import { SetupPage } from "./pages/SetupPage";

import { RepoList } from "./pages/RepoList";
import { SettingsPage } from "./pages/Settings";
import { RepoBrowser } from "./pages/RepoBrowser";
import { WorkItems } from "./pages/WorkItems";
import { WorkItemDetail } from "./pages/WorkItemDetail";
import { PullRequests } from "./pages/PullRequests";
import { PRDetail } from "./pages/PRDetail";
import { PipelineList } from "./pages/PipelineList";
import { PipelineRunDetail } from "./pages/PipelineRunDetail";
import { SearchPage } from "./pages/SearchPage";

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
          <Route path="/repos" element={<RepoList />} />
          <Route path="/repos/:project/:repo" element={<RepoBrowser />} />
          <Route path="/repos/:project/:repo/blob/*" element={<RepoBrowser />} />
          <Route path="/workitems" element={<WorkItems />} />
          <Route path="/workitems/:id" element={<WorkItemDetail />} />
          <Route path="/prs" element={<PullRequests />} />
          <Route path="/prs/:id" element={<PRDetail />} />
          <Route path="/pipelines" element={<PipelineList />} />
          <Route path="/pipelines/:id" element={<PipelineRunDetail />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/settings" element={<SettingsPage />} />
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
        <ThemeProvider>
          <AppRoutes />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
