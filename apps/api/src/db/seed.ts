import { hashPassword } from "../services/auth.js";
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

  const roles = await pool.query(`SELECT id, key FROM roles`);
  const roleMap = new Map(roles.rows.map((row) => [row.key, row.id]));

  const users = [
    ["owner@ledger.local", "Ledger Owner", "owner"],
    ["admin@ledger.local", "Ledger Admin", "admin"],
    ["editor@ledger.local", "Ledger Editor", "editor"],
    ["viewer@ledger.local", "Ledger Viewer", "viewer"]
  ];

  for (const [email, displayName, roleKey] of users) {
    await pool.query(
      `
        INSERT INTO users (email, password_hash, display_name, primary_role_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) DO NOTHING
      `,
      [email, await hashPassword("Password123!"), displayName, roleMap.get(roleKey)]
    );
  }

  const owner = await pool.query(`SELECT id FROM users WHERE email = 'owner@ledger.local'`);
  const editor = await pool.query(`SELECT id FROM users WHERE email = 'editor@ledger.local'`);
  const engineeringGroup = await pool.query(`SELECT id FROM groups WHERE name = 'engineering'`);

  await pool.query(
    `INSERT INTO group_memberships (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [editor.rows[0].id, engineeringGroup.rows[0].id]
  );

  await pool.query(
    `
      INSERT INTO spaces (name, key, description, visibility, created_by_user_id)
      VALUES
        ('Docs', 'docs', 'Public product documentation', 'public', $1),
        ('Ops', 'ops', 'Internal runbooks and procedures', 'internal', $1)
      ON CONFLICT (key) DO NOTHING
    `,
    [owner.rows[0].id]
  );

  const docsSpace = await pool.query(`SELECT id FROM spaces WHERE key = 'docs'`);
  const opsSpace = await pool.query(`SELECT id FROM spaces WHERE key = 'ops'`);

  const existingPublic = await pool.query(`SELECT id FROM pages WHERE slug = 'welcome-to-ledger'`);
  if (!existingPublic.rowCount) {
    const page = await pool.query(
      `
        INSERT INTO pages (space_id, title, slug, excerpt, visibility, state, is_public, owner_user_id)
        VALUES ($1, 'Welcome to Ledger', 'welcome-to-ledger', 'Ledger helps teams publish trusted answers.', 'public', 'published', true, $2)
        RETURNING id
      `,
      [docsSpace.rows[0].id, owner.rows[0].id]
    );

    const revision = await pool.query(
      `
        INSERT INTO page_revisions (page_id, title, slug, excerpt, visibility, state, body_markdown, edited_by_user_id)
        VALUES ($1, 'Welcome to Ledger', 'welcome-to-ledger', 'Ledger helps teams publish trusted answers.', 'public', 'published', '# Welcome to Ledger\n\nLedger is a secure knowledge base for public docs and internal answers.\n\n## What you can do\n\n- Publish public docs\n- Keep internal pages permission-aware\n- Search across trusted knowledge', $2)
        RETURNING id
      `,
      [page.rows[0].id, owner.rows[0].id]
    );

    await pool.query(`UPDATE pages SET current_revision_id = $2 WHERE id = $1`, [page.rows[0].id, revision.rows[0].id]);
  }

  const existingInternal = await pool.query(`SELECT id FROM pages WHERE slug = 'incident-runbook'`);
  if (!existingInternal.rowCount) {
    const page = await pool.query(
      `
        INSERT INTO pages (space_id, title, slug, excerpt, visibility, state, is_public, owner_user_id)
        VALUES ($1, 'Incident Runbook', 'incident-runbook', 'Internal escalation workflow for incidents.', 'restricted', 'published', false, $2)
        RETURNING id
      `,
      [opsSpace.rows[0].id, owner.rows[0].id]
    );

    const revision = await pool.query(
      `
        INSERT INTO page_revisions (page_id, title, slug, excerpt, visibility, state, body_markdown, edited_by_user_id, tag_snapshot)
        VALUES ($1, 'Incident Runbook', 'incident-runbook', 'Internal escalation workflow for incidents.', 'restricted', 'published', '# Incident Runbook\n\nUse this page when triaging a Sev-1 incident.\n\n## First 10 minutes\n\n- Declare incident commander\n- Open incident channel\n- Update status page', $2, '["internal","ops"]'::jsonb)
        RETURNING id
      `,
      [page.rows[0].id, owner.rows[0].id]
    );

    await pool.query(`UPDATE pages SET current_revision_id = $2 WHERE id = $1`, [page.rows[0].id, revision.rows[0].id]);
    await pool.query(`INSERT INTO page_permissions (page_id, group_id) VALUES ($1, $2)`, [
      page.rows[0].id,
      engineeringGroup.rows[0].id
    ]);
  }

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

  console.log("Seeded Ledger demo data");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
