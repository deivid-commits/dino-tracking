import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { LanguageProvider } from './components/LanguageProvider';
import { WarehouseProvider } from './components/WarehouseProvider';
import Pages from './pages/index';
import { Toaster } from './components/ui/toaster';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <WarehouseProvider>
          <Pages />
          <Toaster />
        </WarehouseProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;
