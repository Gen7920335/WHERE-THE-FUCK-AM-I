# Modified edition development setup

This checkout is prepared to build without a machine-wide .NET or Node.js
installation. The toolchain is downloaded into the ignored `.tools` directory.

## Quick start

Requirements: Windows 10/11, PowerShell 5.1 or newer, Git, and the Microsoft
WebView2 Runtime for launching the GUI.

```powershell
.\scripts\bootstrap.cmd
.\scripts\verify.cmd
.\scripts\run.cmd
```

`bootstrap.ps1` installs repository-local .NET SDK 10.0.302 and Node.js 24.19.0,
verifies the Node.js archive checksum, then restores NuGet and npm packages.
The versions are also recorded in `global.json` and `.node-version`.

`run.ps1` launches the executable from its build-output directory. This matters
because the current application resolves `assets/settings.json` relative to the
working directory. Launching it with `dotnet run` from the repository root can
create or modify runtime files in the source tree.

## Common commands

```powershell
# Full repeatable verification
.\scripts\verify.cmd -Configuration Release

# Run a debug build
.\scripts\run.cmd

# Produce a self-contained Windows x64 build
.\scripts\publish.cmd

# Produce a framework-dependent Windows x64 build
.\scripts\publish.cmd -FrameworkDependent
```

The `.cmd` entry points use `ExecutionPolicy Bypass` only for their child
PowerShell process; they do not change the user's machine-wide policy.

Publish output is written below `artifacts/publish` and is ignored by Git.

The standalone dead-zone test harness is `html/test_deadzone.html`. Open it in a
browser and use **Run All Tests** after changing the auto-pan algorithm. It is a
manually copied version of the production script, so update both the harness and
`Classes/Constants.cs` until the JavaScript is extracted into a shared asset.

## Baseline health

At upstream commit `9f40eaf`:

- Debug build succeeds on .NET SDK 10.0.302.
- The original build emits 105 C# warnings, mostly nullable-reference warnings.
- No automated .NET test project exists.
- The npm audit baseline is clean after updating the transitive `picomatch`
  package in `package-lock.json`.

Do not enable warnings-as-errors until the nullable backlog is reduced. New code
should not add warnings.

## Git and release setup

The original repository is configured as the `upstream` remote. The working
branch is `mod/bootstrap`. After creating a fork, add it as `origin`:

```powershell
git remote add origin https://github.com/<owner>/<modified-repo>.git
git push -u origin mod/bootstrap
```

Before distributing a renamed fork, change all hard-coded upstream URLs and the
Velopack package identity listed in `docs/MOD_ROADMAP.md`. Never publish a tag
while the release workflow still targets the original repository.

## Further reading

- `docs/REVERSE_ENGINEERING.md` — architecture, data flow, persistence, and risks
- `docs/MOD_ROADMAP.md` — ordered modification plan and acceptance criteria
- `LICENSE` — MIT terms that must remain with substantial copies
