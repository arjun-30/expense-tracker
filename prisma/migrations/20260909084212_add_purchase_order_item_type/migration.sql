-- CreateEnum
CREATE TYPE "purchase_item_type" AS ENUM ('SPARE_PARTS', 'CONSUMABLES');

-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "item_type" "purchase_item_type";
