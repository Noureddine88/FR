-- AlterForeignKey
-- Change StockMovement_rollId_fkey from RESTRICT to CASCADE
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_rollId_fkey";
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_rollId_fkey" FOREIGN KEY ("rollId") REFERENCES "Roll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterForeignKey
-- Change Sale_rollId_fkey from RESTRICT to CASCADE
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_rollId_fkey";
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_rollId_fkey" FOREIGN KEY ("rollId") REFERENCES "Roll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
