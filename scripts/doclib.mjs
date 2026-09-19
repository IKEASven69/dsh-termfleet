#!/usr/bin/env node

import { existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_DATE = () => new Date().toISOString().slice(0, 10);
const VALID_SEVERITY = new Set(["P0", "P1", "P2", "P3"]);
const VALID_BUG_STATUS = new Set(["open", "partial", "fixed", "verified", "wontfix"]);

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const command = parsed.positionals.shift();
  const root = path.resolve(String(parsed.options.root ?? process.cwd()));
  const date = String(parsed.options.date ?? DEFAULT_DATE());
  const ctx = { root, libRoot: path.join(root, "docs", "lib"), date };

  try {
    switch (command) {
      case "init":
        await initDoclib(ctx);
        break;
      case "status":
        await writeStatus(ctx);
        break;
      case "health":
        await runHealth(ctx, parsed);
        break;
      case "search":
        await runSearch(ctx, parsed);
        break;
      case "new-plan":
      case "plan":
        await newPlan(ctx, parsed);
        break;
      case "new-change":
        await newChange(ctx, parsed);
        break;
      case "update-change":
        await updateChange(ctx, parsed);
        break;
      case "close-change":
        await closeChange(ctx, parsed);
        break;
      case "promote-plan":
        await promotePlan(ctx, parsed);
        break;
      case "record-bug":
        await recordBug(ctx, parsed);
        break;
      case "sync-module":
        await syncModule(ctx, parsed);
        break;
      case "help":
      case undefined:
        printHelp();
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const positionals = [];
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];
    const value = next && !next.startsWith("--") ? next : true;
    if (value !== true) index += 1;

    if (Object.hasOwn(options, key)) {
      options[key] = Array.isArray(options[key])
        ? [...options[key], value]
        : [options[key], value];
    } else {
      options[key] = value;
    }
  }

  return { positionals, options };
}

function values(options, key) {
  const value = options[key];
  if (value === undefined || value === true) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

function requiredOption(options, key) {
  const value = options[key];
  if (value === undefined || value === true || String(value).trim() === "") {
    throw new Error(`Missing required option --${key}`);
  }
  return String(value);
}

async function initDoclib(ctx) {
  const dirs = [
    "docs/lib/_TEMPLATES",
    "docs/lib/specs",
    "docs/lib/flows",
    "docs/lib/bugs",
    "docs/lib/changes",
    "docs/lib/planning/plans/active",
    "docs/lib/planning/plans/completed",
    "docs/lib/planning/plans/superseded",
  ];
  for (const dir of dirs) await mkdir(path.join(ctx.root, dir), { recursive: true });
  const files = {
    "docs/lib/README.md": templateReadme(),
    "docs/lib/specs/_modules.md": templateModules(ctx.date),
    "docs/lib/_TEMPLATES/standalone-plan.md": templateStandalonePlan(),
    "docs/lib/_TEMPLATES/bug-report.md": templateBugReport(),
    "docs/lib/_TEMPLATES/change-proposal.md": templateChangeProposal(),
    "docs/lib/_TEMPLATES/change-tasks.md": templateChangeTasks(),
    "docs/lib/_TEMPLATES/module-spec.md": templateModuleSpec(),
    "docs/lib/_TEMPLATES/flow.md": templateFlow(),
    "docs/lib/patterns.md": templateSimpleDoc("Patterns", "跨模块通用模式。"),
    "docs/lib/decisions.md": templateSimpleDoc("Decisions", "架构决策记录。"),
    "docs/lib/TBD.md": templateSimpleDoc("待调查问题", "未解决的坑 / 待调查问题 / 已知但没时间修的事项。"),
    "docs/lib/glossary.md": templateSimpleDoc("Glossary", "项目术语表。"),
    "docs/lib/unplugged.md": templateSimpleDoc("Unplugged", "脱线、废弃或暂未接入的代码与设计记录。"),
  };
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(ctx.root, relativePath);
    if (!existsSync(filePath)) {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, content, "utf8");
    }
  }
  console.log(`Initialized docs/lib at ${ctx.libRoot}`);
}

