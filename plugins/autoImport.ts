import fs from  'fs';
import path from 'path';

export default function autoImportPlugin() {
    return {
        name: 'auto-import-plugin',
        load(id) {
            //自动生成路由文件导入到app.tsx中应用
            if (id.endsWith('app.tsx')) {
                const routesDir = path.resolve(__dirname, '../app/pages');
                const files = fs.readdirSync(routesDir);
                const imports = files
                    .filter(file => file.endsWith('index.tsx') || file.endsWith('index.jsx'))
                    .map((file) => {
                        const routeName = path.basename(file, path.extname(file));
                        return `import ${routeName} from './pages'/${file}';`;
                    })
                    .join('\n');

                const routeComponents = files
                    .filter(file => file.endsWith('.tsx') || file.endsWith('.jsx'))
                    .map((file, index) => `Route${index}`)
                    .join(', ');

                const appContent = `
                    import React from 'react';
                    ${imports}
                    export default function App() {
                        return (
                            <div>
                                ${routeComponents.split(', ').map(comp => `<${comp} />`).join('\n')}
                            </div>
                        );
                    }
                `;
                return appContent;
            }  

        }
    }
}