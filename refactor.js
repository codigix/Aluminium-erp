
const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/DesignOrders.jsx', 'utf8');

code = code.replace(/import \{.*?\} from '\.\.\/components\/ui\.jsx';/, match => {
  return match + '\nimport DataTable from \'../components/DataTable.jsx\';';
});

code = code.replace(/useState\(new Set\(\)\)/g, 'useState([])');
code = code.replace(/selectedIncomingOrders\.size/g, 'selectedIncomingOrders.length');
code = code.replace(/selectedIncomingOrders\.has\(/g, 'selectedIncomingOrders.includes(');
code = code.replace(/Array\.from\(selectedIncomingOrders\)/g, '[...selectedIncomingOrders]');

code = code.replace(
  /const toggleSelectOrder = \(orderId\) => \{[\s\S]*?\};/,
  \const toggleSelectOrder = (orderId) => {
    setSelectedIncomingOrders(prev => {
      if (prev.includes(orderId)) return prev.filter(id => id !== orderId);
      return [...prev, orderId];
    });
  };\
);

code = code.replace(/const newSelected = new Set\(selectedIncomingOrders\);/g, 'let newSelected = [...selectedIncomingOrders];');
code = code.replace(/newSelected\.add\(/g, 'newSelected.push(');
code = code.replace(/newSelected\.delete\(o\.item_id\)/g, 'newSelected = newSelected.filter(id => id !== o.item_id)');

fs.writeFileSync('frontend/src/pages/DesignOrders.jsx', code);

