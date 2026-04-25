import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireEditor } from "../middleware/auth.js";
import {
  importGitHubDocument,
  importGoogleDoc,
  importMarkdownDocuments,
  listImportJobs,
  listIntegrations,
  previewGitHubImport,
  previewGoogleDocImport,
  previewMarkdownImports,
  upsertIntegration
} from "../../services/integrations.js";

const integrationSchema = z.object({
  name: z.string().min(2),
  config: z.record(z.any()),
  isEnabled: z.boolean()
});

const importTargetSchema = z.object({
  spaceId: z.string().uuid(),
  visibility: z.enum(["public", "internal", "restricted"]),
  state: z.enum(["draft", "published"]),
  parentPageId: z.string().uuid().nullable().optional(),
  allowedRoleKeys: z.array(z.enum(["owner", "admin", "editor", "viewer", "public"])).optional(),
  allowedGroupIds: z.array(z.string().uuid()).optional()
});

const markdownPreviewSchema = z.object({
  files: z.array(
    z.object({
      fileName: z.string().min(1),
      content: z.string().min(1)
    })
  ).min(1)
});

const githubSchema = z.object({
  repo: z.string().min(3),
  branch: z.string().min(1),
  path: z.string().min(1)
});

const googleDocsSchema = z.object({
  documentId: z.string().min(10)
});

export const integrationsRouter = Router();

integrationsRouter.get("/", requireAdmin, async (_req, res) => {
  return res.json({ integrations: await listIntegrations() });
});

integrationsRouter.put("/:provider", requireAdmin, async (req, res) => {
  const provider = z.enum(["github", "google_docs", "markdown_import"]).parse(req.params.provider);
  const input = integrationSchema.parse(req.body);
  const integration = await upsertIntegration(provider, input);
  return res.json({ integration });
});

integrationsRouter.get("/import-jobs", requireAdmin, async (_req, res) => {
  return res.json({ jobs: await listImportJobs() });
});

integrationsRouter.post("/markdown/preview", requireEditor, async (req, res) => {
  const input = markdownPreviewSchema.parse(req.body);
  return res.json({ documents: previewMarkdownImports(input.files) });
});

integrationsRouter.post("/markdown/import", requireEditor, async (req, res) => {
  const input = z.object({
    files: markdownPreviewSchema.shape.files,
    target: importTargetSchema
  }).parse(req.body);
  const result = await importMarkdownDocuments(input.files, input.target, req.user!.id);
  return res.status(201).json(result);
});

integrationsRouter.post("/github/preview", requireEditor, async (req, res) => {
  const input = githubSchema.parse(req.body);
  const document = await previewGitHubImport(input.repo, input.branch, input.path);
  return res.json({ document });
});

integrationsRouter.post("/github/import", requireEditor, async (req, res) => {
  const input = z.object({
    repo: githubSchema.shape.repo,
    branch: githubSchema.shape.branch,
    path: githubSchema.shape.path,
    target: importTargetSchema
  }).parse(req.body);
  const result = await importGitHubDocument(input.repo, input.branch, input.path, input.target, req.user!.id);
  return res.status(201).json(result);
});

integrationsRouter.post("/google-docs/preview", requireEditor, async (req, res) => {
  const input = googleDocsSchema.parse(req.body);
  const document = await previewGoogleDocImport(input.documentId);
  return res.json({ document });
});

integrationsRouter.post("/google-docs/import", requireEditor, async (req, res) => {
  const input = z.object({
    documentId: googleDocsSchema.shape.documentId,
    target: importTargetSchema
  }).parse(req.body);
  const result = await importGoogleDoc(input.documentId, input.target, req.user!.id);
  return res.status(201).json(result);
});
