import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { SAMRemover } from './pages/SAMRemover';
import { OverlayComparison } from './pages/OverlayComparison';
import { LineSelector } from './pages/LineSelector';

const Navigation: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/sam-remover', label: 'SAM Remover' },
    { path: '/overlay', label: 'Overlay Comparison' },
    { path: '/line-selector', label: 'Line Selector' },
  ];

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            <span className="text-xl font-bold">ArchiDiff</span>
          </div>
          
          <div className="flex space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={location.pathname === item.path ? 'nav-link-active' : 'nav-link'}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
};



function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<><Navigation /><Dashboard /></>} />
          <Route path="/sam-remover" element={<><Navigation /><SAMRemover /></>} />
          <Route path="/overlay" element={<><Navigation /><OverlayComparison /></>} />
          <Route path="/line-selector" element={<><Navigation /><LineSelector /></>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
