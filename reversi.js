class GameObject {
    constructor(game) {
        this.game = game;
        game.addObject(this);
    }

    destroy() {
        this.game.removeGameObject(this)
    }
    
    get BBox() {
        return null;
    }
    
    containsPoint(pos) {
        if (this.BBox === null)
            return false;

        let {x, y} = pos;
        return x >= this.BBox.x && y >= this.BBox.y &&
               x <= this.BBox.x + this.BBox.width &&
               y <= this.BBox.y + this.BBox.height;
    }

    get hovering() {
        return this.containsPoint(this.game.mousePos);
    }

    click() {}

    render(ctx) {}
}

class Board extends GameObject {
    constructor(game) {
        super(game);

        this.pieces = []
        for (var i = 0; i < 8; i++) {
            this.pieces.push([null, null, null, null, null, null, null, null]);
        }
    }

    render(ctx, delta) {
        // background
        ctx.fillStyle = '#4caf50';
        ctx.fillRect(0, 0, 1600, 1600);

        // lines
        ctx.strokeWidth = 1000;
        ctx.strokeStyle = '#212121';
        ctx.fillStyle = '#388e3c';
        for (var i = 0; i < 8; i++) {
            for (var j = 0; j < 8; j++) {
                if ((j+i) % 2)
                    ctx.fillRect(i*200, j*200, 200, 200);
                // ctx.strokeRect(i*200, j*200, 200, 200);
            }        
        }
    }
}

class ScorePanel extends GameObject {
    constructor() {}
    render() {

    }
}

class Game {
    constructor(element) {
        this.canvas = element;
        this.canvas.onmousemove = (event) => {this.mouseMove(event)};
        this.canvas.onmousedown = (event) => {this.click(event)};
        this.ctx = canvas.getContext('2d');
        this.gameObjects = [];
        this.lastTime = this.getTime();
        this.mousePos = {x: 0, y: 0};

        this.scorePanel
        this.board = new Board(this);

        window.requestAnimationFrame(() => {this.render()});
    }

    getTime() {
        let date = new Date();
        return date+0 + date.getMilliseconds;
    }

    addObject(obj) {
        this.gameObjects.push(obj);
    }

    mouseMove(event) {
        var x = Math.floor(event.clientX / this.canvas.offsetWidth * 10);
        var y = Math.floor(event.clientY / this.canvas.offsetHeight * 10);
        this.mousePos = {x, y};
    }

    click(event) {
        this.mouseMove(event);
        for (let obj of this.gameObjects) {
            if (obj.hovering)
                obj.click();
        }
    }

    render() {
        let delta = this.getTime() - this.lastTime;
        this.lastTime = this.getTime();        
        for (let obj of this.gameObjects) {
            obj.render(this.ctx, delta);
        }

        window.requestAnimationFrame(() => {this.render()});        
    }
}

var game = new Game(document.getElementById('canvas'));