export default class MazeGenerator {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.grid = new Array(width * height).fill(0);
        this.spacing = 4;
        this.gridChance = 1;
        this.toPlaceAmount = .4;
        this.maxNeighbors = 4;
        this.maxDiagonalNeighbors = 0;
        this.removeSingles = false;
        this.removeBlocks = false;
    }

    get(x, y) {
        return this.grid[y * this.width + x];
    }

    set(x, y, value) {
        this.grid[y * this.width + x] = value;
    }

    get toPlace() {
        return this.width * this.height * this.toPlaceAmount;
    }

    getOnes() {
        return this.grid.reduce((acc, cur) => acc + cur, 0);
    }

    getNeighbors(x, y) {
        const north = y > 0 ? this.get(x, y - 1) : 0;
        const south = y < this.height - 1 ? this.get(x, y + 1) : 0;
        const east = x < this.width - 1 ? this.get(x + 1, y) : 0;
        const west = x > 0 ? this.get(x - 1, y) : 0;

        const northEast = y > 0 && x < this.width - 1 ? this.get(x + 1, y - 1) : 0;
        const northWest = y > 0 && x > 0 ? this.get(x - 1, y - 1) : 0;
        const southEast = y < this.height - 1 && x < this.width - 1 ? this.get(x + 1, y + 1) : 0;
        const southWest = y < this.height - 1 && x > 0 ? this.get(x - 1, y + 1) : 0;

        return {
            cardinal: [north, south, east, west],
            diagonal: [northEast, northWest, southEast, southWest],
            north, south, east, west,
            northEast, northWest, southEast, southWest
        };
    }

    stepOne() {
        for (let i = 1; i < this.width - 1; i += this.spacing) {
            for (let j = 1; j < this.height - 1; j += this.spacing) {
                if (Math.random() < this.gridChance) {
                    this.set(i, j, 1);
                }
            }
        }
    }

    stepTwo() {
        let i = 0;
        while (this.getOnes() < this.toPlace && i++ < 1024 * 1024) {
            const x = Math.floor(Math.random() * this.width);
            const y = Math.floor(Math.random() * this.height);

            const neighbors = this.getNeighbors(x, y);

            const cardinal = neighbors.cardinal.filter(neighbor => !!neighbor).length;
            const diagonal = neighbors.diagonal.filter(neighbor => !!neighbor).length;

            if (this.get(x, y) === 0 && (cardinal === 0 || cardinal > 0) && cardinal <= this.maxNeighbors && diagonal <= this.maxDiagonalNeighbors) {
                this.set(x, y, 1);
            }
        }
    }

    stepThree() {
        for (let i = 0; i < this.width; i++) {
            this.set(i, 0, 0);
            this.set(i, this.height - 1, 0);
        }

        for (let i = 0; i < this.height; i++) {
            this.set(0, i, 0);
            this.set(this.width - 1, i, 0);
        }

        const visited = [];

        function visit(xx, yy) {
            if (visited.some(({ x, y }) => x === xx && y === yy)) {
                return;
            }

            visited.push({ x: xx, y: yy });

            const neighbors = this.getNeighbors(xx, yy);

            if (xx > 0 && neighbors.west === 0) {
                visit.call(this, xx - 1, yy);
            }

            if (xx < this.width - 1 && neighbors.east === 0) {
                visit.call(this, xx + 1, yy);
            }

            if (yy > 0 && neighbors.north === 0) {
                visit.call(this, xx, yy - 1);
            }

            if (yy < this.height - 1 && neighbors.south === 0) {
                visit.call(this, xx, yy + 1);
            }
        }

        visit.call(this, 0, 0);

        const toRemove = [];

        for (let i = 1; i < this.width - 1; i++) {
            for (let j = 1; j < this.height - 1; j++) {
                if (this.get(i, j) === 0 && !visited.some(({ x, y }) => x === i && y === j)) {
                    toRemove.push({ x: i, y: j });
                }
            }
        }

        for (const { x, y } of toRemove) {
            this.set(x, y, 1);
        }
    }

    stepFour() {
        for (let i = 1; i < this.width - 1; i++) {
            for (let j = 1; j < this.height - 1; j++) {
                if (this.get(i, j) === 1) {
                    const neighbors = this.getNeighbors(i, j).cardinal.filter(neighbor => !!neighbor).length;

                    if (neighbors === 0) {
                        this.set(i, j, 0);
                    }
                }
            }
        }
    }

    stepFive() {
        let block;

        while ((block = this.findATwoByTwo()) && block !== null && block.width >= 2 && block.height >= 2) {
            for (let i = block.x; i < block.x + block.width; i++) {
                for (let j = block.y; j < block.y + block.height; j++) {
                    this.set(i, j, 0);
                }
            }
        }
    }

    findATwoByTwo() {
        let block = {
            x: 0,
            y: 0,
            width: 0,
            height: 0
        };

        for (let i = 0; i < this.width - 1; i++) {
            for (let j = 0; j < this.height - 1; j++) {
                if (this.get(i, j) === 1 && this.get(i + 1, j) === 1 && this.get(i, j + 1) === 1 && this.get(i + 1, j + 1) === 1) {
                    block.x = i;
                    block.y = j;
                    block.width = 2;
                    block.height = 2;
                    return block;
                }
            }
        }

        return block;
    }

    reset() {
        for (let i = 0; i < this.width; i++) {
            for (let j = 0; j < this.height; j++) {
                this.set(i, j, 0);
            }
        }
    }

    generate() {
        this.stepOne();

        let i = 0;

        while (this.getOnes() < this.toPlace && i++ < 8) {
            this.stepTwo();
            this.stepThree();

            if (this.removeSingles) {
                this.stepFour();
            }

            if (this.removeBlocks) {
                this.stepFive();
            }
        }

        if (this.removeSingles) {
            this.stepFour();
        }
    }

    getBlocks() {
        // Find any solid blocks. (X by Y). { x, y, width, height }
        const blocks = [];
        const remaining = this.to2DArray();

        function getNRemaining() {
            return remaining.reduce((acc, cur) => acc + cur.reduce((acc, cur) => acc + cur, 0), 0);
        }

        // Solid block (x by y, where x >= 1 and y >= 1, so long as every block in the "block" is solid)
        function getLargestBlock() {
            let largest = {
                x: 0,
                y: 0,
                width: 0,
                height: 0
            };

            // Completely solid block (every cell in widthXheight must be 1)
            function blockSizeAtByWidth(x, y) {
                let bestSize = 0,
                    bestWidth = 0,
                    bestHeight = 0;
            
                for (let width = 1; x + width <= remaining.length; width++) {
                    let height = 0;
                    while (y + height < remaining[x].length && isSolidBlock(x, y, width, height + 1)) {
                        height++;
                    }
            
                    if (width * height > bestSize) {
                        bestSize = width * height;
                        bestWidth = width;
                        bestHeight = height;
                    }
            
                    if (height === 0) {
                        break;
                    }
                }
            
                return {
                    width: bestWidth,
                    height: bestHeight
                };
            }

            function blockSizeAtByHeight(x, y) {
                let bestSize = 0,
                    bestWidth = 0,
                    bestHeight = 0;
            
                for (let height = 1; y + height <= remaining[x].length; height++) {
                    let width = 0;
                    while (x + width < remaining.length && isSolidBlock(x, y, width + 1, height)) {
                        width++;
                    }
            
                    if (width * height > bestSize) {
                        bestSize = width * height;
                        bestWidth = width;
                        bestHeight = height;
                    }
            
                    if (width === 0) {
                        break;
                    }
                }
            
                return {
                    width: bestWidth,
                    height: bestHeight
                };
            }
            
            function isSolidBlock(x, y, width, height) {
                for (let i = x; i < x + width; i++) {
                    for (let j = y; j < y + height; j++) {
                        if (remaining[i][j] !== 1) {
                            return false;
                        }
                    }
                }
                return true;
            }

            for (let i = 0; i < remaining.length; i++) {
                for (let j = 0; j < remaining[i].length; j++) {
                    if (remaining[i][j] === 1) {
                        let best = 0; // (width * height)
                        let bestWidth = 0,
                            bestHeight = 0;

                        // Allow a minimum width or height of 1, but allow for larger blocks
                        const widthBased = blockSizeAtByWidth(i, j);
                        const heightBased = blockSizeAtByHeight(i, j);

                        if (widthBased.width * widthBased.height > best) {
                            best = widthBased.width * widthBased.height;
                            bestWidth = widthBased.width;
                            bestHeight = widthBased.height;
                        }

                        if (heightBased.width * heightBased.height > best) {
                            best = heightBased.width * heightBased.height;
                            bestWidth = heightBased.width;
                            bestHeight = heightBased.height;
                        }

                        if (best > largest.width * largest.height) {
                            largest = {
                                x: i,
                                y: j,
                                width: bestWidth,
                                height: bestHeight
                            };
                        }
                    }
                }
            }

            return largest;
        }

        while (getNRemaining() > 0) {
            const block = getLargestBlock();

            if (block.width * block.height > 0) {
                blocks.push({
                    x: block.x,
                    y: block.y,
                    width: block.width,
                    height: block.height
                });

                for (let i = block.x; i < block.x + block.width; i++) {
                    for (let j = block.y; j < block.y + block.height; j++) {
                        remaining[i][j] = 0;
                    }
                }
            }
        }
    
        return blocks;
    }

    to2DArray() {
        const array = [];

        for (let i = 0; i < this.width; i++) {
            array.push([]);

            for (let j = 0; j < this.height; j++) {
                array[i].push(this.get(i, j));
            }
        }

        return array;
    }
}