/**
 * 2D Boid simulation engine for the interactive explainer demo.
 * Implements Craig Reynolds' three steering rules: separation, alignment, cohesion.
 * Pure TypeScript — no GPU, no Svelte dependencies.
 */

export interface Boid {
	x: number;
	y: number;
	vx: number;
	vy: number;
}

export interface SteeringForces {
	sepX: number;
	sepY: number;
	aliX: number;
	aliY: number;
	cohX: number;
	cohY: number;
}

export interface SimConfig {
	separationOn: boolean;
	alignmentOn: boolean;
	cohesionOn: boolean;
	separationWeight: number;
	alignmentWeight: number;
	cohesionWeight: number;
}

const PERCEPTION_RADIUS = 80;
const SEPARATION_RADIUS = 30;
const MAX_SPEED = 120;
const MAX_FORCE = 200;

export function createBoids(count: number, width: number, height: number): Boid[] {
	const boids: Boid[] = [];
	for (let i = 0; i < count; i++) {
		const angle = Math.random() * Math.PI * 2;
		const speed = 30 + Math.random() * 40;
		boids.push({
			x: Math.random() * width,
			y: Math.random() * height,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed
		});
	}
	return boids;
}

function wrapScalar(v: number, size: number): number {
	if (v > size) return v - size;
	if (v < 0) return v + size;
	return v;
}

/** Shortest offset from a to b on a torus. */
function toroidalDelta(a: number, b: number, size: number): number {
	let d = b - a;
	const half = size * 0.5;
	if (d > half) d -= size;
	if (d < -half) d += size;
	return d;
}

function limitVec(x: number, y: number, max: number): [number, number] {
	const magSq = x * x + y * y;
	if (magSq > max * max) {
		const mag = Math.sqrt(magSq);
		return [(x / mag) * max, (y / mag) * max];
	}
	return [x, y];
}

/**
 * Compute the three steering force vectors for a single boid.
 * Returns raw (unweighted) forces so the caller can apply weights and toggles.
 */
export function computeForces(
	index: number,
	boids: Boid[],
	width: number,
	height: number
): SteeringForces {
	const boid = boids[index];
	let sepX = 0, sepY = 0;
	let aliX = 0, aliY = 0;
	let cohX = 0, cohY = 0;
	let perceptionCount = 0;
	let separationCount = 0;

	const percSq = PERCEPTION_RADIUS * PERCEPTION_RADIUS;
	const sepSq = SEPARATION_RADIUS * SEPARATION_RADIUS;

	for (let i = 0; i < boids.length; i++) {
		if (i === index) continue;
		const other = boids[i];
		const dx = toroidalDelta(boid.x, other.x, width);
		const dy = toroidalDelta(boid.y, other.y, height);
		const distSq = dx * dx + dy * dy;

		if (distSq < percSq && distSq > 0) {
			aliX += other.vx;
			aliY += other.vy;
			cohX += dx;
			cohY += dy;
			perceptionCount++;

			if (distSq < sepSq) {
				const dist = Math.sqrt(distSq);
				sepX -= dx / dist;
				sepY -= dy / dist;
				separationCount++;
			}
		}
	}

	const forces: SteeringForces = { sepX: 0, sepY: 0, aliX: 0, aliY: 0, cohX: 0, cohY: 0 };

	if (perceptionCount > 0) {
		// Alignment: steer toward average heading
		const avgVx = aliX / perceptionCount - boid.vx;
		const avgVy = aliY / perceptionCount - boid.vy;
		[forces.aliX, forces.aliY] = limitVec(avgVx, avgVy, MAX_FORCE);

		// Cohesion: steer toward center of mass
		const avgCx = cohX / perceptionCount - boid.vx;
		const avgCy = cohY / perceptionCount - boid.vy;
		[forces.cohX, forces.cohY] = limitVec(avgCx, avgCy, MAX_FORCE);
	}

	if (separationCount > 0) {
		const avgSx = sepX / separationCount;
		const avgSy = sepY / separationCount;
		[forces.sepX, forces.sepY] = limitVec(avgSx, avgSy, MAX_FORCE);
	}

	return forces;
}

/**
 * Step the entire simulation forward by dt seconds.
 * Returns per-boid force data for the highlighted boid overlay.
 */
export function stepSimulation(
	boids: Boid[],
	config: SimConfig,
	width: number,
	height: number,
	dt: number
): SteeringForces[] {
	const allForces: SteeringForces[] = [];

	// Compute forces from current state (read-only pass)
	for (let i = 0; i < boids.length; i++) {
		allForces.push(computeForces(i, boids, width, height));
	}

	// Apply forces and update positions
	for (let i = 0; i < boids.length; i++) {
		const boid = boids[i];
		const f = allForces[i];

		let fx = 0, fy = 0;
		if (config.separationOn) {
			fx += f.sepX * config.separationWeight;
			fy += f.sepY * config.separationWeight;
		}
		if (config.alignmentOn) {
			fx += f.aliX * config.alignmentWeight;
			fy += f.aliY * config.alignmentWeight;
		}
		if (config.cohesionOn) {
			fx += f.cohX * config.cohesionWeight;
			fy += f.cohY * config.cohesionWeight;
		}

		boid.vx += fx * dt;
		boid.vy += fy * dt;
		[boid.vx, boid.vy] = limitVec(boid.vx, boid.vy, MAX_SPEED);

		boid.x = wrapScalar(boid.x + boid.vx * dt, width);
		boid.y = wrapScalar(boid.y + boid.vy * dt, height);
	}

	return allForces;
}
