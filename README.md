# 🏛️ SUTRA — Smart Urban Tracking & Resource Allocation
### *Unified GIS-Based Digital Public Infrastructure for Land Records*
> **Smart India Hackathon (SIH)** · Smart Urban Governance & Digital Cadastre

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-336791?logo=postgresql)](https://www.postgresql.org/)
[![PostGIS](https://img.shields.io/badge/Spatial-PostGIS%203.4-blue?logo=postgis)](https://postgis.net/)
[![MapLibre GL](https://img.shields.io/badge/GIS-MapLibre%20GL-396B94?logo=maplibre)](https://maplibre.org/)
[![Docker](https://img.shields.io/badge/Containerized-Docker%20Compose-2496ED?logo=docker)](https://www.docker.com/)

---

## 📌 Overview

**SUTRA** (formerly BhoomiSync) is a high-performance, unified digital public infrastructure engineered to bring complete transparency, spatial accuracy, and automation to land records, property tax management, and urban zoning.

Built for municipal administrations, revenue departments, and citizens, SUTRA provides real-time cadastral visualization, standardized **ULPIN (Bhu-Aadhaar)** parcel mapping, automated property tax defaulter tracking, and spatial conflict detection.

---

## ✨ Core Features

### 1. 🗺️ High-Performance Vector GIS Mapping
- **Vector Tile Streaming**: Dynamic Mapbox Vector Tiles (`MVT`) served on the fly directly from PostGIS via `pg_tileserv`.
- **MapLibre GL Rendering**: Smooth hardware-accelerated 60 FPS vector map rendering with cadastral boundaries, land-use coloring, and interactive hover states.
- **Municipal Infrastructure Overlays**: Real-time toggles for water supply trunks, electrical transmission corridors, sewage networks, and critical facility markers.
- **Centroid Navigation & Visual Marker**: Direct coordinate flying and animated marker placement when querying any parcel or defaulter across the municipality.

### 2. 🆔 ULPIN (Bhu-Aadhaar) Parcel Intelligence
- **14-Digit Standardized Identifiers**: Implements India's Bhu-Aadhaar standard encoding State, District, Sub-District, Village, and Parcel numbers.
- **Full Ownership Chain**: Real-time ownership details coupled with historical deed chains, deed registration numbers, and transfer dates.
- **Encumbrance & Violation Indicators**: Instant audit tags for disputes, pending court litigation, unauthorized floor additions, and setback violations.
- **Digital Land Deed Viewer**: Digitized, tamper-evident Land Deed Certificates complete with official stamps, watermarks, survey coordinates, and print-ready formatting.

### 3. 💰 Municipal Revenue & Fiscal Analytics
- **Live Revenue Dashboard**: Ward-level and city-wide tracking of property tax collections, arrears, recovery percentages, and targets.
- **Spatial Defaulter Clustering**: Interactive map highlights for high-value tax defaulters.
- **1-Click Notice Dispatch**: Integrated defaulter notification endpoint dispatching immediate SMS/Email recovery alerts to parcel owners.

### 4. ⚠️ Automated Land Conflict Engine
- **Spatial Overlap Detection**: PostGIS geometry intersection checking for overlapping boundaries and fraudulent double-allocations.
- **Utility Inconsistencies**: Flags meters with missing pipeline connections or consumption anomalies.
- **Automated Background Scanner**: Continuous background worker detecting and categorizing cadastral anomalies with severity ratings.

### 5. 📐 Masterplan & Zoning Compliance
- **FAR & FSI Auditing**: Floor Area Ratio and footprint verification against municipal masterplan limits.
- **Zoning Classification**: Real-time verification of Residential, Commercial, Industrial, Agricultural, and Mixed-Use land compliance.
- **Green Buffer & Heritage Protection**: Identifies parcels violating environmental buffers or protected urban corridors.

### 6. 📢 Citizen Grievance Redressal
- **Geo-Tagged Complaints**: Direct reporting of boundary encroachment, illegal construction, drainage failure, and tax assessment disputes.
- **Resolution Tracking**: End-to-end lifecycle management (Submitted → Investigating → Resolved) with administrative filters and timestamps.

---

## 🏗️ Architecture & Technology Stack

```
                          ┌──────────────────────────┐
                          │   Next.js 16 Frontend    │
                          │ (App Router + MapLibre)  │
                          └─────────────┬────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 │ HTTP (JSON API)                             │ HTTP (MVT Tiles)
                 ▼                                             ▼
    ┌──────────────────────────┐                  ┌──────────────────────────┐
    │     FastAPI Backend      │                  │  pg_tileserv Tile Server │
    │ (SQLAlchemy + GeoAlchemy)│                  │ (Dynamic PostGIS MVT)    │
    └────────────┬─────────────┘                  └────────────┬─────────────┘
                 │                                             │
                 └──────────────────────┬──────────────────────┘
                                        ▼
                          ┌──────────────────────────┐
                          │   PostgreSQL 16 Database │
                          │       + PostGIS 3.4      │
                          └──────────────────────────┘
```

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | [Next.js 16](https://nextjs.org/) (Turbopack, TypeScript) | Modern App Router, Server Components & Client GIS UI |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) + Vanilla CSS | Clean, responsive theme with accessible contrast |
| **GIS Client** | [MapLibre GL JS](https://maplibre.org/) | Open-source WebGL vector tile mapping client |
| **Backend** | [FastAPI](https://fastapi.tiangolo.com/) (Python 3.11+) | Async REST API, OpenAPI docs, background conflict engine |
| **Database ORM** | [SQLAlchemy 2.0](https://www.sqlalchemy.org/) + [GeoAlchemy2](https://geoalchemy-2.readthedocs.io/) | Async database access with native geometry handling |
| **Spatial DB** | [PostgreSQL 16](https://www.postgresql.org/) + [PostGIS 3.4](https://postgis.net/) | Spatial indexing (`GIST`), topological queries, spatial analytics |
| **Tile Engine** | [pg_tileserv](https://github.com/CrunchyData/pg_tileserv) | Low-latency Mapbox Vector Tile generation from PostGIS tables |
| **Deployment** | [Docker Compose](https://docs.docker.com/compose/) | Multi-container orchestration for the complete stack |

---

## 🚀 Quick Start Guide

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/)
- *(Optional for local dev)*: Node.js 18+ and Python 3.11+

---

### Method 1: Instant Start with Docker Compose (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Ranveer-Panesar/SUTRA-SIH.git
   cd SUTRA-SIH
   ```

2. **Launch all services:**
   ```bash
   docker compose up -d
   ```
   This spins up:
   - **PostGIS Database**: `localhost:5432`
   - **Vector Tile Server (`pg_tileserv`)**: `localhost:7800`
   - **FastAPI Backend**: `localhost:8000`
   - **Next.js Frontend**: `localhost:3000`

3. **Seed mock data (Mohali Cadastre & Parcels):**
   ```bash
   docker compose exec backend python scripts/seed_data.py
   ```

4. **Access the application:**
   - **Web Application**: [http://localhost:3000](http://localhost:3000)
   - **Interactive API Documentation (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Vector Tile Catalog**: [http://localhost:7800](http://localhost:7800)

---

### Method 2: Manual Local Development

#### 1. Start the Database & Tile Server
```bash
docker compose up -d db pg_tileserv
```

#### 2. Run the Backend (FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt

# Run database seed script
python scripts/seed_data.py

# Start FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 3. Run the Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Repository Structure

```
SUTRA-SIH/
├── backend/
│   ├── app/
│   │   ├── main.py              # Application entrypoint & conflict loop lifecycle
│   │   ├── database.py          # Async PostgreSQL connection engine
│   │   ├── models.py            # SQLAlchemy & GeoAlchemy2 spatial models
│   │   ├── schemas.py           # Pydantic v2 validation schemas
│   │   └── routers/
│   │       ├── parcels.py       # ULPIN search, detail, fiscal, utilities & alerts
│   │       ├── analytics.py     # Municipal overview, revenue metrics, facilities
│   │       ├── complaints.py    # Citizen grievances & resolution workflow
│   │       └── conflicts.py     # Overlap detection & spatial integrity engine
│   ├── scripts/
│   │   └── seed_data.py         # Realistic cadastral generator for Mohali (SAS Nagar)
│   ├── requirements.txt         # Python dependencies
│   └── Dockerfile               # Backend container configuration
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Executive Overview & Dashboard
│   │   │   ├── map/page.tsx     # Fullscreen GIS Cadastral Explorer
│   │   │   ├── parcel/page.tsx  # ULPIN Parcel Intelligence & Deed Verification
│   │   │   ├── analytics/page.tsx # Revenue & Tax Collection Metrics
│   │   │   ├── masterplan/page.tsx# Zoning, FAR & Masterplan Regulations
│   │   │   └── complaints/page.tsx# Citizen Grievance Portal
│   │   ├── components/
│   │   │   ├── map/
│   │   │   │   ├── MapView.tsx  # MapLibre GL vector layer integration
│   │   │   │   └── PropertyDetailsModal.tsx # Fast inspection modal
│   │   │   ├── parcel/
│   │   │   │   └── LandDeedViewer.tsx # Official printable deed certificate
│   │   │   ├── analytics/
│   │   │   └── layout/
│   │   └── lib/
│   │       ├── api.ts           # Type-safe client fetchers
│   │       └── store.ts         # Global state (selected ULPIN, layer toggles)
│   ├── package.json
│   └── Dockerfile
├── db/
│   └── init.sql                 # Spatial database initialization & tile views
├── docker-compose.yml           # Unified multi-service orchestration
└── README.md                    # Project documentation
```

---

## 📡 API Reference Overview

The backend automatically generates interactive OpenAPI/Swagger documentation at `/docs`:

- `GET /api/search?q={query}`: Fuzzy search across ULPINs, plot numbers, addresses, and owners.
- `GET /api/parcels/{ulpin}`: Get complete parcel metadata, land-use, and spatial centroid.
- `GET /api/parcels/{ulpin}/ownership`: Retrieve current title holder and historical deed chain.
- `GET /api/parcels/{ulpin}/fiscal`: Property tax records, arrears, penalties, and payment status.
- `POST /api/parcels/{ulpin}/notify-defaulter`: Dispatch SMS/Email notice to defaulters.
- `GET /api/analytics/overview`: City-wide summary of parcels, wards, and total area.
- `GET /api/analytics/revenue`: Property tax collection percentage and defaulter statistics.
- `GET /api/complaints`: List geo-tagged citizen grievances with status filters.
- `POST /api/complaints`: Submit a new citizen grievance.

---

## 👥 Contributors & Acknowledgements

Developed for the **Smart India Hackathon (SIH)**.
- **Repository**: [https://github.com/Ranveer-Panesar/SUTRA-SIH](https://github.com/Ranveer-Panesar/SUTRA-SIH)
- Dedicated to building transparent, accountable, and accessible digital public infrastructure for Indian urban governance.
