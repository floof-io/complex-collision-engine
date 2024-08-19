import { getTerrain, SIDE_FLAGS } from "./lib/generateTerrain.js";
import MazeGenerator from "./lib/MazeGenerator.js";
import SpatialHashGrid from "./lib/SpatialHashGrid.js";

const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");

function resize() {
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;

    ctx.lineCap = ctx.lineJoin = "round";
}

window.addEventListener("resize", resize);
resize();

const mouse = {
    x: 0,
    y: 0,

    fovScale: 1,

    left: false
};

window.addEventListener("mousemove", event => {
    mouse.x = event.clientX * window.devicePixelRatio / mouse.fovScale;
    mouse.y = event.clientY * window.devicePixelRatio / mouse.fovScale;
});

window.addEventListener("wheel", event => {
    mouse.fovScale += event.deltaY * .001;

    mouse.fovScale = Math.max(.25, Math.min(2, mouse.fovScale));
});

function lerp(a, b, t) {
    return a + (b - a) * t;
}

const colorCache = new Map();
function mixColors(primary, secondary, amount = .5) {
    const key = `${primary}${secondary}${amount}`;

    if (colorCache.has(key)) {
        return colorCache.get(key);
    }

    const pr = parseInt(primary.slice(1), 16);
    const sc = parseInt(secondary.slice(1), 16);

    const hex = `#${(
        1 << 24 |
        (lerp((pr >> 16) & 255, (sc >> 16) & 255, amount) | 0) << 16 |
        (lerp((pr >> 8) & 255, (sc >> 8) & 255, amount) | 0) << 8 |
        (lerp(pr & 255, sc & 255, amount) | 0)
    ).toString(16).slice(1)}`;

    colorCache.set(key, hex);

    return hex;
}

const spatialHash = new SpatialHashGrid();

let idAccum = 0;

class Polygon {
    static polygons = [];

    constructor(x, y, radius, rotation, sides, color) {
        this.id = idAccum++;
        this.type = 1;

        this.color = color;

        this.gridX = 0;
        this.gridY = 0;

        this.numSides = sides.length;
        this.numPoints = this.numSides * 2;
        this.sides = new Float32Array(this.numPoints);
        this.points = new Float32Array(this.numPoints);

        this.x = 0;
        this.y = 0;
        this.radius = 0;
        this.rotation = 0;
        this._AABB = { x1: 0, y1: 0, x2: 0, y2: 0 };

        for (let i = 0; i < this.numSides; i++) {
            this.sides[i * 2] = sides[i].x;
            this.sides[i * 2 + 1] = sides[i].y;
        }

        this.transform(x, y, radius, rotation);

        this.collisions = new Set();

        Polygon.polygons.push(this);
    }

    transform(x, y, radius, rotation) {
        if (this.x === x && this.y === y && this.radius === radius && this.rotation === rotation) {
            return;
        }

        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        for (let i = 0; i < this.numPoints; i += 2) {
            const pointX = this.sides[i];
            const pointY = this.sides[i + 1];

            this.points[i] = x + (pointX * cos - pointY * sin) * radius;
            this.points[i + 1] = y + (pointX * sin + pointY * cos) * radius;
        }

        this.x = x;
        this.y = y;
        this.radius = radius;
        this.rotation = rotation;
        this._AABB = this.getAABB();
    }

    getAABB() {
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

        for (let i = 0; i < this.numPoints; i += 2) {
            const x = this.points[i];
            const y = this.points[i + 1];

            if (x < minX) {
                minX = x;
            }

            if (y < minY) {
                minY = y;
            }

            if (x > maxX) {
                maxX = x;
            }

            if (y > maxY) {
                maxY = y;
            }
        }

        return {
            x1: minX - 5,
            y1: minY - 5,
            x2: maxX + 5,
            y2: maxY + 5
        };
    }

    pointIsInside(x, y) {
        let inside = false;

        let x1 = this.points[this.numPoints - 2],
            y1 = this.points[this.numPoints - 1];

        for (let i = 0; i < this.numPoints; i += 2) {
            let x2 = this.points[i],
                y2 = this.points[i + 1];

            if (y < y1 !== y < y2 && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1) {
                inside = !inside;
            }

            x1 = x2;
            y1 = y2;
        }

        return inside;
    }

