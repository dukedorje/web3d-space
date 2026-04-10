// Uber-shader: unified boid steering compute shader.
// Reads per-boid config from a config buffer for personality-driven behavior.
// All personality types run through the same shader — differences come from
// config values (weights, radii, speeds) plus a few personality-specific branches.

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
}

// Personality type constants
const PT_FLOCKER: u32 = 0u;
const PT_LONER: u32 = 1u;
const PT_PREDATOR: u32 = 2u;
const PT_EXPLORER: u32 = 3u;
const PT_SWIRLER: u32 = 4u;
const PT_TIMID: u32 = 5u;
const PT_MIMIC: u32 = 6u;

// Personality templates: [sepW, aliW, cohW, percR, sepR, maxSpd, wanderStr, crowdBoost]
// Must stay in sync with PERSONALITY_TEMPLATES in personality-templates.ts
const TEMPLATES = array<array<f32, 8>, 7>(
    array<f32, 8>(1.5, 1.0, 1.0, 15.0, 5.0, 25.0, 0.0, 1.5),  // Flocker
    array<f32, 8>(3.0, 0.1, 0.0, 20.0, 10.0, 20.0, 0.5, 0.0),  // Loner
    array<f32, 8>(0.5, 0.0, 0.0, 25.0, 3.0, 35.0, 0.3, 0.0),   // Predator
    array<f32, 8>(1.0, 0.3, -0.5, 18.0, 6.0, 28.0, 0.8, 0.5),  // Explorer
    array<f32, 8>(1.2, 1.5, 0.7, 15.0, 4.0, 22.0, 0.1, 0.5),   // Swirler
    array<f32, 8>(2.5, 0.4, 0.3, 20.0, 8.0, 30.0, 0.2, 2.0),   // Timid
    array<f32, 8>(1.5, 1.0, 1.0, 15.0, 5.0, 25.0, 0.0, 1.0),   // Mimic
);

// Minimum time before a personality transition can occur (cooldown)
const MIN_TRANSITION_TIME: f32 = 2.0;

@group(0) @binding(0) var<storage, read> boidsIn: array<BoidState>;
@group(0) @binding(1) var<storage, read_write> boidsOut: array<BoidState>;
@group(0) @binding(2) var<uniform> uniforms: Uniforms;
@group(0) @binding(3) var<storage, read_write> configIn: array<BoidConfig>;

// Wrap a scalar value into [-halfSize, halfSize)
fn wrapScalar(v: f32, size: f32) -> f32 {
    let halfSize = size * 0.5;
    var result = v;
    if (result > halfSize) { result -= size; }
    if (result < -halfSize) { result += size; }
    return result;
}

// Wrap a position vector into [-halfSize, halfSize) on each axis
fn wrapPosition(p: vec3f, size: f32) -> vec3f {
    return vec3f(
        wrapScalar(p.x, size),
        wrapScalar(p.y, size),
        wrapScalar(p.z, size),
    );
}

// Compute toroidal offset from a to b (shortest path through wrapping)
fn toroidalOffset(a: vec3f, b: vec3f, size: f32) -> vec3f {
    return wrapPosition(b - a, size);
}

