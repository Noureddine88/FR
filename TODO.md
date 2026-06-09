# ARTICLE MANAGEMENT REFACTOR — COMPLETED

All article management improvements have been implemented and verified.

## ✅ Done — Article Code System
- [x] Prisma schema: `articleCode Int @unique` on `Roll` model
- [x] Migration created and applied (`20260606120000_add_article_code`)
- [x] `Sequence` model for auto-increment (never reused after deletion)
- [x] `nextArticleCode()` — transactional upsert in `stock.js`
- [x] `formatArticleCode()` — 4-digit padding (1 → `0001`)
- [x] `articleCode` excluded from `updateRoll` (cannot be manually edited)

## ✅ Done — Backend Search
- [x] `listRolls` supports search by: articleCode (numeric), design name, color name, color code
- [x] Response includes `articleCodeFormatted` (0001) and `suggestionLabel` (0001 - Design - Color)
- [x] Search limit of 50 results, ordered by articleCode ascending
- [x] `GET /rolls/search` endpoint with same `listRolls` controller

## ✅ Done — Stock Table (Frontend)
- [x] Column "CODE ARTICLE" displayed (not "CODE-BARRES")
- [x] Shows `articleCodeFormatted` (0001, 0002...)
- [x] No ROLL-xxxx visible to users
- [x] Search bar supports article code, design, color

## ✅ Done — Devis Article Selector
- [x] `ArticleLookup` component — searchable autocomplete dropdown
- [x] Search by article code, design name, color name
- [x] Displays: `0001 - DesignName - ColorName`
- [x] Fills fields: articleCode, designation, unitPriceHt
- [x] Sends correct `articleCode` to backend

## ✅ Done — PDF Improvements
- [x] Responsive column widths (flex-based)
- [x] Automatic text wrapping and multi-line designation
- [x] Dynamic row heights (prevents overflow)
- [x] Zebra rows, professional ERP appearance
- [x] Footer with signatures and company info

### PDF Column Layouts
**Devis:** Code, Désignation, Qté, UN, P.U HT, TVA, P.U TTC, Montant HT
**Bon de Livraison:** Code, Désignation, Qté, UN
**Facture:** Code, Désignation, Qté, UN, P.U HT, TVA, P.U TTC, Montant HT

## ✅ Done — Naming
- [x] Nav sidebar shows "Articles" (not "Références")
- [x] Article codes (0001–9999) used as primary identifier everywhere
- [x] ROLL-xxxx format kept internally for database relations only