const db = require("./db");

const AFRICAN_COUNTRIES = [
  { code: "GA", name: "Gabon" }, { code: "CM", name: "Cameroun" }, { code: "CI", name: "Cote d Ivoire" },
  { code: "SN", name: "Senegal" }, { code: "CD", name: "RD Congo" }, { code: "CG", name: "Congo" },
  { code: "BJ", name: "Benin" }, { code: "TG", name: "Togo" }, { code: "BF", name: "Burkina Faso" },
  { code: "ML", name: "Mali" }, { code: "NE", name: "Niger" }, { code: "TD", name: "Tchad" },
  { code: "CF", name: "Centrafrique" }, { code: "GN", name: "Guinee" }, { code: "SC", name: "Seychelles" },
  { code: "MU", name: "Maurice" }, { code: "MG", name: "Madagascar" }, { code: "KM", name: "Comores" },
  { code: "DJ", name: "Djibouti" }, { code: "NG", name: "Nigeria" }, { code: "GH", name: "Ghana" },
  { code: "KE", name: "Kenya" }, { code: "RW", name: "Rwanda" }, { code: "ZA", name: "Afrique du Sud" },
  { code: "MR", name: "Mauritanie" }, { code: "CV", name: "Cap-Vert" }, { code: "GQ", name: "Guinee Equatoriale" }
];

async function seedPricing() {
  console.log("--- Seeding Pricing Rules for Africa ---");
  let inserted = 0;
  let skipped = 0;

  for (const country of AFRICAN_COUNTRIES) {
    try {
      await insertIfNotExist(country.code, "free", 0, "XAF", 0);
      await insertIfNotExist(country.code, "premium", 1000, "XAF", 18.00); 
      await insertIfNotExist(country.code, "pro", 5000, "XAF", 18.00); 
      inserted += 3;
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") skipped += 3;
      else console.error(`Error for ${country.code}:`, e);
    }
  }

  console.log(`Seeding complete! Processed: ${inserted} rows.`);
  process.exit(0);
}

async function insertIfNotExist(code, plan, price, currency, vat) {
  const result = await db.query("SELECT id FROM pricing_rules WHERE country_code = ? AND plan_type = ?", [code, plan]);
  const rows = result.rows || result[0] || result; // handle both object with .rows or raw map array
  if (!rows || rows.length === 0) {
    await db.query(
      "INSERT INTO pricing_rules (country_code, plan_type, price, currency, vat_rate) VALUES (?, ?, ?, ?, ?)",
      [code, plan, price, currency, vat]
    );
  }
}

seedPricing();
