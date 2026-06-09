-- Add designCode to Design model
ALTER TABLE "Design" ADD COLUMN IF NOT EXISTS "designCode" INTEGER;

-- Backfill sequential design codes for existing designs
WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS rn
    FROM "Design"
    WHERE "designCode" IS NULL
)
UPDATE "Design" d
SET "designCode" = numbered.rn
FROM numbered
WHERE d.id = numbered.id;

-- Ensure no nulls remain
UPDATE "Design" SET "designCode" = 1 WHERE "designCode" IS NULL;

ALTER TABLE "Design" ALTER COLUMN "designCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Design_designCode_key" ON "Design"("designCode");
CREATE INDEX IF NOT EXISTS IF NOT EXISTS "Design_designCode_idx" ON "Design"("designCode");

-- Initialize design sequence from highest existing code
INSERT INTO "Sequence" ("name", "lastValue")
SELECT 'design', COALESCE(MAX("designCode"), 0) FROM "Design"
ON CONFLICT ("name") DO UPDATE SET "lastValue" = GREATEST("Sequence"."lastValue", EXCLUDED."lastValue");