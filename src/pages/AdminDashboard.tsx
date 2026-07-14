import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

import { EMAIL_TO_EMPLOYEE_CODE } from "../mocks/employeeCodeMap";

interface DocumentItem {
  id: string;
  name: string;
  avatar?: string;
  payslipId: string;
  status: "Signed" | "Pending";
  date: string;
  email: string;
}

interface NotificationItem {
  id: string;
  message: string;
  time: string;
  read: boolean;
}

const DEFAULT_DOCUMENTS: DocumentItem[] = [
  { id: "1", name: "María Fernanda Quispe", avatar: "", payslipId: "BP-2026-001", status: "Signed", date: "10 jul 2026", email: "maria.quispe@empresa.pe" },
  { id: "2", name: "Carlos Alberto Torres", avatar: "", payslipId: "BP-2026-002", status: "Pending", date: "—", email: "carlos.torres@empresa.pe" },
  { id: "3", name: "Ana Lucía Vargas", avatar: "", payslipId: "BP-2026-003", status: "Signed", date: "09 jul 2026", email: "ana.vargas@empresa.pe" },
  { id: "4", name: "Jorge Luis Mamani", avatar: "", payslipId: "BP-2026-004", status: "Pending", date: "—", email: "jorge.mamani@empresa.pe" },
  { id: "5", name: "Patricia Rojas Salazar", payslipId: "BP-2026-005", status: "Signed", date: "08 jul 2026", email: "patricia.rojas@empresa.pe" },
  { id: "6", name: "Miguel Ángel Flores", payslipId: "BP-2026-006", status: "Pending", date: "—", email: "miguel.flores@empresa.pe" },
  { id: "7", name: "Lucía Fernanda Castillo", payslipId: "BP-2026-007", status: "Signed", date: "07 jul 2026", email: "lucia.castillo@empresa.pe" },
  { id: "8", name: "Diego Alonso Huamán", payslipId: "BP-2026-008", status: "Pending", date: "—", email: "diego.huaman@empresa.pe" }
];

const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  { id: "1", message: "María Fernanda Quispe firmó su boleta BP-2026-001.", time: "Hace 5 min", read: false },
  { id: "2", message: "3 boletas llevan más de 5 días pendientes de firma.", time: "Hace 2 h", read: false },
  { id: "3", message: "Se creó un nuevo lote de boletas de pago.", time: "Ayer", read: true },
  { id: "4", message: "Ana Lucía Vargas firmó su boleta BP-2026-003.", time: "Hace 2 días", read: true }
];

const statusLabel = (status: "Signed" | "Pending") => (status === "Signed" ? "Firmado" : "Pendiente");

