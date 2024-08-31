import Polygon from "./lib/Polygon.js";
import SpatialHashGrid from "./lib/SpatialHashGrid.js";
import Vector2D from "./lib/Vector2D.js"

function angleDifference(a, b) {
    const diff = a - b;
    return Math.atan2(Math.sin(diff), Math.cos(diff));
}

const grid = new SpatialHashGrid();

class CollidableObject {
    static idAccumulator = 0;
    /** @type {Map<null,CollidableObject>} */
    static objects = new Map();
    constructor() {
        this.id = CollidableObject.idAccumulator++;

        this.x = 0;
        this.y = 0;
        this.size = 1;
        this.rotation = 0;
        this.velocity = new Vector2D(Math.random() * 10 - 5, Math.random() * 10 - 5);
        this.rotationalVelocity = 0;

        /** @type {Polygon} */
        this.polygon = null;

        this.avoidCollisionRepetition = new Set();

        CollidableObject.objects.set(this.id, this);
    }

    setRandomMovement(maxSpeed) {
        this.velocity = Vector2D.fromDirMag(Math.PI * 2 * Math.random(), maxSpeed);
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.rotation += this.rotationalVelocity;
        this.rotationalVelocity *= .9;

        this.avoidCollisionRepetition.clear();

        if (this.x < 0 || this.x > canvas.width) {
            this.velocity.x *= -1;
        }

        if (this.y < 0 || this.y > canvas.height) {
            this.velocity.y *= -1;
        }

        this.x = Math.max(0, Math.min(canvas.width, this.x));
        this.y = Math.max(0, Math.min(canvas.height, this.y));

        if (this.polygon !== null) {
            this.polygon.transform(this.x, this.y, this.size, this.rotation);
            this._AABB = this.polygon.bounds;
            grid.insert(this);
        } else {
            this._AABB = {
                x1: this.x - this.size,
                y1: this.y - this.size,
                x2: this.x + this.size,
                y2: this.y + this.size
            };
            grid.insert(this);
        }
    }

    queryCollisions() {
        grid.retrieve(this).forEach(/** @param {CollidableObject} other */ other => {
            if (other.id === this.id || this.avoidCollisionRepetition.has(other.id)) {
                return; // Skip self or already processed collisions
            }
    
            this.avoidCollisionRepetition.add(other.id);
            other.avoidCollisionRepetition.add(this.id);
    
            const dx = this.x - other.x;
            const dy = this.y - other.y;
            const totalSize = this.size + other.size;
            const squaredDistance = dx * dx + dy * dy;
    
            if (this.polygon === null && other.polygon === null) {
                // Circle-circle collision
                if (squaredDistance > totalSize * totalSize) {
                    return; // No collision
                }
                this.handleElasticCollision(other, dx, dy, squaredDistance);
            } else if (this.polygon === null || other.polygon === null) {
                // Circle-polygon collision
                const poly = this.polygon !== null ? this : other;
                const circ = this.polygon !== null ? other : this;
    
                if (!poly.polygon.circleIntersects(circ.x, circ.y, circ.size)) {
                    return; // No collision
                }
    
                const result = poly.polygon.resolve(circ.x, circ.y, circ.size);
                circ.x = result.x;
                circ.y = result.y;
    
                // Handle impulse for circle-polygon collision
                this.handleElasticCollision(other, dx, dy, squaredDistance);
            } else {
                // Polygon-polygon collision
                if (!this.polygon.polygonIntersects(other.polygon)) {
                    return; // No collision
                }
    
                const resolution = this.polygon.resolvePolygon(other.polygon);
                if (resolution !== null) {
                    this.x += resolution.x / 2;
                    this.y += resolution.y / 2;
                    other.x -= resolution.x / 2;
                    other.y -= resolution.y / 2;

                    console.log(`(${this.x}, ${this.y}) (${other.x}, ${other.y})`);

                    const ddx = this.x - other.x;
                    const ddy = this.y - other.y;
                    this.handleElasticCollision(other, ddx, ddy, ddx * ddx + ddy * ddy);
                }
            }
        });
    }
    
