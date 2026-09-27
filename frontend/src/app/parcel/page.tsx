"use client";

import { useState } from "react";
import {
  getParcelDetail, getParcelOwnership, getParcelFiscal,
  getParcelUtilities, getParcelInfra,
  ParcelDetail, OwnershipResponse, FiscalResponse, UtilitiesResponse, InfraRecord,
} from "@/lib/api";
import LandDeedViewer from "@/components/parcel/LandDeedViewer";
import { Search, Building2, User, IndianRupee, Zap, Droplets, AlertTriangle, CheckCircle, Clock, FileText } from "lucide-react";
import { useMapStore } from "@/lib/store";
import { useRouter } from "next/navigation";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
        {title}
      </div>
      <div style={{ padding: "14px 16px" }}>{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
      <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{label}</span>
      <span style={{ color: "var(--text-primary)", fontWeight: 600, textAlign: "right", maxWidth: "60%" }}>{value || "—"}</span>
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const green = ["Paid", "Active", "Working", "Operational"];
  const red   = ["Defaulter", "Inactive", "Faulty"];
  const color = green.includes(s) ? "#059669" : red.includes(s) ? "#DC2626" : "#D97706";
  const bg    = green.includes(s) ? "rgba(16,185,129,0.1)" : red.includes(s) ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)";
  return <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px", background: bg, color }}>{s}</span>;
}

