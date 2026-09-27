"use client";

import React, { useRef, useState } from "react";
import { X, Download } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

interface LandDeedViewerProps {
  parcel: any;
  ownership: any;
  onClose: () => void;
}

export default function LandDeedViewer({ parcel, ownership, onClose }: LandDeedViewerProps) {
  const deedRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!deedRef.current || !parcel) return;
    setDownloading(true);
    setError(null);
    try {
      const canvas = await html2canvas(deedRef.current, { 
        scale: 2,
        useCORS: true,
        logging: false
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Land_Deed_${parcel.ulpin}.pdf`);
    } catch (err: any) {
      console.error("Failed to generate PDF", err);
      setError("Failed to generate PDF. " + (err.message || ""));
    }
    setDownloading(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="bg-white rounded-xl shadow-2xl flex flex-col max-h-full max-w-4xl w-full overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#e2e8f0' }}>
          <h2 className="text-lg font-bold" style={{ color: '#1e293b' }}>Official Land Deed View</h2>
          <button onClick={onClose} className="p-2 rounded-full transition-colors hover:bg-gray-100">
            <X size={20} style={{ color: '#64748b' }} />
          </button>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center items-start" style={{ backgroundColor: '#f1f5f9' }}>
          
          {/* The Actual Deed Document - Using 100% inline styles for perfect html2canvas rendering */}
          <div 
            ref={deedRef} 
            style={{ 
              width: 800, 
              padding: 48, 
              backgroundColor: '#ffffff', 
              color: '#000000', 
              fontFamily: 'sans-serif',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              flexShrink: 0,
              boxSizing: 'border-box'
            }}
          >
            <div style={{ borderBottom: '4px solid #0f172a', paddingBottom: 24, marginBottom: 32, textAlign: 'center' }}>
              <h1 style={{ fontSize: 36, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 4, color: '#0f172a', margin: 0 }}>Official Land Deed</h1>
              <p style={{ fontSize: 18, color: '#475569', marginTop: 8, margin: 0 }}>SUTRA Digital Land Registry — Government of Punjab</p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 32 }}>
              <div>
                <p style={{ color: '#64748b', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', margin: '0 0 4px 0' }}>Property ULPIN</p>
                <p style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 20, color: '#000000', margin: 0 }}>{parcel.ulpin}</p>
              </div>
              <div>
                <p style={{ color: '#64748b', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', margin: '0 0 4px 0' }}>Date of Issue</p>
                <p style={{ fontWeight: 500, fontSize: 20, color: '#000000', margin: 0 }}>{new Date().toLocaleDateString()}</p>
              </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: 24, borderRadius: 8, marginBottom: 32, border: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: 20, fontWeight: 'bold', margin: '0 0 16px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: 8, color: '#0f172a' }}>Property Information</h2>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '12px 0', color: '#475569', fontWeight: 500, width: '33%' }}>Plot Number</th>
                    <td style={{ padding: '12px 0', fontWeight: 600, color: '#0f172a' }}>{parcel.plot_number}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '12px 0', color: '#475569', fontWeight: 500 }}>Area (sqm)</th>
                    <td style={{ padding: '12px 0', fontWeight: 600, color: '#0f172a' }}>{parcel.area_sqm}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '12px 0', color: '#475569', fontWeight: 500 }}>Land Use</th>
                    <td style={{ padding: '12px 0', fontWeight: 600, color: '#0f172a' }}>{parcel.land_use}</td>
                  </tr>
                  <tr>
                    <th style={{ padding: '12px 0', color: '#475569', fontWeight: 500 }}>Address</th>
                    <td style={{ padding: '12px 0', fontWeight: 600, color: '#0f172a' }}>{parcel.address}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: 24, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: 20, fontWeight: 'bold', margin: '0 0 16px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: 8, color: '#0f172a' }}>Current Ownership</h2>
              {ownership?.current_owner ? (
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <th style={{ padding: '12px 0', color: '#475569', fontWeight: 500, width: '33%' }}>Owner Name</th>
                      <td style={{ padding: '12px 0', fontWeight: 'bold', fontSize: 18, color: '#0f172a' }}>{ownership.current_owner.owner_name}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <th style={{ padding: '12px 0', color: '#475569', fontWeight: 500 }}>Ownership Type</th>
                      <td style={{ padding: '12px 0', fontWeight: 600, color: '#0f172a' }}>{ownership.current_owner.ownership_type}</td>
                    </tr>
                    <tr>
                      <th style={{ padding: '12px 0', color: '#475569', fontWeight: 500 }}>Valid From</th>
                      <td style={{ padding: '12px 0', fontWeight: 600, color: '#0f172a' }}>{ownership.current_owner.valid_from}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#64748b', fontStyle: 'italic', margin: 0 }}>No current owner on record.</p>
              )}
            </div>
            
            <div style={{ marginTop: 64, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
              <p style={{ margin: 0 }}>Digitally generated by SUTRA Platform. Scan QR code to verify authenticity.</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t bg-white flex justify-between items-center" style={{ borderColor: '#e2e8f0' }}>
          <div className="text-red-500 text-sm font-medium">{error}</div>
          <button 
            onClick={handleDownload}
            disabled={downloading}
            className="bg-[var(--accent)] hover:opacity-90 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-opacity shadow-sm disabled:opacity-50"
          >
            <Download size={18} />
            {downloading ? "Generating PDF..." : "Download PDF"}
          </button>
        </div>

      </div>
    </div>
  );
}
