"use client";

import React from "react";
import { 
  DollarSign, 
  Layers, 
  Cpu, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  TrendingUp, 
  ArrowRight, 
  Wrench, 
  Activity, 
  Flame, 
  User, 
  Zap 
} from "lucide-react";

interface DashboardViewProps {
  data: any;
  loading: boolean;
  onNavigate: (tab: string) => void;
}

export default function DashboardView({ data, loading, onNavigate }: DashboardViewProps) {
  if (loading || !data) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-800/50 rounded-2xl border border-slate-800" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-slate-800/50 rounded-2xl border border-slate-800" />
          <div className="h-80 bg-slate-800/50 rounded-2xl border border-slate-800" />
        </div>
      </div>
    );
  }

  const { kpis = {}, machineWorkloads = [], primaryBottleneck, lowStockItems = [], activeShopJobs = [], orderStatusDistribution = {} } = data;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Bottleneck Warning Banner */}
      {primaryBottleneck && primaryBottleneck.queueLength > 1 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-amber-950/20">
          <div className="flex items-start md:items-center gap-3.5">
            <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400">
              <Flame className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-base">Production Queue Alert</span>
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold uppercase">
                  Station {primaryBottleneck.code}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                <strong>{primaryBottleneck.name}</strong> currently has the highest workload with <strong className="text-amber-300">{primaryBottleneck.queueLength} operations queued ({primaryBottleneck.estimatedHours} est. hours)</strong>. Consider shifting jobs or adjusting operator focus.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate("machines")}
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold px-4 py-2 rounded-xl text-xs border border-slate-600 transition shadow-sm whitespace-nowrap"
          >
            <span>Inspect Machine Load</span>
            <ArrowRight className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      )}

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Orders */}
        <div 
          onClick={() => onNavigate("orders")}
          className="bg-slate-900/90 hover:bg-slate-800/80 border border-slate-800/80 rounded-2xl p-5 shadow-sm transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Production</span>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-white tracking-tight">{kpis.activeOrdersCount || 0}</div>
          <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-slate-400">
            <span className="text-emerald-400 font-bold flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" /> {kpis.urgentOrdersCount} urgent
            </span>
            <span>in shop pipeline</span>
          </div>
        </div>

        {/* Pipeline Value */}
        <div 
          onClick={() => onNavigate("orders")}
          className="bg-slate-900/90 hover:bg-slate-800/80 border border-slate-800/80 rounded-2xl p-5 shadow-sm transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">WIP Pipeline Value</span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-white tracking-tight">${Number(kpis.totalPipelineValue || 0).toLocaleString()}</div>
          <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-slate-400">
            <span>Across {kpis.customerCount} commercial clients</span>
          </div>
        </div>

        {/* Machine Utilization */}
        <div 
          onClick={() => onNavigate("machines")}
          className="bg-slate-900/90 hover:bg-slate-800/80 border border-slate-800/80 rounded-2xl p-5 shadow-sm transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Machine Utilization</span>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-white tracking-tight">{kpis.utilizationRate}%</div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-amber-500 h-full rounded-full" style={{ width: `${kpis.utilizationRate}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[11px] font-medium text-slate-400">
            <span>{kpis.inUseMachines} / {kpis.totalMachines} operational</span>
            {kpis.maintenanceMachines > 0 && (
              <span className="text-amber-400 font-bold">{kpis.maintenanceMachines} in maintenance</span>
            )}
          </div>
        </div>

        {/* Inventory Stock Alerts */}
        <div 
          onClick={() => onNavigate("inventory")}
          className="bg-slate-900/90 hover:bg-slate-800/80 border border-slate-800/80 rounded-2xl p-5 shadow-sm transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Material Warnings</span>
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 group-hover:bg-rose-500 group-hover:text-white transition">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-white tracking-tight">{kpis.inventoryAlertsCount || 0}</div>
          <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-slate-400">
            {kpis.inventoryAlertsCount > 0 ? (
              <span className="text-rose-400 font-bold flex items-center gap-1">
                At or below reorder threshold
              </span>
            ) : (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> All panels fully stocked
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Row: Live Manufacturing Stream & Machine Queue Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Active Shop Floor Feed */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <h3 className="font-bold text-white text-base tracking-tight">Live Shop Floor Operations Feed</h3>
            </div>
            <button
              onClick={() => onNavigate("station")}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
            >
              <span>Launch Touchscreen Station Mode</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {activeShopJobs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-12">
              <Clock className="w-12 h-12 mb-3 stroke-[1.5] text-slate-600" />
              <p className="text-sm font-medium">No operations currently active on machine floor.</p>
              <button
                onClick={() => onNavigate("orders")}
                className="mt-3 text-xs bg-amber-600/20 text-amber-400 font-bold px-4 py-2 rounded-lg border border-amber-500/30 hover:bg-amber-600 hover:text-white transition"
              >
                Schedule Orders Now
              </button>
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              {activeShopJobs.map((job: any) => {
                const isRunning = job.status === "In Progress";
                return (
                  <div 
                    key={job.id} 
                    onClick={() => onNavigate(`order-${job.orderId}`)}
                    className="p-3.5 bg-slate-950/70 hover:bg-slate-800/60 border border-slate-800 hover:border-amber-500/40 rounded-xl transition cursor-pointer flex items-center justify-between gap-4 group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`p-2.5 rounded-xl border flex-shrink-0 ${
                        isRunning 
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-400" 
                          : "bg-slate-800/80 border-slate-700 text-slate-300"
                      }`}>
                        <Activity className={`w-5 h-5 ${isRunning ? "animate-spin" : ""}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-white text-sm truncate group-hover:text-amber-400 transition">
                            {job.operationName}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-extrabold uppercase tracking-wider ${
                            isRunning ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-300 border border-slate-700"
                          }`}>
                            {job.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 truncate mt-1 flex items-center gap-2">
                          <span className="font-mono text-slate-300 font-bold">{job.orderNumber}</span>
                          <span>•</span>
                          <span className="truncate">{job.orderTitle}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 hidden sm:block">
                      <div className="text-xs font-extrabold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20 inline-block">
                        {job.machineCode || "Any Machine"}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium mt-1 flex items-center justify-end gap-1">
                        <User className="w-3 h-3 text-slate-500" /> 
                        <span>{job.operatorName || "Shop Operator"} ({job.estimatedMinutes} min)</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Machine Status Summary & Queue */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
            <h3 className="font-bold text-white text-base tracking-tight flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-400" />
              <span>Machine Stations</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">{machineWorkloads.length} total units</span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
            {machineWorkloads.map((m: any) => {
              const inUse = m.status === "In-Use" || m.status === "Active" && m.queueLength > 0;
              const isMaintenance = m.status === "Maintenance";
              
              return (
                <div 
                  key={m.machineId}
                  onClick={() => onNavigate("machines")}
                  className="p-3 bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/80 rounded-xl transition cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-extrabold text-amber-400">{m.code}</span>
                      <span className="font-semibold text-slate-200 text-xs truncate">{m.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold uppercase ${
                        isMaintenance ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" : 
                        inUse ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : 
                        "bg-slate-800 text-slate-400"
                      }`}>
                        {m.status}
                      </span>
                      <span className="text-[11px] text-slate-500">${m.hourlyCost}/hr</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-white">
                      {m.queueLength} {m.queueLength === 1 ? "job" : "jobs"}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {m.estimatedHours} hrs est.
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