async function writeStatus(ctx) {
  await ensureDoclib(ctx);
  const docs = await scanDocs(ctx.libRoot);
  const bugs = docs.filter((doc) => doc.type === "bug");
  const specs = docs.filter((doc) => doc.type === "spec");
  const changes = docs.filter((doc) => doc.type === "change");
  const health = buildHealth(ctx, { bugs, specs, changes });

  const lines = [
    "---",
    "type: dashboard",
    `generated: ${ctx.date}`,
    "generator: doclib",
    "---",
    "",
    "# 全局状态仪表盘",
    "",
    "> 由 `npm run doc:status` 生成。聚合 `bugs/`、`changes/`、`specs/` frontmatter。",
    "",
    "## 需要关注",
    "",
    `- open bugs: ${health.openBugs.length}`,
    `- partial bugs: ${health.partialBugs.length}`,
    `- stale specs: ${health.staleSpecs.length}`,
    `- active changes: ${health.activeChanges.length}`,
    "",
    "## Bug 追踪",
    "",
    "| ID | 标题 | 严重度 | 状态 | 模块 |",
    "|----|------|--------|------|------|",
    ...bugs.map((bug) => {
      const fm = bug.frontmatter;
      return `| [${fm.id ?? bug.slug}](${bug.relativePath}) | ${fm.title ?? bug.title} | ${fm.severity ?? ""} | ${fm.status ?? ""} | ${formatList(fm.module)} |`;
    }),
    "",
    "## 变更追踪",
    "",
    "| ID | 标题 | 状态 | 进度 |",
    "|----|------|------|------|",
    ...changes.map((change) => {
      const fm = change.frontmatter;
      return `| [${fm.id ?? change.slug}](${change.relativePath}) | ${fm.title ?? change.title} | ${fm.status ?? ""} | ${change.taskProgress ?? "-"} |`;
    }),
    "",
    "## Spec 健康",
    "",
    "| 模块 | 状态 | last-verified |",
    "|------|------|---------------|",
    ...specs.map((spec) => {
      const fm = spec.frontmatter;
      return `| [${fm.module ?? spec.slug}](${spec.relativePath}) | ${getSpecStatus(ctx, spec)} | ${fm["last-verified"] ?? ""} |`;
    }),
    "",
  ];

  const outPath = path.join(ctx.libRoot, "_status.md");
  await writeFile(outPath, `${lines.join("\n")}\n`, "utf8");
  await writeBugIndexes(ctx, bugs);
  console.log(`Wrote ${relativeToRoot(ctx.root, outPath)}`);
}

async function runHealth(ctx, parsed) {
  await ensureDoclib(ctx);
  const docs = await scanDocs(ctx.libRoot);
  const health = buildHealth(ctx, {
    bugs: docs.filter((doc) => doc.type === "bug"),
    specs: docs.filter((doc) => doc.type === "spec"),
    changes: docs.filter((doc) => doc.type === "change"),
  });

  if (parsed.options.json) {
    console.log(JSON.stringify(health, null, 2));
    return;
  }

  console.log(`# 文档库健康报告 — ${ctx.date}`);
  console.log("");
  console.log(`- stale specs: ${health.staleSpecs.length}`);
  console.log(`- open bugs: ${health.openBugs.length}`);
  console.log(`- partial bugs: ${health.partialBugs.length}`);
  console.log(`- active changes: ${health.activeChanges.length}`);
}

async function runSearch(ctx, parsed) {
  await ensureDoclib(ctx);
  const term = parsed.positionals.join(" ").trim().toLowerCase();
  const type = parsed.options.type ? String(parsed.options.type) : undefined;
  const tag = parsed.options.tag ? String(parsed.options.tag) : undefined;
  const module = parsed.options.module ? String(parsed.options.module) : undefined;

  const matches = (await scanDocs(ctx.libRoot))
    .filter((doc) => parsed.options["include-generated"] || !isGeneratedDoc(doc.relativePath))
    .filter((doc) => !type || doc.type === type)
    .filter((doc) => !tag || asArray(doc.frontmatter.tags).includes(tag))
    .filter((doc) => !module || asArray(doc.frontmatter.module).includes(module))
    .filter((doc) => {
      if (!term) return true;
      return doc.content.toLowerCase().includes(term) || JSON.stringify(doc.frontmatter).toLowerCase().includes(term);
    })
    .map((doc) => ({
      id: String(doc.frontmatter.id ?? doc.slug),
      title: String(doc.frontmatter.title ?? doc.title),
      type: doc.type,
      path: doc.relativePath,
      status: doc.frontmatter.status ?? "",
      severity: doc.frontmatter.severity ?? "",
      module: asArray(doc.frontmatter.module),
      tags: asArray(doc.frontmatter.tags),
      snippet: makeSnippet(doc.content, term),
    }));

  if (parsed.options.json) {
    console.log(JSON.stringify(matches, null, 2));
    return;
  }

  for (const match of matches) {
    console.log(`${match.type}\t${match.id}\t${match.path}\t${match.title}`);
  }
}

