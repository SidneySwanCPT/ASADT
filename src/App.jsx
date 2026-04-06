import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "./context/AuthContext"
import Layout from "./components/Layout"
import LoginPage from "./pages/LoginPage"
import Dashboard from "./pages/Dashboard"
import ClientsPage from "./pages/ClientsPage"
import ClientProfile from "./pages/ClientProfile"
import TripsPage from "./pages/TripsPage"
import TripManifest from "./pages/TripManifest"
import TasksPage from "./pages/TasksPage"
import RemindersPage from "./pages/RemindersPage"
import SuppliersPage from "./pages/SuppliersPage"

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:"#fdf2f7"}}>
      <div className="w-7 h-7 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
    </div>
  )
  if (!session) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function AppRoutes() {
  const { session, loading } = useAuth()
  if (loading) return null
  return (
    <Routes>
      <Route path="/login"                   element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/"                        element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/clients"                 element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
      <Route path="/clients/:id"             element={<ProtectedRoute><ClientProfile /></ProtectedRoute>} />
      <Route path="/trips"                   element={<ProtectedRoute><TripsPage /></ProtectedRoute>} />
      <Route path="/trips/:id/manifest"      element={<ProtectedRoute><TripManifest /></ProtectedRoute>} />
      <Route path="/tasks"                   element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
      <Route path="/reminders"               element={<ProtectedRoute><RemindersPage /></ProtectedRoute>} />
      <Route path="/suppliers"               element={<ProtectedRoute><SuppliersPage /></ProtectedRoute>} />
      <Route path="*"                        element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
