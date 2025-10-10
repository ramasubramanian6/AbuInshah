// File: src/App.tsx
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './components/Home';
import SendPosters from './components/SendPosters';
import MemberRegistration from './components/MemberRegistration';
import AdminLogin from './components/AdminLogin.tsx';
import { AdminPanel } from './components/AdminPanel.tsx'; // Import with curly braces as it's a named export
import { useState } from 'react';
import ProtectedRoute from './components/ProtectedRoute';
import logo from '../assets/logo.png'; // Adjust the path to your logo image
import { useNavigate } from 'react-router-dom';


const Navbar = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Do not render Navbar on the /admin route
  if (location.pathname === '/admin') {
    return null;
  }

  return (
    <nav className="bg-blue-500 shadow-md">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex-shrink-0 text-white font-bold text-xl flex items-center">
            <img 
              src={logo} 
              alt="Logo" 
              onClick={() => { navigate('/'); setOpen(false); }} 
              className="h-12 w-12 sm:h-16 sm:w-16 inline-block mr-2 cursor-pointer" // Adjusted size for better mobile fit
            />
           Marketing Poster
          </div>
          <div className="hidden md:flex gap-6">
            <NavLink to="/" label="Home" active={location.pathname === '/'} />
            <NavLink to="/send-poster" label="Send Poster" active={location.pathname === '/send-poster'} />
            <NavLink to="/register" label="Register Member" active={location.pathname === '/register'} />

          </div>
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setOpen(!open)}
              className="text-white focus:outline-none"
              aria-label="Toggle navigation"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {open && (
        <div className="md:hidden px-4 pb-4">
          <NavLink to="/" label="Home" active={location.pathname === '/'} onClick={() => setOpen(false)} />
          <NavLink to="/send-poster" label="Send Poster" active={location.pathname === '/send-poster'} onClick={() => setOpen(false)} />
          <NavLink to="/register" label="Register Member" active={location.pathname === '/register'} onClick={() => setOpen(false)} />

        </div>
      )}
    </nav>
  );
};

const NavLink = ({ to, label, active, onClick }: { to: string; label: string; active: boolean; onClick?: () => void }) => (
  <Link
    to={to}
    className={`block px-3 py-2 rounded-md text-base font-medium transition ${
      active
        ? 'bg-white text-blue-600 shadow'
        : 'text-white hover:bg-blue-600 hover:text-white'
    }`}
    onClick={onClick}
  >
    {label}
  </Link>
);

function App() {
  const location = useLocation();
  const isAdminRoute = location.pathname === '/admin';

  return (
    <>
      {/* Navbar only renders if NOT on the /admin route */}
      {!isAdminRoute && <Navbar />}
      
      {/* Main content area - removed fixed height and overflow, AdminPanel will manage its own */}
      <main className={`${isAdminRoute ? 'h-full w-full' : 'min-h-[calc(100vh-4rem)] w-full'} flex flex-col items-center justify-start bg-gray-100`}>
        <div className="w-full mx-auto"> {/* Removed p-4 to give AdminPanel full control */}
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/send-poster" element={<SendPosters />} />
            <Route path="/register" element={<MemberRegistration />} />
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminPanel />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </main>
    </>
  );
}

export default App;