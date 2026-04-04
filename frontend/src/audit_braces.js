const fs = require('fs');

const content = fs.readFileSync('App.tsx', 'utf8');
const lines = content.split('\n');

let balance = 0;
let inApp = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('export default function App()')) {
    inApp = true;
  }
  
  const opens = (line.match(/{/g) || []).length;
  const closes = (line.match(/}/g) || []).length;
  
  const oldBalance = balance;
  balance += opens;
  balance -= closes;
  
  if (inApp && balance === 0 && oldBalance !== 0) {
    console.log(`App might have closed at line ${i + 1}: ${line}`);
  }
  
  if (balance < 0) {
    console.log(`Balance went negative at line ${i + 1}: ${line}`);
    balance = 0; // Reset to continue auditing
  }
}

console.log(`Final balance: ${balance}`);
