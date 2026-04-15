const fs = require('fs');

const MARKER_START = '// [MODAL-X] AUTO-GENERATED INSTANCE';

const GET_BLOCK = (hasProps, hasReturnType) => {
  const propsType = hasProps ? 'Props' : 'any';
  const returnType = hasReturnType ? 'ReturnType' : 'any';
  return `\n${MARKER_START}\n// [MODAL-X] Managed Props: This block is auto-generated for strict type safety.\nconst props = defineProps<{ data: ${propsType}; close: (res: ${returnType}) => void }>();\n`;
};

function processFile(content, hasProps, hasReturnType) {
  const targetBlock = GET_BLOCK(hasProps, hasReturnType);
  const hasOurMarker = content.includes(MARKER_START);
  
  if (hasOurMarker) {
        const lines = content.split('\n');
        const startIndex = lines.findIndex(l => l.includes(MARKER_START));
        if (startIndex !== -1) {
          const targetCallLine = targetBlock.trim().split('\n').find(l => l.includes('defineProps')) || '';
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
              return lines.join('\n');
            }
          } else {
            lines.splice(startIndex + 1, 0, targetCallLine);
            return lines.join('\n');
          }
        }
        return content;
  }
  
  const manualPropsRegex = /^(?!\/\/ \[MODAL-X\]).*defineProps/m;
  if (manualPropsRegex.test(content)) return content + " (skipped: manualPropsRegex)";

  const scriptSetupMatch = content.match(/<script setup(.*?)>/);
  if (!scriptSetupMatch) return content + " (skipped: no <script setup>)";

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
  return updatedContent.slice(0, insertIndex) + insertPrefix + targetBlock.trim() + '\n' + updatedContent.slice(insertIndex);
}

const res1 = processFile(`<template><div></div></template><script setup lang="ts"></script>`, false, false);
console.log("TEST 1 - Blank script setup, no imports, no types:");
console.log(res1);

const res2 = processFile(`<template></template>
<script setup lang="ts">
import { ref } from 'vue';
</script>`, false, false);
console.log("\nTEST 2 - With imports, no types:");
console.log(res2);

const res3 = processFile(`<template></template>
<script setup lang="ts">
import { ref, computed } from "vue";
import { closeModal } from "@customizer/modal-x";
</script>`, false, false);
console.log("\nTEST 3 - Multiple imports:");
console.log(res3);

const res4 = processFile(`<template></template>
<script setup lang="ts">
import { ref, computed } from "vue";
import { closeModal } from "@customizer/modal-x";

// [MODAL-X] AUTO-GENERATED INSTANCE
// [MODAL-X] Managed Props: This block is auto-generated for strict type safety.
const props = defineProps<{ data: Props; close: (res: ReturnType) => void }>();

</script>`, false, false);
console.log("\nTEST 4 - Update existing block (no types from existing):");
console.log(res4);