function AdminDashboard() {
  const [documents, setDocuments] = useState<DocumentItem[]>(DEFAULT_DOCUMENTS);
  const [activeTab, setActiveTab] = useState<"dashboard" | "batches" | "employees" | "reports" | "settings">("batches");
  const [filterTab, setFilterTab] = useState<"all" | "pending" | "signed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Modal de creación (se reutiliza para "Nuevo Lote" y "Nuevo Empleado")
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [modalContext, setModalContext] = useState<"batch" | "employee">("batch");
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newPayslipId, setNewPayslipId] = useState("");
  const [newEmployeeEmail, setNewEmployeeEmail] = useState("");
  const [newEmployeeStatus, setNewEmployeeStatus] = useState<"Signed" | "Pending">("Pending");
  const [draggedFile, setDraggedFile] = useState<File | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" } | null>(null);

  // Notificaciones
  const [notifications, setNotifications] = useState<NotificationItem[]>(DEFAULT_NOTIFICATIONS);
  const [notifOpen, setNotifOpen] = useState(false);

  // Ayuda
  const [helpOpen, setHelpOpen] = useState(false);

  // Filtro de orden y mes (tabla de Lotes)
  const [sortOrder, setSortOrder] = useState<"recent" | "name-asc" | "name-desc">("recent");
  const [sortOpen, setSortOpen] = useState(false);
  const [monthFilter, setMonthFilter] = useState<string>("Todos los meses");
  const [monthOpen, setMonthOpen] = useState(false);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Búsqueda propia de la pestaña Empleados
  const [employeeSearch, setEmployeeSearch] = useState("");

  // Configuración
  const [autoReminder, setAutoReminder] = useState(true);
  const [emailNotify, setEmailNotify] = useState(true);
  const [senderEmail, setSenderEmail] = useState("notificaciones@firmadigital.pe");

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

  const handleSendReminder = (name: string, email: string) => {
    setToast({ message: `Recordatorio de firma enviado a ${name} (${email}).`, type: "success" });
  };

  const handleDownload = (payslipId: string) => {
    setToast({ message: `Descargando documento ${payslipId}.pdf...`, type: "info" });
    const element = document.createElement("a");
    const file = new Blob([`Contenido simulado de la boleta ${payslipId}`], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${payslipId}.pdf`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const openBatchModal = () => {
    setModalContext("batch");
    setShowRecordModal(true);
  };

  const openEmployeeModal = () => {
    setModalContext("employee");
    setShowRecordModal(true);
  };

  const handleCreateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployeeName || !newEmployeeEmail) {
      setToast({ message: "Completa los campos obligatorios.", type: "info" });
      return;
    }

    const nextId = (documents.length + 1).toString();
    const pid = newPayslipId || `BP-2026-${String(documents.length + 1).padStart(3, "0")}`;
    const todayStr = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });

    const newDoc: DocumentItem = {
      id: nextId,
      name: newEmployeeName,
      payslipId: pid,
      status: modalContext === "employee" ? "Pending" : newEmployeeStatus,
      date: modalContext !== "employee" && newEmployeeStatus === "Signed" ? todayStr : "—",
      email: newEmployeeEmail
    };

    setDocuments([newDoc, ...documents]);
    setShowRecordModal(false);
    setDraggedFile(null);
    setNewEmployeeName("");
    setNewPayslipId("");
    setNewEmployeeEmail("");
    setNewEmployeeStatus("Pending");

    setToast({
      message: modalContext === "employee"
        ? `Empleado ${newEmployeeName} agregado correctamente.`
        : `Registro de firma creado para ${newEmployeeName}.`,
      type: "success"
    });
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type !== "application/pdf") {
        setToast({ message: "Solo se admiten archivos PDF.", type: "info" });
        return;
      }
      setDraggedFile(file);
      const nameGuess = file.name.replace(".pdf", "").replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      setNewEmployeeName(nameGuess);
      setNewEmployeeEmail(`${nameGuess.toLowerCase().replace(/\s+/g, ".")}@empresa.pe`);
      setNewPayslipId(`BP-2026-${String(documents.length + 1).padStart(3, "0")}`);
      setModalContext("batch");
      setShowRecordModal(true);
      setToast({ message: "PDF cargado. Revisa los datos del empleado.", type: "success" });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setDraggedFile(file);
      const nameGuess = file.name.replace(".pdf", "").replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      setNewEmployeeName(nameGuess);
      setNewEmployeeEmail(`${nameGuess.toLowerCase().replace(/\s+/g, ".")}@empresa.pe`);
      setNewPayslipId(`BP-2026-${String(documents.length + 1).padStart(3, "0")}`);
      setModalContext("batch");
      setShowRecordModal(true);
    }
  };

  const uniqueMonths = Array.from(
    new Set(documents.filter(d => d.date !== "—").map(d => d.date.split(" ").slice(1).join(" ")))
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

  const countPending = documents.filter(d => d.status === "Pending").length;
  const countSigned = documents.filter(d => d.status === "Signed").length;
  const signRate = documents.length ? Math.round((countSigned / documents.length) * 100) : 0;
  const unreadCount = notifications.filter(n => !n.read).length;

  const employeesList = Object.values(
    documents.reduce((acc, doc) => {
      if (!acc[doc.email]) {
        acc[doc.email] = { name: doc.name, email: doc.email, avatar: doc.avatar, total: 0, firmados: 0, pendientes: 0 };
      }
      acc[doc.email].total += 1;
      if (doc.status === "Signed") acc[doc.email].firmados += 1;
      else acc[doc.email].pendientes += 1;
      return acc;
    }, {} as Record<string, { name: string; email: string; avatar?: string; total: number; firmados: number; pendientes: number }>)
  ).filter(emp =>
    emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    emp.email.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  const handleExportCSV = () => {
    const header = "Nombre,Correo,ID de Boleta,Estado,Fecha de Firma\n";
    const rows = documents.map(d => `${d.name},${d.email},${d.payslipId},${statusLabel(d.status)},${d.date}`).join("\n");
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

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setToast({ message: "Configuración guardada correctamente.", type: "success" });
  };

  const markAllNotificationsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const toggleNotificationRead = (id: string) => {
    setNotifications(notifications.map(n => (n.id === id ? { ...n, read: true } : n)));
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDarkMode ? "dark bg-slate-950 text-slate-100" : "bg-background text-on-surface"}`}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-[100] max-w-sm rounded-lg shadow-lg border border-outline-variant p-md flex items-start gap-md bg-surface-container-lowest dark:bg-slate-900">
          <span className={`material-symbols-outlined ${toast.type === "success" ? "text-emerald-500" : "text-sky-500"}`}>
            {toast.type === "success" ? "check_circle" : "info"}
          </span>
          <div className="flex-1">
            <p className="font-body-md text-body-md font-semibold text-primary dark:text-slate-200">
              {toast.type === "success" ? "Listo" : "Aviso"}
            </p>
            <p className="font-body-md text-[13px] text-on-surface-variant dark:text-slate-400 mt-xs leading-normal">{toast.message}</p>
          </div>
          <button onClick={() => setToast(null)} className="material-symbols-outlined text-[18px] text-outline hover:text-primary transition-colors">close</button>
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
          <div className="mt-auto pt-xl">
            <div
              onClick={() => { setActiveTab("settings"); setSidebarOpen(false); }}
              className={`flex items-center gap-md py-md px-md rounded-lg transition-colors cursor-pointer active:scale-95 ${activeTab === "settings" ? "text-primary dark:text-slate-100 font-bold border-r-2 border-primary bg-surface-container-low dark:bg-slate-800" : "text-on-surface-variant dark:text-slate-400 hover:bg-surface-container-low dark:hover:bg-slate-800"}`}
            >
              <span className="material-symbols-outlined">settings</span>
              <span className="font-body-md text-body-md">Configuración</span>
            </div>
          </div>
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

          {/* Notificaciones */}
          <div className="relative">
            <button
              onClick={() => { setNotifOpen(!notifOpen); setHelpOpen(false); }}
              className="material-symbols-outlined text-on-surface-variant dark:text-slate-300 hover:text-primary dark:hover:text-slate-100 transition-all relative"
            >
              notifications
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-error text-white text-[9px] flex items-center justify-center font-bold">{unreadCount}</span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-sm w-80 bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-md py-sm border-b border-outline-variant dark:border-slate-800">
                  <p className="font-body-md text-body-md font-semibold text-primary dark:text-slate-100">Notificaciones</p>
                  <button onClick={markAllNotificationsRead} className="text-[11px] font-semibold text-primary dark:text-sky-400 hover:underline">Marcar todo leído</button>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => toggleNotificationRead(n.id)}
                      className={`px-md py-sm border-b border-outline-variant dark:border-slate-800 cursor-pointer hover:bg-surface-container-low dark:hover:bg-slate-800 ${!n.read ? "bg-primary-container/10 dark:bg-sky-950/20" : ""}`}
                    >
                      <p className="text-[13px] text-on-surface dark:text-slate-200">{n.message}</p>
                      <p className="text-[11px] text-on-surface-variant dark:text-slate-400 mt-xs">{n.time}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Vista previa del portal del empleado (solo para desarrollo/demo) */}
          <Link
            to="/mis-boletas/EMP-0142"
            className="material-symbols-outlined text-on-surface-variant dark:text-slate-300 hover:text-primary dark:hover:text-slate-100 transition-all"
            title="Vista previa: Mis Boletas (empleado)"
          >
            visibility
          </Link>

          {/* Ayuda */}
          <button
            onClick={() => { setHelpOpen(true); setNotifOpen(false); }}
            className="material-symbols-outlined text-on-surface-variant dark:text-slate-300 hover:text-primary dark:hover:text-slate-100 transition-all"
          >
            help
          </button>

          <div className="h-8 w-[1px] bg-outline-variant dark:bg-slate-700 hidden sm:block"></div>

          <div className="flex items-center gap-sm">
            <div className="w-10 h-10 rounded-full bg-surface-container-highest dark:bg-slate-800 overflow-hidden border border-outline-variant dark:border-slate-700 flex items-center justify-center">
              <span className="text-[13px] font-bold text-primary dark:text-slate-200">GF</span>
            </div>
            <div className="hidden lg:block">
              <p className="font-body-md text-body-md font-semibold text-primary dark:text-slate-200">Gonzalo Farfan</p>
              <p className="text-[10px] uppercase font-bold text-on-surface-variant dark:text-slate-400 tracking-tighter">Administrador</p>
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
                    onClick={openBatchModal}
                    className="bg-primary dark:bg-sky-500 text-on-primary dark:text-slate-950 px-lg py-md rounded-lg font-body-md text-body-md hover:opacity-90 active:scale-95 transition-all flex items-center gap-sm shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Nuevo Lote
                  </button>
                </div>
              </div>

              <section className="mb-xl">
                <div className="bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-xl p-xl shadow-sm">
                  <div className="flex flex-col lg:flex-row gap-xl items-center">
                    <div className="w-full lg:w-1/3 space-y-md">
                      <div className="w-16 h-16 bg-primary-container dark:bg-sky-950 text-on-primary-container dark:text-sky-300 rounded-2xl flex items-center justify-center shadow-inner">
                        <span className="material-symbols-outlined text-[32px]">upload_file</span>
                      </div>
                      <div>
                        <h3 className="font-headline-sm text-headline-sm text-primary dark:text-slate-100">Carga Rápida</h3>
                        <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400">Procesa boletas por lote arrastrando tu PDF generado aquí.</p>
                      </div>
                      <div className="flex flex-wrap gap-sm">
                        <span className="px-md py-xs bg-surface-container dark:bg-slate-800 rounded-full text-label-md font-label-md text-on-surface-variant dark:text-slate-300">Solo PDF</span>
                        <span className="px-md py-xs bg-surface-container dark:bg-slate-800 rounded-full text-label-md font-label-md text-on-surface-variant dark:text-slate-300">Máx 25MB</span>
                      </div>
                    </div>

                    <div className="w-full lg:w-2/3">
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`custom-dashed h-48 rounded-xl flex flex-col items-center justify-center gap-md group cursor-pointer transition-colors relative ${isDragging ? "bg-primary-container/20 dark:bg-sky-950/20 border-primary" : "hover:bg-surface-container-low dark:hover:bg-slate-800"}`}
                      >
                        <input type="file" accept=".pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <span className="material-symbols-outlined text-[48px] text-outline opacity-40 group-hover:scale-110 group-hover:opacity-60 transition-transform">picture_as_pdf</span>
                        <div className="text-center pointer-events-none">
                          <p className="font-body-lg text-body-lg text-primary dark:text-slate-200 font-medium">Arrastra y suelta el PDF</p>
                          <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mb-md">o haz clic para buscar en tus archivos</p>
                          <button className="bg-primary dark:bg-sky-500 text-on-primary dark:text-slate-950 px-xl py-sm rounded-lg font-body-md text-body-md pointer-events-auto hover:opacity-90 active:scale-95 transition-all">Buscar Archivos</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

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
                              {doc.status === "Signed" ? (
                                <button onClick={() => handleDownload(doc.payslipId)} className="material-symbols-outlined text-primary dark:text-sky-400 hover:bg-surface-container dark:hover:bg-slate-800 rounded-lg p-sm transition-all text-[20px] active:scale-90" title="Descargar boleta">
                                  download
                                </button>
                              ) : (
                                <button onClick={() => handleSendReminder(doc.name, doc.email)} className="bg-surface dark:bg-slate-800 border border-outline-variant dark:border-slate-700 px-md py-sm rounded-lg text-label-md font-semibold text-primary dark:text-slate-200 hover:bg-surface-container dark:hover:bg-slate-700 transition-all active:scale-95 shadow-sm">
                                  Enviar Recordatorio
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-xl py-xl text-center text-on-surface-variant dark:text-slate-400">
                            No se encontraron documentos para "{searchQuery}"
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="px-xl py-lg bg-surface dark:bg-slate-900/80 border-t border-outline-variant dark:border-slate-800 flex flex-col sm:flex-row gap-md items-center justify-between">
                  <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400">
                    Mostrando {filteredDocuments.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredDocuments.length)} de {filteredDocuments.length} documentos
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
                <h3 className="font-headline-sm text-headline-sm text-primary dark:text-slate-100 mb-md">Actividad Reciente</h3>
                <div className="space-y-sm">
                  {notifications.slice(0, 4).map(n => (
                    <div key={n.id} className="flex items-start gap-md py-sm border-b border-outline-variant dark:border-slate-800 last:border-0">
                      <span className="material-symbols-outlined text-primary dark:text-sky-400 text-[18px] mt-xs">notifications</span>
                      <div>
                        <p className="text-[13px] text-on-surface dark:text-slate-200">{n.message}</p>
                        <p className="text-[11px] text-on-surface-variant dark:text-slate-400 mt-xs">{n.time}</p>
                      </div>
                    </div>
                  ))}
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
                  <button onClick={openEmployeeModal} className="bg-primary dark:bg-sky-500 text-on-primary dark:text-slate-950 px-lg py-md rounded-lg font-body-md text-body-md hover:opacity-90 active:scale-95 transition-all flex items-center gap-sm shadow-sm">
                    <span className="material-symbols-outlined text-[20px]">person_add</span>
                    Agregar Empleado
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
                {employeesList.map(emp => {
                  const employeeCode = EMAIL_TO_EMPLOYEE_CODE[emp.email];
                  return (
                    <div key={emp.email} className="bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-xl p-lg shadow-sm">
                      <div className="flex items-center gap-md mb-md">
                        <div className="w-11 h-11 rounded-full bg-secondary-container dark:bg-slate-700 text-on-secondary-container dark:text-slate-200 flex items-center justify-center font-bold">
                          {getInitials(emp.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-body-md text-body-md font-semibold text-primary dark:text-slate-200 truncate">{emp.name}</p>
                          <p className="text-[11px] text-outline dark:text-slate-400 truncate">{emp.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-md text-[12px]">
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{emp.firmados} firmadas</span>
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">{emp.pendientes} pendientes</span>
                        </div>
                        {employeeCode && (
                          <Link
                            to={`/mis-boletas/${employeeCode}`}
                            className="text-[11px] font-semibold text-primary dark:text-sky-400 hover:underline flex items-center gap-xs shrink-0"
                            title="Ver portal del empleado"
                          >
                            Ver portal
                            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
                {employeesList.length === 0 && (
                  <p className="text-on-surface-variant dark:text-slate-400 col-span-full text-center py-xl">No se encontraron empleados.</p>
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

          {activeTab === "settings" && (
            <>
              <div className="mb-xl">
                <h2 className="font-headline-md text-headline-md text-primary dark:text-slate-100">Configuración</h2>
                <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-xs">Ajusta las preferencias de notificación y del portal.</p>
              </div>
              <form onSubmit={handleSaveSettings} className="bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-xl p-xl shadow-sm max-w-lg space-y-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-body-md text-body-md font-semibold text-primary dark:text-slate-200">Modo oscuro</p>
                    <p className="text-[12px] text-on-surface-variant dark:text-slate-400">Cambia la apariencia del portal.</p>
                  </div>
                  <button type="button" onClick={() => setIsDarkMode(!isDarkMode)} className={`w-12 h-7 rounded-full transition-colors relative ${isDarkMode ? "bg-primary dark:bg-sky-500" : "bg-surface-container-high dark:bg-slate-700"}`}>
                    <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${isDarkMode ? "left-6" : "left-1"}`}></span>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-body-md text-body-md font-semibold text-primary dark:text-slate-200">Recordatorios automáticos</p>
                    <p className="text-[12px] text-on-surface-variant dark:text-slate-400">Enviar recordatorio si una boleta lleva 5+ días pendiente.</p>
                  </div>
                  <button type="button" onClick={() => setAutoReminder(!autoReminder)} className={`w-12 h-7 rounded-full transition-colors relative ${autoReminder ? "bg-primary dark:bg-sky-500" : "bg-surface-container-high dark:bg-slate-700"}`}>
                    <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${autoReminder ? "left-6" : "left-1"}`}></span>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-body-md text-body-md font-semibold text-primary dark:text-slate-200">Notificarme por correo</p>
                    <p className="text-[12px] text-on-surface-variant dark:text-slate-400">Recibe un aviso cada vez que un empleado firma.</p>
                  </div>
                  <button type="button" onClick={() => setEmailNotify(!emailNotify)} className={`w-12 h-7 rounded-full transition-colors relative ${emailNotify ? "bg-primary dark:bg-sky-500" : "bg-surface-container-high dark:bg-slate-700"}`}>
                    <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${emailNotify ? "left-6" : "left-1"}`}></span>
                  </button>
                </div>

                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wider text-on-surface-variant dark:text-slate-300 mb-xs">Correo remitente</label>
                  <input type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} className="w-full bg-surface-container dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-lg px-md py-sm font-body-md dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-sky-500/20 focus:border-primary dark:focus:border-sky-500" />
                </div>

                <div className="pt-md flex justify-end">
                  <button type="submit" className="bg-primary dark:bg-sky-500 text-on-primary dark:text-slate-950 px-lg py-md rounded-lg font-body-md text-body-md hover:opacity-90 active:scale-95 transition-colors shadow-sm">
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </main>

      {/* Modal de creación (Lote / Empleado) */}
      {showRecordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99] flex items-center justify-center p-md">
          <div className="bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant dark:border-slate-800 w-full max-w-md rounded-xl p-xl shadow-xl">
            <div className="flex items-center justify-between mb-lg">
              <div className="flex items-center gap-sm text-primary dark:text-slate-100">
                <span className="material-symbols-outlined text-[24px]">{modalContext === "employee" ? "person_add" : "post_add"}</span>
                <h3 className="font-headline-sm text-headline-sm font-bold">{modalContext === "employee" ? "Agregar Empleado" : "Crear Registro de Firma"}</h3>
              </div>
              <button onClick={() => setShowRecordModal(false)} className="material-symbols-outlined text-outline hover:text-primary transition-colors">close</button>
            </div>

            <form onSubmit={handleCreateRecord} className="space-y-md">
              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-on-surface-variant dark:text-slate-300 mb-xs">Nombre del Empleado *</label>
                <input type="text" required value={newEmployeeName} onChange={(e) => setNewEmployeeName(e.target.value)} placeholder="ej. María Fernanda Quispe" className="w-full bg-surface-container dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-lg px-md py-sm font-body-md dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-sky-500/20 focus:border-primary dark:focus:border-sky-500" />
              </div>

              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-on-surface-variant dark:text-slate-300 mb-xs">Correo Electrónico *</label>
                <input type="email" required value={newEmployeeEmail} onChange={(e) => setNewEmployeeEmail(e.target.value)} placeholder="ej. empleado@empresa.pe" className="w-full bg-surface-container dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-lg px-md py-sm font-body-md dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-sky-500/20 focus:border-primary dark:focus:border-sky-500" />
              </div>

              {modalContext === "batch" && (
                <div className="grid grid-cols-2 gap-md">
                  <div>
                    <label className="block text-[12px] font-bold uppercase tracking-wider text-on-surface-variant dark:text-slate-300 mb-xs">ID de Boleta</label>
                    <input type="text" value={newPayslipId} onChange={(e) => setNewPayslipId(e.target.value)} placeholder={`ej. BP-2026-${String(documents.length + 1).padStart(3, "0")}`} className="w-full bg-surface-container dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-lg px-md py-sm font-body-md dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-sky-500/20 focus:border-primary dark:focus:border-sky-500" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold uppercase tracking-wider text-on-surface-variant dark:text-slate-300 mb-xs">Estado</label>
                    <select value={newEmployeeStatus} onChange={(e) => setNewEmployeeStatus(e.target.value as "Signed" | "Pending")} className="w-full bg-surface-container dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-lg px-md py-sm font-body-md dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-sky-500/20 focus:border-primary dark:focus:border-sky-500">
                      <option value="Pending">Pendiente</option>
                      <option value="Signed">Firmado</option>
                    </select>
                  </div>
                </div>
              )}

              {draggedFile && (
                <div className="p-sm bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-lg flex items-center gap-sm">
                  <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">picture_as_pdf</span>
                  <div className="overflow-hidden">
                    <p className="text-[12px] font-bold text-emerald-800 dark:text-emerald-400 truncate">{draggedFile.name}</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-500">{(draggedFile.size / 1024).toFixed(1)} KB • Listo para subir</p>
                  </div>
                </div>
              )}

              <div className="pt-md flex items-center justify-end gap-md">
                <button type="button" onClick={() => setShowRecordModal(false)} className="bg-surface dark:bg-slate-800 border border-outline-variant dark:border-slate-700 px-lg py-md rounded-lg font-body-md text-body-md text-primary dark:text-slate-200 hover:bg-surface-container dark:hover:bg-slate-700 transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="bg-primary dark:bg-sky-500 text-on-primary dark:text-slate-950 px-lg py-md rounded-lg font-body-md text-body-md hover:opacity-90 active:scale-95 transition-colors shadow-sm">
                  Guardar
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
                { q: "¿Cómo firmo una boleta?", a: "El empleado recibe un enlace por correo y firma directamente desde su boleta pendiente." },
                { q: "¿Qué pasa si un empleado no firma?", a: "Puedes enviarle un recordatorio manual o activar los recordatorios automáticos en Configuración." },
                { q: "¿Puedo exportar los datos?", a: "Sí, desde la pestaña Reportes puedes exportar un CSV con todos los registros." }
              ].map(item => (
                <div key={item.q}>
                  <p className="font-body-md text-body-md font-semibold text-primary dark:text-slate-200">{item.q}</p>
                  <p className="text-[13px] text-on-surface-variant dark:text-slate-400 mt-xs">{item.a}</p>
                </div>
              ))}
              <a href="mailto:soporte@firmadigital.pe" className="inline-flex items-center gap-sm text-primary dark:text-sky-400 font-semibold text-[13px] hover:underline pt-sm">
                <span className="material-symbols-outlined text-[18px]">mail</span>
                Escribir a soporte@firmadigital.pe
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
