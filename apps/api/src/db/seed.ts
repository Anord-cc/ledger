import { pool } from "./pool.js";

async function main() {
  const roleKeys = [
    ["owner", "Owner"],
    ["admin", "Admin"],
    ["editor", "Editor"],
    ["viewer", "Viewer"],
    ["public", "Public"]
  ];

  for (const [key, name] of roleKeys) {
    await pool.query(
      `INSERT INTO roles (key, name) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      [key, name]
    );
  }

  await pool.query(
    `INSERT INTO groups (name, description) VALUES ('engineering', 'Internal engineering team')
     ON CONFLICT (name) DO NOTHING`
  );

  await pool.query(
    `
      INSERT INTO branding_settings (site_name, logo_url, brand_color, footer_text, public_knowledge_base_enabled)
      SELECT 'Ledger', NULL, '#245cff', 'Built for fast, trusted answers.', true
      WHERE NOT EXISTS (SELECT 1 FROM branding_settings)
    `
  );

  await pool.query(
    `
      INSERT INTO smtp_settings (host, port, username, from_email, from_name)
      SELECT NULL, 587, NULL, 'noreply@example.com', 'Ledger'
      WHERE NOT EXISTS (SELECT 1 FROM smtp_settings)
    `
  );

  await pool.query(
    `
      INSERT INTO ai_settings (provider, model, is_enabled)
      SELECT 'none', '', false
      WHERE NOT EXISTS (SELECT 1 FROM ai_settings)
    `
  );

  console.log("Seeded Ledger base data");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
