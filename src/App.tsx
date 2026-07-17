import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppGate from "./pages/AppGate";
import Login from "./pages/Login";
import EmployeeSignRoute from "./pages/EmployeeSignRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppGate />} />
        <Route path="/login" element={<Login />} />
        <Route path="/firmar/:payslipId" element={<EmployeeSignRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;