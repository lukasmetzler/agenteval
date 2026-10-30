// Regenerate schema.json from the Zod config schema: bun run schema
import { configJsonSchema } from "../src/config/schema.js";

await Bun.write(
	new URL("../schema.json", import.meta.url),
	`${JSON.stringify(configJsonSchema(), null, "\t")}\n`,
);
