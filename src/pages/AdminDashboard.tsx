import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  fetchAdminDocuments,
  fetchAdminEmployees,
  createAdminEmployee,
  createAdminPayslip,
  type AdminDocument,
  type AdminEmployee,
} from "../api/admin";
import { fetchPayslipProof } from "../api/admin";


const statusLabel = (status: "Signed" | "Pending") => (status === "Signed" ? "Firmado" : "Pendiente");

function AdminDashboard() {
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"dashboard" | "batches" | "employees" | "reports" | "settings">("batches");
  const [filterTab, setFilterTab] = useState<"all" | "pending" | "signed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Modal: Nuevo Lote (boleta)
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [newPayslipEmail, setNewPayslipEmail] = useState("");
  const [newPayslipCode, setNewPayslipCode] = useState("");
  const [newPayslipPeriod, setNewPayslipPeriod] = useState("");
  const [newPayslipAmount, setNewPayslipAmount] = useState("");
  const [newPayslipIssueDate, setNewPayslipIssueDate] = useState("");
  const [newPayslipStatus, setNewPayslipStatus] = useState<"pending" | "signed">("pending");
  const [creatingBatch, setCreatingBatch] = useState(false);

  // Modal: Agregar Empleado
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [newEmployeeCode, setNewEmployeeCode] = useState("");
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeEmail, setNewEmployeeEmail] = useState("");
  const [newEmployeePosition, setNewEmployeePosition] = useState("");
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<{ email: string; password: string } | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);

  // Ayuda
  const [helpOpen, setHelpOpen] = useState(false);

  // Filtro de orden y mes
  const [sortOrder, setSortOrder] = useState<"recent" | "name-asc" | "name-desc">("recent");
  const [sortOpen, setSortOpen] = useState(false);
  const [monthFilter, setMonthFilter] = useState<string>("Todos los meses");
  const [monthOpen, setMonthOpen] = useState(false);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Búsqueda de empleados
  const [employeeSearch, setEmployeeSearch] = useState("");

  const loadData = () => {
    setLoadingData(true);
    setLoadError(null);
    Promise.all([fetchAdminDocuments(), fetchAdminEmployees()])
      .then(([docs, emps]) => {
        setDocuments(docs);
        setEmployees(emps);
      })
      .catch((err) => setLoadError(err.message || "Error al cargar datos"))
      .finally(() => setLoadingData(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterTab, sortOrder, monthFilter]);

  const handleCreatePayslip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayslipEmail || !newPayslipCode || !newPayslipPeriod || !newPayslipAmount || !newPayslipIssueDate) {
      setToast({ message: "Completa todos los campos obligatorios.", type: "info" });
      return;
    }

    setCreatingBatch(true);
    try {
      await createAdminPayslip({
        employeeEmail: newPayslipEmail,
        payslipCode: newPayslipCode,
        period: newPayslipPeriod,
        netAmount: parseFloat(newPayslipAmount),
        issueDate: newPayslipIssueDate,
        status: newPayslipStatus,
      });

      setToast({ message: `Boleta ${newPayslipCode} creada correctamente.`, type: "success" });
      setShowBatchModal(false);
      setNewPayslipEmail("");
      setNewPayslipCode("");
      setNewPayslipPeriod("");
      setNewPayslipAmount("");
      setNewPayslipIssueDate("");
      setNewPayslipStatus("pending");
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || "No se pudo crear la boleta.", type: "error" });
    } finally {
      setCreatingBatch(false);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployeeCode || !newEmployeeName || !newEmployeeEmail) {
      setToast({ message: "Completa los campos obligatorios.", type: "info" });
      return;
    }

    setCreatingEmployee(true);
    try {
      const result = await createAdminEmployee({
        employeeCode: newEmployeeCode,
        fullName: newEmployeeName,
        email: newEmployeeEmail,
        position: newEmployeePosition || undefined,
      });

      setGeneratedPassword({ email: result.employee.email, password: result.temporaryPassword });
      setShowEmployeeModal(false);
      setNewEmployeeCode("");
      setNewEmployeeName("");
      setNewEmployeeEmail("");
      setNewEmployeePosition("");
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || "No se pudo crear el empleado.", type: "error" });
    } finally {
      setCreatingEmployee(false);
    }
  };

  const uniqueMonths = Array.from(
    new Set(documents.filter((d) => d.date !== "—").map((d) => d.date.split(" ").slice(1).join(" ")))
  );

  const filteredDocuments = documents
    .filter((doc) => {
      const matchesSearch =
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.payslipId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMonth = monthFilter === "Todos los meses" || doc.date.includes(monthFilter);
      if (filterTab === "signed") return matchesSearch && matchesMonth && doc.status === "Signed";
      if (filterTab === "pending") return matchesSearch && matchesMonth && doc.status === "Pending";
      return matchesSearch && matchesMonth;
    })
    .sort((a, b) => {
      if (sortOrder === "name-asc") return a.name.localeCompare(b.name);
      if (sortOrder === "name-desc") return b.name.localeCompare(a.name);
      return 0;
    });

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / itemsPerPage));
  const paginatedDocuments = filteredDocuments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const countPending = documents.filter((d) => d.status === "Pending").length;
  const countSigned = documents.filter((d) => d.status === "Signed").length;
  const signRate = documents.length ? Math.round((countSigned / documents.length) * 100) : 0;

  const employeesList = Object.values(
    documents.reduce((acc, doc) => {
      if (!acc[doc.email]) {
        acc[doc.email] = { name: doc.name, email: doc.email, total: 0, firmados: 0, pendientes: 0 };
      }
      acc[doc.email].total += 1;
      if (doc.status === "Signed") acc[doc.email].firmados += 1;
      else acc[doc.email].pendientes += 1;
      return acc;
    }, {} as Record<string, { name: string; email: string; total: number; firmados: number; pendientes: number }>)
  ).filter(
    (emp) =>
      emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      emp.email.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  const handleExportCSV = () => {
    const header = "Nombre,Correo,ID de Boleta,Estado,Fecha de Firma\n";
    const rows = documents.map((d) => `${d.name},${d.email},${d.payslipId},${statusLabel(d.status)},${d.date}`).join("\n");
    const csv = header + rows;
    const element = document.createElement("a");
    const file = new Blob([csv], { type: "text/csv" });
    element.href = URL.createObjectURL(file);
    const today = new Date().toISOString().split("T")[0];
    element.download = `reporte_boletas_${today}.csv`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setToast({ message: "Reporte CSV descargado.", type: "success" });
  };

  const handleDownloadProof = async (payslipId: string) => {
    try {
      const dataUrl = await fetchPayslipProof(payslipId);
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${payslipId}_firmada.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      setToast({ message: err.message || "No se pudo descargar el comprobante.", type: "error" });
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  if (loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-outline-variant border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-background text-on-surface flex items-center justify-center p-md">
        <div className="max-w-sm text-center bg-surface-container-lowest border border-outline-variant rounded-xl p-xl shadow-sm">
          <span className="material-symbols-outlined text-[40px] text-error opacity-70 mb-md">error</span>
          <p className="text-[13px] text-on-surface-variant mb-lg">{loadError}</p>
          <button onClick={loadData} className="text-primary text-[13px] font-semibold hover:underline">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDarkMode ? "dark bg-slate-950 text-slate-100" : "bg-background text-on-surface"}`}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-[100] max-w-sm rounded-lg shadow-lg border border-outline-variant p-md flex items-start gap-md bg-surface-container-lowest dark:bg-slate-900">
          <span className={`material-symbols-outlined ${toast.type === "success" ? "text-emerald-500" : toast.type === "error" ? "text-error" : "text-sky-500"}`}>
            {toast.type === "success" ? "check_circle" : toast.type === "error" ? "error" : "info"}
          </span>
          <div className="flex-1">
            <p className="font-body-md text-body-md font-semibold text-primary dark:text-slate-200">
              {toast.type === "success" ? "Listo" : toast.type === "error" ? "Error" : "Aviso"}
            </p>
            <p className="font-body-md text-[13px] text-on-surface-variant dark:text-slate-400 mt-xs leading-normal">{toast.message}</p>
          </div>
          <button onClick={() => setToast(null)} className="material-symbols-outlined text-[18px] text-outline hover:text-primary transition-colors">close</button>
        </div>
      )}

      {/* Modal: contraseña generada para nuevo empleado */}
      {generatedPassword && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99] flex items-center justify-center p-md">
          <div className="bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant dark:border-slate-800 w-full max-w-md rounded-xl p-xl shadow-xl text-center">
            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-lg">
              <span className="material-symbols-outlined text-[28px]">check_circle</span>
            </div>
            <h3 className="font-headline-sm text-headline-sm font-bold text-primary dark:text-slate-100 mb-xs">Empleado creado</h3>
            <p className="text-[13px] text-on-surface-variant dark:text-slate-400 mb-lg">
              Comunícale al empleado su correo y esta contraseña temporal. Solo se muestra esta vez.
            </p>
            <div className="bg-surface-container dark:bg-slate-800 rounded-lg p-md mb-lg text-left space-y-xs">
              <p className="text-[12px] text-on-surface-variant dark:text-slate-400">Correo</p>
              <p className="font-data-mono text-data-mono text-primary dark:text-slate-100">{generatedPassword.email}</p>
              <p className="text-[12px] text-on-surface-variant dark:text-slate-400 mt-sm">Contraseña temporal</p>
              <p className="font-data-mono text-data-mono text-primary dark:text-slate-100 text-[16px] font-bold">{generatedPassword.password}</p>
            </div>
            <button
              onClick={() => setGeneratedPassword(null)}
              className="w-full bg-primary dark:bg-sky-500 text-on-primary dark:text-slate-950 px-lg py-md rounded-lg font-body-md text-body-md hover:opacity-90 transition-all"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`w-[280px] h-screen fixed left-0 top-0 bg-surface-container-lowest dark:bg-slate-900 border-r border-outline-variant dark:border-slate-800 flex flex-col py-lg px-md z-50 transition-transform duration-300 md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="mb-xl px-sm flex items-center justify-between">
          <div>
            <h1 className="font-headline-sm text-headline-sm font-bold text-primary dark:text-slate-100">Mister Pan</h1>
            <p className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400 tracking-wider uppercase opacity-70">Gestor de boletas de pago</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden material-symbols-outlined text-outline hover:text-primary">close</button>
        </div>
        <nav className="flex-1 space-y-1">
          {[
            { key: "dashboard", label: "Panel General", icon: "dashboard" },
            { key: "batches", label: "Lotes de Boletas", icon: "payments" },
            { key: "employees", label: "Empleados", icon: "group" },
            { key: "reports", label: "Reportes", icon: "assessment" }
          ].map(item => (
            <div
              key={item.key}
              onClick={() => { setActiveTab(item.key as typeof activeTab); setSidebarOpen(false); }}
              className={`flex items-center gap-md py-md px-md rounded-lg transition-colors cursor-pointer active:scale-95 ${activeTab === item.key ? "text-primary dark:text-slate-100 font-bold border-r-2 border-primary bg-surface-container-low dark:bg-slate-800" : "text-on-surface-variant dark:text-slate-400 hover:bg-surface-container-low dark:hover:bg-slate-800"}`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="font-body-md text-body-md">{item.label}</span>
            </div>
          ))}
        </nav>
      </aside>

      {/* Header */}
      <header className="h-[72px] fixed top-0 right-0 w-full md:w-[calc(100%-280px)] bg-surface dark:bg-slate-900 border-b border-outline-variant dark:border-slate-800 flex items-center justify-between px-xl z-40 transition-colors duration-200">
        <div className="flex items-center gap-md">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden material-symbols-outlined text-on-surface-variant dark:text-slate-300 hover:text-primary">menu</button>
          <div className="flex items-center bg-surface-container dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-full px-md py-sm w-48 sm:w-96 transition-all duration-200 focus-within:ring-2 focus-within:ring-primary/20 dark:focus-within:ring-sky-500/20 focus-within:border-primary dark:focus-within:border-sky-500">
            <span className="material-symbols-outlined text-on-surface-variant dark:text-slate-400 mr-sm">search</span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none focus:outline-none focus:ring-0 text-body-md font-body-md w-full placeholder-on-surface-variant dark:placeholder-slate-400 dark:text-slate-200"
              placeholder="Buscar lotes, empleados..."
              type="text"
            />
          </div>
        </div>

        <div className="flex items-center gap-lg">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="material-symbols-outlined text-on-surface-variant dark:text-slate-300 hover:text-primary dark:hover:text-slate-100 transition-all text-[22px]"
            title={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          >
            {isDarkMode ? "light_mode" : "dark_mode"}
          </button>

          <button
            onClick={() => setHelpOpen(true)}
            className="material-symbols-outlined text-on-surface-variant dark:text-slate-300 hover:text-primary dark:hover:text-slate-100 transition-all"
          >
            help
          </button>

          <div className="h-8 w-[1px] bg-outline-variant dark:bg-slate-700 hidden sm:block"></div>

          <div className="flex items-center gap-sm">
            <div className="w-10 h-10 rounded-full bg-surface-container-highest dark:bg-slate-800 overflow-hidden border border-outline-variant dark:border-slate-700 flex items-center justify-center">
              <span className="text-[13px] font-bold text-primary dark:text-slate-200">A</span>
            </div>
            <div className="hidden lg:block">
              <p className="font-body-md text-body-md font-semibold text-primary dark:text-slate-200">Administrador</p>
              <p className="text-[10px] uppercase font-bold text-on-surface-variant dark:text-slate-400 tracking-tighter">Cuenta admin</p>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="md:ml-[280px] mt-[72px] h-[calc(100vh-72px)] p-xl overflow-y-auto transition-colors duration-200">
        <div className="max-w-[1440px] mx-auto pb-xl">

          {activeTab === "batches" && (
            <>
              <div className="mb-xl flex flex-col sm:flex-row sm:items-end sm:justify-between gap-md">
                <div>
                  <h2 className="font-headline-md text-headline-md text-primary dark:text-slate-100">Boletas de pago</h2>
                  <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-xs">Gestiona y da seguimiento a las firmas de boletas de pago de tus empleados.</p>
                </div>
                <div className="flex gap-md">
                  <div className="relative">
                    <button onClick={() => { setMonthOpen(!monthOpen); setSortOpen(false); }} className="bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant dark:border-slate-800 px-lg py-md rounded-lg font-body-md text-body-md hover:bg-surface-container dark:hover:bg-slate-800 transition-colors flex items-center gap-sm active:scale-95 text-primary dark:text-slate-200">
                      <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                      {monthFilter}
                    </button>
                    {monthOpen && (
                      <div className="absolute right-0 mt-sm w-48 bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-lg shadow-xl z-50 overflow-hidden">
                        {["Todos los meses", ...uniqueMonths].map(m => (
                          <div key={m} onClick={() => { setMonthFilter(m); setMonthOpen(false); }} className="px-md py-sm text-[13px] cursor-pointer hover:bg-surface-container-low dark:hover:bg-slate-800 text-on-surface dark:text-slate-200">{m}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setShowBatchModal(true)}
                    className="bg-primary dark:bg-sky-500 text-on-primary dark:text-slate-950 px-lg py-md rounded-lg font-body-md text-body-md hover:opacity-90 active:scale-95 transition-all flex items-center gap-sm shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Nueva Boleta
                  </button>
                </div>
              </div>

              <section className="bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="px-xl pt-lg border-b border-outline-variant dark:border-slate-800 flex items-center justify-between">
                  <div className="flex gap-xl overflow-x-auto">
                    <button onClick={() => setFilterTab("all")} className={`pb-md border-b-2 font-body-md text-body-md whitespace-nowrap transition-all ${filterTab === "all" ? "border-primary dark:border-sky-500 text-primary dark:text-slate-100 font-semibold" : "border-transparent text-on-surface-variant dark:text-slate-400 hover:text-primary dark:hover:text-slate-200"}`}>
                      Todos los Documentos ({documents.length})
                    </button>
                    <button onClick={() => setFilterTab("pending")} className={`pb-md border-b-2 font-body-md text-body-md whitespace-nowrap transition-all ${filterTab === "pending" ? "border-primary dark:border-sky-500 text-primary dark:text-slate-100 font-semibold" : "border-transparent text-on-surface-variant dark:text-slate-400 hover:text-primary dark:hover:text-slate-200"}`}>
                      Pendientes ({countPending})
                    </button>
                    <button onClick={() => setFilterTab("signed")} className={`pb-md border-b-2 font-body-md text-body-md whitespace-nowrap transition-all ${filterTab === "signed" ? "border-primary dark:border-sky-500 text-primary dark:text-slate-100 font-semibold" : "border-transparent text-on-surface-variant dark:text-slate-400 hover:text-primary dark:hover:text-slate-200"}`}>
                      Firmados ({countSigned})
                    </button>
                  </div>
                  <div className="pb-md relative">
                    <button onClick={() => { setSortOpen(!sortOpen); setMonthOpen(false); }} className="material-symbols-outlined text-on-surface-variant dark:text-slate-400 hover:text-primary dark:hover:text-slate-200 p-xs rounded-md hover:bg-surface-container dark:hover:bg-slate-800 transition-colors">
                      filter_list
                    </button>
                    {sortOpen && (
                      <div className="absolute right-0 mt-sm w-52 bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-lg shadow-xl z-50 overflow-hidden">
                        {[
                          { key: "recent", label: "Más reciente" },
                          { key: "name-asc", label: "Nombre A-Z" },
                          { key: "name-desc", label: "Nombre Z-A" }
                        ].map(opt => (
                          <div key={opt.key} onClick={() => { setSortOrder(opt.key as typeof sortOrder); setSortOpen(false); }} className={`px-md py-sm text-[13px] cursor-pointer hover:bg-surface-container-low dark:hover:bg-slate-800 ${sortOrder === opt.key ? "text-primary dark:text-sky-400 font-semibold" : "text-on-surface dark:text-slate-200"}`}>
                            {opt.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low dark:bg-slate-800/50 text-left border-b border-outline-variant dark:border-slate-800">
                        <th className="px-xl py-lg font-label-md text-label-md text-on-surface-variant dark:text-slate-300 uppercase tracking-wider">Empleado</th>
                        <th className="px-xl py-lg font-label-md text-label-md text-on-surface-variant dark:text-slate-300 uppercase tracking-wider">ID de Boleta</th>
                        <th className="px-xl py-lg font-label-md text-label-md text-on-surface-variant dark:text-slate-300 uppercase tracking-wider">Estado</th>
                        <th className="px-xl py-lg font-label-md text-label-md text-on-surface-variant dark:text-slate-300 uppercase tracking-wider">Fecha de Firma</th>
                        <th className="px-xl py-lg font-label-md text-label-md text-on-surface-variant dark:text-slate-300 uppercase tracking-wider text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant dark:divide-slate-800">
                      {paginatedDocuments.length > 0 ? (
                        paginatedDocuments.map((doc) => (
                          <tr key={doc.id} className="hover:bg-surface-container-low dark:hover:bg-slate-850/50 transition-colors">
                            <td className="px-xl py-md">
                              <div className="flex items-center gap-md">
                                <div className="w-8 h-8 rounded-full bg-secondary-container dark:bg-slate-700 text-on-secondary-container dark:text-slate-200 flex items-center justify-center font-bold text-label-md overflow-hidden">
                                  <span className="text-[11px]">{getInitials(doc.name)}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-body-md text-body-md text-primary dark:text-slate-200 font-medium">{doc.name}</span>
                                  <span className="text-[11px] text-outline dark:text-slate-400">{doc.email}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-xl py-md">
                              <span className="font-data-mono text-data-mono text-on-surface-variant dark:text-slate-300">{doc.payslipId}</span>
                            </td>
                            <td className="px-xl py-md">
                              {doc.status === "Signed" ? (
                                <div className="inline-flex items-center gap-sm px-md py-xs rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-label-md font-semibold border border-emerald-100 dark:border-emerald-900/50">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                  Firmado
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-sm px-md py-xs rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-label-md font-semibold border border-amber-100 dark:border-amber-900/50">
                                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                  Pendiente
                                </div>
                              )}
                            </td>
                            <td className="px-xl py-md">
                              <span className="font-body-md text-body-md text-on-surface-variant dark:text-slate-300">{doc.date}</span>
                            </td>
                            <td className="px-xl py-md text-right">
                              {doc.status === "Signed" && (
                                <button
                                  onClick={() => handleDownloadProof(doc.payslipId)}
                                  className="material-symbols-outlined text-primary dark:text-sky-400 hover:bg-surface-container dark:hover:bg-slate-800 rounded-lg p-sm transition-all text-[20px] active:scale-90"
                                  title="Descargar comprobante firmado"
                                >
                                  download
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-xl py-xl text-center text-on-surface-variant dark:text-slate-400">
                            No hay boletas registradas todavía.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {filteredDocuments.length > 0 && (
                  <div className="px-xl py-lg bg-surface dark:bg-slate-900/80 border-t border-outline-variant dark:border-slate-800 flex flex-col sm:flex-row gap-md items-center justify-between">
                    <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400">
                      Mostrando {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredDocuments.length)} de {filteredDocuments.length} documentos
                    </p>
                    <div className="flex items-center gap-sm">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant dark:border-slate-700 text-on-surface-variant dark:text-slate-300 hover:bg-surface-container dark:hover:bg-slate-800 transition-colors disabled:opacity-30">
                        <span className="material-symbols-outlined">chevron_left</span>
                      </button>
                      <div className="flex gap-xs">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                          <button key={p} onClick={() => setCurrentPage(p)} className={`w-10 h-10 flex items-center justify-center rounded-lg font-bold transition-colors ${currentPage === p ? "bg-primary dark:bg-sky-500 text-on-primary dark:text-slate-950" : "border border-outline-variant dark:border-slate-700 text-on-surface-variant dark:text-slate-300 hover:bg-surface-container dark:hover:bg-slate-800"}`}>
                            {p}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant dark:border-slate-700 text-on-surface-variant dark:text-slate-300 hover:bg-surface-container dark:hover:bg-slate-800 transition-colors disabled:opacity-30">
                        <span className="material-symbols-outlined">chevron_right</span>
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </>
          )}

          {activeTab === "dashboard" && (
            <>
              <div className="mb-xl">
                <h2 className="font-headline-md text-headline-md text-primary dark:text-slate-100">Panel General</h2>
                <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-xs">Resumen del estado de firmas de tu organización.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md mb-xl">
                {[
                  { label: "Total de Boletas", value: documents.length, icon: "description", color: "text-primary dark:text-slate-100" },
                  { label: "Firmadas", value: countSigned, icon: "check_circle", color: "text-emerald-600 dark:text-emerald-400" },
                  { label: "Pendientes", value: countPending, icon: "schedule", color: "text-amber-600 dark:text-amber-400" },
                  { label: "Tasa de Firma", value: `${signRate}%`, icon: "trending_up", color: "text-primary dark:text-sky-400" }
                ].map(card => (
                  <div key={card.label} className="bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-xl p-lg shadow-sm">
                    <div className="flex items-center justify-between mb-sm">
                      <span className={`material-symbols-outlined ${card.color}`}>{card.icon}</span>
                    </div>
                    <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                    <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-xs">{card.label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-xl p-xl shadow-sm">
                <h3 className="font-headline-sm text-headline-sm text-primary dark:text-slate-100 mb-md">Boletas más recientes</h3>
                <div className="space-y-sm">
                  {documents.slice(0, 4).map(doc => (
                    <div key={doc.id} className="flex items-start gap-md py-sm border-b border-outline-variant dark:border-slate-800 last:border-0">
                      <span className={`material-symbols-outlined text-[18px] mt-xs ${doc.status === "Signed" ? "text-emerald-500" : "text-amber-500"}`}>
                        {doc.status === "Signed" ? "check_circle" : "schedule"}
                      </span>
                      <div>
                        <p className="text-[13px] text-on-surface dark:text-slate-200">{doc.name} — {doc.payslipId}</p>
                        <p className="text-[11px] text-on-surface-variant dark:text-slate-400 mt-xs">{statusLabel(doc.status)} · {doc.date}</p>
                      </div>
                    </div>
                  ))}
                  {documents.length === 0 && (
                    <p className="text-[13px] text-on-surface-variant dark:text-slate-400">No hay boletas registradas todavía.</p>
                  )}
                </div>
                <button onClick={() => setActiveTab("batches")} className="mt-lg bg-primary dark:bg-sky-500 text-on-primary dark:text-slate-950 px-lg py-md rounded-lg font-body-md text-body-md hover:opacity-90 active:scale-95 transition-all">
                  Ir a Lotes de Boletas
                </button>
              </div>
            </>
          )}

          {activeTab === "employees" && (
            <>
              <div className="mb-xl flex flex-col sm:flex-row sm:items-end sm:justify-between gap-md">
                <div>
                  <h2 className="font-headline-md text-headline-md text-primary dark:text-slate-100">Empleados</h2>
                  <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-xs">Directorio de empleados y su historial de firmas.</p>
                </div>
                <div className="flex gap-md items-center">
                  <div className="flex items-center bg-surface-container dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-full px-md py-sm w-56">
                    <span className="material-symbols-outlined text-on-surface-variant dark:text-slate-400 mr-sm text-[18px]">search</span>
                    <input value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} className="bg-transparent border-none focus:outline-none focus:ring-0 text-body-md font-body-md w-full dark:text-slate-200" placeholder="Buscar empleado..." type="text" />
                  </div>
                  <button onClick={() => setShowEmployeeModal(true)} className="bg-primary dark:bg-sky-500 text-on-primary dark:text-slate-950 px-lg py-md rounded-lg font-body-md text-body-md hover:opacity-90 active:scale-95 transition-all flex items-center gap-sm shadow-sm">
                    <span className="material-symbols-outlined text-[20px]">person_add</span>
                    Agregar Empleado
                  </button>
                </div>
              </div>

              {/* Lista completa de empleados registrados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md mb-xl">
                {employees
                  .filter(emp =>
                    emp.full_name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
                    emp.email.toLowerCase().includes(employeeSearch.toLowerCase())
                  )
                  .map(emp => {
                    const stats = employeesList.find(e => e.email === emp.email);
                    return (
                      <div key={emp.email} className="bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-xl p-lg shadow-sm">
                        <div className="flex items-center gap-md mb-md">
                          <div className="w-11 h-11 rounded-full bg-secondary-container dark:bg-slate-700 text-on-secondary-container dark:text-slate-200 flex items-center justify-center font-bold">
                            {getInitials(emp.full_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-body-md text-body-md font-semibold text-primary dark:text-slate-200 truncate">{emp.full_name}</p>
                            <p className="text-[11px] text-outline dark:text-slate-400 truncate">{emp.email}</p>
                            <p className="text-[11px] text-outline dark:text-slate-400">{emp.employee_code}{emp.position ? ` · ${emp.position}` : ""}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex gap-md text-[12px]">
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{stats?.firmados ?? 0} firmadas</span>
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">{stats?.pendientes ?? 0} pendientes</span>
                          </div>
                          <Link
                            to={`/mis-boletas/${emp.employee_code}`}
                            className="text-[11px] font-semibold text-primary dark:text-sky-400 hover:underline flex items-center gap-xs shrink-0"
                          >
                            Ver portal
                            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                {employees.length === 0 && (
                  <p className="text-on-surface-variant dark:text-slate-400 col-span-full text-center py-xl">No hay empleados registrados todavía.</p>
                )}
              </div>
            </>
          )}

          {activeTab === "reports" && (
            <>
              <div className="mb-xl">
                <h2 className="font-headline-md text-headline-md text-primary dark:text-slate-100">Reportes</h2>
                <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-xs">Exporta el estado de firmas de todas las boletas de pago.</p>
              </div>
              <div className="bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-xl p-xl shadow-sm mb-xl">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-md">
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-primary dark:text-slate-100">Reporte de Boletas (CSV)</h3>
                    <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-xs">Incluye {documents.length} registros: nombre, correo, ID, estado y fecha de firma.</p>
                  </div>
                  <button onClick={handleExportCSV} className="bg-primary dark:bg-sky-500 text-on-primary dark:text-slate-950 px-lg py-md rounded-lg font-body-md text-body-md hover:opacity-90 active:scale-95 transition-all flex items-center gap-sm shadow-sm">
                    <span className="material-symbols-outlined text-[20px]">file_download</span>
                    Exportar CSV
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
                <div className="bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-xl p-lg shadow-sm text-center">
                  <p className="text-2xl font-bold text-primary dark:text-slate-100">{documents.length}</p>
                  <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-xs">Boletas totales</p>
                </div>
                <div className="bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-xl p-lg shadow-sm text-center">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{countSigned}</p>
                  <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-xs">Firmadas</p>
                </div>
                <div className="bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-xl p-lg shadow-sm text-center">
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{countPending}</p>
                  <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-xs">Pendientes</p>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Modal: Nueva Boleta */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99] flex items-center justify-center p-md">
          <div className="bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant dark:border-slate-800 w-full max-w-md rounded-xl p-xl shadow-xl">
            <div className="flex items-center justify-between mb-lg">
              <div className="flex items-center gap-sm text-primary dark:text-slate-100">
                <span className="material-symbols-outlined text-[24px]">post_add</span>
                <h3 className="font-headline-sm text-headline-sm font-bold">Nueva Boleta</h3>
              </div>
              <button onClick={() => setShowBatchModal(false)} className="material-symbols-outlined text-outline hover:text-primary transition-colors">close</button>
            </div>

            <form onSubmit={handleCreatePayslip} className="space-y-md">
              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-on-surface-variant dark:text-slate-300 mb-xs">Empleado *</label>
                <select
                  required
                  value={newPayslipEmail}
                  onChange={(e) => setNewPayslipEmail(e.target.value)}
                  className="w-full bg-surface-container dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-lg px-md py-sm font-body-md dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-sky-500/20 focus:border-primary dark:focus:border-sky-500"
                >
                  <option value="">Selecciona un empleado</option>
                  {employees.map((emp) => (
                    <option key={emp.email} value={emp.email}>{emp.full_name} ({emp.employee_code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-on-surface-variant dark:text-slate-300 mb-xs">ID de Boleta *</label>
                <input type="text" required value={newPayslipCode} onChange={(e) => setNewPayslipCode(e.target.value)} placeholder="ej. BP-2026-020" className="w-full bg-surface-container dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-lg px-md py-sm font-body-md dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-sky-500/20 focus:border-primary dark:focus:border-sky-500" />
              </div>

              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-on-surface-variant dark:text-slate-300 mb-xs">Período *</label>
                <input type="text" required value={newPayslipPeriod} onChange={(e) => setNewPayslipPeriod(e.target.value)} placeholder="ej. Diciembre 2026" className="w-full bg-surface-container dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-lg px-md py-sm font-body-md dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-sky-500/20 focus:border-primary dark:focus:border-sky-500" />
              </div>

              <div className="grid grid-cols-2 gap-md">
                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wider text-on-surface-variant dark:text-slate-300 mb-xs">Monto Neto (S/) *</label>
                  <input type="number" step="0.01" required value={newPayslipAmount} onChange={(e) => setNewPayslipAmount(e.target.value)} placeholder="2850.00" className="w-full bg-surface-container dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-lg px-md py-sm font-body-md dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-sky-500/20 focus:border-primary dark:focus:border-sky-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wider text-on-surface-variant dark:text-slate-300 mb-xs">Fecha de Emisión *</label>
                  <input type="date" required value={newPayslipIssueDate} onChange={(e) => setNewPayslipIssueDate(e.target.value)} className="w-full bg-surface-container dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-lg px-md py-sm font-body-md dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-sky-500/20 focus:border-primary dark:focus:border-sky-500" />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-on-surface-variant dark:text-slate-300 mb-xs">Estado</label>
                <select value={newPayslipStatus} onChange={(e) => setNewPayslipStatus(e.target.value as "pending" | "signed")} className="w-full bg-surface-container dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-lg px-md py-sm font-body-md dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-sky-500/20 focus:border-primary dark:focus:border-sky-500">
                  <option value="pending">Pendiente</option>
                  <option value="signed">Firmado</option>
                </select>
              </div>

              <div className="pt-md flex items-center justify-end gap-md">
                <button type="button" onClick={() => setShowBatchModal(false)} className="bg-surface dark:bg-slate-800 border border-outline-variant dark:border-slate-700 px-lg py-md rounded-lg font-body-md text-body-md text-primary dark:text-slate-200 hover:bg-surface-container dark:hover:bg-slate-700 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={creatingBatch} className="bg-primary dark:bg-sky-500 text-on-primary dark:text-slate-950 px-lg py-md rounded-lg font-body-md text-body-md hover:opacity-90 active:scale-95 transition-colors shadow-sm disabled:opacity-50">
                  {creatingBatch ? "Creando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Agregar Empleado */}
      {showEmployeeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99] flex items-center justify-center p-md">
          <div className="bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant dark:border-slate-800 w-full max-w-md rounded-xl p-xl shadow-xl">
            <div className="flex items-center justify-between mb-lg">
              <div className="flex items-center gap-sm text-primary dark:text-slate-100">
                <span className="material-symbols-outlined text-[24px]">person_add</span>
                <h3 className="font-headline-sm text-headline-sm font-bold">Agregar Empleado</h3>
              </div>
              <button onClick={() => setShowEmployeeModal(false)} className="material-symbols-outlined text-outline hover:text-primary transition-colors">close</button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-md">
              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-on-surface-variant dark:text-slate-300 mb-xs">Código de Empleado *</label>
                <input type="text" required value={newEmployeeCode} onChange={(e) => setNewEmployeeCode(e.target.value)} placeholder="ej. EMP-0150" className="w-full bg-surface-container dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-lg px-md py-sm font-body-md dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-sky-500/20 focus:border-primary dark:focus:border-sky-500" />
              </div>

              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-on-surface-variant dark:text-slate-300 mb-xs">Nombre completo *</label>
                <input type="text" required value={newEmployeeName} onChange={(e) => setNewEmployeeName(e.target.value)} placeholder="ej. María Fernanda Quispe" className="w-full bg-surface-container dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-lg px-md py-sm font-body-md dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-sky-500/20 focus:border-primary dark:focus:border-sky-500" />
              </div>

              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-on-surface-variant dark:text-slate-300 mb-xs">Correo Electrónico *</label>
                <input type="email" required value={newEmployeeEmail} onChange={(e) => setNewEmployeeEmail(e.target.value)} placeholder="ej. empleado@empresa.pe" className="w-full bg-surface-container dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-lg px-md py-sm font-body-md dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-sky-500/20 focus:border-primary dark:focus:border-sky-500" />
              </div>

              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-on-surface-variant dark:text-slate-300 mb-xs">Puesto</label>
                <input type="text" value={newEmployeePosition} onChange={(e) => setNewEmployeePosition(e.target.value)} placeholder="ej. Asistente Administrativo" className="w-full bg-surface-container dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-lg px-md py-sm font-body-md dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-sky-500/20 focus:border-primary dark:focus:border-sky-500" />
              </div>

              <div className="pt-md flex items-center justify-end gap-md">
                <button type="button" onClick={() => setShowEmployeeModal(false)} className="bg-surface dark:bg-slate-800 border border-outline-variant dark:border-slate-700 px-lg py-md rounded-lg font-body-md text-body-md text-primary dark:text-slate-200 hover:bg-surface-container dark:hover:bg-slate-700 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={creatingEmployee} className="bg-primary dark:bg-sky-500 text-on-primary dark:text-slate-950 px-lg py-md rounded-lg font-body-md text-body-md hover:opacity-90 active:scale-95 transition-colors shadow-sm disabled:opacity-50">
                  {creatingEmployee ? "Creando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Ayuda */}
      {helpOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99] flex items-center justify-center p-md">
          <div className="bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant dark:border-slate-800 w-full max-w-md rounded-xl p-xl shadow-xl">
            <div className="flex items-center justify-between mb-lg">
              <div className="flex items-center gap-sm text-primary dark:text-slate-100">
                <span className="material-symbols-outlined text-[24px]">help</span>
                <h3 className="font-headline-sm text-headline-sm font-bold">Ayuda</h3>
              </div>
              <button onClick={() => setHelpOpen(false)} className="material-symbols-outlined text-outline hover:text-primary transition-colors">close</button>
            </div>
            <div className="space-y-md">
              {[
                { q: "¿Cómo firmo una boleta?", a: "El empleado inicia sesión con su correo y contraseña, y firma directamente desde su boleta pendiente." },
                { q: "¿Cómo agrego un empleado nuevo?", a: "Ve a la pestaña Empleados y usa el botón 'Agregar Empleado'. El sistema genera una contraseña temporal para comunicarle." },
                { q: "¿Puedo exportar los datos?", a: "Sí, desde la pestaña Reportes puedes exportar un CSV con todos los registros." }
              ].map(item => (
                <div key={item.q}>
                  <p className="font-body-md text-body-md font-semibold text-primary dark:text-slate-200">{item.q}</p>
                  <p className="text-[13px] text-on-surface-variant dark:text-slate-400 mt-xs">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
