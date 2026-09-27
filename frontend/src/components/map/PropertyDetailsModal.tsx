"use client";

import React, { useEffect, useState, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { X, FileText, AlertTriangle, Send, CheckCircle2, History } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

interface PropertyDetailsModalProps {
  ulpin: string;
  onClose: () => void;
}

export default function PropertyDetailsModal({ ulpin, onClose }: PropertyDetailsModalProps) {
  const [parcel, setParcel] = useState<any>(null);
  const [ownership, setOwnership] = useState<any>(null);
  const [fiscal, setFiscal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState(false);
  const [notificationSent, setNotificationSent] = useState(false);
  const deedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const p = await apiFetch<any>(`/api/parcels/${ulpin}`);
        setParcel(p);
        const o = await apiFetch<any>(`/api/parels/${ulpin}/ownership`).catch(() => apiFetch<any>(`/api/parcels/${ulpin}/ownership`));
        setOwnership(o);
        const f = await apiFetch<any>(`/api/parcels/${ulpin}/fiscal`);
        setFiscal(f);
      } catch (err) {
        console.error("Failed to load property details", err);
      }
      setLoading(false);
    }
    loadData();
  }, [ulpin]);

  const handleDownloadDeed = async () => {
    if (!deedRef.current || !parcel) return;
    const canvas = await html2canvas(deedRef.current, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Land_Deed_${ulpin}.pdf`);
  };

  const handleNotifyDefaulter = async () => {
    setNotifying(true);
    try {
      await apiFetch(`/api/parcels/${ulpin}/notify-defaulter`, { method: "POST" });
      setNotificationSent(true);
    } catch (err) {
      console.error(err);
    }
    setNotifying(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-y-0 right-0 w-[450px] bg-white shadow-2xl z-[9999] flex items-center justify-center border-l border-slate-200">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800" />
      </div>
    );
  }

  if (!parcel) {
    return (
      <div className="fixed inset-y-0 right-0 w-[450px] bg-white shadow-2xl z-[9999] p-6 border-l border-slate-200">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100"><X size={20}/></button>
        <p className="text-red-500 mt-10">Failed to load property data.</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[450px] bg-white shadow-2xl z-[9999] flex flex-col border-l border-slate-200 overflow-hidden text-slate-800 transition-transform">
      
      {/* Header */}
      <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Property Details</h2>
          <p className="text-sm font-mono text-slate-500 mt-1">ULPIN: {parcel.ulpin}</p>
        </div>
        <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        
        {/* Removed inline deed rendering */}

        {/* Basic Info */}
        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Basic Information</h3>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Plot Number</span>
              <span className="text-sm font-medium">{parcel.plot_number}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Area</span>
              <span className="text-sm font-medium">{parcel.area_sqm} sqm</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Land Use</span>
              <span className="text-sm font-medium">{parcel.land_use}</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-sm text-slate-500">Address</span>
              <span className="text-sm font-medium text-right max-w-[200px]">{parcel.address}</span>
            </div>
          </div>
        </section>

        {/* Actions removed from Modal */}

        {/* Fiscal & Tax */}
        {fiscal && (
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              Tax & Fiscal Status
              {fiscal.current_status === 'Defaulter' && <AlertTriangle size={14} className="text-red-500" />}
            </h3>
            <div className={`rounded-xl p-4 border ${fiscal.current_status === 'Defaulter' ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'} space-y-3`}>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Current Status</span>
                <span className={`text-sm font-bold ${fiscal.current_status === 'Defaulter' ? 'text-red-600' : 'text-green-600'}`}>
                  {fiscal.current_status}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Pending Dues</span>
                <span className="text-sm font-medium">₹{fiscal.current_fy_due + fiscal.total_arrears}</span>
              </div>
              
              {fiscal.current_status === 'Defaulter' && (
                <div className="pt-2 mt-2 border-t border-red-200">
                  <button 
                    onClick={handleNotifyDefaulter}
                    disabled={notifying || notificationSent}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    {notificationSent ? <CheckCircle2 size={16} /> : <Send size={16} />}
                    {notificationSent ? "Notice Sent" : "Send Legal Notice"}
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Ownership History */}
        {ownership && (
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <History size={14} />
              Ownership History
            </h3>
            <div className="space-y-3">
              {/* Current */}
              {ownership.current_owner && (
                <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-slate-900">{ownership.current_owner.owner_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{ownership.current_owner.ownership_type}</p>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">CURRENT</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Since {ownership.current_owner.valid_from}</p>
                </div>
              )}

              {/* Past */}
              {ownership.history.map((hist: any) => (
                <div key={hist.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative">
                  <div className="absolute top-0 left-0 w-1 h-full bg-slate-300 rounded-l-xl"></div>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-slate-700">{hist.owner_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{hist.ownership_type}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">{hist.valid_from} to {hist.valid_to}</p>
                </div>
              ))}
              
              {ownership.history.length === 0 && !ownership.current_owner && (
                <p className="text-sm text-slate-500 italic text-center py-4">No ownership records found.</p>
              )}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
