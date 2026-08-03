"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import AuthGate from "@/components/AuthGate";
import DashboardView from "@/components/DashboardView";
import OrdersView from "@/components/OrdersView";
import OrderWorkflowDetail from "@/components/OrderWorkflowDetail";
import MachinesView from "@/components/MachinesView";
import OperatorStationView from "@/components/OperatorStationView";
import CustomersView from "@/components/CustomersView";
import InventoryView from "@/components/InventoryView";
import ScheduleView from "@/components/ScheduleView";
import GanttView from "@/components/GanttView";
import CmmsView from "@/components/CmmsView";
import ReportView from "@/components/ReportView";
import SettingsView from "@/components/SettingsView";
import { canAccessModule, type ModuleId } from "@/lib/moduleAccess";

export default function WoodTekERP() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authCandidate, setAuthCandidate] = useState<any>(null);

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [demoMode, setDemoMode] = useState(false);

  const fetchRoster = async () => {
    try {
      const res = await fetch("/api/auth/roster", { cache: "no-store" });
      if (res.ok) setUsers(await res.json());
    } catch (error) {
      console.error("Roster fetch failed", error);
    }
  };

  const fetchAllData = async () => {
    try {
      const [dashRes, ordRes, machRes, userRes, custRes, tplRes, invRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/orders"),
        fetch("/api/machines"),
        fetch("/api/users"),
        fetch("/api/customers"),
        fetch("/api/templates"),
        fetch("/api/inventory"),
      ]);

      if (userRes.ok) setUsers(await userRes.json());
      if (ordRes.ok) setOrders(await ordRes.json());
      if (machRes.ok) setMachines(await machRes.json());
      if (custRes.ok) setCustomers(await custRes.json());
      if (tplRes.ok) setTemplates(await tplRes.json());
      if (invRes.ok) setInventory(await invRes.json());
      if (dashRes.ok) setDashboardData(await dashRes.json());
    } catch (error) {
      console.error("Failed to fetch ERP datasets:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      try {
        // A production installation starts empty and presents Create Owner.
        // Demo data is opt-in only; it must never silently populate a factory DB.
        if (process.env.NEXT_PUBLIC_WOODTEK_DEMO === "on") {
          await fetch("/api/seed", { method: "POST" });
        }

        // Restore an existing signed session so a refresh does not log you out.
        const meRes = await fetch("/api/auth", { cache: "no-store" });
        if (meRes.ok) {
          const me = await meRes.json();
          setDemoMode(Boolean(me.demoMode));
          if (me.user) {
            setCurrentUser(me.user);
            await fetchAllData();
            return;
          }
        }
        // Not signed in: load only the roster needed to render the sign-in screen.
        await fetchRoster();
      } catch (error) {
        console.error("Initialization error", error);
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  const handleReseed = async () => {
    if (!confirm("Reset the database with fresh WoodTek demo factory data? All current changes will be lost.")) return;
    setIsSeeding(true);
    try {
      await fetch("/api/seed?force=true", { method: "POST" });
      setCurrentUser(null);
      setAuthOpen(false);
      await fetchAllData();
    } catch (error) {
      console.error("Reseed error", error);
    } finally {
      setIsSeeding(false);
    }
  };

  const requestProfileSwitch = (candidate?: any) => {
    setAuthCandidate(candidate || null);
    setAuthOpen(true);
    setSidebarOpen(false);
  };

  const handleAuthenticated = async (user: any) => {
    setCurrentUser(user);
    setAuthOpen(false);
    setAuthCandidate(null);
    if (user.role === "Machine Operator") setActiveTab("station");
    await fetchAllData();
  };

  const lockWorkspace = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch (error) {
      console.error("Sign out failed", error);
    }
    setCurrentUser(null);
    setAuthCandidate(null);
    setAuthOpen(false);
    setSidebarOpen(false);
    await fetchRoster();
  };

  const handleSelectOrder = (orderId: number) => {
    setActiveTab(`order-${orderId}`);
    setSidebarOpen(false);
  };

  const handleSelectSolutionMode = (mode: "A" | "B") => {
    if (mode === "A") {
      const managerUser = users.find(user => user.role === "Manager") || users[0];
      if (managerUser) setCurrentUser(managerUser);
      setActiveTab("dashboard");
    } else {
      const operatorUser = users.find(user => user.role === "Machine Operator") || users[1] || users[0];
      if (operatorUser) setCurrentUser(operatorUser);
      setActiveTab("station");
    }
    setAuthOpen(false);
    setSidebarOpen(false);
  };

  const canCreateOrders = currentUser?.role === "Manager" || currentUser?.role === "Sales Coordinator";

  // Map the legacy tab id to a ModuleId for the access check
  const tabToModule = (tab: string): ModuleId | null => {
    if (tab === "station") return "operator";
    if (tab.startsWith("order-")) return "orders";
    const allowed: ModuleId[] = ["dashboard", "orders", "machines", "operator", "customers", "inventory", "schedule", "gantt", "cmms", "reports", "settings"];
    return (allowed as string[]).includes(tab) ? (tab as ModuleId) : null;
  };

  // If the current user is signed in but landed on a tab they cannot access,
  // bounce them back to their dashboard.
  useEffect(() => {
    if (!currentUser) return;
    const m = tabToModule(activeTab);
    if (m && !canAccessModule(currentUser.role, m)) {
      setActiveTab("dashboard");
    }
  }, [currentUser, activeTab]);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden antialiased">
      {sidebarOpen && <button className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        allUsers={users}
        onSwitchUser={(user) => requestProfileSwitch(user)}
        onRequestSwitch={() => requestProfileSwitch()}
        onSelectSolutionMode={handleSelectSolutionMode}
        onReseed={handleReseed}
        isSeeding={isSeeding}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto custom-scrollbar">
        <Header
          activeTab={activeTab}
          onNewOrder={() => {
            if (!canCreateOrders) return;
            setActiveTab("orders");
            setShowNewModal(true);
          }}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          currentUser={currentUser}
          bottleneckCount={dashboardData?.primaryBottleneck?.queueLength > 1 ? 1 : 0}
          lowStockCount={dashboardData?.lowStockItems?.length || 0}
          onOpenMenu={() => setSidebarOpen(true)}
          onSwitchProfile={() => requestProfileSwitch()}
          onLock={lockWorkspace}
          canCreateOrder={canCreateOrders}
        />

        <main className="flex-1 pb-16">
          {activeTab === "dashboard" && <DashboardView data={dashboardData} loading={loading} onNavigate={setActiveTab} />}
          {activeTab === "orders" && (
            <OrdersView orders={orders} loading={loading} onSelectOrder={handleSelectOrder} onRefresh={fetchAllData}
              showNewModal={showNewModal && canCreateOrders} setShowNewModal={setShowNewModal} customers={customers}
              templates={templates} machines={machines} searchQuery={searchQuery} />
          )}
          {activeTab === "schedule" && (
            <ScheduleView machines={machines} currentUser={currentUser} onRefresh={fetchAllData} searchQuery={searchQuery} />
          )}
          {activeTab.startsWith("order-") && (
            <OrderWorkflowDetail orderId={Number(activeTab.split("-")[1])} onBack={() => setActiveTab("orders")}
              onRefresh={fetchAllData} currentUser={currentUser} machines={machines} inventoryItems={inventory} />
          )}
          {activeTab === "machines" && <MachinesView machines={machines} loading={loading} onRefresh={fetchAllData} users={users} onSelectOrder={handleSelectOrder} />}
          {activeTab === "station" && <OperatorStationView machines={machines} currentUser={currentUser} onRefresh={fetchAllData} onSelectOrder={handleSelectOrder} />}
          {activeTab === "customers" && <CustomersView customers={customers} loading={loading} onRefresh={fetchAllData} onSelectOrder={handleSelectOrder} />}
          {activeTab === "inventory" && <InventoryView items={inventory} loading={loading} onRefresh={fetchAllData} />}
          {activeTab === "gantt" && (
            <GanttView machines={machines} onSelectOrder={handleSelectOrder} searchQuery={searchQuery} />
          )}
          {activeTab === "cmms" && (
            <CmmsView currentUser={currentUser} machines={machines} searchQuery={searchQuery} />
          )}
          {activeTab === "reports" && <ReportView currentUser={currentUser} searchQuery={searchQuery} />}
          {activeTab === "settings" && <SettingsView currentUser={currentUser} />}
        </main>
      </div>

      {!loading && (!currentUser || authOpen) && (
        <AuthGate
          users={users}
          initialUser={authCandidate}
          required={!currentUser}
          onAuthenticated={handleAuthenticated}
          onCancel={currentUser ? () => { setAuthOpen(false); setAuthCandidate(null); } : undefined}
          onSelectSolutionMode={handleSelectSolutionMode}
          demoMode={demoMode}
        />
      )}
    </div>
  );
}
