<section id="camera" class="mb-20">
	<h2 class="text-3xl font-bold text-white mb-6">Section 9: The Camera & Coordinate Pipeline</h2>

	<div class="prose prose-invert max-w-none space-y-4 text-gray-300">
		<p>
			When you fly around the boid simulation — swooping between flocks, panning left and right —
			you're using a virtual camera. But how does a position in 3D space actually become the pixels
			you see on screen? It takes three coordinate transformations, each one shrinking the problem
			down until we reach pixels.
		</p>

		<h3 class="text-xl font-semibold text-white mt-8 mb-2">World Space</h3>
		<p>
			<strong class="text-white">World space</strong> is the master coordinate system — every boid, every
			particle, every point in the simulation lives here. Think of it like the movie set: the director
			has placed everything in a big physical space, and every prop has a real-world address (X, Y, Z).
			In the boids sim the world is a cube roughly 200 units across, and each boid has a position in that
			cube right now.
		</p>

		<h3 class="text-xl font-semibold text-white mt-8 mb-2">View Space</h3>
		<p>
			<strong class="text-white">View space</strong> (also called camera space) is what the world looks
			like from inside the camera. We pretend the camera is glued to the origin, facing straight
			down the negative Z axis, and the entire world is shifted and rotated around it. It's like
			strapping a GoPro to your head: your head is always at (0, 0, 0) in GoPro-space, but the
			trees and mountains move relative to you as you turn.
		</p>
		<p>
			A <strong class="text-white">matrix</strong> — in 3D graphics, a grid of numbers that
			encodes a transformation like rotation, scaling, or translation — is how GPUs move things
			around in space. The <strong class="text-white">view matrix</strong> is one such grid; it
			performs the world-to-camera transformation. In
			<code class="text-blue-300">camera.ts</code>, the
			<code class="text-blue-300">gl-matrix</code> call
			<code class="text-blue-300">mat4.lookAt(viewMatrix, pos, target, up)</code>
			builds that matrix from three pieces: where the camera <em>is</em>, where it's
			<em>looking</em>, and which direction is <em>up</em>.
		</p>

		<h3 class="text-xl font-semibold text-white mt-8 mb-2">Clip Space & the Projection Matrix</h3>
		<p>
			After the view matrix, everything is still 3D. The
			<strong class="text-white">projection matrix</strong> squashes 3D view-space into a
			standard box called <strong class="text-white">clip space</strong>, where X, Y, and Z all
			live in the range −1 to +1 (or 0 to 1 for depth on WebGPU). Anything outside that box is
			literally clipped away — the GPU doesn't even try to draw it.
		</p>
		<p>
			The most important input to the projection matrix is the
			<strong class="text-white">field of view</strong> (FOV) — the angle of the cone the camera
			can see. A narrow FOV is like a telephoto lens (zoomed in, far-away things look big); a wide
			FOV is like a fisheye lens (you see a lot but things at the edges stretch). In
			<code class="text-blue-300">camera.ts</code> the default FOV is 75°:
		</p>
		<pre class="bg-gray-900 rounded p-3 text-sm text-green-300 overflow-x-auto"><code>const DEFAULT_FOV = 75 * DEG_TO_RAD;
