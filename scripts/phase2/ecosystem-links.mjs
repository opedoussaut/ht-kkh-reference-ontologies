#!/usr/bin/env node
// Checkpoint 3: documented technical relationships and the robot-development reference ecosystem (editorial).
// Idempotent: adds missing relation types/items, (re)writes the ecosystem use case, links existing ontologies.
//   node scripts/phase2/ecosystem-links.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

export const TECH_CATEGORY = { id: 'technical', label: 'Documented technical connection', description: 'Format support, interfaces, dependencies, training data and evaluation stated in publisher documentation. Not a demonstrated integration in your context.' };
export const TECH_TYPES = [
  { id: 'supports-format', label: 'supports the format', description: "Reads or writes the target format, as stated in the publisher's documentation.", category: 'technical' },
  { id: 'implements-interface', label: 'provides an interface to', description: 'Ships a documented bridge or interface to the target.', category: 'technical' },
  { id: 'depends-on', label: 'depends on', description: 'Requires the target to run, as stated by the publisher.', category: 'technical' },
  { id: 'integrates-with', label: 'documents integration with', description: 'Documents a supported integration with the target (e.g. a supported benchmark).', category: 'technical' },
  { id: 'trained-on', label: 'was trained on', description: 'Model trained on the target dataset, as stated by its authors.', category: 'technical' },
  { id: 'evaluated-with', label: 'was evaluated with', description: 'Evaluated on the target benchmark, with results reported by its authors.', category: 'technical' },
];
const R = (source, target, type, url, evType, note, status = 'verified', conditions) => ({ source, target, type, evidence: { url, type: evType, note }, status, ...(conditions ? { conditions } : {}) });
export const TECH_RELATIONS = [
  R('isaac-sim', 'urdf', 'supports-format', 'https://github.com/isaac-sim/IsaacSim', 'publisher-repository', 'README: imports robotic systems from URDF, MJCF and CAD.', 'verified', 'Import (conversion into USD); not round-trip export.'),
  R('isaac-sim', 'openusd', 'supports-format', 'https://docs.isaacsim.omniverse.nvidia.com/latest/index.html', 'official-documentation', 'Documentation: "USD-native — one scene representation from asset import to deployment".'),
  R('isaac-sim', 'ros2', 'implements-interface', 'https://docs.isaacsim.omniverse.nvidia.com/latest/index.html', 'official-documentation', 'Documentation includes a ROS 2 bridge.', 'verified', 'Supported ROS 2 distributions depend on the Isaac Sim release.'),
  R('isaac-lab', 'isaac-sim', 'depends-on', 'https://github.com/isaac-sim/IsaacLab', 'publisher-repository', 'README: "Built on NVIDIA Isaac Sim"; each branch requires a specific Isaac Sim release.'),
  R('mujoco', 'urdf', 'supports-format', 'https://mujoco.readthedocs.io/en/3.3.1/modeling.html', 'official-documentation', 'Modeling chapter: MuJoCo reads MJCF and the more limited URDF format.', 'verified', 'Only URDF features that MuJoCo maps are supported; MuJoCo-specific extensions apply.'),
  R('gazebo', 'ros2', 'implements-interface', 'https://gazebosim.org/docs/latest/ros_installation/', 'official-documentation', 'Integration through the ros_gz packages, with a documented compatibility table.', 'verified', 'Recommended pairings: Jetty with Lyrical/Rolling, Harmonic with Jazzy, Ionic with Kilted.'),
  R('ros2', 'urdf', 'supports-format', 'https://github.com/ros2/urdf', 'publisher-repository', 'The ROS 2 organisation maintains packages for working with URDF files.'),
  R('lerobot', 'libero', 'integrates-with', 'https://github.com/huggingface/lerobot', 'publisher-repository', 'README lists LIBERO among supported simulation benchmarks.'),
  R('openvla', 'open-x-embodiment', 'trained-on', 'https://github.com/openvla/openvla', 'publisher-repository', 'openvla-7b was trained on an Open X-Embodiment mixture of 970K trajectories.'),
  R('openvla', 'libero', 'evaluated-with', 'https://github.com/openvla/openvla', 'publisher-repository', 'Authors report fine-tuned LIBERO success rates (average 76.5%).', 'verified', 'Results reported by the model authors; not independently replicated.'),
];

