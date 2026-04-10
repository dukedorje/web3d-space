// Boid instanced rendering: vertex + fragment shaders
// Reads per-instance position and velocity from storage buffer,
// reads personalityType from config buffer for color and shape,
// builds a rotation matrix to align cone forward axis (+Z) to velocity,
// and applies view-projection transform.

struct BoidState {
    position: vec3f,
    _pad0: f32,
    velocity: vec3f,
    _pad1: u32,
    _pad2: vec4f,
}

struct BoidConfig {
    separationWeight: f32,
    alignmentWeight: f32,
    cohesionWeight: f32,
    perceptionRadius: f32,
    separationRadius: f32,
    maxSpeed: f32,
    wanderStrength: f32,
    crowdSpeedBoost: f32,
    personalityType: u32,
    experienceTimer: f32,
    stressLevel: f32,
    _padding: f32,
}

struct Uniforms {
    deltaTime: f32,
    boidCount: u32,
    worldSize: f32,
    maxForce: f32,
    viewProjection: mat4x4f,
    selectedBoidIndex: u32,
    totalTime: f32,
    _pad0: f32,
    _pad1: f32,
}

@group(0) @binding(0) var<storage, read> boids: array<BoidState>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;
@group(0) @binding(2) var<storage, read> configs: array<BoidConfig>;

// Per-personality colors: Flocker=cyan, Loner=orange, Predator=red, Explorer=green,
// Swirler=purple, Timid=yellow, Mimic=white
const COLORS = array<vec3f, 7>(
    vec3f(0.2, 0.6, 1.0),   // 0: Flocker — cyan/blue
    vec3f(1.0, 0.45, 0.1),  // 1: Loner — orange
    vec3f(1.0, 0.15, 0.15), // 2: Predator — red
    vec3f(0.2, 0.9, 0.3),   // 3: Explorer — green
    vec3f(0.7, 0.3, 1.0),   // 4: Swirler — purple
    vec3f(1.0, 0.9, 0.2),   // 5: Timid — yellow
    vec3f(0.9, 0.9, 0.9),   // 6: Mimic — white
);

// Per-personality shape scales (x, y, z multipliers on cone geometry)
const SCALES = array<vec3f, 7>(
    vec3f(1.0, 1.0, 1.0),   // 0: Flocker — normal
    vec3f(1.8, 0.3, 1.5),   // 1: Loner — flat delta
    vec3f(1.3, 1.3, 1.5),   // 2: Predator — large
    vec3f(0.8, 0.8, 1.4),   // 3: Explorer — sleek
    vec3f(1.0, 1.0, 0.8),   // 4: Swirler — compact
    vec3f(0.7, 0.7, 0.7),   // 5: Timid — small
    vec3f(1.0, 1.0, 1.0),   // 6: Mimic — normal
);

struct VertexInput {
    @location(0) localPos: vec3f,
    @location(1) localNormal: vec3f,
    @builtin(instance_index) instanceIdx: u32,
}

struct VertexOutput {
    @builtin(position) clipPos: vec4f,
    @location(0) worldNormal: vec3f,
    @location(1) baseColor: vec3f,
    @location(2) @interpolate(flat) isSelected: u32,
}

// Build a rotation matrix that rotates +Z to align with the given direction.
fn rotationFromDirection(dir: vec3f) -> mat3x3f {
    let lenSq = dot(dir, dir);
    if (lenSq < 0.0001) {
        return mat3x3f(
            vec3f(1.0, 0.0, 0.0),
            vec3f(0.0, 1.0, 0.0),
            vec3f(0.0, 0.0, 1.0),
        );
    }

    let forward = dir / sqrt(lenSq);

    var upHint = vec3f(0.0, 1.0, 0.0);
    if (abs(dot(forward, upHint)) > 0.99) {
        upHint = vec3f(1.0, 0.0, 0.0);
    }

    let right = normalize(cross(upHint, forward));
    let up = cross(forward, right);

    return mat3x3f(right, up, forward);
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    let boid = boids[input.instanceIdx];
    let config = configs[input.instanceIdx];
    let rotation = rotationFromDirection(boid.velocity);

    let pType = min(config.personalityType, 6u);
    let shapeScale = SCALES[pType];
    let selected = u32(input.instanceIdx == uniforms.selectedBoidIndex);

    // Scale up selected boid by 1.5x
    let selectionScale = select(1.0, 1.5, selected == 1u);

    var localPos = input.localPos * shapeScale * selectionScale;
    var localNormal = normalize(input.localNormal / shapeScale);

    // S4.3: Transition fade-in — lerp from white to personality color
    let transitionDuration = 1.0;
    var baseColor = COLORS[pType];
    if (config.experienceTimer < transitionDuration) {
        let t = smoothstep(0.0, transitionDuration, config.experienceTimer);
        baseColor = mix(vec3f(1.0, 1.0, 1.0), baseColor, t);
    }

    // S4.3: Scale pulse on recent transition — decaying oscillation
    if (config.experienceTimer < transitionDuration) {
        let pulse = 1.0 + sin(config.experienceTimer * 12.0) * 0.2
            * (1.0 - config.experienceTimer / transitionDuration);
        localPos = localPos * pulse;
    }

    let worldPos = rotation * localPos + boid.position;
    let worldNormal = rotation * localNormal;

    var out: VertexOutput;
    out.clipPos = uniforms.viewProjection * vec4f(worldPos, 1.0);
    out.worldNormal = worldNormal;
    out.baseColor = baseColor;
    out.isSelected = selected;

    return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
    // Simple directional lighting
    let lightDir = normalize(vec3f(0.3, 1.0, 0.5));
    let normal = normalize(input.worldNormal);
    let ndotl = max(dot(normal, lightDir), 0.0);

    let ambient = 0.15;
    let diffuse = ndotl * 0.85;
    var color = input.baseColor * (ambient + diffuse);

    // Selection highlight: emissive boost with gentle pulsing
    if (input.isSelected == 1u) {
        let pulse = sin(uniforms.totalTime * 5.0) * 0.15 + 0.85;
        color = color * pulse + vec3f(0.3);
    }

    return vec4f(color, 1.0);
}
