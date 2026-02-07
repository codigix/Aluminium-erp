const productionPlanService = require('./backend/src/services/productionPlanService');
const db = require('./backend/src/config/db');

async function test() {
  try {
    console.log("Starting test for item 127...");
    const details = await productionPlanService.getItemBOMDetails(127);
    console.log("--- FINAL RESULTS ---");
    console.log("Materials Count:", details.materials.length);
    console.log("Components Count:", details.components.length);
    console.log("Operations Count:", details.operations.length);
    
    // console.log("Materials:", JSON.stringify(details.materials, null, 2));
    // console.log("Components:", JSON.stringify(details.components, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

test();
