import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App'
import ShareView from './pages/ShareView'
import Login from './pages/Login'
import Users from './pages/Users'
import PrintView from './pages/PrintView'
import Dashboard from './pages/Dashboard'
import AuditLogs from './pages/AuditLogs'
import { ThemeProvider } from './context/ThemeContext'
import './index.css'

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/share/:slug" element={<ShareView />} />
          <Route 
            path="/users" 
            element={
              <ProtectedRoute>
                <Users />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/audit-logs" 
            element={
              <ProtectedRoute>
                <AuditLogs />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/article/:id" 
            element={
              <ProtectedRoute>
                <App />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/print/:id" 
            element={
              <ProtectedRoute>
                <PrintView />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <App />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
)