    circleIntersectsEdge(px1, py1, px2, py2, cx, cy, radius) {
        const ABx = px2 - px1;
        const ABy = py2 - py1;
        const ACx = cx - px1;
        const ACy = cy - py1;

        const t = Math.max(0, Math.min(1, (ABx * ACx + ABy * ACy) / (ABx * ABx + ABy * ABy)));
        const dx = (px1 + ABx * t) - cx;
        const dy = (py1 + ABy * t) - cy;

        return dx * dx + dy * dy <= radius * radius;
    }

    circleIntersects(x, y, radius) {
        if (this.pointIsInside(x, y)) {
            return true;
        }

        for (let i = 0; i < this.numPoints; i += 2) {
            if (this.circleIntersectsEdge(this.points[i], this.points[i + 1], this.points[(i + 2) % this.numPoints], this.points[(i + 3) % this.numPoints], x, y, radius)) {
                return true;
            }
        }

        return false;
    }

    getClosestPointOnEdge(px1, py1, px2, py2, cx, cy) {
        const ABx = px2 - px1;
        const ABy = py2 - py1;
        const ACx = cx - px1;
        const ACy = cy - py1;
        const AB_AB = ABx * ABx + ABy * ABy;
        const AB_AC = ABx * ACx + ABy * ACy;
        const t = AB_AC / AB_AB;
        const t_clamped = Math.max(0, Math.min(1, t));

        return {
            x: px1 + ABx * t_clamped,
            y: py1 + ABy * t_clamped
        };
    }

    resolve(x, y, radius) {
        let closestDistance = Infinity,
            closestPoint = null;

        for (let i = 0; i < this.numPoints; i += 2) {
            const point = this.getClosestPointOnEdge(this.points[i], this.points[i + 1], this.points[(i + 2) % this.numPoints], this.points[(i + 3) % this.numPoints], x, y);
        
            const dx = point.x - x;
            const dy = point.y - y;
            const distance = dx * dx + dy * dy;

            if (distance < closestDistance) {
                closestDistance = distance;
                closestPoint = point;
            }
        }

        const dx = closestPoint.x - x;
        const dy = closestPoint.y - y;
        const angle = Math.atan2(dy, dx);

        x = closestPoint.x - Math.cos(angle) * radius;
        y = closestPoint.y - Math.sin(angle) * radius;

        let atan = Math.atan2(y - closestPoint.y, x - closestPoint.x);

        if (this.pointIsInside(x, y)) {
            atan += Math.PI;
        }

        return {
            x: closestPoint.x + Math.cos(atan) * radius,
            y: closestPoint.y + Math.sin(atan) * radius,
            angle: atan
        }
    }

    update() {
        this.collisions.clear();
        spatialHash.insert(this);
    }

