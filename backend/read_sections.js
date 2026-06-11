const fs = require('fs');

const filePath = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/JobCard.jsx';
const lines = fs.readFileSync(filePath, 'utf8').split('\n');

function printSection(start, end) {
    console.log(`--- Lines ${start} to ${end} ---`);
    for (let i = start - 1; i < end; i++) {
        console.log(`${i + 1}: ${lines[i]}`);
    }
}

printSection(2295, 2325);
printSection(6555, 6590);
