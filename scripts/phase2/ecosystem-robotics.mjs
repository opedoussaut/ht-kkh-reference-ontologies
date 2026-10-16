#!/usr/bin/env node
// Checkpoint 3: robot-development reference ecosystem (researched 2026-10-16). Adds technology records that do not
// exist yet; never overwrites an existing record. Every fact below was checked against the cited source on that date.
//   node scripts/phase2/ecosystem-robotics.mjs
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const D = '2026-10-16';
const S = (url, title, type, supports) => ({ url, title, type, supports });
const L = (category, text, basis, sourceRef) => ({ text, basis, category, ...(sourceRef ? { sourceRef } : {}) });
const OPEN_NOTE = 'As granted by the licence text; dependencies and third-party components not assessed. Not legal advice.';
const lic = (scope, name, spdx, url, statedAt, extra = {}) => ({ scope, name, ...(spdx ? { spdx } : {}), url, statedAt, commercialUse: 'unknown', reviewStatus: 'not-assessed', ...extra });
const permissive = (scope, name, spdx, url, statedAt) => lic(scope, name, spdx, url, statedAt, { commercialUse: 'permitted', reviewStatus: 'reviewed', reviewNote: OPEN_NOTE });
const UC = ['robot-development'];
const base = (r) => ({
  classificationBasis: { industries: 'editorial', capabilities: 'editorial', ...(r.physicalAi?.length ? { physicalAi: 'editorial' } : {}) },
  editorialReview: { reviewedOn: D, reviewer: 'atlas-editors' },
  origin: 'v2',
});