async function newPlan(ctx, parsed) {
  await ensurePlanDirs(ctx);
  const slug = requiredSlug(parsed.positionals.shift(), "plan slug");
  const title = requiredOption(parsed.options, "title");
  const filePath = path.join(ctx.libRoot, "planning", "plans", "active", `${slug}.md`);
  await assertMissing(filePath);

  const relatedBugs = values(parsed.options, "related-bug");
  const relatedSpecs = values(parsed.options, "related-spec");
  const content = [
    "---",
    `id: ${slug}`,
    `title: ${title}`,
    "status: active",
    `created: ${ctx.date}`,
    `updated: ${ctx.date}`,
    `related_bugs: ${serializeArray(relatedBugs)}`,
    `related_specs: ${serializeArray(relatedSpecs)}`,
    "related_phases: []",
    "---",
    "",
    `# ${title}`,
    "",
    "> 放置位置：`docs/lib/planning/plans/active/`。执行完成后移到 `completed/`；被替代时移到 `superseded/`。",
    "",
    "## 背景",
    "",
    "<!-- 为什么需要这个专项计划；当前现象或限制是什么 -->",
    "",
    "## 目标",
    "",
    "<!-- 做成什么样；必须可验证 -->",
    "",
    "## 非目标",
    "",
    "<!-- 明确本计划不处理什么，防止范围失控 -->",
    "",
    "## 现状链路",
    "",
    "<!-- 入口、关键文件、调用链；尽量写到函数/模块级别 -->",
    "",
    "## 推荐方案",
    "",
    "<!-- 选定方案 + 为什么选它；如有替代方案，简述取舍 -->",
    "",
    "## 实施任务",
    "",
    "1. <任务一>",
    "2. <任务二>",
    "3. <任务三>",
    "",
    "## 验收清单",
    "",
    "- [ ] <可验证结果一>",
    "- [ ] <可验证结果二>",
    "- [ ] <测试/手动验证命令或页面>",
    "",
    "## 风险",
    "",
    "- <风险与缓解方式>",
    "",
    "## 完成记录",
    "",
    "<!-- 移入 completed/ 前补：完成日期、验证方法、关键结果、遗留项 -->",
    "",
  ].join("\n");

  await writeFile(filePath, content, "utf8");
  console.log(`Created ${relativeToRoot(ctx.root, filePath)}`);
}

async function newChange(ctx, parsed) {
  await mkdir(path.join(ctx.libRoot, "changes"), { recursive: true });
  const id = requiredSlug(parsed.positionals.shift() ?? (await nextChangeId(ctx)), "change id");
  const title = requiredOption(parsed.options, "title");
  const dir = path.join(ctx.libRoot, "changes", id);
  await assertMissing(dir);
  await mkdir(dir, { recursive: true });

  const specs = values(parsed.options, "spec");
  const links = values(parsed.options, "link");
  const proposal = [
    "---",
    `id: ${id}`,
    `title: ${title}`,
    "status: proposed",
    `specs_impacted: ${serializeArray(specs)}`,
    `links: ${serializeArray(links)}`,
    `created: ${ctx.date}`,
    `updated: ${ctx.date}`,
    "---",
    "",
    `# ${title}`,
    "",
    "## 背景",
    "",
    "<!-- 为什么要做这个变更；现状的什么问题 -->",
    "",
    "## 目标",
    "",
    "<!-- 做成什么样；可验证的成功标准 -->",
    "",
    "## 方案",
    "",
    "<!-- 怎么做；影响哪些 spec；关键设计决策 -->",
    "",
    "## 非目标",
    "",
    "<!-- 明确不做什么（YAGNI 边界） -->",
    "",
  ].join("\n");
  const tasks = [
    "---",
    `id: ${id}`,
    `title: ${title} — 实施清单`,
    "status: proposed",
    "---",
    "",
    `# 实施清单（change-${id}）`,
    "",
    "> 每完成一项把 `- [ ]` 改成 `- [x]`。`npm run doc:status` 会聚合所有 tasks.md 的勾选框算完成率。",
    "",
    "## S1. 准备",
    "- [ ] 1.1 明确影响模块",
    "- [ ] 1.2 补充验收清单",
    "",
  ].join("\n");

  await writeFile(path.join(dir, "proposal.md"), proposal, "utf8");
  await writeFile(path.join(dir, "tasks.md"), tasks, "utf8");
  console.log(`Created ${relativeToRoot(ctx.root, dir)}`);
}

