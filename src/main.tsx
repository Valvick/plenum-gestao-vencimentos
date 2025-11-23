import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import "./index.css";

// Suas páginas
import App from "./App.tsx";
import LandingPage from "./LandingPage";
import Checkout from "./Checkout"; // ← IMPORT DO CHECKOUT

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Landing comercial */}
        <Route path="/apresentacao" element={<LandingPage />} />

        {/* Checkout premium */}
        <Route path="/checkout" element={<Checkout />} />

        {/* Resto do sistema */}
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);

