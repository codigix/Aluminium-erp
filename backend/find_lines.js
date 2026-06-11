const fs = require('fs');
const path = require('path');

const filePath = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/JobCard.jsx';
const lines = fs.readFileSync(filePath, 'utf8').split('\n');

function find(query) {
    console.log(`--- Searching for: "${query}" ---`);
    lines.forEach((line, idx) => {
        if (line.toLowerCase().includes(query.toLowerCase())) {
            console.log(`${idx + 1}: ${line.trim()}`);
        }
    });
}

find('Standard Time (Min)');
find('Net Time');
find('stdTime:');
find('std_time');
find('Edit Job Card');