export default function ParcelPage() {
  const [ulpin, setUlpin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [parcel, setParcel] = useState<ParcelDetail | null>(null);
  const [ownership, setOwnership] = useState<OwnershipResponse | null>(null);
  const [fiscal, setFiscal] = useState<FiscalResponse | null>(null);
  const [utilities, setUtilities] = useState<UtilitiesResponse | null>(null);
  const [infra, setInfra] = useState<InfraRecord | null>(null);
  const [showDeed, setShowDeed] = useState(false);
  const { setActiveULPIN } = useMapStore();
  const router = useRouter();

  const lookup = async () => {
    const q = ulpin.trim().toUpperCase();
    if (!q) return;
    setLoading(true);
    setError("");
    try {
      const [p, o, f, u, i] = await Promise.all([
        getParcelDetail(q),
        getParcelOwnership(q),
        getParcelFiscal(q),
        getParcelUtilities(q),
        getParcelInfra(q),
      ]);
      setParcel(p); setOwnership(o); setFiscal(f); setUtilities(u); setInfra(i);
    } catch (e: any) {
      setError(e.message || "Parcel not found");
      setParcel(null);
    } finally {
      setLoading(false);
    }
  };

  const openOnMap = () => {
    if (parcel) { setActiveULPIN(parcel.ulpin); router.push("/map"); }
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "var(--bg-primary)", padding: "20px 24px" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4, letterSpacing: "-0.02em" }}>Parcel Intelligence</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Enter a ULPIN to view the complete land record, ownership history, and utility connections</p>
      </div>

      {/* Search bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, maxWidth: 540 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={15} color="var(--text-muted)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input
            className="search-input"
            value={ulpin}
            onChange={e => setUlpin(e.target.value)}
            onKeyDown={e => e.key === "Enter" && lookup()}
            placeholder="Enter ULPIN (e.g. PB-MHL-000001)"
            style={{ width: "100%", padding: "10px 12px 10px 32px", fontSize: 13 }}
          />
        </div>
        <button
          onClick={lookup}
          disabled={loading}
          style={{
            padding: "0 20px", background: "var(--accent)", color: "#fff",
            borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
            border: "none", opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Loading…" : "Lookup"}
        </button>
      </div>

      {error && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 16, padding: "10px 14px", background: "rgba(239,68,68,0.08)", borderRadius: 8 }}>{error}</div>}

      {parcel && (
        <div style={{ maxWidth: 760 }}>
          {/* Header card */}
          <div style={{
            background: "var(--bg-card)", border: parcel.has_conflict ? "1px solid rgba(239,68,68,0.4)" : "1px solid var(--border)",
            borderRadius: 14, padding: "18px 20px", marginBottom: 14,
            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <Building2 size={20} color="var(--accent)" />
                <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{parcel.ulpin}</span>
                {parcel.has_conflict && <span style={{ background: "rgba(239,68,68,0.1)", color: "#DC2626", fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px" }}>⚠ Conflict</span>}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{parcel.address}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{parcel.ward_name} · {parcel.district} · {parcel.state}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => setShowDeed(true)} style={{
                padding: "8px 14px", background: "#0F172A", color: "#fff",
                border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, justifyContent: "center"
              }}>
                <FileText size={14} /> View Land Deed
              </button>
              <button onClick={openOnMap} style={{
                padding: "8px 14px", background: "var(--accent-dim)", color: "var(--accent)",
                border: "1px solid var(--border-accent)", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, justifyContent: "center"
              }}>
                📍 View on Map
              </button>
            </div>
          </div>

          {showDeed && (
            <LandDeedViewer 
              parcel={parcel}
              ownership={ownership}
              onClose={() => setShowDeed(false)}
            />
          )}

          {/* Land Details */}
          <Section title="Land Details">
            <Row label="Plot Number" value={parcel.plot_number} />
            <Row label="Land Use" value={parcel.land_use} />
            <Row label="Area" value={`${parcel.area_sqm?.toFixed(1)} sq m`} />
            <Row label="Ward" value={parcel.ward_name} />
            <Row label="District" value={parcel.district} />
          </Section>

          {/* Ownership */}
          {ownership && (
            <Section title={`Ownership — Chain of Title (${1 + ownership.history.length} records)`}>
              {ownership.current_owner && (
                <div style={{ background: "rgba(2,132,199,0.06)", border: "1px solid rgba(2,132,199,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700, marginBottom: 4 }}>Current Owner</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{ownership.current_owner.owner_name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                    {ownership.current_owner.ownership_type} · Since {ownership.current_owner.valid_from}
                  </div>
                  {ownership.current_owner.deed_number && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Deed: {ownership.current_owner.deed_number}</div>}
                </div>
              )}
              {ownership.history.map(h => (
                <div key={h.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{h.owner_name}</div>
                  <div style={{ color: "var(--text-muted)", marginTop: 2 }}>{h.ownership_type} · {h.valid_from} → {h.valid_to}</div>
                </div>
              ))}
            </Section>
          )}

          {/* Fiscal */}
          {fiscal && (
            <Section title="Tax & Fiscal">
              <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, background: "var(--bg-primary)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Status</div>
                  <StatusBadge s={fiscal.current_status} />
                </div>
                <div style={{ flex: 1, background: "var(--bg-primary)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>FY Due</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#DC2626" }}>₹{fiscal.current_fy_due.toLocaleString()}</div>
                </div>
                <div style={{ flex: 1, background: "var(--bg-primary)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Arrears</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#D97706" }}>₹{fiscal.total_arrears.toLocaleString()}</div>
                </div>
              </div>
              {fiscal.records.map(r => (
                <Row key={r.id} label={`FY ${r.financial_year}`} value={<span>₹{r.amount_paid.toLocaleString()} / ₹{r.amount_due.toLocaleString()} <StatusBadge s={r.status} /></span>} />
              ))}
            </Section>
          )}

          {/* Utilities */}
          {utilities && (
            <Section title="Utility Connections">
              {utilities.electricity && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                    <Zap size={13} color="#F59E0B" />
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Electricity</span>
                    <StatusBadge s={utilities.electricity.connection_status} />
                  </div>
                  <Row label="Provider" value={utilities.electricity.provider} />
                  <Row label="Connection ID" value={utilities.electricity.connection_id} />
                  <Row label="Meter Status" value={utilities.electricity.meter_status} />
                  <Row label="Last Bill" value={utilities.electricity.recent_bill_amount ? `₹${utilities.electricity.recent_bill_amount}` : "—"} />
                </div>
              )}
              {utilities.water && (
                <div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                    <Droplets size={13} color="#0284C7" />
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Water</span>
                    <StatusBadge s={utilities.water.connection_status} />
                  </div>
                  <Row label="Provider" value={utilities.water.provider} />
                  <Row label="Connection ID" value={utilities.water.connection_id} />
                  <Row label="Meter Status" value={utilities.water.meter_status} />
                  <Row label="Avg Consumption" value={utilities.water.avg_consumption ? `${utilities.water.avg_consumption} ${utilities.water.consumption_unit}` : "—"} />
                </div>
              )}
            </Section>
          )}

          {/* Infrastructure */}
          {infra && (
            <Section title="Infrastructure & Building">
              <Row label="Sewage Connected" value={infra.sewage_connected ? <CheckCircle size={14} color="#059669" /> : "No"} />
              <Row label="Building Plan Approved" value={infra.building_plan_approved ? "Yes" : "No"} />
              <Row label="Approved Floors" value={infra.approved_floors} />
              <Row label="Construction Year" value={infra.construction_year} />
              <Row label="Active Violations" value={
                infra.active_violations > 0
                  ? <span style={{ color: "#DC2626", fontWeight: 700 }}>{infra.active_violations}</span>
                  : <CheckCircle size={14} color="#059669" />
              } />
            </Section>
          )}
        </div>
      )}

      {!parcel && !loading && !error && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
          <Building2 size={48} strokeWidth={1} style={{ marginBottom: 16, opacity: 0.3 }} />
          <div style={{ fontSize: 15, fontWeight: 600 }}>Enter a ULPIN to begin</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>The full land intelligence profile will load here</div>
        </div>
      )}
    </div>
  );
}
