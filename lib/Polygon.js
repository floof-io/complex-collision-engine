import Vector2D from "./Vector2D.js";

export default class Polygon {
    /**
     * Instantiate a new polygon
     * @param {{x:number,y:number}[]} sides The sides of the polygon in a coordinate object ([{x:0,y:0},...])
     * @param {number} x The initial x-axis offset of the polygon
     * @param {number} y The initial y-axis offset of the polygon
     * @param {number} size The initial size as radius of the polygon
     * @param {number} rotation The initial rotation of the polygon in radians
     */
    constructor(sides, x, y, size, rotation) {
        this.rawSides = sides;
        this.x = NaN;
        this.y = NaN;
        this.size = NaN;
        this.rotation = NaN;

        this.numSides = sides.length;
        this.numPoints = this.numSides * 2;
        this.sides = new Float32Array(this.numPoints);
        this.points = new Float32Array(this.numPoints);

        for (let i = 0; i < this.numSides; i++) {
            this.sides[i * 2] = sides[i].x;
            this.sides[i * 2 + 1] = sides[i].y;
        }

        this.bounds = {
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 0
        };

        this.transform(x, y, size, rotation);
    }

    transform(x, y, size, rotation) {
        rotation %= Math.PI * 2;

        if (
            this.x === x &&
            this.y === y &&
            this.size === size &&
            this.rotation === rotation
        ) {
            return;
        }

        this.x = x;
        this.y = y;
        this.size = size;
        this.rotation = rotation;

        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        this.bounds.x1 = Infinity;
        this.bounds.y1 = Infinity;
        this.bounds.x2 = -Infinity;
        this.bounds.y2 = -Infinity;

        for (let i = 0; i < this.numPoints; i += 2) {
            const pointX = this.sides[i];
            const pointY = this.sides[i + 1];

            this.points[i] = x + (pointX * cos - pointY * sin) * size;
            this.points[i + 1] = y + (pointX * sin + pointY * cos) * size;

            if (this.points[i] < this.bounds.x1) {
                this.bounds.x1 = this.points[i];
            } else if (this.points[i + 1] < this.bounds.y1) {
                this.bounds.y1 = this.points[i + 1];
            }

            if (this.points[i] > this.bounds.x2) {
                this.bounds.x2 = this.points[i];
            } else if (this.points[i + 1] > this.bounds.y2) {
                this.bounds.y2 = this.points[i + 1];
            }
        }
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
        radius += 1;
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
        };
    }

    /** @returns {Vector2D[]} */
    getAxes() {
        const axes = [];
        for (let i = 0; i < this.numPoints; i += 2) {
            const x1 = this.points[i];
            const y1 = this.points[i + 1];
            const x2 = this.points[(i + 2) % this.numPoints];
            const y2 = this.points[(i + 3) % this.numPoints];
            const edgeX = x2 - x1;
            const edgeY = y2 - y1;
            axes.push(new Vector2D(-edgeY, edgeX).normalize());
        }
        return axes;
    }

    /** @param {Vector2D} axis */
    projectOntoAxis(axis) {
        let min = Infinity;
        let max = -Infinity;

        for (let i = 0; i < this.numPoints; i += 2) {
            const dotProduct = this.points[i] * axis.x + this.points[i + 1] * axis.y;

            if (dotProduct < min) {
                min = dotProduct;
            }

            if (dotProduct > max) {
                max = dotProduct;
            }
        }

        return { min, max };
    }

    /** @param {Polygon} other */
    polygonIntersects(other) {
        for (let i = 0; i < this.numPoints; i += 2) {
            const thisX1 = this.points[i];
            const thisY1 = this.points[i + 1];
            const thisX2 = this.points[(i + 2) % this.numPoints];
            const thisY2 = this.points[(i + 3) % this.numPoints];

            const normal = new Vector2D(-(thisX2 - thisX1), thisY2 - thisY1).normalize();

            let min1 = Infinity,
                max1 = -Infinity,
                min2 = Infinity,
                max2 = -Infinity;

            for (let j = 0; j < this.numPoints; j += 2) {
                const projected = normal.x * this.points[j] + normal.y * this.points[j + 1];

                if (projected < min1) {
                    min1 = projected;
                }

                if (projected > max1) {
                    max1 = projected;
                }
            }

            for (let j = 0; j < other.numPoints; j += 2) {
                const projected = normal.x * other.points[j] + normal.y * other.points[j + 1];

                if (projected < min2) {
                    min2 = projected;
                }

                if (projected > max2) {
                    max2 = projected;
                }
            }

            if (max1 < min2 || max2 < min1) {
                return false;
            }
        }

        for (let i = 0; i < this.numPoints; i += 2) {
            if (other.pointIsInside(this.points[i], this.points[i + 1])) {
                return true;
            }
        }

        for (let i = 0; i < other.numPoints; i += 2) {
            if (this.pointIsInside(other.points[i], other.points[i + 1])) {
                return true;
            }
        }

        return false;
    }

    /** @param {Polygon} other @returns {Vector2D|null}*/
    resolvePolygon(other) {
        let mtv = null,
            minOverlap = Infinity;

        const axes = this.getAxes().concat(other.getAxes());

        for (let i = 0; i < axes.length; i++) {
            const axis = axes[i];
            const myProj = this.projectOntoAxis(axis);
            const otherProj = other.projectOntoAxis(axis);
            const overlap = Math.min(myProj.max, otherProj.max) - Math.max(myProj.min, otherProj.min);

            if (overlap < Number.EPSILON) {
                return null;
            }

            if (overlap < minOverlap) {
                minOverlap = overlap;

                mtv = {
                    axis: axis,
                    magnitude: overlap * (myProj.min < otherProj.min ? -1 : 1)
                };
            }
        }

        if (mtv) {
            return mtv.axis.normalize().multiply(mtv.magnitude);
        }

        return null;
    }
}