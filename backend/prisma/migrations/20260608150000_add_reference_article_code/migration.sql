-- Add articleCode to Reference model
ALTER TABLE "Reference" ADD COLUMN IF NOT EXISTS "articleCode" INTEGER;

-- Backfill sequential article codes for existing references
WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS rn
    FROM "Reference"
    WHERE "articleCode" IS NULL
)
UPDATE "Reference" r
SET "articleCode" = numbered.rn
FROM numbered
WHERE r.id = numbered.id;

-- Ensure no nulls remain
UPDATE "Reference" SET "articleCode" = 1 WHERE "articleCode" IS NULL;

ALTER TABLE "Reference" ALTER COLUMN "articleCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Reference_articleCode_key" ON "Reference"("articleCode");

-- Initialize reference article sequence from highest existing code
INSERT INTO "Sequence" ("name", "lastValue")
SELECT 'referenceArticle', COALESCE(MAX("articleCode"), 0) FROM "Reference"
ON CONFLICT ("name") DO UPDATE SET "lastValue" = GREATEST("Sequence"."lastValue", EXCLUDED."lastValue");