    render() {
        ctx.fillStyle = this.color;
        ctx.strokeStyle = mixColors(this.color, "#000000", .2);
        ctx.lineWidth = 4;

        ctx.beginPath();
        ctx.moveTo(this.points[0], this.points[1]);

        for (let i = 2; i < this.numPoints; i += 2) {
            ctx.lineTo(this.points[i], this.points[i + 1]);
        }

        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
}

const blockSize = 128 + 64;
const generator = new MazeGenerator(16, 16);
generator.spacing = 2;
generator.gridChance = 1;
generator.toPlaceAmount = .4;
generator.maxNeighbors = 2;
generator.maxDiagonalNeighbors = 1;
generator.removeSingles = true;
generator.removeBlocks = true;
generator.generate();

for (let i = 0; i < generator.width; i++) {
    for (let j = 0; j < generator.height; j++) {
        if (generator.get(i, j) === 1) {
            let top = j > 0 && generator.get(i, j - 1) === 1,
                right = i < generator.width - 1 && generator.get(i + 1, j) === 1,
                bottom = j < generator.height - 1 && generator.get(i, j + 1) === 1,
                left = i > 0 && generator.get(i - 1, j) === 1;

            let flags = 0;

            if (!top) {
                flags |= SIDE_FLAGS.TOP;
            }

            if (!right) {
                flags |= SIDE_FLAGS.RIGHT;
            }

            if (!bottom) {
                flags |= SIDE_FLAGS.BOTTOM;
            }

            if (!left) {
                flags |= SIDE_FLAGS.LEFT;
            }

            const polygon = new Polygon(blockSize + (i + .5) * blockSize, blockSize + (j + .5) * blockSize, blockSize / 2, 0, getTerrain(flags), "#55CACA");
            polygon.gridX = i;
            polygon.gridY = j;
        }
    }
}

new Polygon(blockSize * generator.width + 800, 1800, 150, Math.random() * Math.PI * 2, ((out = []) => {
    for (let i = 0; i < 5; i++) {
        const a = Math.PI * 2 / 5 * i;
        out.push({
            x: Math.cos(a),
            y: Math.sin(a)
        });
    }

    return out;
})(), "#55CA55");

new Polygon(blockSize * generator.width + 400, 1800, 150, Math.random() * Math.PI * 2, ((out = []) => {
    for (let i = 0; i < 8; i++) {
        const a = Math.PI / 4 * i;
        const d = i % 2 ? 1 : .5;

        out.push({
            x: Math.cos(a) * d,
            y: Math.sin(a) * d
        });
    }

    return out;
})(), "#CA5555");

new Polygon(blockSize * generator.width + 400, 500, 250, Math.random() * Math.PI * 2, [{ x: 0.208, y: 0.138 }, { x: -0.65, y: 0.76 }, { x: -0.448, y: 0.222 }, { x: 0, y: 0 }, { x: -0.458, y: -0.2 }, { x: -0.687, y: -0.726 }, { x: 0.201, y: -0.148 }], "#5555CA");

new Polygon(blockSize * generator.width + 800, 500, 150, Math.random() * Math.PI * 2, ((out = []) => {
    for (let i = 0; i < 24; i++) {
        const a = Math.PI / 12 * i;

        out.push({
            x: Math.cos(a),
            y: Math.sin(a) * .75
        });
    }

    return out;
})(), "#CACA55");

new Polygon(blockSize * generator.width + 600, 1024, 250, Math.random() * Math.PI * 2, ((out = []) => {
    for (let i = 0; i < 20; i++) {
        const a = Math.PI / 10 * i;
        const d = .8 + Math.random() * .4;

        out.push({
            x: Math.cos(a) * d,
            y: Math.sin(a) * d
        });
    }

    return out;
})(), "#55CACA");

class Vector2D {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    multiply(value) {
        this.x *= value;
        this.y *= value;
    }

    zero() {
        this.x = 0;
        this.y = 0;
    }

    get magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    get direction() {
        return Math.atan2(this.y, this.x);
    }
}

const circID = idAccum;

class Circle {
    static circles = [];

    constructor(x, y, radius, color) {
        this.id = idAccum++;
        this.type = 0;

        this.x = x;
        this.y = y;
        this.size = radius;
        this.color = color;

        this.width = 1;
        this.height = 1;

        this.speed = 5;
        this.friction = .925;

        this.moveGoal = false;

        this.velocity = new Vector2D(Math.random() * 2 - 1, Math.random() * 2 - 1);

        Circle.circles.push(this);

        this.collisions = new Set();
    }

    update() {
        this.velocity.multiply(this.friction);

        if (this.x + this.size > canvas.width / mouse.fovScale || this.x - this.size < 0) {
            this.velocity.x *= -1;
        }

        if (this.y + this.size > canvas.height / mouse.fovScale || this.y - this.size < 0) {
            this.velocity.y *= -1;
        }

        if (this.id !== circID) {
            this.moveGoal = mouse.left ? mouse : false;
            this.friction = mouse.left ? .6 : .925;
        }

        if (this.moveGoal) {
            const strength = Math.min(this.speed, Math.sqrt((this.moveGoal.x - this.x) ** 2 + (this.moveGoal.y - this.y) ** 2));
            const angle = Math.atan2(this.moveGoal.y - this.y, this.moveGoal.x - this.x);

            this.velocity.x += Math.cos(angle) * strength;
            this.velocity.y += Math.sin(angle) * strength;
        } else if (this.velocity.magnitude < .01) {
            const a = Math.random() * Math.PI * 2;
            this.velocity.x = Math.cos(a) * this.speed;
            this.velocity.y = Math.sin(a) * this.speed;
        }

        this.x += this.velocity.x;
        this.y += this.velocity.y;

        this.collisions.clear();
        this._AABB = spatialHash.getAABB(this);
        spatialHash.insert(this);
    }

