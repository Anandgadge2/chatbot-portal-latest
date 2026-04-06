const fs = require('fs');
const dataPath = 'C:/Users/anand/.gemini/antigravity/brain/7dd76d5d-c9fd-452e-9ff5-400d46256d71/.system_generated/steps/214/output.txt';
const outPath = 'ids_to_delete.json';

try {
    const content = fs.readFileSync(dataPath, 'utf8');
    const lines = content.split('\n');
    const jsonLine = lines.find(l => l.trim().startsWith('['));
    if (!jsonLine) throw new Error('No JSON data found starting with [');

    const data = JSON.parse(jsonLine.trim());

    const groups = {};

    data.forEach(item => {
        const companyId = (item.companyId && item.companyId.$oid) || 'no_company';
        const key = `${companyId}_${item.templateKey}`;
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(item);
    });

    const idsToDelete = [];
    const idsToKeep = [];

    for (const key in groups) {
        const sorted = groups[key].sort((a, b) => {
            const dateA = a.updatedAt ? new Date(a.updatedAt.$date) : new Date(0);
            const dateB = b.updatedAt ? new Date(b.updatedAt.$date) : new Date(0);
            return dateB - dateA;
        });
        idsToKeep.push(sorted[0]._id.$oid);
        for (let i = 1; i < sorted.length; i++) {
            idsToDelete.push(sorted[i]._id.$oid);
        }
    }

    fs.writeFileSync(outPath, JSON.stringify(idsToDelete));
    console.log(`Saved ${idsToDelete.length} IDs to delete.`);
} catch (e) {
    fs.writeFileSync(outPath, JSON.stringify({ error: e.message }));
}
