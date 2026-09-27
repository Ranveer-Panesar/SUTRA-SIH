"""
Parcels router — serves individual ULPIN data, fuzzy search, and spatial queries.

Key design decisions:
- Each sub-resource (ownership, fiscal, utilities, infra) is a SEPARATE endpoint
  so the frontend can independently fetch them with skeleton loaders.
- Fuzzy search uses PostgreSQL pg_trgm similarity() for typo tolerance.
- Spatial query accepts a GeoJSON polygon and returns aggregated stats.
"""

import json
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import ConflictAlert, InfrastructureRecord, Owner, Parcel, TaxRecord, UtilityConnection
from ..schemas import (
    FiscalResponse,
    InfraOut,
    OwnerOut,
    OwnershipResponse,
    ParcelDetail,
    SearchResult,
    SpatialQueryRequest,
    SpatialQueryResult,
    TaxRecordOut,
    UtilitiesResponse,
    UtilityOut,
    ParcelSummary,
)

router = APIRouter()


# ─── Parcel Detail ────────────────────────────────────────────────────────────

@router.get("/parcels/{ulpin}", response_model=ParcelDetail)
async def get_parcel(ulpin: str, db: AsyncSession = Depends(get_db)):
    """Get core parcel metadata by ULPIN."""
    result = await db.execute(
        select(Parcel, func.ST_AsGeoJSON(func.ST_Centroid(Parcel.geometry)).label("centroid"))
        .where(Parcel.ulpin == ulpin)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Parcel with ULPIN {ulpin} not found")

    parcel = row[0]
    centroid_str = row[1]

    # Check for active conflicts
    conflict_result = await db.execute(
        select(ConflictAlert)
        .where(ConflictAlert.parcel_id == parcel.id, ConflictAlert.resolved == False)
    )
    has_conflict = conflict_result.first() is not None

    return ParcelDetail(
        id=parcel.id,
        ulpin=parcel.ulpin,
        plot_number=parcel.plot_number,
        area_sqm=parcel.area_sqm,
        land_use=parcel.land_use,
        ward_name=parcel.ward_name,
        district=parcel.district,
        state=parcel.state,
        address=parcel.address,
        has_conflict=has_conflict,
        geometry=json.loads(centroid_str) if centroid_str else None,
    )


# ─── Ownership (Record of Rights) ─────────────────────────────────────────────

@router.get("/parcels/{ulpin}/ownership", response_model=OwnershipResponse)
async def get_ownership(ulpin: str, db: AsyncSession = Depends(get_db)):
    """Get current owner + ownership history for a parcel."""
    result = await db.execute(select(Parcel).where(Parcel.ulpin == ulpin))
    parcel = result.scalar_one_or_none()
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")

    owners_result = await db.execute(
        select(Owner)
        .where(Owner.parcel_id == parcel.id)
        .order_by(Owner.valid_from.desc())
    )
    all_owners = owners_result.scalars().all()

    current = next((o for o in all_owners if o.valid_to is None), None)
    history = [o for o in all_owners if o.valid_to is not None]

    return OwnershipResponse(
        current_owner=OwnerOut.model_validate(current) if current else None,
        history=[OwnerOut.model_validate(o) for o in history],
    )


# ─── Fiscal (Tax Department) ──────────────────────────────────────────────────

@router.get("/parcels/{ulpin}/fiscal", response_model=FiscalResponse)
async def get_fiscal(ulpin: str, db: AsyncSession = Depends(get_db)):
    """Get property tax records for the last 5 years."""
    result = await db.execute(select(Parcel).where(Parcel.ulpin == ulpin))
    parcel = result.scalar_one_or_none()
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")

    tax_result = await db.execute(
        select(TaxRecord)
        .where(TaxRecord.parcel_id == parcel.id)
        .order_by(TaxRecord.financial_year.desc())
        .limit(5)
    )
    records = tax_result.scalars().all()

    if not records:
        return FiscalResponse(current_status="Unknown", current_fy_due=0, total_arrears=0, records=[])

    latest = records[0]
    total_arrears = sum(float(r.arrears or 0) for r in records)

    return FiscalResponse(
        current_status=latest.status,
        current_fy_due=float(latest.amount_due - latest.amount_paid),
        total_arrears=total_arrears,
        records=[TaxRecordOut.model_validate(r) for r in records],
    )


# ─── Notifications ────────────────────────────────────────────────────────────

@router.post("/parcels/{ulpin}/notify-defaulter")
async def notify_defaulter(ulpin: str, db: AsyncSession = Depends(get_db)):
    """Mock endpoint to send SMS/Email to a tax defaulter."""
    result = await db.execute(select(Parcel).where(Parcel.ulpin == ulpin))
    parcel = result.scalar_one_or_none()
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")
        
    return {"status": "success", "message": f"Notice sent to owner of {ulpin}"}


# ─── Utilities ────────────────────────────────────────────────────────────────

@router.get("/parcels/{ulpin}/utilities", response_model=UtilitiesResponse)
async def get_utilities(ulpin: str, db: AsyncSession = Depends(get_db)):
    """Get electricity and water utility connections."""
    result = await db.execute(select(Parcel).where(Parcel.ulpin == ulpin))
    parcel = result.scalar_one_or_none()
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")

    util_result = await db.execute(
        select(UtilityConnection).where(UtilityConnection.parcel_id == parcel.id)
    )
    utilities = util_result.scalars().all()

    electricity = next((u for u in utilities if u.utility_type == "Electricity"), None)
    water = next((u for u in utilities if u.utility_type == "Water"), None)

    return UtilitiesResponse(
        electricity=UtilityOut.model_validate(electricity) if electricity else None,
        water=UtilityOut.model_validate(water) if water else None,
    )


# ─── Infrastructure ───────────────────────────────────────────────────────────

@router.get("/parcels/{ulpin}/infrastructure", response_model=InfraOut)
async def get_infrastructure(ulpin: str, db: AsyncSession = Depends(get_db)):
    """Get physical assets and infrastructure record."""
    result = await db.execute(select(Parcel).where(Parcel.ulpin == ulpin))
    parcel = result.scalar_one_or_none()
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")

    infra_result = await db.execute(
        select(InfrastructureRecord).where(InfrastructureRecord.parcel_id == parcel.id)
    )
    infra = infra_result.scalar_one_or_none()
    if not infra:
        return InfraOut()

    return InfraOut.model_validate(infra)


# ─── Fuzzy Search ─────────────────────────────────────────────────────────────

@router.get("/search", response_model=list[SearchResult])
async def search_parcels(
    q: str = Query(..., min_length=2, description="Search by ULPIN, owner name, or address"),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """
    Fuzzy search using pg_trgm. Tolerates typos and partial matches.
    Searches across: ULPIN (exact prefix), owner_name (trgm), address (trgm).
    """
    # Exact ULPIN prefix match first
    if q.isdigit():
        ulpin_result = await db.execute(
            select(Parcel).where(Parcel.ulpin.like(f"{q}%")).limit(limit)
        )
        exact_parcels = ulpin_result.scalars().all()
        if exact_parcels:
            results = []
            for p in exact_parcels:
                owner_res = await db.execute(
                    select(Owner).where(Owner.parcel_id == p.id, Owner.valid_to == None).limit(1)
                )
                owner = owner_res.scalar_one_or_none()
                results.append(SearchResult(
                    ulpin=p.ulpin,
                    plot_number=p.plot_number,
                    address=p.address,
                    owner_name=owner.owner_name if owner else None,
                    similarity=1.0,
                ))
            return results

    # Trigram fuzzy search across owner names and addresses
    sql = text("""
        SELECT
            p.ulpin,
            p.plot_number,
            p.address,
            o.owner_name,
            GREATEST(
                COALESCE(similarity(o.owner_name, :q), 0),
                COALESCE(similarity(p.address, :q), 0)
            ) AS sim
        FROM parcels p
        LEFT JOIN owners o ON o.parcel_id = p.id AND o.valid_to IS NULL
        WHERE
            similarity(o.owner_name, :q) > 0.15
            OR similarity(p.address, :q) > 0.15
        ORDER BY sim DESC
        LIMIT :limit
    """)
    rows = await db.execute(sql, {"q": q, "limit": limit})
    results = []
    for row in rows.mappings():
        results.append(SearchResult(
            ulpin=row["ulpin"],
            plot_number=row["plot_number"],
            address=row["address"],
            owner_name=row["owner_name"],
            similarity=float(row["sim"] or 0),
        ))
    return results


# ─── Spatial Query (Draw & Select) ────────────────────────────────────────────

@router.post("/parcels/spatial-query", response_model=SpatialQueryResult)
async def spatial_query(
    body: SpatialQueryRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Accept a GeoJSON polygon, return all parcels within + aggregated stats.
    Used by the Draw & Select tool on the map.
    """
    geojson_str = json.dumps(body.geojson_polygon)

    sql = text("""
        SELECT
            p.id::text,
            p.ulpin,
            p.plot_number,
            p.area_sqm,
            p.land_use,
            p.ward_name,
            p.address,
            o.owner_name,
            COALESCE(t.amount_due - t.amount_paid, 0) AS pending_tax,
            t.status AS tax_status
        FROM parcels p
        LEFT JOIN owners o ON o.parcel_id = p.id AND o.valid_to IS NULL
        LEFT JOIN LATERAL (
            SELECT amount_due, amount_paid, status
            FROM tax_records
            WHERE parcel_id = p.id
            ORDER BY financial_year DESC
            LIMIT 1
        ) t ON TRUE
        WHERE ST_Within(
            p.geometry,
            ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326)
        )
        LIMIT 500
    """)

    rows = await db.execute(sql, {"geojson": geojson_str})
    parcels = rows.mappings().all()

    total_pending = sum(float(r["pending_tax"] or 0) for r in parcels)
    defaulters = sum(1 for r in parcels if r["tax_status"] == "Defaulter")
    total_area = sum(float(r["area_sqm"] or 0) for r in parcels)

    parcel_list = [
        ParcelSummary(
            id=UUID(r["id"]),
            ulpin=r["ulpin"],
            plot_number=r["plot_number"],
            area_sqm=float(r["area_sqm"]),
            land_use=r["land_use"],
            ward_name=r["ward_name"],
            address=r["address"],
            owner_name=r["owner_name"],
        )
        for r in parcels
    ]

    return SpatialQueryResult(
        parcel_count=len(parcel_list),
        total_area_sqm=total_area,
        total_pending_tax=total_pending,
        defaulter_count=defaulters,
        parcels=parcel_list,
    )
