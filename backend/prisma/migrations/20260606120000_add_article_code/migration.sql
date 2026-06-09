-- CreateTable
CREATE TABLE IF NOT EXISTS "Sequence" (
    "name" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("name")
);

-- AlterTable
ALTER TABLE "Roll" ADD COLUMN IF NOT EXISTS "articleCode" INTEGER;

-- Backfill sequential article codes for existing rolls
WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS rn
    FROM "Roll"
    WHERE "articleCode" IS NULL
)
UPDATE "Roll" r
SET "articleCode" = numbered.rn
FROM numbered
WHERE r.id = numbered.id;

-- Ensure no nulls remain (empty table edge case)
UPDATE "Roll" SET "articleCode" = 1 WHERE "articleCode" IS NULL;

ALTER TABLE "Roll" ALTER COLUMN "articleCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Roll_articleCode_key" ON "Roll"("articleCode");

-- Initialize article sequence from highest existing code
INSERT INTO "Sequence" ("name", "lastValue")
SELECT 'article', COALESCE(MAX("articleCode"), 0) FROM "Roll"
ON CONFLICT ("name") DO UPDATE SET "lastValue" = GREATEST("Sequence"."lastValue", EXCLUDED."lastValue");

-- Initialize customer sequence if missing
INSERT INTO "Sequence" ("name", "lastValue")
SELECT 'customer', COALESCE(MAX("customerCode"), 0) FROM "Customer"
ON CONFLICT ("name") DO UPDATE SET "lastValue" = GREATEST("Sequence"."lastValue", EXCLUDED."lastValue");
