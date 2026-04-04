const fs = require('fs');
const path = 'c:\\Users\\julio\\OneDrive\\Documentos\\gestion-docente\\frontend\\src\\modules\\configuracion\\pages\\ConfiguracionPage.tsx';

let content = fs.readFileSync(path, 'utf8');

const target = `              <input 
                ref={logoInputRef}
                type="file" 
                accept="image/*" 
                style={{ display: "none" }} 
                onChange={handleLogoUpload} 
              />`;

const replacement = `              <input 
                ref={logoInputRef}
                type="file" 
                accept="image/*" 
                style={{ display: "none" }} 
                onChange={handleLogoUpload} 
              />
              {imageError && (
                <p style={{ color: "#ef4444", fontSize: "11px", fontWeight: 700, marginTop: "8px", textAlign: "center" }}>
                  {imageError}
                </p>
              )}`;

if (content.includes(target)) {
  const newContent = content.replace(target, replacement);
  fs.writeFileSync(path, newContent, 'utf8');
  console.log('Successfully updated the UI in ConfiguracionPage.tsx');
} else {
  console.error('Target not found in ConfiguracionPage.tsx');
  // Try with normalized whitespace if direct match fails
  const lines = content.split('\n');
  const targetLines = target.split('\n').map(l => l.trimEnd());
  
  // Find where the sequence starts
  let found = false;
  for (let i = 0; i <= lines.length - targetLines.length; i++) {
    let match = true;
    for (let j = 0; j < targetLines.length; j++) {
      if (lines[i + j].trimEnd() !== targetLines[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      console.log('Found with fuzzy matching at line ' + (i + 1));
      lines.splice(i + targetLines.length, 0, 
        '              {imageError && (',
        '                <p style={{ color: "#ef4444", fontSize: "11px", fontWeight: 700, marginTop: "8px", textAlign: "center" }}>',
        '                  {imageError}',
        '                </p>',
        '              )}'
      );
      fs.writeFileSync(path, lines.join('\n'), 'utf8');
      console.log('Successfully updated the UI using fuzzy matching');
      found = true;
      break;
    }
  }
  if (!found) {
     console.error('Even fuzzy matching failed. Check file manually.');
  }
}
