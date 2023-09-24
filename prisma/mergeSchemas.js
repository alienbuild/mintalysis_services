const fs = require('fs');
const path = require('path');

const schemasDirectory = path.resolve(__dirname, 'schemas');
const mainSchemaPath = path.resolve(__dirname, 'schema.prisma');

let schemasContent = '';

function readDirectory(directory) {
    fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
        const entryPath = path.resolve(directory, entry.name);
        if (entry.isDirectory()) {
            readDirectory(entryPath);
        } else if (entry.isFile() && entry.name.endsWith('.prisma')) {
            const fileContent = fs.readFileSync(entryPath, 'utf-8');
            schemasContent += '\n' + fileContent;
        }
    });
}

readDirectory(schemasDirectory);

let mainSchemaContent = fs.readFileSync(mainSchemaPath, 'utf-8');
mainSchemaContent = mainSchemaContent.replace(/\/\/ BEGIN_MODELS([\s\S]*)\/\/ END_MODELS/, `// BEGIN_MODELS${schemasContent}\n// END_MODELS`);
fs.writeFileSync(mainSchemaPath, mainSchemaContent);
