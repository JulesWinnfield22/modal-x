const fs = require('node:fs');
const path = require('node:path');

/**
 * Native recursive file scanner
 */
function findAllFiles(dir, extensions, blacklist, rootPath) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.resolve(dir, file); // Ensure absolute paths
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (blacklist.includes(file)) continue;
      results = results.concat(findAllFiles(filePath, extensions, blacklist, rootPath));
    } else {
      if (extensions.some(ext => file.endsWith(ext))) {
        results.push(filePath);
      }
    }
  }
  return results;
}

/**
 * Resolves the output path for FileNameEnums.ts.
 */
function resolveOutFile(rootPath) {
  const packageNames = ['@customizer/modal-x', 'modal-x'];
  for (const pkgName of packageNames) {
    const candidatePath = path.resolve(rootPath, 'node_modules', pkgName, 'FileNameEnums.ts');
    const candidateDir = path.dirname(candidatePath);
    if (fs.existsSync(candidateDir)) return candidatePath;
  }
  return path.resolve(rootPath, "FileNameEnums.ts");
}

const MARKER_START = '// [MODAL-X] AUTO-GENERATED INSTANCE';

const GET_BLOCK = (hasProps, hasReturnType) => {
  const propsType = hasProps ? 'Props' : 'any';
  const returnType = hasReturnType ? 'ReturnType' : 'any';
  return `\n${MARKER_START}\n// [MODAL-X] Managed Props: This block is auto-generated for strict type safety.\nconst props = defineProps<{ data: ${propsType}; close: (res: ${returnType}) => void }>();\n`;
};