async function updateChange(ctx, parsed) {
  const id = requiredSlug(parsed.positionals.shift(), "change id");
  const dir = path.join(ctx.libRoot, "changes", id);
  if (!existsSync(dir)) throw new Error(`Change does not exist: ${id}`);

  const proposalPath = path.join(dir, "proposal.md");
  const tasksPath = path.join(dir, "tasks.md");
  if (!existsSync(proposalPath)) throw new Error(`Missing proposal.md for change: ${id}`);

  const proposalContent = await readFile(proposalPath, "utf8");
  const proposalUpdates = {};
  if (parsed.options.status) proposalUpdates.status = String(parsed.options.status);
  if (parsed.options.title) proposalUpdates.title = String(parsed.options.title);
  proposalUpdates.updated = ctx.date;

  const extraLinks = values(parsed.options, "link");
  const extraSpecs = values(parsed.options, "spec");
  const notes = values(parsed.options, "note");

  let nextProposal = replaceFrontmatter(proposalContent, proposalUpdates);
  if (extraLinks.length || extraSpecs.length || notes.length) {
    const append = [];
    if (extraLinks.length) append.push(...extraLinks.map((link) => `- ${link}`));
    if (extraSpecs.length) append.push(...extraSpecs.map((spec) => `- ${spec}`));
    if (notes.length) append.push(...notes);
    nextProposal = appendSection(nextProposal, "## 讨论记录", append);
  }
  await writeFile(proposalPath, nextProposal, "utf8");

  if (existsSync(tasksPath)) {
    let tasksContent = await readFile(tasksPath, "utf8");
    if (parsed.options.status) {
      tasksContent = replaceFrontmatter(tasksContent, {
        status: String(parsed.options.status),
      });
    }
    for (const task of values(parsed.options, "task")) {
      tasksContent = appendTask(tasksContent, task);
    }
    for (const index of values(parsed.options, "check-task")) {
      tasksContent = checkTask(tasksContent, index);
    }
    await writeFile(tasksPath, tasksContent, "utf8");
  }

  console.log(`Updated ${relativeToRoot(ctx.root, dir)}`);
}

async function promotePlan(ctx, parsed) {
  const slug = requiredSlug(parsed.positionals.shift(), "plan slug");
  const changeId = requiredSlug(requiredOption(parsed.options, "change"), "change id");
  const planPath = path.join(ctx.libRoot, "planning", "plans", "active", `${slug}.md`);
  if (!existsSync(planPath)) throw new Error(`Plan does not exist: ${slug}`);

  const planContent = await readFile(planPath, "utf8");
  const planFrontmatter = parseFrontmatter(planContent);
  const title = String(planFrontmatter.title ?? inferTitle(planContent) ?? slug);
  const relatedBugs = asArray(planFrontmatter.related_bugs);
  const relatedSpecs = asArray(planFrontmatter.related_specs);
  const relatedPhases = asArray(planFrontmatter.related_phases);
  const taskSections = extractPlanTasks(planContent);
  const background = extractSection(planContent, "背景");
  const goal = extractSection(planContent, "目标");
  const nonGoals = extractSection(planContent, "非目标");
  const chain = extractSection(planContent, "现状链路");
  const recommendation = extractSection(planContent, "推荐方案");
  const risks = extractSection(planContent, "风险");
  const acceptance = extractChecklistItems(extractSection(planContent, "验收清单"));

  const changeDir = path.join(ctx.libRoot, "changes", changeId);
  await mkdir(changeDir, { recursive: true });
  const proposalPath = path.join(changeDir, "proposal.md");
  const tasksPath = path.join(changeDir, "tasks.md");
  await assertMissing(proposalPath);
  await assertMissing(tasksPath);

  const proposal = [
    "---",
    `id: ${changeId}`,
    `title: ${title}`,
    "status: proposed",
    `specs_impacted: ${serializeArray(relatedSpecs)}`,
    `links: ${serializeArray([relativeToRoot(ctx.root, planPath), ...relatedBugs])}`,
    `created: ${ctx.date}`,
    `updated: ${ctx.date}`,
    "---",
    "",
    `# ${title}`,
    "",
    "## 背景",
    background,
    "",
    "## 目标",
    goal,
    "",
    "## 方案",
    recommendation,
    "",
    "## 非目标",
    nonGoals,
    "",
  ].join("\n").trimEnd() + "\n";

  const tasks = [
    "---",
    `id: ${changeId}`,
    `title: ${title} — 实施清单`,
    "status: proposed",
    "---",
    "",
    `# 实施清单（change-${changeId}）`,
    "",
    "## S1. Plan 转换任务",
    ...(taskSections.length ? taskSections.map((task) => `- [ ] ${task}`) : ["- [ ] 1.1 从 plan 提炼任务"]),
    "",
    "## S2. 验收",
    ...(acceptance.length ? acceptance.map((item) => `- [ ] ${item}`) : ["- [ ] 2.1 通过计划验收清单"]),
    "",
  ].join("\n");

  await writeFile(proposalPath, proposal, "utf8");
  await writeFile(tasksPath, tasks, "utf8");
  const updatedPlan = replaceFrontmatter(planContent, {
    linked_change: relativeToRoot(ctx.root, proposalPath),
  });
  await writeFile(planPath, updatedPlan, "utf8");
  console.log(`Promoted ${relativeToRoot(ctx.root, planPath)} -> ${relativeToRoot(ctx.root, proposalPath)}`);
}

