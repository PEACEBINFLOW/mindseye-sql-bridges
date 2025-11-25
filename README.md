# mindseye-sql-bridges

> **Time-travel adapters that translate legacy data languages and relational algebra into MindsEye SQL.**

This repo is **Repo 20** in the MindsEye / LAW-T / LAW-N ecosystem.

- `mindseye-sql-core` = the **new language**
- `mindseye-sql-bridges` = the **time machine**

It lets you:

- Take **relational algebra** or **old DB scripts**
- Run them through **adapters**
- Get back **MindsEye SQL** strings or **logical plans** that plug into `@mindseye/sql-core`.

Think of it as:  
> “`SELECT` / `JOIN`, but with time, provenance, and LAW-T baked into the bridge.”

---

## High-Level Concepts

- **Relational Algebra → MindsEye SQL**  
  Map `σ`, `π`, `⋈`, `ρ`, etc. into your hybrid SQL + LAW-T dialect.

- **Legacy Scripts → MindsEye SQL**  
  Parse toy dBase/COBOL-style scripts into structured IR and translate them.

- **Moving Library Integration (conceptual)**  
  In later iterations this repo reads from a **Moving Library** of old patterns and suggests equivalent MindsEye SQL.

---

## Project Structure

```text
mindseye-sql-bridges/
├── adapters/
│   ├── relational_algebra.md
│   └── old_db_language_X.md
├── docs/
│   └── HISTORY_TIMELINE.md
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── relational_adapter.ts
│   └── legacy_script_adapter.ts
├── tests/
│   ├── relational_adapter.test.ts
│   └── legacy_script_adapter.test.ts
├── package.json
├── tsconfig.json
├── jest.config.js
├── .gitignore
├── LICENSE
└── README.md
