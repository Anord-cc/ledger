import { hashPassword, createSessionToken, getUserForSession } from "./auth.js";
import { logAudit } from "./audit.js";
import { pool } from "../db/pool.js";

const FIXED_FOOTER = "Powered by Ledger made by ANord.cc";

interface SetupInput {
  siteName: string;
  brandColor: string;
  publicKnowledgeBaseEnabled: boolean;
  ownerEmail: string;
  ownerDisplayName: string;
  password: string;
}

export async function getSetupStatus() {
  const users = await pool.query(`SELECT COUNT(*)::int AS count FROM users`);
  const branding = await pool.query(`SELECT site_name, brand_color FROM branding_settings ORDER BY created_at ASC LIMIT 1`);

  return {
    isInitialized: users.rows[0].count > 0,
    branding: branding.rows[0] ?? null
  };
}

export async function initializeLedger(input: SetupInput) {
  const existingUsers = await pool.query(`SELECT COUNT(*)::int AS count FROM users`);
  if (existingUsers.rows[0].count > 0) {
    throw new Error("Ledger has already been initialized");
  }

  await pool.query("BEGIN");
  try {
    const ownerRole = await pool.query(`SELECT id FROM roles WHERE key = 'owner'`);

    const user = await pool.query(
      `
        INSERT INTO users (email, password_hash, display_name, primary_role_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [input.ownerEmail, await hashPassword(input.password), input.ownerDisplayName, ownerRole.rows[0].id]
    );

    const ownerUserId = user.rows[0].id;

    const branding = await pool.query(
      `
        UPDATE branding_settings
        SET site_name = $1, brand_color = $2, footer_text = $3,
            public_knowledge_base_enabled = $4, updated_at = now()
        WHERE id = (SELECT id FROM branding_settings ORDER BY created_at ASC LIMIT 1)
        RETURNING id
      `,
      [input.siteName, input.brandColor, FIXED_FOOTER, input.publicKnowledgeBaseEnabled]
    );

    await pool.query(
      `
        INSERT INTO spaces (name, key, description, visibility, created_by_user_id)
        VALUES
          ('Docs', 'docs', 'Public documentation for your organization', 'public', $1),
          ('Team', 'team', 'Internal knowledge for your organization', 'internal', $1)
        ON CONFLICT (key) DO NOTHING
      `,
      [ownerUserId]
    );

    const docsSpace = await pool.query(`SELECT id FROM spaces WHERE key = 'docs'`);
    const welcomePage = await pool.query(
      `
        INSERT INTO pages (space_id, title, slug, excerpt, visibility, state, is_public, owner_user_id)
        VALUES ($1, 'Welcome to Ledger', 'welcome-to-ledger', 'Start customizing your new knowledge base.', 'public', 'published', true, $2)
        RETURNING id
      `,
      [docsSpace.rows[0].id, ownerUserId]
    );

    const welcomeRevision = await pool.query(
      `
        INSERT INTO page_revisions (page_id, title, slug, excerpt, visibility, state, body_markdown, edited_by_user_id)
        VALUES (
          $1,
          'Welcome to Ledger',
          'welcome-to-ledger',
          'Start customizing your new knowledge base.',
          'public',
          'published',
          '# Welcome to Ledger\n\nYour knowledge base is ready.\n\n## Next steps\n\n- Customize branding\n- Invite your team\n- Publish your first public and internal pages',
          $2
        )
        RETURNING id
      `,
      [welcomePage.rows[0].id, ownerUserId]
    );

    await pool.query(`UPDATE pages SET current_revision_id = $2 WHERE id = $1`, [
      welcomePage.rows[0].id,
      welcomeRevision.rows[0].id
    ]);

    await pool.query("COMMIT");

    const sessionUser = await getUserForSession(ownerUserId);
    const token = createSessionToken(sessionUser!);
    await logAudit(ownerUserId, "setup.initialize", "ledger", "instance", {
      brandingSettingsId: branding.rows[0].id
    });

    return { token, user: sessionUser };
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}
