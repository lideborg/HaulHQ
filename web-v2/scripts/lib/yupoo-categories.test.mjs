import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCategories } from "./yupoo-categories.mjs";

const HTML = `
<a href='https://99team.x.yupoo.com/categories/' title='全部分类'>全部分类</a>
<a href='https://99team.x.yupoo.com/categories/0' title='other'>未分类相册</a>
<a href='https://99team.x.yupoo.com/categories/5225737' title='👜D&amp;G'>👜D&amp;G</a>
<a href='https://99team.x.yupoo.com/categories/5225748' title='👜The Row'>👜The Row</a>
<a href="https://x.x.yupoo.com/categories/123" title="Men&#x27;s Shoes">dup below</a>
<a href="https://x.x.yupoo.com/categories/123" title="Men&#x27;s Shoes">dup</a>
`;

test("parses id + decoded title, skips all/0, dedupes", () => {
  assert.deepEqual(parseCategories(HTML), [
    { id: "5225737", title: "👜D&G" },
    { id: "5225748", title: "👜The Row" },
    { id: "123", title: "Men's Shoes" },
  ]);
});

test("empty page parses to empty list", () => {
  assert.deepEqual(parseCategories("<html></html>"), []);
});
