class Vector2d {
    constructor(x = 0, y = 0) {
        this.x = Number.isFinite(x) ? x : 0;
        this.y = Number.isFinite(y) ? y : 0;
    }

    set(x = this.x, y = this.y) {
        this.x = Number.isFinite(x) ? x : this.x;
        this.y = Number.isFinite(y) ? y : this.y;
        return this;
    }

    copy(vector) {
        if (!vector || typeof vector !== 'object') {
            return this;
        }

        return this.set(vector.x, vector.y);
    }

    clone() {
        return new Vector2d(this.x, this.y);
    }

    add(vector) {
        if (!vector || typeof vector !== 'object') {
            return this;
        }

        return this.set(this.x + Number(vector.x || 0), this.y + Number(vector.y || 0));
    }

    subtract(vector) {
        if (!vector || typeof vector !== 'object') {
            return this;
        }

        return this.set(this.x - Number(vector.x || 0), this.y - Number(vector.y || 0));
    }

    scale(scalar) {
        const safeScalar = Number(scalar);
        if (!Number.isFinite(safeScalar)) {
            return this;
        }

        return this.set(this.x * safeScalar, this.y * safeScalar);
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    distanceTo(vector) {
        if (!vector || typeof vector !== 'object') {
            return null;
        }

        const dx = this.x - Number(vector.x || 0);
        const dy = this.y - Number(vector.y || 0);
        return Math.sqrt(dx * dx + dy * dy);
    }

    toObject() {
        return {
            x: this.x,
            y: this.y,
        };
    }
}