    /** 
     * Handle elastic collision between two objects 
     * @param {CollidableObject} other
     * @param {number} dx 
     * @param {number} dy 
     * @param {number} squaredDistance 
     */
    handleElasticCollision(other, dx, dy, squaredDistance) {
        const restitution = 1; // Coefficient of restitution (1 for perfectly elastic)
    
        const distance = Math.sqrt(squaredDistance);
        if (distance === 0) {
            // Avoid division by zero; handle overlap
            const overlapCorrection = this.size + other.size;
            dx = (Math.random() - 0.5) * overlapCorrection;
            dy = (Math.random() - 0.5) * overlapCorrection;
        }
    
        const normal = new Vector2D(dx / distance, dy / distance);
        const relativeVelocity = this.velocity.subtractFrom(other.velocity);
        const velocityAlongNormal = relativeVelocity.dot(normal);
    
        if (velocityAlongNormal > 0) {
            return; // Objects are separating, no impulse needed
        }
    
        // Calculate impulse scalar
        const impulseScalar = -(1 + restitution) * velocityAlongNormal / (1 / this.size + 1 / other.size);
        const impulse = new Vector2D(impulseScalar * normal.x, impulseScalar * normal.y);
    
        // Update velocities based on impulse
        this.velocity.x += (impulse.x / this.size);
        this.velocity.y += (impulse.y / this.size);
        other.velocity.x -= (impulse.x / other.size);
        other.velocity.y -= (impulse.y / other.size);
    
        // Handle rotational effects
        const rotationalImpulse = normal.crossProduct(relativeVelocity) * impulseScalar * .01;
        this.rotationalVelocity += rotationalImpulse / this.size;
        other.rotationalVelocity -= rotationalImpulse / other.size;
    }
}

class Timing {
    constructor(maxMemory = 128) {
        this.maxMemory = maxMemory;
        this.memory = [];

        this.currentStart = 0;
        this.frames = 0;
        this.framesPerSecond = 0;

        this.fpsInterval = setInterval(() => {
            this.framesPerSecond = this.frames;
            this.frames = 0;
        }, 1E3);
    }

    start() {
        this.currentStart = performance.now();
    }

    stopAndSave() {
        this.memory.unshift(performance.now() - this.currentStart);
        this.memory.length = Math.min(this.memory.length, this.maxMemory);
        this.frames++;
    }

    get min() {
        return Math.min(...this.memory);
    }

    get max() {
        return Math.max(...this.memory);
    }

    get average() {
        return this.memory.length === 0 ? 0 : this.memory.reduce((a, b) => a + b, 0) / this.memory.length;
    }

    destroy() {
        clearInterval(this.fpsInterval);
    }

    get string() {
        return `FPS: ${this.framesPerSecond} ${this.min.toFixed(2)}/${this.max.toFixed(2)}/${this.average.toFixed(2)} (min/max/avg) ms`;
    }
}

const physicsTiming = new Timing();
const renderTiming = new Timing();

let totalVelocity = 0;

function physicsLoop() {
    // Timings
    physicsTiming.start();

    // Clean up from last tick
    grid.clear();
    totalVelocity = 0;

    // Update everything
    for (const object of CollidableObject.objects.values()) {
        object.update();
    }

    for (const object of CollidableObject.objects.values()) {
        object.queryCollisions();
    }

    for (const object of CollidableObject.objects.values()) {
        totalVelocity += object.velocity.magnitude;
    }

    // Store the time to do all the physics
    physicsTiming.stopAndSave();
}

const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const TAU = Math.PI * 2;

function resize() {
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
}

window.addEventListener("resize", resize);
resize();

