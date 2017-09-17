// taken from https://github.com/danro/jquery-easing/blob/master/jquery.easing.js
function easeOutBack(t, s) {
    if (s == undefined) s = 1.70158;
    return (t=t-1)*t*((s+1)*t + s) + 1;
}

// base class of all renderable objects, handles hovering and clicking
class GameObject {
    constructor(game) {
        this.game = game;
        game.add(this);
    }

    destroy() {
        this.game.remove(this)
    }
    
    get BBox() {
        return null;
    }
    
    contains(pos) {
        if (this.BBox === null)
            return false;

        let {x, y} = pos;
        return x >= this.BBox.x && y >= this.BBox.y &&
               x <= this.BBox.x + this.BBox.width &&
               y <= this.BBox.y + this.BBox.height;
    }

    get hovering() {
        return this.contains(this.game.mousePos);
    }

    click() {}

    render(ctx, delta) {}
}

class Piece extends GameObject {
    constructor(game, color, x, y) {
        super(game);

        this.color = color;
        this.pos = {x, y};
        this.startAnim = 0;
        this.turnAnim = null;
        this.scale = 80;
        this.alpha = 1;
    }

    get BBox() {
        return {
            x: this.pos.x * 200,
            y: this.pos.y * 200,
            width: 200,
            height: 200,
        }
    }

    fillColor(opposite) {
        if (opposite === undefined)
            opposite = false;

        if ((this.color === 'b') ^ opposite)
            return '#212121';
        return '#fafafa';
    }

    // called when captured
    turn(color) {
        this.color = color;
        this.turnAnim = 0;
    }

    render(ctx, delta) {
        let scale = this.scale;
        let {x, y} = this.pos;

        this.startAnim = Math.min(this.startAnim + delta / 500, 1);
        scale *= easeOutBack(this.startAnim);

        ctx.globalAlpha = this.alpha;

        // handle turn animation
        if (this.turnAnim !== null) {
            this.turnAnim = Math.min(this.turnAnim + delta / 700, 1);

            ctx.fillStyle = this.fillColor(true);
            ctx.beginPath();
            ctx.arc(x*200+100, y*200+100, 80, 0, Math.PI * 2);
            ctx.fill();

            scale *= Math.pow(this.turnAnim, 4);

            if (this.turnAnim === 1)
                this.turnAnim = null;
        }

        ctx.fillStyle = this.fillColor();
        ctx.beginPath();
        ctx.arc(x*200+100, y*200+100, scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class PossibleMove extends Piece {
    constructor(game, color, x, y, attacking) {
        super(game, color, x, y);
        this.attacking = attacking;
        this.renderDelay = 600;
    }

    click() {
        this.game.board.addPiece(this.color, this.pos.x, this.pos.y);

        for (let piece of this.attacking)
            piece.turn(this.color);

        this.game.nextTurn();

        // check if there are any possible moves or pass
        if (this.game.board.possibleMoves.length === 0) {
            this.game.nextTurn();

            // if no moves left again, game is over
            if (this.game.board.possibleMoves.length === 0)
                new GameOver(this.game, this.pos.x, this.pos.y);
        }
    }

    render(ctx, delta) {
        // delay to not disturb focus from actual pieces
        this.renderDelay -= delta;
        if (this.renderDelay > 0)
            return;

        ctx.globalAlpha = 0.2;
        this.alpha = 0.2;
        if (this.hovering) {
            document.body.style.cursor = "pointer";

            // highlight attacking pieces
            for (let piece of this.attacking) {
                ctx.fillStyle = this.fillColor();
                ctx.beginPath();
                ctx.arc(piece.pos.x*200+100, piece.pos.y*200+100, 80, 0, Math.PI * 2);
                ctx.fill();
            }

            this.alpha = 0.7;
        }

        // pulse for better UX
        this.scale = 80 + Math.pow((+new Date() % 1000 - 500) / 200, 2);

        super.render(ctx, delta);
        this.alpha = 1;
    }
}

// keeps state about the pieces and renders the background
class Board extends GameObject {
    constructor(game) {
        super(game);

        this.pieces = [];
        for (let i = 0; i < 8; i++) {
            this.pieces.push([null, null, null, null, null, null, null, null]);
        }

        // setup the initial pieces
        this.addPiece('w', 3, 3);
        this.addPiece('b', 3, 4);
        this.addPiece('b', 4, 3);
        this.addPiece('w', 4, 4);

        this.possibleMoves = [];
        this.nextTurn(game.turn);
    }

    addPiece(color, x, y) {
        this.pieces[x][y] = new Piece(this.game, color, x, y);
    }

    // get all pieces that the given position is attacking
    attacking(color, x, y) {
        let ret = [];
        let dirs = [[1, -1], [1, 0], [1, 1], [0, 1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];

        for (let dir of dirs) {
            let cx = x, cy = y;
            let l = [];
            while (true) {
                cx += dir[0];
                cy += dir[1];
                if (cx < 0 || cx >= 8 || cy < 0 || cy >= 8)
                    break;

                if (this.pieces[cx][cy] === null)
                    break;

                // found same color - push all pieces in between
                if (this.pieces[cx][cy].color === color) {
                    for (let a of l)
                        ret.push(a);
                    break;
                }

                l.push(this.pieces[cx][cy]);
            }
        }

        return ret;
    }

    get count() {
        let cnt = {b: 0, w: 0};
        for (let r of this.pieces) {
            for (let p of r) {
                if (p === null)
                    continue;
                cnt[p.color]++;
            }
        }

        return cnt;
    }

    nextTurn(color) {
        for (let move of this.possibleMoves)
            move.destroy();

        this.possibleMoves = [];
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (this.pieces[i][j] !== null)
                    continue;

                let attack = this.attacking(color, i, j);
                if (attack.length === 0)
                    continue;

                let move = new PossibleMove(this.game, color, i, j, attack);
                this.possibleMoves.push(move);
            }
        }
    }

    render(ctx, delta) {
        // background
        ctx.fillStyle = '#4caf50';
        ctx.fillRect(0, 0, 1600, 1600);

        // squares
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#212121';
        ctx.fillStyle = '#388e3c';
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if ((j+i) % 2)
                    ctx.fillRect(i*200, j*200, 200, 200);
                // ctx.strokeRect(i*200, j*200, 200, 200);
            }        
        }
    }
}

