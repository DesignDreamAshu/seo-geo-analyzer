import { IMPLEMENTED_DIAGNOSTIC_RULES } from "./rule-inventory";

console.log("Total Rules in Inventory:", IMPLEMENTED_DIAGNOSTIC_RULES.length);

const categories = new Map<string, string[]>();
for (const r of IMPLEMENTED_DIAGNOSTIC_RULES) {
  const cat = r.category;
  if (!categories.has(cat)) categories.set(cat, []);
  categories.get(cat)!.push(r.ruleCode);
}

for (const [cat, rules] of categories.entries()) {
  console.log(`Category: ${cat} (${rules.length} rules):`, rules.join(", "));
}
