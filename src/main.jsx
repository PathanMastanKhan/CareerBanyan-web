import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import { Analytics } from '@vercel/analytics/react';
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Each job now gets its own real URL. Both routes render the same
            <App/>, which reads the :id param (if present) via useParams()
            to decide which job's detail view to show. This is what makes
            /job/123 a distinct, crawlable, bookmarkable, shareable page
            instead of only existing as in-memory modal state. */}
        <Route path="/job/:id" element={<App />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
    <Analytics />
  </React.StrictMode>
);