export const ECOSYSTEM = {
  id: 'robot-development',
  kind: 'ecosystem',
  name: 'Robot development reference ecosystem',
  legacyEndObject: null,
  tagline: 'From robot concepts to simulation, learning and validation.',
  summary: 'An editorial map of public resources that help an engineer understand, simulate and develop a robot. It is ordered from shared concepts, through engineering representations and frameworks, to data, AI models and validation. Documented technical connections are cited; the reference workflow is a suggestion, not a demonstrated integration.',
  industries: ['industrial-equipment', 'high-tech', 'transportation-mobility'],
  challenges: [
    'Keeping one consistent description of the robot (structure, kinematics, sensors) across design, simulation and software',
    'Choosing simulation and learning tools whose formats and interfaces actually connect',
    'Knowing which data and models can legally be reused, and on what terms',
    'Separating benchmark results from safety and validation evidence',
  ],
  stack: [
    { layer: 'Concepts & semantics', ontologies: ['ieee-cora', 'ieee-rparts', 'ieee-pos', 'ieee-rtr', 'ieee-aur', 'qudt', 'sosa'], role: 'Shared vocabulary for robots, parts, poses, tasks, autonomy, units and sensing.',
      notes: { 'ieee-cora': 'Defines robot, robotic system and environment.', 'ieee-rparts': 'Names robot parts and their roles.', 'ieee-pos': 'Positions, orientations and poses with reference frames.', 'ieee-rtr': 'Task and sub-task representation for planners.', 'ieee-aur': 'Autonomy concepts and design patterns.', qudt: 'Units for joint limits, torques and sensor data.', sosa: 'Observations and actuations from sensors and actuators.' } },
    { layer: 'Engineering representations & models', ontologies: ['urdf', 'openusd', 'sysml-v2'], role: 'Machine-readable descriptions of the robot, its scene and its system architecture.',
      notes: { urdf: 'Kinematic and physical robot description used by ROS and simulators.', openusd: 'Scene and asset composition for simulation and visualisation.', 'sysml-v2': 'System requirements and architecture.' } },
    { layer: 'Frameworks & environments', ontologies: ['ros2', 'gazebo', 'mujoco', 'isaac-sim', 'isaac-lab', 'lerobot'], role: 'Middleware, simulators and learning frameworks to build and exercise robot software.',
      notes: { ros2: 'Communication backbone of the robot software.', gazebo: 'Open-source simulator integrated with ROS 2.', mujoco: 'Fast contact physics for control and learning.', 'isaac-sim': 'GPU simulator with USD scenes and sensor simulation.', 'isaac-lab': 'Robot-learning framework on top of Isaac Sim.', lerobot: 'Datasets, policies and evaluation tools for real robots.' } },
    { layer: 'Datasets & AI models', ontologies: ['open-x-embodiment', 'openvla'], role: 'Training data and pretrained policies; each carries its own terms.',
      notes: { 'open-x-embodiment': 'Cross-robot demonstration data (licence not stated).', openvla: 'Pretrained vision-language-action policy (code MIT, weights under the Llama licence).' } },
    { layer: 'Testing, verification & validation', ontologies: ['libero', 'iso-10218-1'], role: 'Benchmarks that compare policies, and the safety requirements a real robot must meet. These are different kinds of evidence.',
      notes: { libero: 'Simulated benchmark for comparing learned policies.', 'iso-10218-1': 'Normative safety requirements for industrial robots.' } },
  ],
  workflow: [
    { from: 'ieee-rparts', to: 'urdf', label: 'concepts can guide the robot description' },
    { from: 'urdf', to: 'gazebo', label: 'describe the robot for simulation' },
    { from: 'openusd', to: 'isaac-sim', label: 'compose the simulated scene' },
    { from: 'ros2', to: 'gazebo', label: 'test robot software in simulation' },
    { from: 'mujoco', to: 'libero', label: 'simulate evaluation tasks' },
    { from: 'open-x-embodiment', to: 'lerobot', label: 'train policies on demonstration data' },
    { from: 'openvla', to: 'iso-10218-1', label: 'safety requirements still apply to any deployed policy' },
  ],
};
export const LINK_EXISTING = ['ieee-cora', 'ieee-rparts', 'ieee-pos', 'ieee-rtr', 'ieee-aur', 'qudt', 'sosa', 'sysml-v2'];

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rp = join(ROOT, 'data/taxonomy/relations.json');
  const rel = JSON.parse(readFileSync(rp, 'utf8'));
  if (!rel.categories.some((c) => c.id === 'technical')) rel.categories.splice(rel.categories.findIndex((c) => c.id === 'editorial'), 0, TECH_CATEGORY);
  for (const t of TECH_TYPES) if (!rel.types.some((x) => x.id === t.id)) rel.types.push(t);
  for (const r of TECH_RELATIONS) if (!rel.items.some((x) => x.source === r.source && x.target === r.target && x.type === r.type)) rel.items.push(r);
  writeFileSync(rp, JSON.stringify(rel, null, 2) + '\n');

  const up = join(ROOT, 'data/taxonomy/use-cases.json');
  const uc = JSON.parse(readFileSync(up, 'utf8'));
  const i = uc.items.findIndex((u) => u.id === ECOSYSTEM.id);
  if (i >= 0) uc.items[i] = ECOSYSTEM; else uc.items.unshift(ECOSYSTEM);
  writeFileSync(up, JSON.stringify(uc, null, 2) + '\n');

  for (const id of LINK_EXISTING) {
    const p = join(ROOT, 'data/ontologies', `${id}.json`);
    const r = JSON.parse(readFileSync(p, 'utf8'));
    if (!r.useCases.includes(ECOSYSTEM.id)) { r.useCases.push(ECOSYSTEM.id); writeFileSync(p, JSON.stringify(r, null, 2) + '\n'); }
  }
  console.log(`Relations: ${rel.items.length}; use cases: ${uc.items.length}.`);
}
