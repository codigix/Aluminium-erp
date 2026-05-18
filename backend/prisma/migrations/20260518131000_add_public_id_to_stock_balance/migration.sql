-- AlterTable  
ALTER TABLE \`stock_balance\` ADD COLUMN \`public_id\` VARCHAR(100) NULL;  
-- CreateIndex  
CREATE UNIQUE INDEX \`public_id\` ON \`stock_balance\`(\`public_id\`);  
