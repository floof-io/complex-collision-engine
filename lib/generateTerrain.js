function lerp(a, b, t) {
    return a + (b - a) * t;
}

function filterDupes(pointsArray) {
    return pointsArray.filter((point, index, self) => {
        return index === self.findIndex(p => p.x === point.x && p.y === point.y);
    }).map(point => ({
        x: +point.x.toFixed(3),
        y: +point.y.toFixed(3)
    }));
}

export default function generateRealTerrain(top, left, bottom, right) {
    const points = [];

    // Top
    points.push([{
        x: -1,
        y: -1
    }]);

    if (top) {
        for (let i = 0, n = 4 + Math.random() * 6 | 0; i < n; i++) {
            points.push([{
                x: lerp(-1, 1, (i + 1) / (n + 1)) * (.8 + Math.random() * .25),
                y: -.8 - Math.random() * .2125
            }]);
        }
    }

    // Right
    points.push([{
        x: 1,
        y: -1
    }]);

    if (right) {
        for (let i = 0, n = 4 + Math.random() * 6 | 0; i < n; i++) {
            points.push([{
                x: .8 + Math.random() * .2125,
                y: lerp(-1, 1, (i + 1) / (n + 1)) * (.8 + Math.random() * .25)
            }]);
        }
    }

    // Bottom
    points.push([{
        x: 1,
        y: 1
    }]);

    if (bottom) {
        for (let i = 0, n = 4 + Math.random() * 6 | 0; i < n; i++) {
            points.push([{
                x: lerp(1, -1, (i + 1) / (n + 1)) * (.8 + Math.random() * .25),
                y: .8 + Math.random() * .2125
            }]);
        }
    }

    // Left
    points.push([{
        x: -1,
        y: 1
    }]);

    if (left) {
        for (let i = 0, n = 4 + Math.random() * 6 | 0; i < n; i++) {
            points.push([{
                x: -.8 - Math.random() * .2125,
                y: lerp(1, -1, (i + 1) / (n + 1)) * (.8 + Math.random() * .25)
            }]);
        }
    }

    return filterDupes(points.flat());
}

export function generateTerrain(top, left, bottom, right) {
    const output = [];

    for (let i = 0, n = (!top && !left && !bottom && !right) ? 1 : 5; i < n; i++) {
        output.push(generateRealTerrain(top, left, bottom, right));
    }

    return output;
}

export const SIDE_FLAGS = {
    TOP: 1,
    RIGHT: 2,
    BOTTOM: 4,
    LEFT: 8
};

export const TERRAINS = {
    [SIDE_FLAGS.TOP]: generateTerrain(true, false, false, false),
    [SIDE_FLAGS.LEFT]: generateTerrain(false, true, false, false),
    [SIDE_FLAGS.BOTTOM]: generateTerrain(false, false, true, false),
    [SIDE_FLAGS.RIGHT]: generateTerrain(false, false, false, true),
    [SIDE_FLAGS.TOP | SIDE_FLAGS.LEFT]: generateTerrain(true, true, false, false),
    [SIDE_FLAGS.TOP | SIDE_FLAGS.RIGHT]: generateTerrain(true, false, false, true),
    [SIDE_FLAGS.BOTTOM | SIDE_FLAGS.RIGHT]: generateTerrain(false, false, true, true),
    [SIDE_FLAGS.BOTTOM | SIDE_FLAGS.LEFT]: generateTerrain(false, true, true, false),
    [SIDE_FLAGS.TOP | SIDE_FLAGS.BOTTOM]: generateTerrain(true, false, true, false),
    [SIDE_FLAGS.LEFT | SIDE_FLAGS.RIGHT]: generateTerrain(false, true, false, true),
    [SIDE_FLAGS.TOP | SIDE_FLAGS.LEFT | SIDE_FLAGS.RIGHT]: generateTerrain(true, true, false, true),
    [SIDE_FLAGS.TOP | SIDE_FLAGS.RIGHT | SIDE_FLAGS.BOTTOM]: generateTerrain(true, false, true, true),
    [SIDE_FLAGS.RIGHT | SIDE_FLAGS.BOTTOM | SIDE_FLAGS.LEFT]: generateTerrain(false, true, true, true),
    [SIDE_FLAGS.BOTTOM | SIDE_FLAGS.LEFT | SIDE_FLAGS.TOP]: generateTerrain(true, true, true, false),
    [SIDE_FLAGS.TOP | SIDE_FLAGS.RIGHT | SIDE_FLAGS.BOTTOM | SIDE_FLAGS.LEFT]: generateTerrain(true, true, true, true),
    0: generateTerrain(false, false, false, false)
};

window.test = TERRAINS;

export function getTerrain(flags) {
    return TERRAINS[flags][Math.random() * TERRAINS[flags].length | 0];
}