async function closeChange(ctx, parsed) {
  const id = requiredSlug(parsed.positionals.shift(), "change id");
  const statusValue = String(parsed.options.status ?? "archived");
  const dir = path.join(ctx.libRoot, "changes", id);
  if (!existsSync(dir)) throw new Error(`Change does not exist: ${id}`);

  for (const name of ["proposal.md", "tasks.md"]) {
    const filePath = path.join(dir, name);
    if (!existsSync(filePath)) continue;
    const content = await readFile(filePath, "utf8");
    await writeFile(
      filePath,
      replaceFrontmatter(content, { status: statusValue, updated: ctx.date }),
      "utf8",
    );
  }
  console.log(`Updated ${relativeToRoot(ctx.root, dir)} to ${statusValue}`);
}

async function recordBug(ctx, parsed) {
  await mkdir(path.join(ctx.libRoot, "bugs"), { recursive: true });
  const slug = requiredSlug(parsed.positionals.shift(), "bug slug");
  const title = requiredOption(parsed.options, "title");
  const severity = String(parsed.options.severity ?? "P2");
  const statusValue = String(parsed.options.status ?? "open");
  if (!VALID_SEVERITY.has(severity)) throw new Error(`Invalid severity: ${severity}`);
  if (!VALID_BUG_STATUS.has(statusValue)) throw new Error(`Invalid bug status: ${statusValue}`);

  const filePath = path.join(ctx.libRoot, "bugs", `${slug}.md`);
  await assertMissing(filePath);

  const modules = values(parsed.options, "module");
  const tags = values(parsed.options, "tag");
  const summary = String(parsed.options.summary ?? "<!-- 用户可见的症状；运行时证据 -->");
  const content = [
    "---",
    `id: ${slug}`,
    `title: ${title}`,
    `severity: ${severity}`,
    `status: ${statusValue}`,
    `found: ${ctx.date}`,
    `updated: ${ctx.date}`,
    `module: ${serializeArray(modules)}`,
    "counts: {}",
    `linked_change: ${parsed.options["linked-change"] ? String(parsed.options["linked-change"]) : ""}`,
    `tags: ${serializeArray(tags)}`,
    "---",
    "",
    `# ${title}`,
    "",
    "## 现象",
    summary,
    "",
    "## 根因",
    "<!-- 已验证的根因链，含 file:line -->",
    "",
    "## 涉及文件",
    "- `path/to/file.ts` — 说明",
    "",
    "## 修复",
    "<!-- 修复方案 + 当前状态 -->",
    "",
    "## 验证",
    "- [ ] <验证项>",
    "",
  ].join("\n");

  await writeFile(filePath, content, "utf8");
  const bugs = (await scanDocs(ctx.libRoot)).filter((doc) => doc.type === "bug");
  await writeBugIndexes(ctx, bugs);
  console.log(`Created ${relativeToRoot(ctx.root, filePath)}`);
}

async function syncModule(ctx, parsed) {
  const moduleName = requiredSlug(parsed.positionals.shift(), "module name");
  const filePath = path.join(ctx.libRoot, "specs", `${moduleName}.md`);
  if (!existsSync(filePath)) throw new Error(`Spec does not exist: ${moduleName}`);

  const content = await readFile(filePath, "utf8");
  await writeFile(
    filePath,
    replaceFrontmatter(content, {
      status: "fresh",
      "last-updated": ctx.date,
      "last-verified": ctx.date,
      "verified-by": "doclib",
    }),
    "utf8",
  );
  console.log(`Synced ${relativeToRoot(ctx.root, filePath)}`);
}

async function ensureDoclib(ctx) {
  if (!existsSync(ctx.libRoot)) {
    throw new Error(`docs/lib does not exist at ${ctx.libRoot}. Run init first.`);
  }
}

async function ensurePlanDirs(ctx) {
  await mkdir(path.join(ctx.libRoot, "planning", "plans", "active"), { recursive: true });
  await mkdir(path.join(ctx.libRoot, "planning", "plans", "completed"), { recursive: true });
  await mkdir(path.join(ctx.libRoot, "planning", "plans", "superseded"), { recursive: true });
}

async function scanDocs(libRoot) {
  const files = await listMarkdownFiles(libRoot);
  const docs = [];
  for (const filePath of files) {
    const content = await readFile(filePath, "utf8");
    const frontmatter = parseFrontmatter(content);
    const relativePath = normalize(path.relative(libRoot, filePath));
    const type = inferType(relativePath, frontmatter);
    const title = frontmatter.title ?? inferTitle(content) ?? path.basename(filePath, ".md");
    const slug = path.basename(filePath, ".md");
    const doc = { filePath, relativePath, content, frontmatter, type, title, slug };
    if (type === "change") doc.taskProgress = await readTaskProgress(filePath);
    docs.push(doc);
  }
  return docs;
}

