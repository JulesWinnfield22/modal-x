const regex = /import\s+(?:type\s+)?(?:[\w*{},\s]+from\s+['"][^'"]+['"]|['"][^'"]+['"])\s*;?/g;
const str = `import { ref } from 'vue'
import { closeModal } from "@customizer/modal-x";`;

let match;
while ((match = regex.exec(str)) !== null) {
  console.log("Matched: " + match[0]);
  console.log("Index: " + match.index);
}
