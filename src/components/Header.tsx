"use client";

import React, { useState, useEffect } from "react";
import { Search, Plus, ShieldAlert, Menu, LockKeyhole, UserRoundCog, Power } from "lucide-react";

interface HeaderProps {
  activeTab: string;
  onNewOrder: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  currentUser: any;
  bottleneckCount: number;
  lowStockCount: number;
  onOpenMenu: () => void;
  onSwitchProfile: () => void;
  onLock: () => void;
  onExit: () => void;
  canCreateOrder: boolean;
}

export default function Header({
  activeTab,
  onNewOrder,
  searchQuery,
  setSearchQuery,
  currentUser,
  bottleneckCount,
  lowStockCount,
  onOpenMenu,
  onSwitchProfile,
  onLock,
  onExit,
  canCreateOrder,
}: HeaderProps) {
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getTitle = () => {
    if (activeTab === "dashboard") return "Executive Control & Shop Analytics";
    if (activeTab === "orders") return "Order Workflow Routing & Operations";
    if (activeTab === "schedule") return "Dispatch Schedule & Machine Capacity";
    if (activeTab.startsWith("order-")) return "Order Manufacturing Workflow Detail";
    if (activeTab === "machines") return "Shop Floor Equipment Monitor";
    if (activeTab === "station") return "Operator Touchscreen Mode";
    if (activeTab === "customers") return "Client Accounts & Projects";
    if (activeTab === "inventory") return "Raw Panels & Edge Stock";
    if (activeTab === "gantt") return "Production Gantt Chart";
    if (activeTab === "cmms") return "Plant Asset Analytics & CMMS";
    if (activeTab === "reports") return "System Report Generator";
    if (activeTab === "settings") return "General Settings & Configuration";
    return "WoodTek ERP Platform";
  };

  return (
    <header className="min-h-16 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-3 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm gap-3">
      {/* Title & Status */}
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onOpenMenu} className="md:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-200" aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="text-sm sm:text-lg font-bold text-white tracking-tight flex items-center gap-2.5 truncate">
          <span className="truncate">{getTitle()}</span>
        </h2>

        {/* Real-time status indicator */}
        <div className="hidden md:flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 rounded-full px-3 py-1 text-xs text-slate-300 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Shop Floor Live: <strong className="text-white font-mono">{timeStr || "--:--"}</strong></span>
        </div>
      </div>

      {/* Action Area */}
      <div className="flex items-center gap-3">
        {/* Search Input */}
        <div className="relative hidden sm:block w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search orders, clients, machines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-950/70 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-1 rounded"
            >
              ESC
            </button>
          )}
        </div>

        {/* Alert Pill if Bottlenecks or Low Stock */}
        {(bottleneckCount > 0 || lowStockCount > 0) && (
          <div className="hidden lg:flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 px-3 py-1.5 rounded-lg text-xs font-semibold">
            <ShieldAlert className="w-4 h-4 text-rose-500 animate-bounce" />
            <span>
              {bottleneckCount > 0 ? `${bottleneckCount} Machine Queue Alert` : ""}
              {bottleneckCount > 0 && lowStockCount > 0 ? " | " : ""}
              {lowStockCount > 0 ? `${lowStockCount} Low Stock Items` : ""}
            </span>
          </div>
        )}

        <button onClick={onSwitchProfile} className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 transition hover:border-amber-500/50 hover:text-amber-300" title={`Switch profile — ${currentUser?.name || "employee"}`}>
          <UserRoundCog className="h-4 w-4" />
        </button>
        <button onClick={onLock} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 transition hover:border-rose-500/50 hover:text-rose-300" title="Lock workspace">
          <LockKeyhole className="h-4 w-4" />
        </button>
        <button onClick={onExit} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 transition hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-300" title="Exit WoodTek ERP (signs you out and closes the window)">
          <Power className="h-4 w-4" />
        </button>

        {/* Quick Create Order Button */}
        {canCreateOrder && (
          <button
            onClick={onNewOrder}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:from-amber-700 active:to-amber-800 text-white font-bold px-3.5 py-1.5 rounded-lg shadow-md shadow-amber-600/20 hover:shadow-lg hover:shadow-amber-600/30 transition text-xs whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">New Order Flow</span><span className="sm:hidden">Order</span>
          </button>
        )}
      </div>
    </header>
  );
}
