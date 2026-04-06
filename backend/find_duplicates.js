const fs = require('fs');
const dataPath = 'C:/Users/anand/.gemini/antigravity/brain/7dd76d5d-c9fd-452e-9ff5-400d46256d71/.system_generated/steps/271/output.txt';

try {
    const content = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(content.split('\n').find(l => l.trim().startsWith('[')).trim());

    const groups = {};
    data.forEach(item => {
        const key = `${item.companyId.$oid}_${item.templateKey}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(item._id.$oid);
    });

    let duplicatesCount = 0;
    for (const key in groups) {
        if (groups[key].length > 1) {
            console.log(`Duplicate found: ${key} (${groups[key].length} records)`);
            duplicatesCount += (groups[key].length - 1);
        }
    }
    console.log(`Total duplicates to remove: ${duplicatesCount}`);
} catch (e) {
    console.error(e.message);
}