async function listMarkdownFiles(root) {
  if (!existsSync(root)) return [];
  const out = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(full);
      }
    }
  }
  await walk(root);
  return out;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const parsed = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf(":");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const rawValue = line.slice(index + 1).trim();
    parsed[key] = parseValue(rawValue);
  }
  return parsed;
}

function parseValue(rawValue) {
  const value = rawValue.replace(/\s+#.*$/, "").trim();
  if (value === "[]") return [];
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  if (value === "{}") return {};
  return value.replace(/^["']|["']$/g, "");
}

function replaceFrontmatter(content, updates) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const serializedUpdates = Object.fromEntries(
    Object.entries(updates).map(([key, value]) => [key, serializeValue(value)]),
  );

  if (!match) {
    const lines = Object.entries(serializedUpdates).map(([key, value]) => `${key}: ${value}`);
    return `---\n${lines.join("\n")}\n---\n\n${content}`;
  }

  const seen = new Set();
  const lines = match[1].split(/\r?\n/).map((line) => {
    const index = line.indexOf(":");
    if (index === -1) return line;
    const key = line.slice(0, index).trim();
    if (!Object.hasOwn(serializedUpdates, key)) return line;
    seen.add(key);
    return `${key}: ${serializedUpdates[key]}`;
  });

  for (const [key, value] of Object.entries(serializedUpdates)) {
    if (!seen.has(key)) lines.push(`${key}: ${value}`);
  }

  return content.replace(match[0], `---\n${lines.join("\n")}\n---`);
}

function serializeValue(value) {
  if (Array.isArray(value)) return serializeArray(value);
  return String(value);
}

function serializeArray(items) {
  return `[${items.map(String).join(", ")}]`;
}

function inferType(relativePath, frontmatter) {
  if (relativePath.startsWith("bugs/") && !relativePath.startsWith("bugs/_")) return "bug";
  if (relativePath.startsWith("specs/") && !relativePath.startsWith("specs/_")) return "spec";
  if (relativePath.startsWith("changes/") && relativePath.endsWith("/proposal.md")) return "change";
  if (relativePath.startsWith("planning/plans/")) return "plan";
  if (relativePath.startsWith("architecture/")) return String(frontmatter.type ?? "architecture");
  return String(frontmatter.type ?? "doc");
}

function isGeneratedDoc(relativePath) {
  return [
    "_status.md",
    "bugs/_index.md",
    "bugs/_by-module.md",
    "changes/_index.md",
  ].includes(relativePath);
}

async function readTaskProgress(proposalPath) {
  const tasksPath = path.join(path.dirname(proposalPath), "tasks.md");
  if (!existsSync(tasksPath)) return "-";
  const content = await readFile(tasksPath, "utf8");
  const total = [...content.matchAll(/- \[[ xX]\]/g)].length;
  const done = [...content.matchAll(/- \[[xX]\]/g)].length;
  return total === 0 ? "-" : `${done}/${total}`;
}

function buildHealth(ctx, { bugs, specs, changes }) {
  return {
    generated: ctx.date,
    staleSpecs: specs
      .filter((spec) => getSpecStatus(ctx, spec) === "stale")
      .map((spec) => summarizeDoc(spec)),
    openBugs: bugs
      .filter((bug) => bug.frontmatter.status === "open")
      .map((bug) => summarizeDoc(bug)),
    partialBugs: bugs
      .filter((bug) => bug.frontmatter.status === "partial")
      .map((bug) => summarizeDoc(bug)),
    activeChanges: changes
      .filter((change) => ["proposed", "in-progress", "complete"].includes(String(change.frontmatter.status ?? "")))
      .map((change) => summarizeDoc(change)),
  };
}

function getSpecStatus(ctx, spec) {
  const explicit = String(spec.frontmatter.status ?? "");
  if (explicit === "missing" || explicit === "stale") return explicit;
  const verified = spec.frontmatter["last-verified"];
  if (!verified) return "stale";
  return daysBetween(String(verified), ctx.date) > 30 ? "stale" : "fresh";
}

function daysBetween(fromDate, toDate) {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return Number.POSITIVE_INFINITY;
  return Math.floor((to - from) / 86_400_000);
}

function summarizeDoc(doc) {
  return {
    id: String(doc.frontmatter.id ?? doc.frontmatter.module ?? doc.slug),
    title: String(doc.frontmatter.title ?? doc.title),
    path: doc.relativePath,
    status: doc.frontmatter.status ?? "",
    severity: doc.frontmatter.severity ?? "",
  };
}

async function writeBugIndexes(ctx, bugs) {
  const bugDir = path.join(ctx.libRoot, "bugs");
  await mkdir(bugDir, { recursive: true });

  const indexLines = [
    "# Bug Index",
    "",
    "> Generated by `npm run doc:status` or `npm run doc:record-bug`.",
    "",
    "| ID | Title | Severity | Status | Module |",
    "|----|-------|----------|--------|--------|",
    ...bugs.map((bug) => {
      const fm = bug.frontmatter;
      return `| [${fm.id ?? bug.slug}](${path.basename(bug.relativePath)}) | ${fm.title ?? bug.title} | ${fm.severity ?? ""} | ${fm.status ?? ""} | ${formatList(fm.module)} |`;
    }),
    "",
  ];
  await writeFile(path.join(bugDir, "_index.md"), `${indexLines.join("\n")}\n`, "utf8");

  const byModule = new Map();
  for (const bug of bugs) {
    for (const moduleName of asArray(bug.frontmatter.module)) {
      if (!byModule.has(moduleName)) byModule.set(moduleName, []);
      byModule.get(moduleName).push(bug);
    }
  }
  const moduleLines = ["# Bugs By Module", "", "> Generated by doclib.", ""];
  for (const [moduleName, moduleBugs] of [...byModule.entries()].sort()) {
    moduleLines.push(`## ${moduleName}`, "");
    for (const bug of moduleBugs) {
      moduleLines.push(`- [${bug.frontmatter.id ?? bug.slug}](${path.basename(bug.relativePath)}) — ${bug.frontmatter.status ?? ""}`);
    }
    moduleLines.push("");
  }
  await writeFile(path.join(bugDir, "_by-module.md"), `${moduleLines.join("\n")}\n`, "utf8");
}

async function nextChangeId(ctx) {
  const changesDir = path.join(ctx.libRoot, "changes");
  if (!existsSync(changesDir)) return "001-change";
  const entries = await readdir(changesDir, { withFileTypes: true });
  const max = entries.reduce((acc, entry) => {
    const match = entry.name.match(/^(\d+)/);
    return match ? Math.max(acc, Number(match[1])) : acc;
  }, 0);
  return `${String(max + 1).padStart(3, "0")}-change`;
}

async function assertMissing(targetPath) {
  if (existsSync(targetPath)) {
    const info = await stat(targetPath);
    throw new Error(`${info.isDirectory() ? "Directory" : "File"} already exists: ${targetPath}`);
  }
}

function requiredSlug(value, label) {
  if (!value) throw new Error(`Missing ${label}`);
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return value;
}

function asArray(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value === undefined || value === null || value === "") return [];
  return [String(value)];
}

function formatList(value) {
  return asArray(value).join(", ");
}

function inferTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1];
}

