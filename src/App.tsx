import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthContext } from './contexts/AuthProvider'
import { RequireAuth } from './components/guards/RequireAuth'
import { RequireOwner } from './components/guards/RequireOwner'
import { Login } from './app/pages/Login'
import { Home } from './app/pages/Home'
import { Register } from './app/pages/Register'
import AccessRequestPage from './app/pages/AccessRequestPage'
import { Transactions } from './app/pages/Transactions'
import { Attendance } from './app/pages/Attendance'
import { Admin } from './app/pages/Admin'
import AttendanceCalendar from './app/pages/admin/AttendanceCalendar'
import SalesCalendar from './app/pages/admin/SalesCalendar'
import UsersAdmin from './app/pages/admin/Users'
import './App.css'

function App() {
  const { isAuthenticated, loading } = useAuthContext()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white text-xl">システム初期化中...</div>
      </div>
    )
  }

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900">
        <Routes>
          {/* Public Routes */}
          <Route 
            path="/login" 
            element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} 
          />
          <Route path="/register" element={<Register />} />
          <Route path="/access-request" element={<AccessRequestPage />} />
          
          {/* Protected Routes */}
          <Route 
            path="/" 
            element={
              <RequireAuth>
                <Home />
              </RequireAuth>
            } 
          />
          <Route 
            path="/transactions" 
            element={
              <RequireAuth>
                <Transactions />
              </RequireAuth>
            } 
          />
          <Route 
            path="/attendance" 
            element={
              <RequireAuth>
                <Attendance />
              </RequireAuth>
            } 
          />
          
          {/* Owner Only Routes */}
          <Route
            path="/admin"
            element={
              <RequireOwner>
                <Admin />
              </RequireOwner>
            }
          />
          <Route
            path="/admin/attendance-calendar"
            element={
              <RequireOwner>
                <AttendanceCalendar />
              </RequireOwner>
            }
          />
          <Route
            path="/admin/sales-calendar"
            element={
              <RequireOwner>
                <SalesCalendar />
              </RequireOwner>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RequireOwner>
                <UsersAdmin />
              </RequireOwner>
            }
          />
          
          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  )
}