// ...
mat4.perspectiveZO(projMatrix, fov, aspect, near, far);</code></pre>
		<p>
			The <code class="text-blue-300">ZO</code> in <code class="text-blue-300">perspectiveZO</code>
			stands for "zero-to-one" depth range — that's the depth convention WebGPU uses (unlike
			WebGL's −1 to +1). Small detail, but if you get it wrong nothing renders.
		</p>
		<p>
			Finally, the GPU's <strong class="text-white">viewport transform</strong> maps clip-space
			coordinates to actual pixel coordinates on your screen. That's the last step — fully handled
			by the hardware.
		</p>

		<h3 class="text-xl font-semibold text-white mt-8 mb-2">Putting It Together</h3>
		<p>
			In <code class="text-blue-300">camera.ts</code>, <code class="text-blue-300">getViewProjectionMatrix()</code>
			multiplies the two matrices into one:
		</p>
		<pre class="bg-gray-900 rounded p-3 text-sm text-green-300 overflow-x-auto"><code>mat4.multiply(vpMatrix, projMatrix, viewMatrix);</code></pre>
		<p>
			Every frame, the boid render pass uploads this single combined matrix to the GPU. The vertex
			shader multiplies each boid position by it in one shot — world space in, clip space out.
		</p>
	</div>

	<!-- Pipeline Diagram -->
	<div class="mt-10">
		<h3 class="text-xl font-semibold text-white mb-6 text-center">The Matrix Pipeline</h3>

		<!-- Desktop: horizontal row. Mobile: vertical stack. -->
		<div class="flex flex-col md:flex-row items-center justify-center gap-0">

			<!-- Stage: World Space -->
			<div class="pipeline-box">
				<div class="pipeline-label">World Space</div>
				<div class="pipeline-desc">Every object's position in the shared 3D scene</div>
			</div>

			<!-- Arrow: Model Matrix -->
			<div class="pipeline-arrow">
				<span class="pipeline-arrow-label">Model Matrix</span>
				<span class="pipeline-arrow-line md:block hidden">→</span>
				<span class="pipeline-arrow-line md:hidden block">↓</span>
			</div>

			<!-- Stage: View Space -->
			<div class="pipeline-box">
				<div class="pipeline-label">View Space</div>
				<div class="pipeline-desc">Relative to the camera's position & orientation</div>
			</div>

			<!-- Arrow: View Matrix -->
			<div class="pipeline-arrow">
				<span class="pipeline-arrow-label">View Matrix</span>
				<span class="pipeline-arrow-line md:block hidden">→</span>
				<span class="pipeline-arrow-line md:hidden block">↓</span>
			</div>

			<!-- Stage: Clip Space -->
			<div class="pipeline-box">
				<div class="pipeline-label">Clip Space</div>
				<div class="pipeline-desc">Normalized box (−1 to +1); outside = invisible</div>
			</div>

			<!-- Arrow: Projection Matrix -->
			<div class="pipeline-arrow">
				<span class="pipeline-arrow-label">Projection Matrix</span>
				<span class="pipeline-arrow-line md:block hidden">→</span>
				<span class="pipeline-arrow-line md:hidden block">↓</span>
			</div>

			<!-- Stage: Screen Space -->
			<div class="pipeline-box pipeline-box-last">
				<div class="pipeline-label">Screen Space</div>
				<div class="pipeline-desc">Actual pixel coordinates on your display</div>
			</div>

		</div>

		<p class="text-center text-gray-500 text-sm mt-4 italic">
			Viewport Transform (hardware) maps Clip Space → Screen Space
		</p>
	</div>
</section>

<style>
	.pipeline-box {
		background-color: rgb(30 41 59); /* slate-800 */
		border: 1px solid rgb(71 85 105); /* slate-600 */
		border-radius: 0.5rem;
		padding: 1rem 1.25rem;
		width: 100%;
		max-width: 180px;
		text-align: center;
		flex-shrink: 0;
	}

	.pipeline-label {
		font-size: 0.95rem;
		font-weight: 700;
		color: rgb(147 197 253); /* blue-300 */
		margin-bottom: 0.4rem;
	}

	.pipeline-desc {
		font-size: 0.75rem;
		color: rgb(148 163 184); /* slate-400 */
		line-height: 1.3;
	}

	.pipeline-arrow {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 0.25rem 0.5rem;
		flex-shrink: 0;
	}

	.pipeline-arrow-label {
		font-size: 0.65rem;
		color: rgb(251 191 36); /* amber-400 */
		font-weight: 600;
		text-align: center;
		white-space: nowrap;
		margin-bottom: 0.1rem;
	}

	.pipeline-arrow-line {
		color: rgb(100 116 139); /* slate-500 */
		font-size: 1.25rem;
		line-height: 1;
	}

	@media (min-width: 768px) {
		.pipeline-box {
			max-width: 150px;
		}
	}
</style>
