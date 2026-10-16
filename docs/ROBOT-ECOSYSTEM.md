# Robot development reference ecosystem (Checkpoint 3)

Question: *What knowledge, models, tools and validation resources would help me understand, simulate and develop a robot?*

Route: `#/use-cases/robot-development` (also reachable from the home-page question). Data:
`scripts/phase2/ecosystem-robotics.mjs` (records) and `scripts/phase2/ecosystem-links.mjs` (relations and ecosystem).
Both scripts are idempotent, and every fact was checked against the cited source on 2026-10-16.

## Scope statement

This is a **discovery and architecture aid**. Documented technical connections cite the publisher's documentation.
The reference workflow is editorial. Nothing here demonstrates that the resources work together in a given context,
and no integration has been implemented or tested by the atlas.

## Stages and resources

| Stage | Resources | New records |
| --- | --- | --- |
| 1 Concepts & semantics | IEEE CORA, RPARTS, POS, RTR, AuR; QUDT; SOSA | — (existing, now linked to the ecosystem) |
| 2 Engineering representations & models | URDF, OpenUSD, SysML v2 | URDF, OpenUSD |
| 3 Frameworks & environments | ROS 2, Gazebo, MuJoCo, NVIDIA Isaac Sim, NVIDIA Isaac Lab, LeRobot | all six |
| 4 Datasets & AI models | Open X-Embodiment, OpenVLA | both |
| 5 Testing, verification & validation | LIBERO, ISO 10218-1:2025 | both |

Resource types used: software-framework (ROS 2), data-schema / file-format (URDF, OpenUSD), simulation (Gazebo, Isaac
Sim, MuJoCo), ai-framework (Isaac Lab, LeRobot), dataset (Open X-Embodiment), ai-model / trained-model (OpenVLA),
benchmark (LIBERO), standard (ISO 10218-1).

## Rights highlights (scoped licences)

- **Isaac Sim:** source code Apache-2.0, but building and running it requires accepting NVIDIA Omniverse licensing terms.
- **OpenVLA:** code MIT; the weights are subject to the Llama Community License (inherited from Llama 2).
- **LIBERO:** code MIT; datasets CC BY 4.0.
- **Open X-Embodiment:** licence **not stated** on the project page, so it is recorded as unknown.
- **ISO 10218-1:** purchased standard.
- `commercialUse: permitted` is recorded only where an SPDX licence was identified and its text reviewed (with a
  "not legal advice; dependencies not assessed" note). Everything else stays unknown.

## Documented technical connections (10)

Isaac Sim supports URDF (import) and OpenUSD, and provides a ROS 2 bridge. Isaac Lab depends on Isaac Sim. MuJoCo
supports URDF. Gazebo provides a ROS 2 interface (ros_gz). ROS 2 supports URDF. LeRobot documents integration with
LIBERO. OpenVLA was trained on Open X-Embodiment and evaluated with LIBERO (author-reported results).

## Physical AI categories (now active)

Simulation & digital twins: Isaac Sim, MuJoCo, Gazebo. Sim-to-real: Isaac Lab. Robot capabilities & control:
LeRobot, OpenVLA. Safety, testing & validation: LIBERO, ISO 10218-1. Each assignment is editorial and backed by a
publisher, specification or peer-reviewed source cited for `capability`.

## Not included, and why

- **ISO 9283** (robot performance test methods): the current edition could not be confirmed from public sources.
- Robot datasets and models beyond one example each: the aim was a small, well-documented set.
- Any connection between the IEEE ontologies and ROS 2 or URDF: no publisher states one. The workflow edge
  "concepts can guide the robot description" is editorial only.

## Verification caveats

`docs.ros.org`, the ROS wiki and `iso.org` block automated checks. ROS 2, URDF and ISO 10218-1 are therefore
*partially verified*, with the alternative sources named in each record.
