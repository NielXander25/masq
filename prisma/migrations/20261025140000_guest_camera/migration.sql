-- CreateEnum
CREATE TYPE "GuestCamera" AS ENUM ('OPTIONAL', 'REQUIRED');

-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "guestCamera" "GuestCamera" NOT NULL DEFAULT 'OPTIONAL';