class ScorePanel extends GameObject {
    constructor(game) {
        super(game);

    }

    render(ctx, delta) {
        let cnt = this.game.board.count;

        // background
        ctx.fillStyle = '#fafafa';
        if (this.game.turn === 'b')
            ctx.fillStyle = '#212121';
        ctx.fillRect(0, 1600, 1600, 100);

        // colors
        ctx.fillStyle = "#212121";
        ctx.beginPath();
        ctx.arc(700, 1650, 40, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#fafafa";
        ctx.beginPath();
        ctx.arc(900, 1650, 40, 0, Math.PI * 2);
        ctx.fill();

        // score
        ctx.font = "50px cliche";
        ctx.textAlign="center";
        ctx.fillStyle = "#212121";
        ctx.fillText(cnt.w, 900, 1670);
        ctx.fillStyle = "#fafafa";
        ctx.fillText(cnt.b, 700, 1670);
    }
}

class GameOver extends Piece {
    constructor(game, x, y) {
        let color = 'b';
        let cnt = game.board.count;
        if (cnt.b < cnt.w)
            color = 'w';

        super(game, color, x, y);
        this.endAnim = 0;

        // put score panel to front
        game.remove(game.scorePanel);
        this.game.turn = this.color;
        new ScorePanel(game);
    }

    get BBox() {
        return {
            x: 700,
            y: 950,
            width: 250,
            height: 250,
        }
    }

    click() {
        game = new Game(document.getElementById('canvas'));
    }

    render(ctx, delta) {
        this.endAnim += delta;
        this.scale = 80 + Math.pow(this.endAnim / 2000, 5);
        super.render(ctx, delta);

        if (this.hovering) {
            document.body.style.cursor = "pointer";
        }

        ctx.globalAlpha = Math.max(Math.min((this.endAnim - 8000) / 4000, 1), 0);
        ctx.font = "200px FontAwesome";
        ctx.textAlign="center";
        ctx.fillStyle = this.fillColor(true);
        ctx.fillText('\uF091', 800, 600);
        ctx.fillText('\uF021', 800, 1150);
        ctx.globalAlpha = 1;
    }
}

// handles the main game loop and mouse events, keeps and calls render for all GameObjects
class Game {
    constructor(element) {
        this.canvas = element;
        this.canvas.onmousemove = (event) => {this.mouseMove(event)};
        this.canvas.onmousedown = (event) => {this.click(event)};
        this.ctx = canvas.getContext('2d');

        this.gameObjects = [];
        this.lastTime = +new Date();
        this.mousePos = {x: 0, y: 0};
        this.turn = 'b';

        this.board = new Board(this);
        this.scorePanel = new ScorePanel(this);

        window.requestAnimationFrame(() => {this.render()});
    }

    add(obj) {
        this.gameObjects.push(obj);
    }

    remove(obj) {
        this.gameObjects.splice(this.gameObjects.indexOf(obj), 1);
    }

    nextTurn() {
        if (this.turn === 'b')
            this.turn = 'w';
        else
            this.turn = 'b';

        this.board.nextTurn(this.turn);
    }

    mouseMove(event) {
        let rect = this.canvas.getBoundingClientRect();
        let x = Math.floor((event.clientX - rect.left) / this.canvas.offsetWidth * 1600);
        let y = Math.floor((event.clientY - rect.top) / this.canvas.offsetHeight * 1700);
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
        // reset pointer
        document.body.style.cursor = "default";

        let delta = +new Date() - this.lastTime;
        this.lastTime = +new Date();
        for (let obj of this.gameObjects) {
            obj.render(this.ctx, delta);
        }

        window.requestAnimationFrame(() => {this.render()});        
    }
}

let game = new Game(document.getElementById('canvas'));