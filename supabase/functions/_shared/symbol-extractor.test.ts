import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { extractSymbols, normalizeSymbols } from "./symbol-extractor.ts";

Deno.test("extractSymbols - typescript basic", () => {
  const code = `
    import { UserService } from "./user";
    const service = new UserService();
    service.getUserById(123).then(user => console.log(user.name));
  `;
  const symbols = extractSymbols(code, "typescript");

  // Should include UserService, getUserById
  assertEquals(symbols.includes("UserService"), true);
  assertEquals(symbols.includes("getUserById"), true);

  // Should NOT include keywords or small tokens
  assertEquals(symbols.includes("new"), false);
  assertEquals(symbols.includes("log"), false); // stoplist
});

Deno.test("extractSymbols - rust qualified names", () => {
  const code = `
    use std::collections::HashMap;
    let mut map = HashMap::new();
    map.insert("key", value);
  `;
  const symbols = extractSymbols(code, "rust");

  assertEquals(symbols.includes("std::collections::HashMap"), true);
  assertEquals(symbols.includes("HashMap"), true);
});

Deno.test("normalizeSymbols - generics", () => {
  const raw = ["Map<string, number>", "List[User]", "func(arg)"];
  const normalized = normalizeSymbols(raw, "typescript");

  assertEquals(normalized.includes("Map"), true);
  assertEquals(normalized.includes("List"), true);
  assertEquals(normalized.includes("func"), true);
});

Deno.test("extractSymbols - capping", () => {
  const code = Array.from({ length: 100 }, (_, i) => `Symbol${i}`).join(" ");
  const symbols = extractSymbols(code, "common", 50);
  assertEquals(symbols.length, 50);
});
