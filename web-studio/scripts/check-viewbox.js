const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '../public/assets/props');
fs.readdirSync(dir).filter(f => f.endsWith('.svg')).forEach(f => {
  const c = fs.readFileSync(path.join(dir, f), 'utf8');
  const m = c.match(/viewBox=["']([^"']+)["']/);
  console.log(f.padEnd(20), m ? m[1] : 'NO VIEWBOX');
});
