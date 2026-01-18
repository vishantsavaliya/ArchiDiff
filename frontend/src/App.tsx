import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { CanvasEditor } from './pages/CanvasEditor';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/canvas-editor" element={<CanvasEditor />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

