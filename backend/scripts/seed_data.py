"""
BhoomiSync Seed Data Script
============================
Generates realistic synthetic land parcel data around Bengaluru (India) and
inserts it into the PostgreSQL + PostGIS database.

Run with:
    DATABASE_URL_SYNC=postgresql://bhoomi:bhoomi_secret@localhost:5432/landstack \
    python -m scripts.seed_data
"""

import os
import random
import sys
import uuid
from datetime import date, timedelta

import psycopg2
from psycopg2.extras import execute_values

# ─── Config ───────────────────────────────────────────────────────────────────

DB_URL = os.getenv(
    "DATABASE_URL_SYNC",
    "postgresql://bhoomi:bhoomi_secret@localhost:5432/landstack",
)

# Mohali center
CENTER_LAT = 30.7046
CENTER_LON = 76.7179

# Parcel grid: 6 rows × 5 cols = 30 parcels
GRID_ROWS = 6
GRID_COLS = 5

PARCEL_W = 0.00045   # ~50m longitude span
PARCEL_H = 0.00050   # ~55m latitude span
GRID_STEP_LON = 0.00065
GRID_STEP_LAT = 0.00070

WARDS = [
    "Sector 62", "Sector 70", "Sector 71", "Sector 59",
    "Phase 7", "Phase 3B2", "Sector 67", "Sector 68",
    "Sector 66", "Phase 11",
]

LAND_USES = ["Residential"] * 14 + ["Commercial"] * 8 + ["Industrial"] * 4 + ["Agricultural"] * 2 + ["Mixed"] * 2

OWNER_NAMES = [
    "Ramesh Kumar", "Priya Sharma", "Suresh Naidu", "Lakshmi Devi",
    "Mohammed Iqbal", "Anjali Menon", "Venkatesh Rao", "Deepika Nair",
    "Arun Patel", "Santhosh Gowda", "Meera Iyer", "Rajiv Shetty",
    "Fatima Begum", "Harish Chandran", "Kavitha Murthy", "Dinesh Reddy",
    "Anitha Joseph", "Prakash Hegde", "Sunita Krishnan", "Mohan Das",
    "Bhavna Singh", "Nagaraj T.", "Roopa Deshpande", "Vijay Kumar",
    "Saraswathi Bai", "Nagesh Patil", "Jyoti Rao", "Kiran Kulkarni",
    "Usha Rani", "Balakrishna",
]

PROVIDERS_ELEC = ["BESCOM", "MESCOM", "HESCOM"]
PROVIDERS_WATER = ["BWSSB", "KUWSDB"]

VIOLATIONS = [
    "Unauthorized floor construction",
    "Encroachment on setback area",
    "Illegal commercial use in residential zone",
    "Unapproved extension",
]


def make_polygon(center_lon: float, center_lat: float) -> str:
    """Generate a WKT POLYGON for a parcel at given center coordinates."""
    w, h = PARCEL_W / 2, PARCEL_H / 2
    coords = [
        (center_lon - w, center_lat - h),
        (center_lon + w, center_lat - h),
        (center_lon + w, center_lat + h),
        (center_lon - w, center_lat + h),
        (center_lon - w, center_lat - h),
    ]
    ring = ", ".join(f"{lon} {lat}" for lon, lat in coords)
    return f"SRID=4326;POLYGON(({ring}))"


def make_ulpin(state: str, row: int, col: int, index: int) -> str:
    """14-digit ULPIN: state(2) + district(2) + taluk(3) + village(3) + parcel(4)"""
    state_code = "03"      # Punjab
    district   = "59"      # SAS Nagar
    taluk      = f"{(row + 1):03d}"
    village    = f"{(col + 1):03d}"
    parcel_no  = f"{(index + 1):04d}"
    return f"{state_code}{district}{taluk}{village}{parcel_no}"


def random_date(start: date, end: date) -> date:
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))


