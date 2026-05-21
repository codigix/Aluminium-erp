const fs = require('fs');
const git = require('isomorphic-git');
async function restore() {
  try {
    const dir = 'e:/codigix-project/Aluminium-erp';
    const filepath = 'frontend/src/pages/QuotationFormPage.jsx';
    await git.checkout({
      fs,
      dir,
      filepaths: [filepath],
      force: true
    });
    console.log("File restored successfully!");
  } catch (e) {
    console.error("Error restoring file: ", e);
  }
}
restore();
