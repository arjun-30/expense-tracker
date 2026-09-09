/*
  Warnings:

  - You are about to drop the `consumable_usage` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "consumable_usage" DROP CONSTRAINT "consumable_usage_consumable_id_fkey";

-- DropForeignKey
ALTER TABLE "consumable_usage" DROP CONSTRAINT "consumable_usage_cost_center_id_fkey";

-- DropForeignKey
ALTER TABLE "consumable_usage" DROP CONSTRAINT "consumable_usage_department_id_fkey";

-- DropForeignKey
ALTER TABLE "consumable_usage" DROP CONSTRAINT "consumable_usage_machine_id_fkey";

-- DropForeignKey
ALTER TABLE "consumable_usage" DROP CONSTRAINT "consumable_usage_stock_movement_id_fkey";

-- DropTable
DROP TABLE "consumable_usage";

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
