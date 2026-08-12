"use client";

import React, { useState, useEffect } from "react";
import { 
  Tablet, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  User, 
  Activity, 
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldAlert
} from "lucide-react";

interface OperatorStationViewProps {
  machines: any[];
  currentUser: any;
  onRefresh: () => void;
  onSelectOrder: (orderId: number) => void;
}

export default function OperatorStationView({
  machines = [],
  currentUser,
  onRefresh,
  onSelectOrder,
}: OperatorStationViewProps) {
  const [selectedMachineId, setSelectedMachineId] = useState<number | null>(null);
  const [operations, setOperations] = useState<any[]>([]);
  const [loadingOps, setLoadingOps] = useState(false);
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyOperationId, setBusyOperationId] = useState<number | null>(null);

  // Select default machine when loaded
  useEffect(() => {
    if (!selectedMachineId && machines.length > 0) {
      setSelectedMachineId(machines[0].id);
    }
  }, [machines, selectedMachineId]);

  // Fetch active operations for selected machine
  const fetchMachineQueue = async () => {
    if (!selectedMachineId) return;
    setLoadingOps(true);
    try {
      const res = await fetch(`/api/operations?machineId=${selectedMachineId}&activeOnly=true`);
      if (res.ok) {
        const data = await res.json();
        setOperations(data);
      }
    } catch (err) {
      console.error("Error fetching station tasks:", err);
    } finally {
      setLoadingOps(false);
    }
  };

  useEffect(() => {
    fetchMachineQueue();
    const interval = setInterval(fetchMachineQueue, 10000);
    return () => clearInterval(interval);
  }, [selectedMachineId]);

  const handleTouchAction = async (opId: number, status: string) => {
    if (busyOperationId !== null) return;
    let rejectReason: string | undefined;
    if (status === "Rejected/Rework") {
      const entered = window.prompt("Describe the defect, tooling issue, or rework required:");
      if (!entered?.trim()) return;
      rejectReason = entered.trim();
    }

    setBusyOperationId(opId);
    setActionError("");
    try {
      const response = await fetch(`/api/operations/${opId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          rejectReason,
          operatorId: currentUser?.id ? Number(currentUser.id) : undefined
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The station could not update this operation.");

      setActionSuccess(status === "Completed" ? "Step completed — the next workstation is now ready." : `Operation marked ${status}.`);
      setTimeout(() => setActionSuccess(""), 3500);
      await fetchMachineQueue();
      onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Touch action failed.";
      setActionError(message);
      setTimeout(() => setActionError(""), 6000);
    } finally {
      setBusyOperationId(null);
    }
  };

  const currentMachine = machines.find(m => m.id === selectedMachineId);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto select-none">
      {/* Touch Screen Banner & Station Switcher */}
      <div className="bg-slate-900/90 border-2 border-amber-500/40 rounded-3xl p-6 shadow-xl shadow-amber-950/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Tablet className="w-5 h-5 text-amber-400 animate-bounce" />
              <span className="text-xs font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/30">
                Touchscreen Shop Floor Mode
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">Select Workstation</h2>
          </div>

          <div className="flex items-center gap-3 bg-slate-950 px-4 py-2.5 rounded-2xl border border-slate-800">
            <User className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Logged Operator</div>
              <div className="text-sm font-black text-white">{currentUser?.name || "Machine Operator"}</div>
            </div>
          </div>
        </div>

        {/* Tactile Station Buttons Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3 pt-6">
          {machines.map((m) => {
            const isSelected = m.id === selectedMachineId;
            const unavailable = m.status === "Maintenance" || m.status === "Offline";
            return (
              <button
                key={m.id}
                onClick={() => !unavailable && setSelectedMachineId(m.id)}
                disabled={unavailable}
                className={`p-4 rounded-2xl border-2 transition-all duration-150 flex flex-col items-center justify-center text-center active:scale-95 shadow-md ${
                  unavailable ? "bg-slate-950/40 border-rose-500/30 text-slate-600 cursor-not-allowed opacity-60" : isSelected
                    ? "bg-gradient-to-b from-amber-500 to-amber-600 border-amber-300 text-slate-950 font-black shadow-lg shadow-amber-500/30 scale-105 z-10"
                    : "bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white"
                }`}
              >
                <span className={`font-mono font-black text-lg tracking-wider mb-1 ${isSelected ? "text-slate-950" : "text-amber-400"}`}>
                  {m.code}
                </span>
                <span className={`text-xs font-extrabold line-clamp-1 ${isSelected ? "text-slate-900" : "text-slate-300"}`}>
                  {m.category}
                </span>
                <span className={`text-[10px] mt-1.5 font-bold px-2 py-0.5 rounded-full ${
                  isSelected ? "bg-slate-950 text-white" : "bg-slate-900 text-slate-400"
                }`}>
                  {unavailable ? m.status : `${m.queueCount} queued`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-500 text-slate-950 font-black text-center text-base rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2" role="status">
          <Sparkles className="w-6 h-6 stroke-[2.5]" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-4 bg-rose-500/15 text-rose-200 font-bold text-center text-sm rounded-2xl border-2 border-rose-500/50 shadow-xl flex items-center justify-center gap-2" role="alert">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Machine Queue Display */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-lg font-black text-white flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-amber-500 animate-pulse" />
            <span>Active Queue for {currentMachine?.name || "Selected Machine"}</span>
          </h3>
          <button
            onClick={fetchMachineQueue}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
            title="Refresh Machine Queue"
          >
            <RefreshCw className={`w-4 h-4 ${loadingOps ? "animate-spin text-amber-400" : ""}`} />
          </button>
        </div>

        {operations.length === 0 ? (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-16 text-center my-6 shadow-sm">
            <CheckCircle2 className="w-20 h-20 text-emerald-500 mx-auto mb-4 stroke-[1.5] animate-bounce" />
            <h3 className="text-2xl font-black text-white mb-2">Workstation All Clear!</h3>
            <p className="text-sm font-semibold text-slate-400 max-w-md mx-auto">
              There are no pending or running jobs at <strong className="text-amber-400">{currentMachine?.code}</strong> right now. Enjoy a clean floor or help assist another station.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {operations.map((op) => {
              const isRunning = op.status === "In Progress";
              
              return (
                <div 
                  key={op.id}
                  className={`p-6 rounded-3xl border-2 transition shadow-xl ${
                    isRunning 
                      ? "bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border-amber-500 shadow-amber-950/30"
                      : "bg-slate-900/95 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Job Details */}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className={`text-xs font-extrabold px-3 py-1 rounded-xl uppercase tracking-wider ${
                          isRunning ? "bg-amber-500 text-slate-950 animate-pulse font-black" : "bg-blue-600 text-white"
                        }`}>
                          {op.status}
                        </span>
                        <span className="font-mono text-sm font-black text-amber-400 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800">
                          {op.orderNumber}
                        </span>
                        <span className="text-xs text-slate-400 font-bold bg-slate-800 px-2.5 py-1 rounded-xl">
                          Step #{op.stepOrder}
                        </span>
                      </div>

                      <h4 
                        onClick={() => onSelectOrder(op.orderId)}
                        className="text-xl font-black text-white hover:text-amber-300 transition cursor-pointer flex items-center gap-2"
                      >
                        <span>{op.operationName}</span>
                        <ArrowRight className="w-5 h-5 text-slate-500 inline" />
                      </h4>

                      <div className="text-sm font-bold text-slate-300 truncate">
                        Project: {op.orderTitle}
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 pt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-slate-500" /> Est: <strong className="text-slate-200">{op.estimatedMinutes} mins</strong>
                        </span>
                        {op.operatorName && (
                          <span className="text-emerald-400">Assigned: {op.operatorName}</span>
                        )}
                      </div>
                    </div>

                    {/* GIANT TACTILE OPERATOR BUTTONS */}
                    <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
                      {!isRunning ? (
                        <button
                          onClick={() => handleTouchAction(op.id, "In Progress")}
                          disabled={busyOperationId !== null}
                          className="flex items-center justify-center gap-2.5 bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 active:scale-95 text-slate-950 font-black px-8 py-5 rounded-2xl text-base shadow-xl shadow-amber-600/30 transition uppercase tracking-wider w-full sm:w-auto disabled:opacity-40 disabled:cursor-wait"
                        >
                          <Play className="w-6 h-6 fill-slate-950 stroke-[2.5]" />
                          <span>START MACHINING</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleTouchAction(op.id, "Completed")}
                          disabled={busyOperationId !== null}
                          className="flex items-center justify-center gap-2.5 bg-gradient-to-b from-emerald-400 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700 active:scale-95 text-slate-950 font-black px-8 py-5 rounded-2xl text-base shadow-xl shadow-emerald-600/30 transition uppercase tracking-wider animate-pulse w-full sm:w-auto disabled:opacity-40 disabled:cursor-wait"
                        >
                          <CheckCircle2 className="w-6 h-6 stroke-[3]" />
                          <span>FINISH & PASS NEXT</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleTouchAction(op.id, "Rejected/Rework")}
                        disabled={busyOperationId !== null}
                        className="p-5 bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 text-rose-400 rounded-2xl border-2 border-rose-500/40 font-black text-sm flex items-center gap-2 transition uppercase disabled:opacity-40 disabled:cursor-wait"
                        title="Flag defect or tool wear"
                      >
                        <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
                        <span className="hidden md:inline">REJECT / REWORK</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
