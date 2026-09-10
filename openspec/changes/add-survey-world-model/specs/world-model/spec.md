## ADDED Requirements

### Requirement: /mesh may load a world document beside coverage

`/mesh` SHALL be allowed to load a `world-model` document (HDRI, imported
GLB, optional splat-cache refs, LOD distances) while coverage paint stays
on. Capture SHALL enter as GLB (or splat cache), not as an in-browser
trainer. A missing asset SHALL fail visibly.

#### Scenario: Fixture world

- GIVEN a world-model fixture with an HDRI and a GLB
- WHEN `/mesh` loads that document
- THEN the world is visible and coverage state remains readable

#### Scenario: Missing capture

- GIVEN a document that names a missing GLB
- WHEN `/mesh` loads it
- THEN the load error is visible and the page does not hang
