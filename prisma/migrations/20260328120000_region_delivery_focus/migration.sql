-- AlterTable
ALTER TABLE "Region" ADD COLUMN "deliveryFocusHouseMarkerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Region_deliveryFocusHouseMarkerId_key" ON "Region"("deliveryFocusHouseMarkerId");

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_deliveryFocusHouseMarkerId_fkey" FOREIGN KEY ("deliveryFocusHouseMarkerId") REFERENCES "HouseMarker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
