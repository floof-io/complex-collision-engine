export default class Vector2D {
    static fromDirMag(direction, magnitude) {
        return new this(Math.cos(direction) * magnitude, Math.sin(direction) * magnitude);
    }

    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    get direction() {
        return Math.atan2(this.y, this.x);
    }

    get magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    dot(other) {
        return this.x * other.x + this.y * other.y;
    }

    normalize() {
        const mag = this.magnitude;
        if (mag > 0) {
            this.divide(mag);
        }
        return this;
    }

    multiply(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }

    divide(scalar) {
        if (scalar !== 0) {
            this.x /= scalar;
            this.y /= scalar;
        }
        return this;
    }

    subtractFrom(other) {
        return new Vector2D(this.x - other.x, this.y - other.y);
    }

    add(other) {
        return new Vector2D(this.x + other.x, this.y + other.y);
    }

    crossProduct(other) {
        return this.x * other.y - this.y * other.x;
    }
    
    clone() {
        return new Vector2D(this.x, this.y);
    }

    // Optional: Override toString for easy debugging
    toString() {
        return `Vector2D(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
    }
}