const fs = require('fs');
const path = require('path');
const content = fs.readFileSync(path.join('D:/UGit/LPTV', 'channels', 'default.m3u'), 'utf-8');
const lines = content.split('\n');

console.log('Total lines:', lines.length);
console.log('First 10 lines:');
lines.slice(0, 10).forEach((l, i) => console.log(i, JSON.stringify(l)));

// Check the regex
const testLine = lines.find(l => l.startsWith('#EXTINF:'));
console.log('\nTest line:', JSON.stringify(testLine));
const match = testLine && testLine.match(/tvg-name="([^"]*)".*?group-title="([^"]*)"[^,]*,(.*)/);
console.log('Regex match:', match);

// Try alternative regex
const match2 = testLine && testLine.match(/group-title="([^"]*)"[^,]*,([^\s]+)/);
console.log('Alt regex match:', match2);
