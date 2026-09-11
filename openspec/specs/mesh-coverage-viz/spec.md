# mesh-coverage-viz

## Purpose

`/mesh` shows coverage state a walker can read — covered, thin, or
unknown — visually distinct from 802.11s link-strength. Fixture
positions are enough; live GPS and DreamBall join are other changes.

## Requirements

### Requirement: /mesh shows coverage a walker can read

The `/mesh` PlayCanvas scene SHALL expose per-cell or per-region coverage
as covered, thin, or unknown, visually distinct from 802.11s
link-strength. An empty fixture with no samples SHALL still boot with
everything unknown. A missing PlayCanvas adapter SHALL remain a visible
error.

#### Scenario: Empty fixture

- GIVEN the four-router simulate.ts fleet and no coverage samples
- WHEN `/mesh` loads
- THEN the scene boots and coverage reads as unknown

#### Scenario: Distinct from links

- GIVEN a graph with strong and relayed edges
- WHEN coverage paint is on
- THEN link color still encodes edge strength and coverage uses a
  different encoding

#### Scenario: Adapter missing

- GIVEN `createPlayCanvasApp` throws
- WHEN `/mesh` boots
- THEN the existing visible error path still fires