function renderLoop() {
    requestAnimationFrame(renderLoop);

    // Timings
    renderTiming.start();

    // Overwrite the canvas
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all the objects
    ctx.strokeStyle = "#FF0000";
    ctx.lineWidth = 2;
    for (const object of CollidableObject.objects.values()) {
        ctx.beginPath();
        ctx.moveTo(object.x + .5 | 0, object.y + .5 | 0);
        if (object.polygon === null) {
            ctx.arc(object.x + .5 | 0, object.y + .5 | 0, object.size + .5 | 0, object.rotation, TAU + object.rotation);
        } else {
            for (let i = 0; i < object.polygon.points.length; i += 2) {
                ctx.lineTo(object.polygon.points[i], object.polygon.points[i + 1]);
            }
            ctx.lineTo(object.polygon.points[0], object.polygon.points[1]);
        }
        ctx.closePath();
        ctx.stroke();
    }

    // Draw our metrics
    const fontSize = 24;
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Render: " + renderTiming.string, fontSize / 2, fontSize);
    ctx.fillText("Physics: " + physicsTiming.string, fontSize / 2, fontSize * 2);
    ctx.fillText("Debug: VelT: " + totalVelocity.toFixed(2), fontSize / 2, fontSize * 3);

    // Store the time to do all the rendering
    renderTiming.stopAndSave();
}

renderLoop();
setInterval(physicsLoop, 1000 / 30);

const slaveUp = false;

for (let i = 0; i < !slaveUp * 256; i++) {
    const o = new CollidableObject();
    o.x = Math.random() * canvas.width;
    o.y = Math.random() * canvas.height;
    o.size = 5 + Math.random() * 25;
    o.rotation = Math.random() * TAU;
    o.setRandomMovement(5);
}

const polygonShapes = [((out = []) => {
    for (let i = 0; i < 8; i++) {
        const a = Math.PI / 4 * i;
        const d = i % 2 ? 1 : .5;

        out.push({
            x: Math.cos(a) * d,
            y: Math.sin(a) * d
        });
    }

    return out;
})(), ((out = []) => {
    for (let i = 0; i < 24; i++) {
        const a = Math.PI / 12 * i;

        out.push({
            x: Math.cos(a),
            y: Math.sin(a) * .75
        });
    }

    return out;
})(), ((out = []) => {
    for (let i = 0; i < 6; i++) {
        const a = Math.PI / 3 * i;
        const d = i % 2 ? 1 : .75;

        out.push({
            x: Math.cos(a) * d,
            y: Math.sin(a) * d
        });
    }

    return out;
})(), [{ x: 0.208, y: 0.138 }, { x: -0.65, y: 0.76 }, { x: -0.448, y: 0.222 }, { x: 0, y: 0 }, { x: -0.458, y: -0.2 }, { x: -0.687, y: -0.726 }, { x: 0.201, y: -0.148 }],
((out = []) => {
    for (let i = 0; i < 5; i++) {
        const a = Math.PI * 2 / 5 * i;
        out.push({
            x: Math.cos(a),
            y: Math.sin(a)
        });
    }

    return out;
})(), ((out = []) => {
    for (let i = 0; i < 20; i++) {
        const a = Math.PI / 10 * i;
        const d = .8 + Math.random() * .4;

        out.push({
            x: Math.cos(a) * d,
            y: Math.sin(a) * d
        });
    }

    return out;
})()];

for (const shape of polygonShapes) {
    const obj = new CollidableObject();
    obj.x = Math.random() * canvas.width;
    obj.y = Math.random() * canvas.height;
    obj.size = 96 + Math.random() * 64;
    obj.rotation = Math.random() * TAU;
    obj.polygon = new Polygon(shape, obj.x, obj.y, obj.size, obj.rotation);
    obj.setRandomMovement(3);
}

if (slaveUp) {
    window.addEventListener("mousemove", e => {
        const circ = CollidableObject.objects.get(1);
        circ.size = 128;
        circ.x = e.clientX * window.devicePixelRatio;
        circ.y = e.clientY * window.devicePixelRatio;
    });
}