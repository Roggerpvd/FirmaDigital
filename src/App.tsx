import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminDashboard from "./pages/AdminDashboard";
import EmployeeDashboardRoute from "./pages/EmployeeDashboardRoute";
import EmployeeSignRoute from "./pages/EmployeeSignRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/mis-boletas/:employeeCode" element={<EmployeeDashboardRoute />} />
        <Route path="/firmar/:payslipId" element={<EmployeeSignRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;