# Repository structure

Every repository of this owner follows one layout, so a person who knows one knows them all. This page records the
standard and the places where this repository departs from it on purpose. Moving files must never change behaviour:
move with `git mv`, update every reference in the same commit, and run every check before and after.

## The standard

| Place | Holds |
| --- | --- |
| `README.md`, `LICENSE`, `NOTICE` | What it is and how to run it; the licence (one copy, top level); the Apache notice |
| `.gitignore`, `.gitattributes`, `.editorconfig` | Ignored files; line endings; indentation |
| One config file per tool | Here `ruff.toml` (Python lint). No second copy elsewhere |
| `src/` | Application source code |
| `tests/` | Automated tests; `tests/visual/` holds the browser layout and accessibility suites and their `baselines/` |
| `tools/` | Maintainer scripts and generators; `tools/launchers/` for the `.bat`/`.command` launchers |
| `assets/` | Source artwork (`brand/`) and example files (`samples/`) |
| `packaging/` | Installer and build files (PyInstaller spec, Inno Setup script, requirements, constraints, self-check) |
| `.github/` | `CONTRIBUTING`, `SECURITY`, `SUPPORT`, `CODE_OF_CONDUCT`, issue and pull request templates, `dependabot.yml`, `workflows/` |
| `docs/` | `README.md` (index), `CHANGELOG.md`, `ROADMAP.md` and the folders below |

| `docs/` folder | Holds |
| --- | --- |
| `guide/` | End-user guides; `guide/roles/` for team roles, `guide/images/` for their screenshots |
| `development/` | Architecture, coding standards, developer guide, design system, branching, releases, testing, performance, this page |
| `architecture/` | Design documents for single subsystems, and the design history |
| `reference/` | Feature, configuration and asset reference |
| `deployment/` | Deployment guide, environment variables, hosting, code signing |
| `operations/` | Runbooks (database backup and restore) |
| `releases/` | Release notes per version; `releases/archive/` for old ones |
| `legal/` | `THIRD_PARTY_NOTICES.md` |
| `qa/` | The live test guide, QA reports and the screenshots they show |
| `project/` | Audits and plans still in progress; `project/history/` for finished ones, named `YYYY-MM-DD-topic.md` |
| `continuity/` | `PROJECT_GUIDE.md`, `PROJECT_STATUS.md`, `PROJECT_ROADMAP.md`, `NEXT_SESSION.md` |

**Names:** folders and documents in lowercase-kebab-case, except the conventional upper-case files (`README`,
`LICENSE`, `NOTICE`, `CHANGELOG`, `ROADMAP`, the `.github` community files, `THIRD_PARTY_NOTICES` and the four
continuity files). Images and brand files start with the product name: `framedecks-<what>.<ext>`. Python modules use
snake_case, as Python requires.

## Exceptions in this repository (on purpose)

- **`app/`** is the desktop interface (HTML, CSS, JavaScript, fonts, icons). The program serves it and the installer
  bundles it under that name, so it stays at the top level rather than inside `src/`.
- **`hosted/`** is the website, a separate Next.js project with its own required layout (`src/app/`, `public/`,
  `supabase/migrations/`, `package.json`).
- **Identical copies in `app/` and `hosted/`** (fonts and their licences, the emblem, icons) ship with two different
  products and must stay equal; `tools/make_emblem_assets.py` writes both.
- **`kc-*.json`** data files, saved keys, CSS class names and environment variables keep their old names: renaming
  them would lose people's saved data or break linked computers.
- **`.github/PULL_REQUEST_TEMPLATE.md`** stays upper case (a case-only rename breaks on Windows and OneDrive), and
  the issue templates keep their `snake_case.yml` names, which form part of their GitHub links.
- **`tests/visual/baselines/bar-1440.webp` and `studio.webp`** are identical; both are written by the visual test.