function makeSnippet(content, term) {
  if (!term) return "";
  const plain = content.replace(/\s+/g, " ");
  const index = plain.toLowerCase().indexOf(term);
  if (index === -1) return "";
  const start = Math.max(0, index - 40);
  const end = Math.min(plain.length, index + term.length + 80);
  return plain.slice(start, end).trim();
}

function normalize(value) {
  return value.split(path.sep).join("/");
}

function relativeToRoot(root, targetPath) {
  return normalize(path.relative(root, targetPath));
}

function printHelp() {
  console.log(`doclib commands:
  init
  status
  health [--json]
  search <term> [--json] [--tag tag] [--module module] [--type type]
  new-plan <slug> --title "..."
  new-change [id] --title "..."
  update-change <id> [--status in-progress] [--note "..."] [--task "..."] [--check-task "1.1"]
  close-change <id> [--status archived]
  promote-plan <plan-slug> --change <change-id>
  record-bug <slug> --title "..." [--severity P2] [--module name] [--tag tag]
  sync-module <module>

Common options:
  --root <path>   Project root, default current directory
  --date <date>   Override YYYY-MM-DD for deterministic generation
`);
}

function templateReadme() {
  return `# Doclib

项目结构化文档库：模块规格、变更追踪、bug 记录、专项计划、架构决策和验证证据。

## 常用入口

- \`specs/_modules.md\`：模块总览。
- \`_status.md\`：全局仪表盘，由 \`npm run doc:status\` 生成。
- \`bugs/_index.md\`：bug 状态索引，由 \`npm run doc:status\` 或 \`npm run doc:record-bug\` 生成。
- \`planning/plans/active/\`：零散专项计划。

## 常用命令

\`\`\`bash
npm run doc:status
npm run doc:health
npm run doc:search -- <keyword>
npm run doc:plan -- <slug> -- --title "..."
npm run doc:new-change -- <id> -- --title "..."
npm run doc:record-bug -- <slug> -- --title "..."
npm run doc:sync-module -- <module>
\`\`\`
`;
}

