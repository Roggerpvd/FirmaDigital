import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppGate from "./pages/AppGate";
import Login from "./pages/Login";
import EmployeeSignRoute from "./pages/EmployeeSignRoute";
import SplashScreen from "./components/SplashScreen";

function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      {/* Fondo global fijo: logo como marca de agua sutil detrás de toda la app.
          El wash de color encima de la imagen mantiene el mismo tono de fondo
          del diseño (#f7f9fb) y controla qué tan visible se ve el logo. */}
      <div
      aria-hidden="true"
      className="fixed inset-0 -z-10"
      style={{
        backgroundImage: `linear-gradient(rgba(247, 249, 251, 0.6), rgba(247, 249, 251, 0.6)), url(/mister-pan-watermark.png)`,
        backgroundSize: "1200px",
        backgroundPosition: "-250px center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#f7f9fb",
      }}
      />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppGate />} />
          <Route path="/login" element={<Login />} />
          <Route path="/firmar/:payslipId" element={<EmployeeSignRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;