export const RECORDS = [
  {
    id: 'ros2', name: 'ROS 2', fullName: 'Robot Operating System 2', resourceType: 'software-framework', kind: 'middleware',
    summary: 'Open-source middleware, libraries and tools for building robot applications, with a publish/subscribe communication layer and a large package ecosystem. Distributions are released yearly; even-year releases are long-term support.',
    knowledge: { domain: 'product.interfaces', basis: 'editorial', confidence: 'clear', rationale: 'ROS 2 primarily defines how robot software components communicate (messages, services, actions).' },
    publisher: 'Open Robotics / ROS community', publisherType: 'consortium', topics: ['robot middleware', 'messaging', 'robot software'],
    version: { label: 'Lyrical Luth (LTS), released 22 May 2026, supported to May 2031', date: '2026-05-22', status: 'published' }, maturity: 'stable',
    license: { name: 'Apache-2.0 (core packages)', access: 'open', url: 'https://www.apache.org/licenses/LICENSE-2.0', reviewStatus: 'not-assessed', commercialReuse: 'unknown' },
    licenses: [permissive('software', 'Apache License 2.0 (core client library rclcpp)', 'Apache-2.0', 'https://www.apache.org/licenses/LICENSE-2.0', 'https://github.com/ros2/rclcpp')],
    links: { official: 'https://docs.ros.org/', repository: 'https://github.com/ros2' },
    formats: ['ROS messages (.msg/.srv/.action)', 'URDF (robot description)'],
    industries: ['industrial-equipment', 'high-tech', 'transportation-mobility'], useCases: UC,
    capabilities: ['robotics-autonomy', 'data-exchange'], physicalAi: [],
    limitations: [L('catalogue-gap', 'docs.ros.org blocks automated retrieval; the Lyrical release date comes from a third-party listing, and its LTS status from the Gazebo compatibility documentation.', 'editorial'),
      L('scope', 'Packages in the ROS ecosystem carry their own licences; only the core client library licence is recorded here.', 'editorial')],
    engineeringUses: ['Connecting perception, planning and control components of a robot through typed messages', 'Running the same robot software against a simulator or the real robot through standard interfaces'],
    verification: { checkedOn: D, status: 'partially-verified', notes: 'Official documentation could not be fetched automatically; version facts cross-checked with the Gazebo–ROS compatibility table.', sources: [
      S('https://gazebosim.org/docs/latest/ros_installation/', 'Gazebo: installing Gazebo with ROS (lists ROS 2 Lyrical as LTS)', 'official-documentation', ['status', 'relationship']),
      S('https://endoflife.date/ros-2', 'endoflife.date — ROS 2 release and support dates', 'third-party', ['version']),
      S('https://github.com/ros2/rclcpp', 'ROS 2 C++ client library (Apache-2.0)', 'publisher-repository', ['identity', 'licence'])] },
  },
  {
    id: 'urdf', name: 'URDF', fullName: 'Unified Robot Description Format', resourceType: 'data-schema', kind: 'file-format', layer: 'domain',
    summary: 'XML format for describing a robot model: links, joints, inertial, visual and collision properties. It is the de facto robot description exchanged between ROS tools and many simulators.',
    knowledge: { domain: 'product.structure', basis: 'editorial', confidence: 'clear', rationale: 'URDF describes the kinematic and physical structure of a robot.' },
    publisher: 'ROS community', publisherType: 'consortium', topics: ['robot description', 'kinematics', 'links and joints'],
    version: { label: 'Specification maintained by the ROS community (no version number published)', date: null, status: 'published' }, maturity: 'stable',
    license: { name: 'Parser libraries BSD-3-Clause; licence of the specification text not stated', access: 'open', url: null, reviewStatus: 'not-assessed', commercialReuse: 'unknown' },
    licenses: [permissive('software', 'BSD 3-Clause (ROS 2 URDF parsing packages)', 'BSD-3-Clause', 'https://opensource.org/license/bsd-3-clause', 'https://github.com/ros2/urdf'),
      lic('file-format', 'Specification licence not stated', null, null, 'https://github.com/ros/urdfdom')],
    links: { official: 'https://github.com/ros/urdfdom', repository: 'https://github.com/ros2/urdf' },
    formats: ['XML'], industries: ['industrial-equipment', 'high-tech', 'transportation-mobility'], useCases: UC,
    capabilities: ['robotics-autonomy', 'data-exchange', 'simulation-validation'], physicalAi: [],
    limitations: [L('catalogue-gap', 'The specification pages on the ROS wiki block automated checks; identity is confirmed through the reference parser repositories.', 'editorial')],
    engineeringUses: ['Exchanging a robot’s kinematic structure between design tools, ROS and simulators', 'Describing links, joints and collision geometry for motion planning'],
    verification: { checkedOn: D, status: 'partially-verified', notes: 'Specification page not retrievable automatically.', sources: [
      S('https://github.com/ros/urdfdom', 'urdfdom — URDF parser (robot model: links, joints, materials)', 'publisher-repository', ['identity', 'scope']),
      S('https://github.com/ros2/urdf', 'ros2/urdf — packages for working with URDF files (BSD-3-Clause)', 'publisher-repository', ['licence', 'relationship'])] },
  },
  {
    id: 'openusd', name: 'OpenUSD', fullName: 'Universal Scene Description (OpenUSD)', resourceType: 'data-schema', kind: 'file-format', layer: 'domain',
    summary: 'Extensible software platform and file format for collaboratively constructing and exchanging 3D scenes, originally developed by Pixar. Used as the scene representation of several robotics simulators.',
    knowledge: { domain: 'product.structure', basis: 'editorial', confidence: 'tentative', rationale: 'OpenUSD describes scene structure and composition; it also carries visual and simulation data, so a single domain is a simplification.' },
    publisher: 'Pixar Animation Studios', publisherType: 'industry', topics: ['3D scene description', 'composition', 'digital twins'],
    version: { label: 'OpenUSD 26.08', date: null, status: 'published' }, maturity: 'stable',
    license: { name: 'Tomorrow Open Source Technology License 1.0 (Apache 2.0 with a modified trademark section)', access: 'open', url: 'https://raw.githubusercontent.com/PixarAnimationStudios/OpenUSD/release/LICENSE.txt', reviewStatus: 'not-assessed', commercialReuse: 'unknown' },
    licenses: [lic('software', 'Tomorrow Open Source Technology License 1.0', null, 'https://raw.githubusercontent.com/PixarAnimationStudios/OpenUSD/release/LICENSE.txt', 'https://raw.githubusercontent.com/PixarAnimationStudios/OpenUSD/release/LICENSE.txt', { restrictions: ['Differs from Apache 2.0 in Section 6 (Trademarks).'] })],
    links: { official: 'https://openusd.org/release/index.html', repository: 'https://github.com/PixarAnimationStudios/OpenUSD' },
    formats: ['USD (.usd, .usda, .usdc)'], industries: ['high-tech', 'industrial-equipment', 'architecture-engineering-construction', 'cross-industry'], useCases: UC,
    capabilities: ['digital-twin', 'data-exchange', 'simulation-validation'], physicalAi: [],
    limitations: [],
    engineeringUses: ['Assembling robot, workcell and environment assets into one layered scene for simulation', 'Exchanging 3D scene data between content tools and simulators'],
    verification: { checkedOn: D, status: 'verified', notes: '', sources: [
      S('https://openusd.org/release/index.html', 'OpenUSD documentation (26.08)', 'official-documentation', ['identity', 'version', 'scope']),
      S('https://raw.githubusercontent.com/PixarAnimationStudios/OpenUSD/release/LICENSE.txt', 'OpenUSD LICENSE.txt', 'publisher-repository', ['licence'])] },
  },
  {
    id: 'isaac-sim', name: 'NVIDIA Isaac Sim', fullName: 'NVIDIA Isaac Sim robotics simulation platform', resourceType: 'simulation', kind: 'simulator',
    summary: 'Robotics simulation platform built on NVIDIA Omniverse, with a USD-native scene representation, import of URDF, MJCF and CAD models, simulated sensors and a ROS bridge.',
    knowledge: { domain: 'product.behaviour', basis: 'editorial', confidence: 'clear', rationale: 'A simulator executes models of robot behaviour and sensing.' },
    publisher: 'NVIDIA', publisherType: 'industry', topics: ['robot simulation', 'synthetic data', 'sensor simulation'],
    version: { label: 'Isaac Sim 6.x (documentation covers 6.0 and 6.1 migrations; Isaac Lab 3.0 targets 6.2)', date: null, status: 'published' }, maturity: 'stable',
    license: { name: 'Source code Apache-2.0; building and running it requires NVIDIA Omniverse components under NVIDIA terms', access: 'open-with-terms', url: 'https://github.com/isaac-sim/IsaacSim', reviewStatus: 'not-assessed', commercialReuse: 'unknown' },
    licenses: [permissive('software', 'Apache License 2.0 (Isaac Sim source code)', 'Apache-2.0', 'https://www.apache.org/licenses/LICENSE-2.0', 'https://github.com/isaac-sim/IsaacSim'),
      lic('software', 'NVIDIA Omniverse licensing terms (Kit SDK and extensions, accepted at first build)', null, null, 'https://github.com/isaac-sim/IsaacSim', { restrictions: ['Building or running Isaac Sim requires accepting the NVIDIA Omniverse licensing terms and downloading the Kit SDK and extensions.'] })],
    links: { official: 'https://docs.isaacsim.omniverse.nvidia.com/latest/index.html', repository: 'https://github.com/isaac-sim/IsaacSim' },
    formats: ['USD', 'URDF (import)', 'MJCF (import)'], industries: ['industrial-equipment', 'high-tech', 'transportation-mobility'], useCases: UC,
    capabilities: ['simulation-validation', 'robotics-autonomy', 'digital-twin'], physicalAi: ['simulation-digital-twins'],
    limitations: [L('access', 'Requires accepting NVIDIA Omniverse licensing terms for runtime components; Isaac Lab describes Isaac Sim as having its own proprietary terms.', 'source', 'https://github.com/isaac-sim/IsaacLab'),
      L('catalogue-gap', 'The exact current release number is not stated on the documentation landing page.', 'editorial')],
    engineeringUses: ['Testing robot perception and control software against simulated sensors before hardware is available', 'Generating synthetic sensor data for training perception models'],
    verification: { checkedOn: D, status: 'partially-verified', notes: 'Capabilities as described by the publisher; exact version to confirm.', sources: [
      S('https://docs.isaacsim.omniverse.nvidia.com/latest/index.html', 'Isaac Sim documentation', 'official-documentation', ['identity', 'capability', 'relationship']),
      S('https://github.com/isaac-sim/IsaacSim', 'Isaac Sim repository (README)', 'publisher-repository', ['licence', 'capability', 'relationship'])] },
  },
  {
    id: 'isaac-lab', name: 'NVIDIA Isaac Lab', fullName: 'Isaac Lab robot-learning framework', resourceType: 'ai-framework', kind: 'ai-framework',
    summary: 'Open-source framework for robot learning (reinforcement learning, imitation learning, motion planning) built on Isaac Sim, with ready-to-train environments and sensor models.',
    knowledge: { domain: 'product.behaviour', basis: 'editorial', confidence: 'clear', rationale: 'Trains and evaluates robot behaviours (policies).' },
    publisher: 'NVIDIA', publisherType: 'industry', topics: ['robot learning', 'reinforcement learning', 'imitation learning'],
    version: { label: 'Isaac Lab 3.0.0 (targets Isaac Sim 6.2)', date: null, status: 'published' }, maturity: 'stable',
    license: { name: 'BSD-3-Clause (framework); depends on Isaac Sim terms', access: 'open-with-terms', url: 'https://github.com/isaac-sim/IsaacLab', reviewStatus: 'not-assessed', commercialReuse: 'unknown' },
    licenses: [permissive('software', 'BSD 3-Clause (Isaac Lab framework)', 'BSD-3-Clause', 'https://opensource.org/license/bsd-3-clause', 'https://github.com/isaac-sim/IsaacLab'),
      permissive('software', 'Apache License 2.0 (isaaclab_mimic extension)', 'Apache-2.0', 'https://www.apache.org/licenses/LICENSE-2.0', 'https://github.com/isaac-sim/IsaacLab')],
    links: { official: 'https://github.com/isaac-sim/IsaacLab', repository: 'https://github.com/isaac-sim/IsaacLab' },
    formats: ['Python'], industries: ['industrial-equipment', 'high-tech'], useCases: UC,
    capabilities: ['robotics-autonomy', 'simulation-validation', 'ai-model-development'], physicalAi: ['sim-to-real'],
    limitations: [L('access', 'Full workflows require Isaac Sim (proprietary terms), and the isaaclab_mimic extension requires cuRobo (proprietary).', 'source', 'https://github.com/isaac-sim/IsaacLab')],
    engineeringUses: ['Training locomotion or manipulation policies in parallel simulated environments', 'Evaluating learned policies in simulation before transfer to a physical robot'],
    verification: { checkedOn: D, status: 'verified', notes: 'Capabilities as described by the publisher.', sources: [
      S('https://github.com/isaac-sim/IsaacLab', 'Isaac Lab repository (README)', 'publisher-repository', ['identity', 'version', 'licence', 'capability', 'relationship', 'limitation'])] },
  },
  {
    id: 'mujoco', name: 'MuJoCo', fullName: 'MuJoCo — Multi-Joint dynamics with Contact', resourceType: 'simulation', kind: 'physics-engine',
    summary: 'General-purpose physics simulator for articulated systems with contact, widely used in robotics and robot-learning research. Loads its native MJCF format and URDF.',
    knowledge: { domain: 'product.behaviour', basis: 'editorial', confidence: 'clear', rationale: 'Simulates the dynamic behaviour of articulated systems.' },
    publisher: 'Google DeepMind', publisherType: 'industry', topics: ['physics simulation', 'contact dynamics', 'articulated bodies'],
    version: { label: 'MuJoCo 3.16.0', date: '2026-10-14', status: 'published' }, maturity: 'stable',
    license: { name: 'Apache-2.0', access: 'open', url: 'https://www.apache.org/licenses/LICENSE-2.0', reviewStatus: 'not-assessed', commercialReuse: 'unknown' },
    licenses: [permissive('software', 'Apache License 2.0', 'Apache-2.0', 'https://www.apache.org/licenses/LICENSE-2.0', 'https://github.com/google-deepmind/mujoco')],
    links: { official: 'https://mujoco.readthedocs.io/', repository: 'https://github.com/google-deepmind/mujoco' },
    formats: ['MJCF (XML)', 'URDF', 'MJB'], industries: ['industrial-equipment', 'high-tech', 'life-sciences-healthcare'], useCases: UC,
    capabilities: ['simulation-validation', 'robotics-autonomy'], physicalAi: ['simulation-digital-twins'],
    limitations: [],
    engineeringUses: ['Simulating contact-rich manipulation and locomotion for controller design', 'Providing a fast physics back-end for robot-learning benchmarks'],
    verification: { checkedOn: D, status: 'verified', notes: '', sources: [
      S('https://github.com/google-deepmind/mujoco', 'MuJoCo repository (Apache-2.0)', 'publisher-repository', ['identity', 'licence', 'capability']),
      S('https://mujoco.readthedocs.io/en/latest/changelog.html', 'MuJoCo changelog (3.16.0, 2026-10-14)', 'official-documentation', ['version']),
      S('https://mujoco.readthedocs.io/en/3.3.1/modeling.html', 'MuJoCo modeling chapter (MJCF and URDF)', 'official-documentation', ['capability', 'relationship'])] },
  },
  {
    id: 'gazebo', name: 'Gazebo', fullName: 'Gazebo open-source robotics simulator', resourceType: 'simulation', kind: 'simulator',
    summary: 'Open-source robotics simulator with SDFormat models, sensors and plugins, integrated with ROS 2 through the ros_gz packages. Long-term-support releases pair with ROS 2 LTS distributions.',
    knowledge: { domain: 'product.behaviour', basis: 'editorial', confidence: 'clear', rationale: 'Simulates robot behaviour, sensors and environments.' },
    publisher: 'Open Robotics', publisherType: 'consortium', topics: ['robot simulation', 'sensors', 'SDFormat'],
    version: { label: 'Gazebo Jetty (LTS, September 2025 – May 2031)', date: '2025-09', status: 'published' }, maturity: 'stable',
    license: { name: 'Apache-2.0 (Gazebo Sim library)', access: 'open', url: 'https://www.apache.org/licenses/LICENSE-2.0', reviewStatus: 'not-assessed', commercialReuse: 'unknown' },
    licenses: [permissive('software', 'Apache License 2.0 (gz-sim)', 'Apache-2.0', 'https://www.apache.org/licenses/LICENSE-2.0', 'https://github.com/gazebosim/gz-sim')],
    links: { official: 'https://gazebosim.org/', repository: 'https://github.com/gazebosim/gz-sim' },
    formats: ['SDFormat (SDF)'], industries: ['industrial-equipment', 'high-tech', 'transportation-mobility'], useCases: UC,
    capabilities: ['simulation-validation', 'robotics-autonomy'], physicalAi: ['simulation-digital-twins'],
    limitations: [L('scope', 'Recommended ROS 2 pairings are release-specific (for example Jetty with Lyrical and Rolling, Harmonic with Jazzy).', 'source', 'https://gazebosim.org/docs/latest/ros_installation/')],
    engineeringUses: ['Testing ROS 2 robot software in simulated worlds with simulated sensors', 'Running regression tests of navigation or manipulation stacks in continuous integration'],
    verification: { checkedOn: D, status: 'verified', notes: '', sources: [
      S('https://gazebosim.org/docs/latest/releases/', 'Gazebo releases', 'official-documentation', ['version', 'status']),
      S('https://github.com/gazebosim/gz-sim', 'Gazebo Sim repository (Apache-2.0)', 'publisher-repository', ['identity', 'licence', 'capability']),
      S('https://gazebosim.org/docs/latest/ros_installation/', 'Gazebo: installing Gazebo with ROS', 'official-documentation', ['relationship', 'limitation'])] },
  },
  {
    id: 'lerobot', name: 'LeRobot', fullName: 'Hugging Face LeRobot', resourceType: 'ai-framework', kind: 'ai-framework',
    summary: 'PyTorch library providing models, datasets and tools for real-world robotics: the LeRobotDataset format, implementations of imitation-learning, reinforcement-learning and VLA policies, and evaluation in simulation or on hardware.',
    knowledge: { domain: 'product.behaviour', basis: 'editorial', confidence: 'clear', rationale: 'Trains, runs and evaluates robot policies.' },
    publisher: 'Hugging Face', publisherType: 'industry', topics: ['robot learning', 'policies', 'robot datasets'],
    version: { label: 'Version not stated on the project page', date: null, status: 'published' }, maturity: 'emerging',
    license: { name: 'Apache-2.0', access: 'open', url: 'https://www.apache.org/licenses/LICENSE-2.0', reviewStatus: 'not-assessed', commercialReuse: 'unknown' },
    licenses: [permissive('software', 'Apache License 2.0', 'Apache-2.0', 'https://www.apache.org/licenses/LICENSE-2.0', 'https://github.com/huggingface/lerobot'),
      lic('model-weights', 'Per-model terms on the Hugging Face Hub (not assessed)', null, null, 'https://github.com/huggingface/lerobot'),
      lic('dataset', 'Per-dataset terms on the Hugging Face Hub (not assessed)', null, null, 'https://github.com/huggingface/lerobot')],
    links: { official: 'https://github.com/huggingface/lerobot', repository: 'https://github.com/huggingface/lerobot' },
    formats: ['LeRobotDataset (Parquet + MP4)', 'Python'], industries: ['industrial-equipment', 'high-tech'], useCases: UC,
    capabilities: ['robotics-autonomy', 'ai-model-development'], physicalAi: ['robot-capabilities-control'],
    limitations: [L('catalogue-gap', 'Release version not stated on the project page; model checkpoints and datasets on the Hub carry their own terms.', 'editorial')],
    engineeringUses: ['Recording teleoperation demonstrations in a common dataset format', 'Training and comparing imitation-learning policies on low-cost or research robots'],
    verification: { checkedOn: D, status: 'partially-verified', notes: 'Version not stated by the publisher.', sources: [
      S('https://github.com/huggingface/lerobot', 'LeRobot repository (README)', 'publisher-repository', ['identity', 'licence', 'capability', 'relationship'])] },
  },
  {
    id: 'open-x-embodiment', name: 'Open X-Embodiment', fullName: 'Open X-Embodiment robot learning dataset', resourceType: 'dataset', kind: 'dataset',
    summary: 'Collection of more than one million real-robot trajectories across 22 robot embodiments, pooled from 60 existing datasets of 34 research labs, released with the RT-X models.',
    knowledge: { domain: 'product.operations', basis: 'editorial', confidence: 'tentative', rationale: 'Recorded robot trajectories are operational data; the dataset is mainly used to train policies.' },
    publisher: 'Open X-Embodiment Collaboration', publisherType: 'research', topics: ['robot demonstrations', 'cross-embodiment learning'],
    version: { label: 'Dataset release accompanying arXiv:2310.08864', date: null, status: 'published' }, maturity: 'research',
    license: { name: 'Not stated on the project page', access: 'unknown', url: null, reviewStatus: 'not-assessed', commercialReuse: 'unknown' },
    licenses: [lic('dataset', 'Not stated on the project page', null, null, 'https://robotics-transformer-x.github.io/')],
    links: { official: 'https://robotics-transformer-x.github.io/' },
    formats: ['Standardised episode format (see project page)'], industries: ['industrial-equipment', 'high-tech'], useCases: UC,
    capabilities: ['robotics-autonomy', 'ai-model-development'], physicalAi: [],
    details: { dataset: { modalities: ['RGB images', 'robot state', 'actions', 'language instructions'], size: '1M+ trajectories', collection: '60 existing datasets from 34 robotic research labs', embodiments: '22' } },
    limitations: [L('catalogue-gap', 'The licence is not stated on the project page; it aggregates 60 datasets whose individual terms were not assessed.', 'editorial'),
      L('scope', 'Real-robot demonstrations from research labs; coverage of industrial settings was not assessed.', 'editorial')],
    engineeringUses: ['Pre-training generalist robot policies on data from many robot types', 'Studying how training data from one robot transfers to another'],
    verification: { checkedOn: D, status: 'partially-verified', notes: 'Licence not stated; preprint only.', sources: [
      S('https://robotics-transformer-x.github.io/', 'Open X-Embodiment project page', 'official-documentation', ['identity', 'scope']),
      S('https://arxiv.org/abs/2310.08864', 'Open X-Embodiment: Robotic Learning Datasets and RT-X Models (arXiv)', 'research-publication', ['identity', 'scope'])] },
  },
  {
    id: 'openvla', name: 'OpenVLA', fullName: 'OpenVLA vision-language-action model (openvla-7b)', resourceType: 'ai-model', kind: 'trained-model',
    summary: 'Open 7B-parameter vision-language-action model that maps camera images and language instructions to robot actions, trained on an Open X-Embodiment mixture. The code and the trained weights carry different terms.',
    knowledge: { domain: 'product.behaviour', basis: 'editorial', confidence: 'clear', rationale: 'A trained policy that produces robot behaviour (actions).' },
    publisher: 'OpenVLA authors (Stanford, UC Berkeley, Toyota Research Institute, Google DeepMind and others)', publisherType: 'research', topics: ['vision-language-action', 'robot policy', 'foundation model'],
    version: { label: 'openvla-7b', date: null, status: 'published' }, maturity: 'research',
    license: { name: 'Code MIT; weights subject to the Llama Community License', access: 'open-with-terms', url: 'https://github.com/openvla/openvla', reviewStatus: 'not-assessed', commercialReuse: 'unknown' },
    licenses: [permissive('software', 'MIT License (all code in the repository)', 'MIT', 'https://opensource.org/license/mit', 'https://github.com/openvla/openvla'),
      lic('model-weights', 'Llama Community License (inherited from the Llama 2 base model)', null, null, 'https://github.com/openvla/openvla', { restrictions: ['The authors state the pretrained models may inherit restrictions from their base models and are subject to the Llama Community License.'] })],
    links: { official: 'https://github.com/openvla/openvla', repository: 'https://github.com/openvla/openvla' },
    formats: ['PyTorch / Hugging Face checkpoints'], industries: ['industrial-equipment', 'high-tech'], useCases: UC,
    capabilities: ['robotics-autonomy', 'ai-model-development'], physicalAi: ['robot-capabilities-control'],
    details: { aiModel: { artefact: 'trained-model', weightsPublished: 'yes', baseModel: 'Prismatic prism-dinosiglip-224px VLM (DINOv2 + SigLIP vision, Llama 2 language model)', trainingData: 'Open X-Embodiment mixture, 970K trajectories', modalities: ['RGB image', 'language instruction', 'robot action'] } },
    limitations: [L('unverified-claim', 'LIBERO success rates are reported by the model authors after fine-tuning (3 seeds × 500 rollouts) and have not been independently replicated here.', 'source', 'https://github.com/openvla/openvla'),
      L('access', 'Weights are subject to the Llama Community License, which differs from the MIT licence of the code.', 'source', 'https://github.com/openvla/openvla')],
    engineeringUses: ['Prototyping language-conditioned manipulation on a new robot by fine-tuning a pretrained policy', 'Serving as a baseline when comparing robot-learning approaches on a benchmark'],
    verification: { checkedOn: D, status: 'verified', notes: 'Performance figures are author-reported.', sources: [
      S('https://github.com/openvla/openvla', 'OpenVLA repository (README)', 'publisher-repository', ['identity', 'licence', 'capability', 'relationship', 'limitation']),
      S('https://arxiv.org/abs/2406.09246', 'OpenVLA: An Open-Source Vision-Language-Action Model (arXiv)', 'research-publication', ['identity', 'scope'])] },
  },
  {
    id: 'libero', name: 'LIBERO', fullName: 'LIBERO lifelong robot-learning benchmark', resourceType: 'benchmark', kind: 'benchmark',
    summary: 'Benchmark for knowledge transfer in multitask and lifelong robot learning: 130 procedurally generated manipulation tasks in four suites (Spatial, Object, Goal, and LIBERO-100 split into 90 and 10).',
    knowledge: { domain: 'product.requirements', basis: 'editorial', confidence: 'clear', rationale: 'Defines evaluation tasks and success criteria for robot policies.' },
    publisher: 'LIBERO authors (Lifelong-Robot-Learning)', publisherType: 'research', topics: ['benchmark', 'lifelong learning', 'manipulation'],
    version: { label: 'LIBERO (arXiv:2306.03310)', date: null, status: 'published' }, maturity: 'research',
    license: { name: 'Code MIT; datasets CC BY 4.0', access: 'open', url: 'https://github.com/Lifelong-Robot-Learning/LIBERO', reviewStatus: 'not-assessed', commercialReuse: 'unknown' },
    licenses: [permissive('software', 'MIT License (benchmark code)', 'MIT', 'https://opensource.org/license/mit', 'https://github.com/Lifelong-Robot-Learning/LIBERO'),
      permissive('dataset', 'Creative Commons Attribution 4.0 (datasets)', 'CC-BY-4.0', 'https://creativecommons.org/licenses/by/4.0/', 'https://github.com/Lifelong-Robot-Learning/LIBERO')],
    links: { official: 'https://github.com/Lifelong-Robot-Learning/LIBERO', repository: 'https://github.com/Lifelong-Robot-Learning/LIBERO' },
    formats: ['Python', 'HDF5 demonstrations'], industries: ['industrial-equipment', 'high-tech'], useCases: UC,
    capabilities: ['simulation-validation', 'ai-model-development', 'robotics-autonomy'], physicalAi: ['safety-testing-validation'],
    details: { benchmark: { evaluates: 'Knowledge transfer in multitask and lifelong robot learning (manipulation policies)', metrics: ['task success rate'], environment: 'Simulated tabletop manipulation' } },
    limitations: [L('scope', 'Evaluates simulated tabletop manipulation; results do not establish real-world or safety performance.', 'editorial'),
      L('catalogue-gap', 'The simulation back-end is not named on the project page.', 'editorial')],
    engineeringUses: ['Comparing manipulation policies on a shared, reproducible task suite', 'Testing whether a policy keeps earlier skills when trained on new tasks'],
    verification: { checkedOn: D, status: 'verified', notes: '', sources: [
      S('https://github.com/Lifelong-Robot-Learning/LIBERO', 'LIBERO repository (README)', 'publisher-repository', ['identity', 'licence', 'capability', 'scope']),
      S('https://arxiv.org/abs/2306.03310', 'LIBERO: Benchmarking Knowledge Transfer for Lifelong Robot Learning (arXiv)', 'research-publication', ['identity'])] },
  },
  {
    id: 'iso-10218-1', name: 'ISO 10218-1:2025', fullName: 'ISO 10218-1:2025 Robotics — Safety requirements — Part 1: Industrial robots', resourceType: 'standard', kind: 'specification',
    summary: 'International standard specifying safety requirements for industrial robots as partly completed machinery. The 2025 edition makes functional-safety requirements explicit and integrates collaborative-robot requirements previously in ISO/TS 15066.',
    knowledge: { domain: 'product.requirements', basis: 'editorial', confidence: 'clear', rationale: 'Normative safety requirements.' },
    publisher: 'ISO TC 299 (Robotics)', publisherType: 'standards-body', topics: ['robot safety', 'functional safety', 'collaborative robots'], standardRef: 'ISO 10218-1:2025',
    version: { label: 'Edition 3 (2025)', date: '2025-02', status: 'published' }, maturity: 'standard',
    license: { name: 'ISO standard (purchase required)', access: 'licensed', url: 'https://www.iso.org/standard/73933.html', reviewStatus: 'not-assessed', commercialReuse: 'unknown' },
    licenses: [lic('specification', 'ISO copyright; sold by ISO and national bodies', null, null, 'https://www.iso.org/standard/73933.html')],
    links: { official: 'https://www.iso.org/standard/73933.html' },
    formats: ['Document'], industries: ['industrial-equipment', 'transportation-mobility', 'high-tech'], useCases: UC,
    capabilities: ['safety-assurance', 'robotics-autonomy'], physicalAi: ['safety-testing-validation'],
    details: { standard: { body: 'ISO', designation: 'ISO 10218-1:2025', edition: '3' } },
    limitations: [L('access', 'The normative text is sold by ISO; only catalogue information is public.', 'source', 'https://www.iso.org/standard/73933.html'),
      L('catalogue-gap', 'The ISO catalogue blocks automated checks; edition and date confirmed through search results and industry announcements.', 'editorial')],
    engineeringUses: ['Deriving safety requirements for an industrial robot or robot cell design', 'Planning verification activities for collaborative robot applications'],
    verification: { checkedOn: D, status: 'partially-verified', notes: 'ISO page not retrievable automatically.', sources: [
      S('https://www.iso.org/standard/73933.html', 'ISO 10218-1:2025 catalogue entry', 'published-specification', ['identity', 'version', 'status', 'capability']),
      S('https://www.automate.org/robotics/news/updated-iso-10218-major-advancements-in-industrial-robot-safety-standards-now-available/aph', 'A3: Updated ISO 10218 now available', 'third-party', ['scope'])] },
  },
];

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let added = 0;
  for (const r of RECORDS) {
    const p = join(ROOT, 'data/ontologies', `${r.id}.json`);
    if (existsSync(p)) continue;
    writeFileSync(p, JSON.stringify({ ...r, ...base(r), verification: r.verification }, null, 2) + '\n');
    added++;
  }
  console.log(`Ecosystem: ${added} record(s) added, ${RECORDS.length - added} already present.`);
}