function templateModules(date) {
  return `---
last-updated: ${date}
---

# 模块总览

## 模块列表

| 模块 | 职责 | 入口点 | SPEC 文件 |
|------|------|--------|-----------|
| <!-- module --> | <!-- responsibility --> | <!-- entry --> | <!-- spec --> |

## 依赖关系图

\`\`\`mermaid
flowchart TD
  Project[Project]
\`\`\`

## 目录与模块的映射

| 目录 | 对应模块 | 说明 |
|------|----------|------|
| <!-- path --> | <!-- module --> | <!-- note --> |
`;
}

function templateStandalonePlan() {
  return `---
id: <slug>
title: <标题>
status: active
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
related_bugs: []
related_specs: []
related_phases: []
---

# <标题>

## 背景

## 目标

## 非目标

## 现状链路

## 推荐方案

## 实施任务

1. <任务一>

## 验收清单

- [ ] <可验证结果>

## 风险

## 完成记录
`;
}

function templateBugReport() {
  return `---
id: <slug>
title: <标题>
severity: P0
status: open
found: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
module: []
counts: {}
linked_change:
tags: []
---

# <标题>

## 现象

## 根因

## 涉及文件

## 修复

## 验证

- [ ] <验证项>
`;
}

function templateChangeProposal() {
  return `---
id: <NNN>
title: <标题>
status: proposed
specs_impacted: []
links: []
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
---

# <标题>

## 背景

## 目标

## 方案

## 非目标
`;
}

function templateChangeTasks() {
  return `---
id: <NNN>
title: <标题> — 实施清单
status: proposed
---

# 实施清单（change-<NNN>）

## S1. <阶段名>
- [ ] 1.1 <任务>
`;
}

function templateModuleSpec() {
  return `---
module: <模块名>
status: stale
last-updated: <YYYY-MM-DD>
last-verified:
verified-by:
---

# <模块名> 规格书

## 职责

## 架构

## 关键文件

## 接口契约

## 依赖

## 关联流程

## 已知陷阱 / 设计约束

## 错题记录
`;
}

function templateFlow() {
  return `---
flow: <流程名>
last-updated: <YYYY-MM-DD>
---

# <流程名>

## 触发条件

## 流程总图

\`\`\`mermaid
flowchart TD
  A[入口] --> B[结束]
\`\`\`

## 逐步骤解析
`;
}

function templateSimpleDoc(title, description) {
  return `# ${title}

${description}
`;
}

function appendSection(content, heading, lines) {
  const section = [`${heading}`, "", ...lines, ""].join("\n");
  if (new RegExp(`^${escapeRegExp(heading)}\\s*$`, "m").test(content)) {
    return content.replace(
      new RegExp(`(${escapeRegExp(heading)}\\s*\\n[\\s\\S]*?)(\\n##\\s|$)`),
      `$1\n${lines.join("\n")}\n$2`,
    );
  }
  return `${content.trimEnd()}\n\n${section}`;
}

function extractSection(content, heading) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return "";
  const collected = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^##[ \t]+/.test(line) || /^---[ \t]*$/.test(line)) break;
    collected.push(line);
  }
  return collected.join("\n").trim();
}

function extractPlanTasks(content) {
  const tasksSection = extractSection(content, "实施任务");
  return extractChecklistItems(tasksSection, { allowHeadings: true });
}

function extractChecklistItems(content, { allowHeadings = false } = {}) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .flatMap((line) => {
      if (!line) return [];
      const bulletMatch = line.match(/^[-*]\s+\[[ xX]\]\s*(.+)$/);
      if (bulletMatch) return [bulletMatch[1].trim()];
      if (allowHeadings) {
        const headingMatch = line.match(/^###\s+(.+)$/);
        if (headingMatch) {
          return [headingMatch[1].trim().replace(/^Task\s+\d+[:：]\s*/, "")];
        }
      }
      return [];
    });
}

function appendTask(content, task) {
  if (content.includes(task)) return content;
  const lines = content.split(/\r?\n/);
  const insertAt = lines.findIndex((line) => /^##\s+S\d+\./.test(line));
  if (insertAt === -1) {
    return `${content.trimEnd()}\n- [ ] ${task}\n`;
  }
  lines.splice(insertAt + 1, 0, `- [ ] ${task}`);
  return `${lines.join("\n").trimEnd()}\n`;
}

function checkTask(content, index) {
  const lines = content.split(/\r?\n/);
  const pattern = new RegExp(`^(-\\s+)\\[ \\]\\s+${escapeRegExp(index)}\\b`);
  const idx = lines.findIndex((line) => pattern.test(line));
  if (idx >= 0) {
    lines[idx] = lines[idx].replace("[ ]", "[x]");
  }
  return `${lines.join("\n")}\n`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

await main();
