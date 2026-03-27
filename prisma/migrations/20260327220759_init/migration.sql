-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'courier');

-- CreateEnum
CREATE TYPE "HouseStatus" AS ENUM ('NOT_DELIVERED', 'DELIVERED', 'NO_ADVERTISE');

-- CreateEnum
CREATE TYPE "StreetRuleType" AS ENUM ('all', 'odd', 'even', 'from_number', 'to_number', 'include_numbers', 'exclude_numbers');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'courier',
    "is_disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRegionAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRegionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreetRule" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "street_name" TEXT NOT NULL,
    "rule_type" "StreetRuleType" NOT NULL,
    "from_number" INTEGER,
    "to_number" INTEGER,
    "include_numbers" TEXT[],
    "exclude_numbers" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "StreetRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApartmentGroup" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "building_id" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApartmentGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseNumberConflict" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "streetName" TEXT NOT NULL,
    "current_housenumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseNumberConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseMarker" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "streetRuleId" TEXT,
    "street_name" TEXT NOT NULL,
    "osm_default_housenumber" TEXT NOT NULL,
    "current_housenumber" TEXT NOT NULL,
    "is_number_overridden" BOOLEAN NOT NULL DEFAULT false,
    "delivery_status" "HouseStatus" NOT NULL DEFAULT 'NOT_DELIVERED',
    "last_delivered_at" TIMESTAMP(3),
    "last_delivery_update_at" TIMESTAMP(3),
    "is_selected_by_rule" BOOLEAN NOT NULL DEFAULT false,
    "is_manually_added" BOOLEAN NOT NULL DEFAULT false,
    "is_manually_excluded" BOOLEAN NOT NULL DEFAULT false,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "building_id" TEXT,
    "apartment_group_id" TEXT,
    "conflictId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseMarker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserRegionAssignment_regionId_idx" ON "UserRegionAssignment"("regionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRegionAssignment_userId_regionId_key" ON "UserRegionAssignment"("userId", "regionId");

-- CreateIndex
CREATE INDEX "StreetRule_regionId_street_name_idx" ON "StreetRule"("regionId", "street_name");

-- CreateIndex
CREATE UNIQUE INDEX "StreetRule_regionId_street_name_key" ON "StreetRule"("regionId", "street_name");

-- CreateIndex
CREATE INDEX "ApartmentGroup_regionId_idx" ON "ApartmentGroup"("regionId");

-- CreateIndex
CREATE UNIQUE INDEX "ApartmentGroup_regionId_building_id_key" ON "ApartmentGroup"("regionId", "building_id");

-- CreateIndex
CREATE INDEX "HouseNumberConflict_regionId_idx" ON "HouseNumberConflict"("regionId");

-- CreateIndex
CREATE UNIQUE INDEX "HouseNumberConflict_regionId_streetName_current_housenumber_key" ON "HouseNumberConflict"("regionId", "streetName", "current_housenumber");

-- CreateIndex
CREATE INDEX "HouseMarker_regionId_street_name_idx" ON "HouseMarker"("regionId", "street_name");

-- CreateIndex
CREATE INDEX "HouseMarker_regionId_current_housenumber_idx" ON "HouseMarker"("regionId", "current_housenumber");

-- AddForeignKey
ALTER TABLE "UserRegionAssignment" ADD CONSTRAINT "UserRegionAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRegionAssignment" ADD CONSTRAINT "UserRegionAssignment_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreetRule" ADD CONSTRAINT "StreetRule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreetRule" ADD CONSTRAINT "StreetRule_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApartmentGroup" ADD CONSTRAINT "ApartmentGroup_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseNumberConflict" ADD CONSTRAINT "HouseNumberConflict_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseMarker" ADD CONSTRAINT "HouseMarker_apartment_group_id_fkey" FOREIGN KEY ("apartment_group_id") REFERENCES "ApartmentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseMarker" ADD CONSTRAINT "HouseMarker_conflictId_fkey" FOREIGN KEY ("conflictId") REFERENCES "HouseNumberConflict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseMarker" ADD CONSTRAINT "HouseMarker_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseMarker" ADD CONSTRAINT "HouseMarker_streetRuleId_fkey" FOREIGN KEY ("streetRuleId") REFERENCES "StreetRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