function modalTypesPlugin(options = {}) {
  const { autoInference = false } = options;
  const expansions = [".amdl.vue", ".mdl.vue"];
  const blacklist = [
    "assets", "composables", "node_modules", "dist", ".git", 
    "config", "directives", "middleware", "plugins", "server", 
    "stores", "store", "types", "type", "utils"
  ];

  let rootPath = "";
  let outFile = "";

  const processAutoInference = (filePath) => {
    if (!autoInference) return;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const hasOurMarker = content.includes(MARKER_START);
      const hasReturnType = /export\s+(type|interface)\s+ReturnType/.test(content);
      const hasProps = /export\s+(type|interface)\s+Props/.test(content);
      const targetBlock = GET_BLOCK(hasProps, hasReturnType);

      if (hasOurMarker) {
        const lines = content.split('\n');
        const startIndex = lines.findIndex(l => l.includes(MARKER_START));
        if (startIndex !== -1) {
          const targetCallLine = targetBlock.trim().split('\n')[1];
          let definePropsIndex = -1;
          for (let i = startIndex + 1; i <= startIndex + 5 && i < lines.length; i++) {
            if (lines[i].includes('defineProps')) {
              definePropsIndex = i;
              break;
            }
          }
          if (definePropsIndex !== -1) {
            if (lines[definePropsIndex].trim() !== targetCallLine.trim()) {
              lines[definePropsIndex] = targetCallLine;
              fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
            }
          } else {
            lines.splice(startIndex + 1, 0, targetCallLine);
            fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
          }
        }
        return;
      }
      const manualPropsRegex = /^(?!\/\/ \[MODAL-X\]).*defineProps/m;
      if (manualPropsRegex.test(content)) return;

      const scriptSetupMatch = content.match(/<script setup(.*?)>/);
      if (!scriptSetupMatch) return;

      let scriptSetupTag = scriptSetupMatch[0];
      let updatedContent = content;
      if (!scriptSetupTag.includes('lang="ts"') && !scriptSetupTag.includes("lang='ts'")) {
        const newTag = scriptSetupTag.replace('<script setup', '<script setup lang="ts"');
        updatedContent = content.replace(scriptSetupTag, newTag);
        scriptSetupTag = newTag;
      }
      const scriptSetupIdx = updatedContent.indexOf(scriptSetupTag) + scriptSetupTag.length;
      let insertIndex = scriptSetupIdx;

      const importsRegex = /import\s+(?:type\s+)?(?:[\w*{},\s]+from\s+['"][^'"]+['"]|['"][^'"]+['"])\s*;?/g;
      importsRegex.lastIndex = scriptSetupIdx;

      let match;
      const scriptEndIdx = updatedContent.indexOf('</script>', scriptSetupIdx);
      const limitIdx = scriptEndIdx !== -1 ? scriptEndIdx : updatedContent.length;

      while ((match = importsRegex.exec(updatedContent)) !== null) {
          if (match.index > limitIdx) break;
          insertIndex = match.index + match[0].length;
      }
      
      const insertPrefix = insertIndex === scriptSetupIdx ? '\n' : '\n\n';
      fs.writeFileSync(filePath, updatedContent.slice(0, insertIndex) + insertPrefix + targetBlock.trim() + '\n' + updatedContent.slice(insertIndex), 'utf-8');
    } catch (err) {}
  };

  return {
    name: "modalx-types",
    apply: "serve",
    configResolved(config) {
      rootPath = path.resolve(config.root); // MUST be absolute
      outFile = resolveOutFile(rootPath);
    },
    configureServer(server) {
      const generateTypes = async () => {
        try {
          const modalFiles = findAllFiles(rootPath, expansions, blacklist, rootPath);
          const imports = [];
          const mapping = [];
          const typeAliases = [];
          const constantMembers = [];
          const modalNames = [];
          // name -> project-root-relative source path, consumed by the
          // "@customizer/modal-x/ts-plugin" language-service plugin so that
          // Go-to-Definition on a modal name jumps into its .vue file.
          const sources = {};
          const outDir = path.dirname(outFile);

          for (const file of modalFiles) {
            const fileNameWithExt = path.basename(file);
            const name = fileNameWithExt.split('.')[0];
            const content = fs.readFileSync(file, 'utf-8');
            const hasReturnType = /export\s+(type|interface)\s+ReturnType/.test(content);
            const hasProps = /export\s+(type|interface)\s+Props/.test(content);

            let importPath = path.relative(outDir, file);
            if (!importPath.startsWith('.')) importPath = './' + importPath;
            
            const returnAlias = `ReturnType_${name}`;
            const propsAlias = `Props_${name}`;
            const relPath = path.relative(rootPath, file);
            // Normalize to POSIX separators so the emitted map is stable across OSes.
            sources[name] = relPath.split(path.sep).join('/');
            const jsDoc = `  /** \n   * @source ${relPath}\n   */`;

            typeAliases.push(`${jsDoc}\nexport type ${name} = '${name}';`);
            constantMembers.push(`${jsDoc}\n  ${name}: '${name}' as ${name},`);
            modalNames.push(name);

            const importEntries = [];
            if (hasReturnType) importEntries.push(`ReturnType as ${returnAlias}`);
            if (hasProps) importEntries.push(`Props as ${propsAlias}`);
            if (importEntries.length > 0) {
              imports.push(`import type { ${importEntries.join(', ')} } from '${importPath}';`);
            }

            mapping.push(`${jsDoc}\n  '${name}': {\n    ReturnType: ${hasReturnType ? returnAlias : 'any'};\n    Props: ${hasProps ? propsAlias : 'any'};\n  };`);
          }

          const typeContent = `// Auto-generated by vite-plugin-modal-types\n${imports.join('\n')}\n\nexport interface ModalRegistry {\n${mapping.join('\n')}\n}\n\n${typeAliases.join('\n\n')}\n\nexport const MODALS = {\n${constantMembers.join('\n')}\n} as const;\n\nexport type FileNames = ${modalNames.join(' | ') || 'never'};\n`;

          const jsOutFile = outFile.replace(/\.ts$/, '.js');
          const jsConstantMembers = constantMembers.map(m => m.replace(/\s+as\s+\w+,?$/, ','));
          const jsContent = `// Auto-generated by vite-plugin-modal-types\nexport const MODALS = {\n${jsConstantMembers.join('\n')}\n};\n`;

          const sourcesOutFile = path.resolve(outDir, 'modalx.sources.json');
          const sourcesContent = JSON.stringify(sources, null, 2) + '\n';

          if (!fs.existsSync(outFile) || fs.readFileSync(outFile, "utf-8") !== typeContent) {
            fs.mkdirSync(path.dirname(outFile), { recursive: true });
            fs.writeFileSync(outFile, typeContent);
          }
          if (!fs.existsSync(jsOutFile) || fs.readFileSync(jsOutFile, "utf-8") !== jsContent) {
            fs.writeFileSync(jsOutFile, jsContent);
          }
          if (!fs.existsSync(sourcesOutFile) || fs.readFileSync(sourcesOutFile, "utf-8") !== sourcesContent) {
            fs.writeFileSync(sourcesOutFile, sourcesContent);
          }
        } catch (error) {
          console.error("\n⚠️ Modal type generation failed:", error);
        }
      };

      generateTypes();

      server.watcher.on("add", (file) => {
        if (expansions.some(ext => file.endsWith(ext))) {
          generateTypes();
          processAutoInference(file);
        }
      });
      server.watcher.on("unlink", (file) => {
        if (expansions.some(ext => file.endsWith(ext))) generateTypes();
      });
      server.watcher.on("change", (file) => {
        if (expansions.some(ext => file.endsWith(ext))) {
          generateTypes();
          processAutoInference(file);
        }
      });
    },
  };
}

module.exports = { modalTypesPlugin };