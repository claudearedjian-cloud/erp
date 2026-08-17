"use client";

import React, { useEffect, useState } from "react";
import { 
  ClipboardList, 
  Plus, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ChevronRight, 
  Layers, 
  Cpu, 
  User, 
  Calendar, 
  DollarSign,
  Search,
  ArrowUpRight,
  LayoutGrid,
  List,
  Sparkles,
  X,
  Trash2,
  Wrench
} from "lucide-react";

interface OrdersViewProps {
  orders: any[];
  loading: boolean;
  onSelectOrder: (orderId: number) => void;
  onRefresh: () => void;
  showNewModal: boolean;
  setShowNewModal: (val: boolean) => void;
  customers: any[];
  templates: any[];
  machines: any[];
  searchQuery?: string;
}

export default function OrdersView({
  orders = [],
  loading,
  onSelectOrder,
  onRefresh,
  showNewModal,
  setShowNewModal,
  customers = [],
  templates = [],
  machines = [],
  searchQuery = "",
}: OrdersViewProps) {
  const [viewMode, setViewMode] = useState<"kanban" | "list">("list");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  // Form State for new order
  const [customerId, setCustomerId] = useState(customers[0]?.id || "");
  const [title, setTitle] = useState("");
  const [projectType, setProjectType] = useState("Custom Kitchens");
  const [priority, setPriority] = useState("Normal");
  const [totalValue, setTotalValue] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState("");
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id || "");
  const [useCustomSteps, setCustomStepsMode] = useState(false);
  const [customSteps, setCustomSteps] = useState([
    { stepOrder: 1, operationName: "Precision Saw Cutting", estimatedMinutes: 60, machineId: machines[0]?.id || "" },
    { stepOrder: 2, operationName: "Edge Banding Treatment", estimatedMinutes: 90, machineId: machines[2]?.id || "" },
    { stepOrder: 3, operationName: "Assembly & QC", estimatedMinutes: 60, machineId: machines[machines.length - 1]?.id || "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!customerId && customers[0]?.id) setCustomerId(customers[0].id);
    if (!templateId && templates[0]?.id) setTemplateId(String(templates[0].id));
    if (machines.length > 0) {
      setCustomSteps(steps => steps.map((step, index) => {
        if (step.machineId) return step;
        const preferred = index === 0
          ? machines.find(machine => machine.category === "Panel Saw")
          : index === 1
            ? machines.find(machine => machine.category === "Edge Bander")
            : machines.find(machine => machine.category === "Assembly Table");
        return { ...step, machineId: preferred?.id || machines[0].id };
      }));
    }
  }, [customers, templates, machines, customerId, templateId]);

  // Filtered orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = !searchQuery || 
      order.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (order.customerCompany && order.customerCompany.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === "All" || order.status === statusFilter;
    const matchesPriority = priorityFilter === "All" || order.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !title) {
      setErrorMsg("Please select a customer and provide a project title.");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const payload: any = {
        customerId: Number(customerId),
        title,
        projectType,
        priority,
        totalValue: totalValue || "0.00",
        dueDate: new Date(dueDate),
        notes,
      };

      if (!useCustomSteps && templateId) {
        payload.templateId = Number(templateId);
      } else if (useCustomSteps && customSteps.length > 0) {
        payload.customSteps = customSteps;
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create order");
      }

      setShowNewModal(false);
      setTitle("");
      setTotalValue("");
      setNotes("");
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const addStep = () => {
    setCustomSteps([...customSteps, {
      stepOrder: customSteps.length + 1,
      operationName: "New Shop Floor Step",
      estimatedMinutes: 60,
      machineId: machines[0]?.id || ""
    }]);
  };

  const updateStep = (index: number, field: string, val: any) => {
    const copy = [...customSteps];
    copy[index] = { ...copy[index], [field]: val };
    setCustomSteps(copy);
  };

  const removeStep = (index: number) => {
    setCustomSteps(customSteps.filter((_, i) => i !== index));
  };

  const getPriorityBadge = (p: string) => {
    if (p === "Urgent") return "bg-rose-500/20 text-rose-300 border border-rose-500/30";
    if (p === "High") return "bg-amber-500/20 text-amber-300 border border-amber-500/30";
    return "bg-slate-800 text-slate-300 border border-slate-700";
  };

  const getStatusBadge = (s: string) => {
    if (s === "Completed") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    if (s === "In Production") return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    if (s === "Quality Review") return "bg-purple-500/20 text-purple-300 border-purple-500/30";
    if (s === "On Hold") return "bg-rose-500/20 text-rose-300 border-rose-500/30";
    return "bg-slate-800 text-slate-300 border-slate-700";
  };

  const kanbanColumns = [
    { title: "Pending Start", status: "Pending", color: "border-slate-600" },
    { title: "In Production", status: "In Production", color: "border-amber-500" },
    { title: "Quality Review", status: "Quality Review", color: "border-purple-500" },
    { title: "Completed & Ready", status: "Completed", color: "border-emerald-500" },
  ];

  if (loading) {
    return <div className="p-6 text-slate-400 animate-pulse">Loading manufacturing orders...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800/80 p-4 rounded-2xl shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-amber-500" /> Status:
          </span>
          {["All", "Pending", "In Production", "Quality Review", "Completed", "On Hold", "Cancelled"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                statusFilter === s
                  ? "bg-amber-500 text-slate-950 font-extrabold shadow-sm"
                  : "bg-slate-950/60 text-slate-300 hover:bg-slate-800 border border-slate-800"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Priority Toggle */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-950 text-slate-200 border border-slate-700 rounded-xl px-3 py-1 text-xs font-semibold focus:outline-none focus:border-amber-500"
          >
            <option value="All">Priority: All</option>
            <option value="Urgent">Priority: Urgent</option>
            <option value="High">Priority: High</option>
            <option value="Normal">Priority: Normal</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                viewMode === "list" ? "bg-slate-800 text-amber-400" : "text-slate-400 hover:text-white"
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                viewMode === "kanban" ? "bg-slate-800 text-amber-400" : "text-slate-400 hover:text-white"
              }`}
              title="Kanban Board"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredOrders.length === 0 ? (
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-12 text-center max-w-lg mx-auto my-12">
          <ClipboardList className="w-16 h-16 text-slate-600 mx-auto mb-4 stroke-[1.5]" />
          <h3 className="text-lg font-bold text-white mb-1">No Orders Matching Filter</h3>
          <p className="text-xs text-slate-400 mb-6">
            There are currently no manufacturing orders matching your criteria. Try resetting filters or create a new order to schedule operations.
          </p>
          <button
            onClick={() => { setStatusFilter("All"); setPriorityFilter("All"); setShowNewModal(true); }}
            className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg transition"
          >
            + Create Production Order
          </button>
        </div>
      ) : viewMode === "list" ? (
        /* LIST VIEW */
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              onClick={() => onSelectOrder(order.id)}
              className="bg-slate-900/90 hover:bg-slate-850 border border-slate-800/80 hover:border-amber-500/50 rounded-2xl p-5 shadow-sm transition-all duration-150 cursor-pointer group flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Left Order Info */}
              <div className="flex items-start md:items-center gap-4 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 flex items-center justify-center flex-shrink-0 font-mono font-black text-amber-400 text-xs shadow-inner">
                  {order.orderNumber.split("-")[2] || "ORD"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-black text-amber-400">{order.orderNumber}</span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${getStatusBadge(order.status)}`}>
                      {order.status}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${getPriorityBadge(order.priority)}`}>
                      {order.priority}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium hidden lg:inline-block">
                      • {order.projectType}
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-base truncate group-hover:text-amber-300 transition">
                    {order.title}
                  </h3>
                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                    <span className="font-semibold text-slate-300 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-500" /> {order.customerCompany || order.customerName}
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" /> Due: {new Date(order.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Center: Current Machine Station & Progress Bar */}
              <div className="w-full md:w-64 flex-shrink-0 flex flex-col justify-center">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-400 font-medium flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-blue-400" /> Station:
                  </span>
                  <span className="font-bold text-white truncate max-w-[140px]">
                    {order.currentStation ? order.currentStation.machineCode : "Scheduled"}
                  </span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      order.progressPercent === 100 ? "bg-emerald-500" : "bg-gradient-to-r from-amber-600 to-amber-400"
                    }`} 
                    style={{ width: `${order.progressPercent || 0}%` }} 
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mt-1">
                  <span>{order.completedSteps} of {order.totalSteps} ops done</span>
                  <span className={order.progressPercent === 100 ? "text-emerald-400 font-extrabold" : "text-amber-400"}>
                    {order.progressPercent || 0}%
                  </span>
                </div>
              </div>

              {/* Right Value & Arrow */}
              <div className="flex items-center justify-between md:justify-end gap-6 flex-shrink-0 border-t md:border-0 pt-3 md:pt-0 border-slate-800">
                <div className="text-right">
                  <div className="text-sm font-black text-white font-mono">
                    {order.totalValue != null ? `$${Number(order.totalValue).toLocaleString()}` : <span className="text-slate-600 italic text-[10px]">restricted</span>}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Total Value</div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-slate-800 group-hover:bg-amber-500 group-hover:text-slate-950 text-slate-400 flex items-center justify-center transition-all">
                  <ChevronRight className="w-5 h-5 stroke-[2.5]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* KANBAN BOARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-8">
          {kanbanColumns.map((col) => {
            const colOrders = filteredOrders.filter(o => o.status === col.status);
            return (
              <div key={col.status} className="flex flex-col bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5">
                <div className={`flex items-center justify-between pb-3 mb-3 border-b-2 ${col.color}`}>
                  <span className="font-extrabold text-sm text-white tracking-tight">{col.title}</span>
                  <span className="bg-slate-800 text-slate-200 text-xs font-mono font-bold px-2 py-0.5 rounded">
                    {colOrders.length}
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[680px] pr-1">
                  {colOrders.map(order => (
                    <div
                      key={order.id}
                      onClick={() => onSelectOrder(order.id)}
                      className="p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 rounded-xl transition cursor-pointer shadow-sm group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[11px] font-extrabold text-amber-400">{order.orderNumber}</span>
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${getPriorityBadge(order.priority)}`}>
                          {order.priority}
                        </span>
                      </div>
                      <h4 className="font-bold text-white text-sm line-clamp-2 group-hover:text-amber-300 transition mb-2">
                        {order.title}
                      </h4>
                      <div className="text-[11px] text-slate-400 font-semibold mb-3 truncate">
                        {order.customerCompany || order.customerName}
                      </div>
                      
                      {/* Station pill & progress */}
                      <div className="p-2 bg-slate-950/70 rounded-lg border border-slate-800/80 text-[11px] mb-2">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-500">Station:</span>
                          <span className="font-bold text-amber-400">{order.currentStation?.machineCode || "Ready"}</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
                          <div className="bg-amber-500 h-full rounded-full" style={{ width: `${order.progressPercent}%` }} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                        <span>Due {new Date(order.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        <span className="font-black text-white font-mono">{order.totalValue != null ? `$${Number(order.totalValue).toLocaleString()}` : "—"}</span>
                      </div>
                    </div>
                  ))}
                  {colOrders.length === 0 && (
                    <div className="py-12 text-center text-slate-600 text-xs font-medium italic">
                      No orders in {col.title}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE ORDER MODAL WITH TEMPLATE SWITCHER */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-8">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <span>New Production Order & Routing</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Define customer project details and choose a manufacturing machine flow.</p>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Customer Select */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Client / Architect *</label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company} ({c.name})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Project Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Project Category</label>
                  <select
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Custom Hospitality Furniture">Hospitality Furniture</option>
                    <option value="Custom Kitchens">Custom Kitchens & Pantry</option>
                    <option value="Wardrobe Fit-out">Wardrobe & Closet Fit-out</option>
                    <option value="Commercial Office & Retail">Commercial Office & Retail</option>
                    <option value="Precision Sizing & Banding Only">Express Trade Cutting & Banding</option>
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Project Title & Description *</label>
                <input
                  type="text"
                  placeholder="e.g. 24 Executive Mahogany Conference Tables & Paneling"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Priority */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Priority Level</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                {/* Total Value */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Total Quote Value ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 14500.00"
                    value={totalValue}
                    onChange={(e) => setTotalValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Target Due Date *</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              {/* WORKFLOW ROUTING SELECTION */}
              <div className="pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="block text-sm font-black text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-amber-500" />
                      <span>Machine Workflow & Operation Routing</span>
                    </label>
                    <p className="text-[11px] text-slate-400">Choose how this order travels across the machines in your service center.</p>
                  </div>
                  <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setCustomStepsMode(false)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${!useCustomSteps ? "bg-amber-600 text-white" : "text-slate-400 hover:text-white"}`}
                    >
                      Use Template
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomStepsMode(true)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${useCustomSteps ? "bg-amber-600 text-white" : "text-slate-400 hover:text-white"}`}
                    >
                      Custom Routing
                    </button>
                  </div>
                </div>

                {!useCustomSteps ? (
                  <div className="space-y-2.5">
                    {templates.map(tpl => (
                      <div
                        key={tpl.id}
                        onClick={() => setTemplateId(String(tpl.id))}
                        className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                          String(templateId) === String(tpl.id)
                            ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-950/30"
                            : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                          String(templateId) === String(tpl.id) ? "border-amber-500 bg-amber-500" : "border-slate-600"
                        }`}>
                          {String(templateId) === String(tpl.id) && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-white text-xs">{tpl.name}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{tpl.description}</div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {Array.isArray(tpl.defaultStepsJson) && tpl.defaultStepsJson.map((s: any, idx: number) => (
                              <React.Fragment key={idx}>
                                <span className="bg-slate-800 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-700">
                                  {s.stepOrder}. {s.operationName} ({s.estimatedMinutes}m)
                                </span>
                                {idx < tpl.defaultStepsJson.length - 1 && (
                                  <span className="text-slate-600 font-bold">→</span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                    <div className="text-[11px] text-slate-400 font-medium mb-2 flex items-center justify-between">
                      <span>Define step-by-step sequence through machines:</span>
                      <button
                        type="button"
                        onClick={addStep}
                        className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Operation Step
                      </button>
                    </div>
                    {customSteps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                        <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={step.operationName}
                          onChange={(e) => updateStep(idx, "operationName", e.target.value)}
                          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1 text-xs text-white"
                          placeholder="Operation Name"
                          required
                        />
                        <select
                          value={step.machineId}
                          onChange={(e) => updateStep(idx, "machineId", e.target.value)}
                          className="w-40 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white truncate"
                        >
                          <option value="">Any Machine Station</option>
                          {machines.map(m => (
                            <option key={m.id} value={m.id}>{m.code} ({m.name})</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={step.estimatedMinutes}
                          onChange={(e) => updateStep(idx, "estimatedMinutes", e.target.value)}
                          className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white text-center font-mono"
                          placeholder="Mins"
                          title="Estimated Minutes"
                        />
                        {customSteps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeStep(idx)}
                            className="text-slate-500 hover:text-rose-400 p-1 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-xs shadow-lg shadow-amber-600/30 transition disabled:opacity-50"
                >
                  {isSubmitting ? "Generating Schedule..." : "Schedule & Route Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