// Limit a vector to a maximum magnitude
fn limitVec(v: vec3f, maxMag: f32) -> vec3f {
    let magSq = dot(v, v);
    if (magSq > maxMag * maxMag) {
        return normalize(v) * maxMag;
    }
    return v;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let index = gid.x;
    if (index >= uniforms.boidCount) {
        return;
    }

    let boid = boidsIn[index];
    let config = configIn[index];
    let worldSize = uniforms.worldSize;
    let maxForce = uniforms.maxForce;
    let dt = uniforms.deltaTime;

    let perceptionRadiusSq = config.perceptionRadius * config.perceptionRadius;
    let separationRadiusSq = config.separationRadius * config.separationRadius;

    // Accumulators for steering forces
    var separationSum = vec3f(0.0);
    var alignmentSum = vec3f(0.0);
    var cohesionSum = vec3f(0.0);
    var perceptionCount = 0u;
    var separationCount = 0u;

    // Personality-specific accumulators
    var nearestPredatorOffset = vec3f(0.0);
    var nearestPredatorDistSq = 1e12;
    var hasPredatorNearby = false;
    var nearestNeighborVelocity = vec3f(0.0);
    var nearestNeighborDistSq = 1e12;
    var nearestNeighborIdx = index; // default to self (no neighbor found)
    var densestClusterDir = vec3f(0.0);

    // O(n) neighbor query
    for (var i = 0u; i < uniforms.boidCount; i++) {
        if (i == index) { continue; }

        let other = boidsIn[i];
        let otherConfig = configIn[i];
        let offset = toroidalOffset(boid.position, other.position, worldSize);
        let distSq = dot(offset, offset);

        if (distSq < perceptionRadiusSq && distSq > 0.0) {
            alignmentSum += other.velocity;
            cohesionSum += offset;
            perceptionCount += 1u;

            // Track densest cluster direction (for predator chase)
            densestClusterDir += offset;

            if (distSq < separationRadiusSq) {
                let dist = sqrt(distSq);
                separationSum -= offset / dist;
                separationCount += 1u;
            }

            // Track nearest neighbor (for mimic)
            if (distSq < nearestNeighborDistSq) {
                nearestNeighborDistSq = distSq;
                nearestNeighborVelocity = other.velocity;
                nearestNeighborIdx = i;
            }

            // Track nearest predator (for timid flee)
            if (otherConfig.personalityType == PT_PREDATOR && distSq < nearestPredatorDistSq) {
                nearestPredatorDistSq = distSq;
                nearestPredatorOffset = offset;
                hasPredatorNearby = true;
            }
        }
    }

    // Compute steering forces using per-boid config weights
    var force = vec3f(0.0);

    if (perceptionCount > 0u) {
        let fCount = f32(perceptionCount);

        // Alignment: steer toward average heading of neighbors
        let avgVelocity = alignmentSum / fCount;
        let alignmentForce = limitVec(avgVelocity - boid.velocity, maxForce);
        force += alignmentForce * config.alignmentWeight;

        // Cohesion: steer toward center of mass of neighbors
        let avgOffset = cohesionSum / fCount;
        let cohesionForce = limitVec(avgOffset - boid.velocity, maxForce);
        force += cohesionForce * config.cohesionWeight;
    }

    if (separationCount > 0u) {
        let avgSeparation = separationSum / f32(separationCount);
        let separationForce = limitVec(avgSeparation, maxForce);
        force += separationForce * config.separationWeight;
    }

    // --- Wander force (driven by config.wanderStrength) ---
    if (config.wanderStrength > 0.001) {
        let phase = f32(index) * 2.399 + dt * 50.0;
        let wander = vec3f(
            sin(phase),
            cos(phase * 0.7),
            sin(phase * 1.3)
        ) * maxForce * config.wanderStrength;
        force += wander;
    }

    // --- Personality-specific special behaviors ---

    // PREDATOR: chase bias toward densest cluster direction
    if (config.personalityType == PT_PREDATOR && perceptionCount > 0u) {
        let chaseDir = normalize(densestClusterDir);
        force += chaseDir * maxForce * 1.5;
    }

    // EXPLORER: edge-attraction force toward nearest world boundary
    if (config.personalityType == PT_EXPLORER) {
        let halfSize = worldSize * 0.5;
        let pos = boid.position;
        let distFromCenter = length(pos);
        let edgeBias = clamp(distFromCenter / halfSize, 0.0, 1.0);
        // Push toward edges — stronger as boid approaches center
        if (distFromCenter > 0.01) {
            let outward = normalize(pos);
            force += outward * maxForce * (1.0 - edgeBias) * 0.8;
        }
    }

    // SWIRLER: rotational force via cross product with up axis
    if (config.personalityType == PT_SWIRLER) {
        let speed = length(boid.velocity);
        if (speed > 0.01) {
            let swirlForce = cross(boid.velocity, vec3f(0.0, 1.0, 0.0));
            force += normalize(swirlForce) * maxForce * 0.6;
        }
    }

    // TIMID: strong flee force from nearest predator
    if (config.personalityType == PT_TIMID && hasPredatorNearby) {
        let fleeDist = sqrt(nearestPredatorDistSq);
        if (fleeDist > 0.01) {
            let fleeDir = -normalize(nearestPredatorOffset);
            let urgency = clamp(1.0 - fleeDist / config.perceptionRadius, 0.0, 1.0);
            force += fleeDir * maxForce * 3.0 * urgency;
        }
    }

    // MIMIC: copy nearest neighbor's velocity direction
    if (config.personalityType == PT_MIMIC && nearestNeighborDistSq < 1e11) {
        let mimicSpeed = length(nearestNeighborVelocity);
        if (mimicSpeed > 0.01) {
            let mimicDir = normalize(nearestNeighborVelocity);
            let mimicForce = limitVec(mimicDir * config.maxSpeed - boid.velocity, maxForce);
            force += mimicForce * 0.8;
        }
    }

    // Apply force (scale by dt * 60 for frame-rate independence)
    var newVelocity = boid.velocity + force * dt * 60.0;

    // Crowd speed boost: more close neighbors = faster (prevents clustering)
    var speedLimit = config.maxSpeed;
    if (separationCount > 0u && config.crowdSpeedBoost > 0.001) {
        let crowding = f32(separationCount) / max(f32(perceptionCount), 1.0);
        speedLimit = config.maxSpeed * (1.0 + crowding * config.crowdSpeedBoost);
        let minSpeed = config.maxSpeed * (0.3 + crowding * 0.5);
        let currentSpeed = length(newVelocity);
        if (currentSpeed < minSpeed && currentSpeed > 0.01) {
            newVelocity = normalize(newVelocity) * minSpeed;
        }
    }
    newVelocity = limitVec(newVelocity, speedLimit);

    // Update position and wrap toroidally
    var newPosition = boid.position + newVelocity * dt;
    newPosition = wrapPosition(newPosition, worldSize);

    // Write boid state output
    var out: BoidState;
    out.position = newPosition;
    out._pad0 = 0.0;
    out.velocity = newVelocity;
    out._pad1 = 0u;
    out._pad2 = vec4f(0.0);
    boidsOut[index] = out;

    // --- S4.1: Experience accumulation ---
    var newExperience = config.experienceTimer + dt;
    let crowdFactor = f32(separationCount) / max(f32(perceptionCount), 1.0);
    var newStress = config.stressLevel + (crowdFactor - 0.3) * dt * 2.0;
    newStress = clamp(newStress, 0.0, 1.0);

    // --- S4.2: Personality transition rules ---
    var newType = config.personalityType;
    var transitioned = false;

    // Only check transitions after cooldown
    if (newExperience >= MIN_TRANSITION_TIME) {
        // Flocker -> Timid: too crowded, becomes anxious
        if (config.personalityType == PT_FLOCKER && newStress > 0.8) {
            newType = PT_TIMID;
            transitioned = true;
        }
        // Timid -> Flocker: calm long enough, rejoins flock
        else if (config.personalityType == PT_TIMID && newStress < 0.2 && newExperience > 5.0) {
            newType = PT_FLOCKER;
            transitioned = true;
        }
        // Loner -> Explorer: bored of wandering, starts exploring edges
        else if (config.personalityType == PT_LONER && newExperience > 10.0) {
            newType = PT_EXPLORER;
            transitioned = true;
        }
        // Explorer -> Loner: too many encounters at edges, retreats
        else if (config.personalityType == PT_EXPLORER && newStress > 0.6) {
            newType = PT_LONER;
            transitioned = true;
        }
        // Predator: never changes
        // Swirler: never changes
    }

    // Apply transition: copy template values, reset experience, preserve stress
    if (transitioned) {
        let t = TEMPLATES[newType];
        configIn[index].separationWeight = t[0];
        configIn[index].alignmentWeight = t[1];
        configIn[index].cohesionWeight = t[2];
        configIn[index].perceptionRadius = t[3];
        configIn[index].separationRadius = t[4];
        configIn[index].maxSpeed = t[5];
        configIn[index].wanderStrength = t[6];
        configIn[index].crowdSpeedBoost = t[7];
        configIn[index].personalityType = newType;
        configIn[index].experienceTimer = 0.0;
        configIn[index].stressLevel = newStress; // preserve stress
    } else {
        // Mimic: copy nearest neighbor's config values each frame (no type change)
        if (config.personalityType == PT_MIMIC && nearestNeighborIdx != index) {
            let nc = configIn[nearestNeighborIdx];
            configIn[index].separationWeight = nc.separationWeight;
            configIn[index].alignmentWeight = nc.alignmentWeight;
            configIn[index].cohesionWeight = nc.cohesionWeight;
            configIn[index].perceptionRadius = nc.perceptionRadius;
        }
        // Always update experience and stress
        configIn[index].experienceTimer = newExperience;
        configIn[index].stressLevel = newStress;
    }
}
