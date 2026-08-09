/*
  Warnings:

  - Added the required column `originalFileName` to the `Import` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Import" ADD COLUMN     "originalFileName" TEXT NOT NULL;
