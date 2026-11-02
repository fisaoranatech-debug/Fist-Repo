-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "liveUntil" TIMESTAMP(3),
ADD COLUMN     "trackingIntervalSec" INTEGER NOT NULL DEFAULT 300;
