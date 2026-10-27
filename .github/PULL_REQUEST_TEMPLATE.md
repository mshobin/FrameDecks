## Summary

<!-- What does this change do, and why? Link the issue it fixes: "Fixes #123". -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Change to existing behaviour
- [ ] Documentation
- [ ] Build, packaging or tests
- [ ] Other:

## Service safety

A change must never put a live service at risk.

- [ ] This change does **not** affect what happens during a live service, **or** I describe the effect below.
- [ ] I tested the flows this change touches (tick those that apply):
  - [ ] Go Live, and Previous / Next Frame
  - [ ] Stepping through questions and scriptures (→ / ←)
  - [ ] Hide all (Esc), Blackout (K), Freeze (F)
  - [ ] Annotate (D)
  - [ ] Phone remote (Simple and Advanced)
  - [ ] FRAMECAST camera in Zoom / Teams / OBS
  - [ ] Speaker View / Presentation window
- [ ] Existing saved meetings still open and look the same (older data converts on load).

<!-- Effect on a live service, if any: -->

## Tests

- [ ] `node tests/run.js` passes
- [ ] `python packaging/check.py` passes
- [ ] New behaviour has a test (or explain why not)

## Screenshots

<!-- For any change to the interface: before and after. Remove PINs and member data. -->

## Documentation

- [ ] User documentation in `docs/` is updated
- [ ] `docs/CHANGELOG.md` has an entry under **Unreleased**
- [ ] Release notes for the next version (`docs/releases/vX.Y.md`) are updated, if the change is user-facing
- [ ] `docs/architecture/design-history.md` is updated, if the change affects the design