def seed():
    print("Connecting to database...")
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()

    print("Clearing existing data...")
    for tbl in [
        "conflict_alerts", "infrastructure_records", "utility_connections",
        "tax_records", "owners", "parcels"
    ]:
        cur.execute(f"DELETE FROM {tbl}")

    parcels_data = []
    owners_data = []
    tax_data = []
    utility_data = []
    infra_data = []

    # Used connection IDs to ensure uniqueness
    used_conn_ids = set()

    start_lat = CENTER_LAT - (GRID_ROWS * GRID_STEP_LAT / 2)
    start_lon = CENTER_LON - (GRID_COLS * GRID_STEP_LON / 2)

    index = 0
    for row in range(GRID_ROWS):
        for col in range(GRID_COLS):
            parcel_id = str(uuid.uuid4())
            center_lon = start_lon + col * GRID_STEP_LON + GRID_STEP_LON / 2
            center_lat = start_lat + row * GRID_STEP_LAT + GRID_STEP_LAT / 2

            # 90% get valid ULPIN, 10% get unassigned unique placeholder
            is_assigned = random.random() < 0.90
            ulpin = make_ulpin("03", row, col, index) if is_assigned else f"PENDING-{index:06d}"
            plot_no = f"PB/MOH/{row+1:02d}/{col+1:02d}/{index+1:04d}"
            geometry = make_polygon(center_lon, center_lat)
            area_sqm = round(PARCEL_W * PARCEL_H * 111_000 * 108_000, 1)
            land_use = LAND_USES[index % len(LAND_USES)]
            ward = WARDS[index % len(WARDS)]
            address = f"{random.randint(10, 999)}, {ward} Main Road, {ward}, Mohali - {160055 + row}"

            parcels_data.append((
                parcel_id, ulpin, plot_no, geometry,
                area_sqm, land_use, ward,
                "SAS Nagar", "Punjab", address,
            ))

            # ── Owners (current + 2-3 historical) ─────────────────────────────
            num_prev_owners = random.randint(1, 3)
            current_valid_from = date(2015 + num_prev_owners * 3, random.randint(1, 12), random.randint(1, 28))
            prev_date = date(1980, 1, 1)

            for h in range(num_prev_owners):
                days_left = (current_valid_from - prev_date).days
                chunk = max(1, days_left // ((num_prev_owners - h) * 2))
                
                valid_from = random_date(prev_date, prev_date + timedelta(days=chunk))
                valid_to = random_date(valid_from + timedelta(days=1), valid_from + timedelta(days=chunk * 2))
                prev_date = valid_to
                owners_data.append((
                    str(uuid.uuid4()), parcel_id,
                    OWNER_NAMES[(index + h + 5) % len(OWNER_NAMES)],
                    random.choice(["Freehold", "Leasehold"]),
                    str(random.randint(1000, 9999)),
                    f"9{random.randint(100000000, 999999999)}",
                    f"SY.NO.{random.randint(100, 999)}",
                    valid_from, valid_to,
                    f"REG/{valid_from.year}/{random.randint(10000, 99999)}",
                ))

            # Current owner
            owners_data.append((
                str(uuid.uuid4()), parcel_id,
                OWNER_NAMES[index % len(OWNER_NAMES)],
                random.choice(["Freehold", "Freehold", "Leasehold"]),
                str(random.randint(1000, 9999)),
                f"9{random.randint(100000000, 999999999)}",
                f"SY.NO.{random.randint(100, 999)}",
                current_valid_from, None,  # valid_to=None = current
                f"REG/{current_valid_from.year}/{random.randint(10000, 99999)}",
            ))

            # ── Tax Records (5 years) ──────────────────────────────────────────
            base_tax = random.uniform(3000, 25000)
            years = ["2020-21", "2021-22", "2022-23", "2023-24", "2024-25"]
            is_defaulter_pattern = random.random() < 0.30  # 30% chance of being a chronic defaulter

            for fy in years:
                due = round(base_tax * (1 + years.index(fy) * 0.05), 2)
                if is_defaulter_pattern and fy == "2024-25":
                    paid = 0.0
                    status = "Defaulter"
                    payment_date = None
                    arrears = round(due * random.uniform(0.5, 2.0), 2)
                elif is_defaulter_pattern and fy == "2023-24":
                    paid = round(due * random.uniform(0.1, 0.5), 2)
                    status = "Partial"
                    payment_date = random_date(date(2024, 4, 1), date(2024, 12, 31))
                    arrears = round(due - paid, 2)
                else:
                    paid = due
                    status = "Paid"
                    payment_date = random_date(date(int(fy[:4]), 4, 1), date(int(fy[:4]), 8, 30))
                    arrears = 0.0

                tax_data.append((
                    str(uuid.uuid4()), parcel_id, fy,
                    due, paid, status, payment_date, arrears,
                    round(arrears * 0.12, 2),
                ))

            # ── Utility Connections ────────────────────────────────────────────
            # Electricity
            elec_id = f"BESCOM{random.randint(1000000, 9999999)}"
            while elec_id in used_conn_ids:
                elec_id = f"BESCOM{random.randint(1000000, 9999999)}"
            used_conn_ids.add(elec_id)

            # Industrial zone gets high consumption for conflict detection
            avg_elec = 950.0 if (land_use == "Residential" and index % 7 == 0) else (
                random.uniform(100, 400) if land_use == "Residential"
                else random.uniform(400, 1500)
            )

            utility_data.append((
                str(uuid.uuid4()), parcel_id, "Electricity",
                random.choice(["Active", "Active", "Active", "Inactive"]),
                random.choice(PROVIDERS_ELEC), elec_id,
                round(avg_elec, 1), "kWh", "Working",
                round(avg_elec * random.uniform(4.5, 6.0), 2),
                date(2025, random.randint(1, 9), random.randint(1, 28)),
            ))

            # Water
            water_id = f"BWSSB{random.randint(1000000, 9999999)}"
            while water_id in used_conn_ids:
                water_id = f"BWSSB{random.randint(1000000, 9999999)}"
            used_conn_ids.add(water_id)

            utility_data.append((
                str(uuid.uuid4()), parcel_id, "Water",
                random.choice(["Active", "Active", "Inactive"]),
                random.choice(PROVIDERS_WATER), water_id,
                round(random.uniform(5, 35), 1), "KL",
                random.choice(["Working", "Working", "Faulty"]),
                round(random.uniform(200, 2000), 2),
                date(2025, random.randint(1, 9), random.randint(1, 28)),
            ))

            # ── Infrastructure ─────────────────────────────────────────────────
            has_violations = random.random() < 0.20  # 20% have violations
            n_violations = random.randint(1, 3) if has_violations else 0
            viol_detail = (
                [{"type": random.choice(VIOLATIONS), "date": str(random_date(date(2020, 1, 1), date(2025, 1, 1)))}
                 for _ in range(n_violations)]
                if has_violations else []
            )
            import json
            infra_data.append((
                str(uuid.uuid4()), parcel_id,
                random.random() < 0.70,  # sewage_connected
                f"MH-{ward[:3].upper()}-{random.randint(100, 999)}",
                random.random() < 0.75,  # building_plan_approved
                random.choice(["G", "G+1", "G+2", "G+3", "G+4"]),
                random.randint(1985, 2020),
                n_violations,
                json.dumps(viol_detail),
            ))

            index += 1

    print(f"Inserting {len(parcels_data)} parcels...")

    # Insert parcels using ST_GeomFromEWKT for the geometry
    for pid, ulpin, pno, geom, area, lu, ward, dist, st, addr in parcels_data:
        cur.execute("""
            INSERT INTO parcels (id, ulpin, plot_number, geometry, area_sqm, land_use, ward_name,
                                 district, state, address)
            VALUES (%s, %s, %s, ST_GeomFromEWKT(%s), %s, %s, %s, %s, %s, %s)
        """, (pid, ulpin, pno, geom, area, lu, ward, dist, st, addr))

    print(f"Inserting {len(owners_data)} owner records...")
    execute_values(cur, """
        INSERT INTO owners (id, parcel_id, owner_name, ownership_type, owner_aadhar,
                            contact_phone, survey_number, valid_from, valid_to, deed_number)
        VALUES %s
    """, owners_data)

    print(f"Inserting {len(tax_data)} tax records...")
    execute_values(cur, """
        INSERT INTO tax_records (id, parcel_id, financial_year, amount_due, amount_paid,
                                 status, payment_date, arrears, penalty)
        VALUES %s
    """, tax_data)

    print(f"Inserting {len(utility_data)} utility connections...")
    execute_values(cur, """
        INSERT INTO utility_connections (id, parcel_id, utility_type, connection_status,
                                         provider, connection_id, avg_consumption, consumption_unit,
                                         meter_status, recent_bill_amount, last_reading_date)
        VALUES %s
    """, utility_data)

    print(f"Inserting {len(infra_data)} infrastructure records...")
    execute_values(cur, """
        INSERT INTO infrastructure_records (id, parcel_id, sewage_connected, nearest_manhole_id,
                                            building_plan_approved, approved_floors,
                                            construction_year, active_violations, violations_detail)
        VALUES %s
    """, infra_data)

    conn.commit()
    cur.close()
    conn.close()
    print(f"✅ Seed complete! Inserted {index} parcels with all linked data.")


if __name__ == "__main__":
    import json  # ensure json is importable in closure
    seed()
