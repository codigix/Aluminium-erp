ALTER TABLE workstations
ADD COLUMN location VARCHAR(255) AFTER department,
ADD COLUMN capacity_per_hour DECIMAL(12, 2) DEFAULT 0.00 AFTER location,
ADD COLUMN target_utilization DECIMAL(5, 2) DEFAULT 80.00 AFTER capacity_per_hour,
ADD COLUMN equipment_code VARCHAR(100) AFTER workstation_type,
ADD COLUMN maintenance_frequency VARCHAR(50) AFTER equipment_code,
ADD COLUMN last_maintenance_date DATE AFTER maintenance_frequency,
ADD COLUMN assigned_operators TEXT AFTER last_maintenance_date,
ADD COLUMN description TEXT AFTER assigned_operators;

-- Rename workstation_type to equipment_type to match UI if needed, but keeping it as workstation_type in DB for now to avoid breaking existing code if any.
-- Actually, the screenshot calls it "Equipment Type", so maybe I should rename or just map it.
-- Let's stick with the current names and add what's missing.
