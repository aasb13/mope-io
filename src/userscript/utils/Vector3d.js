class Vector3d {
    constructor(x = 0, y = 0, z = 0) {
        this.x = Number.isFinite(x) ? x : 0;
        this.y = Number.isFinite(y) ? y : 0;
        this.z = Number.isFinite(z) ? z : 0;
    }

    set(x = this.x, y = this.y, z = this.z) {
        this.x = Number.isFinite(x) ? x : this.x;
        this.y = Number.isFinite(y) ? y : this.y;
        this.z = Number.isFinite(z) ? z : this.z;
        return this;
    }

    copy(vector) {
        if (!vector || typeof vector !== 'object') {
            return this;
        }

        return this.set(vector.x, vector.y, vector.z);
    }

    clone() {
        return new Vector3d(this.x, this.y, this.z);
    }

    add(vector) {
        if (!vector || typeof vector !== 'object') {
            return this;
        }

        return this.set(
            this.x + Number(vector.x || 0),
            this.y + Number(vector.y || 0),
            this.z + Number(vector.z || 0)
        );
    }

    subtract(vector) {
        if (!vector || typeof vector !== 'object') {
            return this;
        }

        return this.set(
            this.x - Number(vector.x || 0),
            this.y - Number(vector.y || 0),
            this.z - Number(vector.z || 0)
        );
    }

    scale(scalar) {
        const safeScalar = Number(scalar);
        if (!Number.isFinite(safeScalar)) {
            return this;
        }

        return this.set(this.x * safeScalar, this.y * safeScalar, this.z * safeScalar);
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    distanceTo(vector) {
        if (!vector || typeof vector !== 'object') {
            return null;
        }

        const dx = this.x - Number(vector.x || 0);
        const dy = this.y - Number(vector.y || 0);
        const dz = this.z - Number(vector.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    toObject() {
        return {
            x: this.x,
            y: this.y,
            z: this.z,
        };
    }
}