    collide() {
        const polygons = [];

        spatialHash.retrieve(this).forEach(other => {
            if (this.id === other.id || this.collisions.has(other.id)) {
                return;
            }

            this.collisions.add(other.id);
            other.collisions.add(this.id);

            if (other.type === 1) {
                if (other.circleIntersects(this.x, this.y, this.size)) {
                    const resolved = other.resolve(this.x, this.y, this.size);
                    this.x = resolved.x;
                    this.y = resolved.y;

                    polygons.push(other);
                }

                return;
            }

            const dx = other.x - this.x;
            const dy = other.y - this.y;
            const minDistance = this.size + other.size;

            if (dx * dx + dy * dy < minDistance * minDistance) {
                const angle = Math.atan2(dy, dx);
                const targetX = this.x + Math.cos(angle) * minDistance;
                const targetY = this.y + Math.sin(angle) * minDistance;
                const ax = (targetX - other.x) * .1;
                const ay = (targetY - other.y) * .1;

                this.velocity.x -= ax;
                this.velocity.y -= ay;
                other.velocity.x += ax;
                other.velocity.y += ay;
            }
        });

        if (polygons.length > 0) { // If we don't do this you glitch inside the walls, if we do, entities bunch on eachother
            this.velocity.zero();
        }

        if (polygons.length === 2) {
            // Make sure it's not corner collision  
            const xDiff = Math.abs(polygons[0].gridX - polygons[1].gridX);
            const yDiff = Math.abs(polygons[0].gridY - polygons[1].gridY);

            if (xDiff === yDiff || xDiff > 1 || yDiff > 1) {
                return;
            }

            const avg = {
                x: 0,
                y: 0,
                size: 0
            };

            for (const polygon of polygons) {
                avg.x += polygon.x;
                avg.y += polygon.y;
                avg.size += polygon.radius;
            }

            avg.x /= polygons.length;
            avg.y /= polygons.length;
            avg.size /= polygons.length;

            // If the overlap is less than the size of the circle, ignore it
            const dx = this.x - avg.x;
            const dy = this.y - avg.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.size) {
                return;
            }

            const angle = Math.atan2(this.y - avg.y, this.x - avg.x);
            this.x = avg.x + Math.cos(angle) * (avg.size + this.size + 1);
            this.y = avg.y + Math.sin(angle) * (avg.size + this.size + 1);
        }
    }

    render() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

for (let i = 0; i < 128; i++) {
    new Circle(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 35 + 5, "#555555");
}

let ticks = 0,
    times = [],
    fps = 0,
    mspt = {
        min: 0,
        max: 0,
        avg: 0
    };

setInterval(() => {
    fps = ticks;
    mspt = {
        min: Math.min(...times).toFixed(2),
        max: Math.max(...times).toFixed(2),
        avg: (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2)
    };

    ticks = 0;
    times = [];
}, 1000);

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    spatialHash.clear();

    for (const circle of Circle.circles) {
        circle.update();
    }

    Circle.circles[0].moveGoal = mouse;
    Circle.circles[0].friction = .6;
    Circle.circles[0].color = "#CA55CA";
    Circle.circles[0].size = 50;

    for (const polygon of Polygon.polygons) {
        polygon.update();
    }

    const t = performance.now();

    for (const circle of Circle.circles) {
        circle.collide();
    }

    times.push(performance.now() - t);
    ticks++;

    // render time
    ctx.save();
    ctx.scale(mouse.fovScale, mouse.fovScale);

    for (const polygon of Polygon.polygons) {
        polygon.render();
    }

    for (const circle of Circle.circles) {
        circle.render();
    }

    ctx.restore();

    ctx.fillStyle = "rgba(255, 64, 64, .6)";
    ctx.fillRect(0, 0, 512 + 128, 96);

    ctx.font = "bold 16px sans-serif";
    ctx.fillStyle = "black";
    ctx.fillText(`FPS: ${fps} | ms: ${mspt.min} min, ${mspt.max} max, ${mspt.avg} avg`, 10, 20);
    ctx.fillText("Left click to attract gray circles, right click to teleport your circle to your mouse.", 10, 40);
    ctx.fillText("Middle click to randomize gray circles' positions", 10, 60);
    ctx.fillText("Your circle will follow your circle", 10, 80);

    requestAnimationFrame(draw);
}

draw();

window.addEventListener("mousedown", e => {
    switch (e.button) {
        case 0:
            mouse.left = true;
            break;
        case 1:
            Circle.circles.forEach(c => {
                c.x = Math.random() * canvas.width / mouse.fovScale;
                c.y = Math.random() * canvas.height / mouse.fovScale;
            });
            break;
        case 2:
            Circle.circles[0].x = mouse.x;
            Circle.circles[0].y = mouse.y;
            break;
    }
});

window.addEventListener("mouseup", e => {
    if (e.button === 0) {
        mouse.left = false;
    }
});