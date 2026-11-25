/* Snake — arcade
 * Source : exemple officiel Phaser « games/snake » (parties 7 et 8)
 * https://github.com/phaserjs/examples/tree/master/public/src/games/snake — code sous licence MIT
 * Adaptations ZGames : intégré à la plateforme (score, record, écran de fin), contrôles ZQSD et tactiles,
 * écran « appuyez pour commencer », serpent de 3 segments au départ, rendu amélioré (damier, textures
 * dessinées par le code, dégradé, yeux, halo sous le fruit), effets sonores branchés sur le contexte audio de Phaser.
 */

//  Direction consts
const SNAKE_UP = 0;
const SNAKE_DOWN = 1;
const SNAKE_LEFT = 2;
const SNAKE_RIGHT = 3;

class Food extends Phaser.GameObjects.Image
{
    constructor (scene, x, y)
    {
        super(scene);

        this.setTexture('food');
        this.setPosition(x * 16, y * 16);
        this.setOrigin(0);

        this.total = 0;

        scene.children.add(this);
    }

    eat ()
    {
        this.total++;
    }
}

class Snake
{
    constructor (scene, x, y)
    {
        this.scene = scene;

        this.headPosition = new Phaser.Math.Vector2(x, y);

        this.body = scene.add.group();

        this.head = this.body.create(x * 16, y * 16, 'body');
        this.head.setOrigin(0);

        this.alive = true;

        this.speed = 100;

        this.moveTime = 0;

        this.tail = new Phaser.Math.Vector2(x, y);

        this.heading = SNAKE_RIGHT;
        this.direction = SNAKE_RIGHT;

        this.eatEffect = {
            frequency: 523.25,
            attack: 0.05,
            decay: 0.2,
            type: 'sine',
            volume: 3,
            pan: 0.8,
            pitchBend: 600,
            reverse: true,
            random: 100
        };

        this.deathEffect = {
            frequency: 16,
            decay: 1,
            type: 'sawtooth',
            dissonance: 50
        };
    }

    update (time)
    {
        if (time >= this.moveTime)
        {
            return this.move(time);
        }
    }

    faceLeft ()
    {
        if (this.direction === SNAKE_UP || this.direction === SNAKE_DOWN)
        {
            this.heading = SNAKE_LEFT;
        }
    }

    faceRight ()
    {
        if (this.direction === SNAKE_UP || this.direction === SNAKE_DOWN)
        {
            this.heading = SNAKE_RIGHT;
        }
    }

    faceUp ()
    {
        if (this.direction === SNAKE_LEFT || this.direction === SNAKE_RIGHT)
        {
            this.heading = SNAKE_UP;
        }
    }

    faceDown ()
    {
        if (this.direction === SNAKE_LEFT || this.direction === SNAKE_RIGHT)
        {
            this.heading = SNAKE_DOWN;
        }
    }

    move (time)
    {
        /**
        * Based on the heading property (which is the direction the pgroup pressed)
        * we update the headPosition value accordingly.
        *
        * The Math.wrap call allow the snake to wrap around the screen, so when
        * it goes off any of the sides it re-appears on the other.
        */
        switch (this.heading)
        {
            case SNAKE_LEFT:
                this.headPosition.x = Phaser.Math.Wrap(this.headPosition.x - 1, 0, 40);
                break;

            case SNAKE_RIGHT:
                this.headPosition.x = Phaser.Math.Wrap(this.headPosition.x + 1, 0, 40);
                break;

            case SNAKE_UP:
                this.headPosition.y = Phaser.Math.Wrap(this.headPosition.y - 1, 0, 30);
                break;

            case SNAKE_DOWN:
                this.headPosition.y = Phaser.Math.Wrap(this.headPosition.y + 1, 0, 30);
                break;
        }

        this.direction = this.heading;

        //  Update the body segments and place the last coordinate into this.tail
        Phaser.Actions.ShiftPosition(this.body.getChildren(), this.headPosition.x * 16, this.headPosition.y * 16, 1, this.tail);

        //  Check to see if any of the body pieces have the same x/y as the head
        //  If they do, the head ran into the body

        const hitBody = Phaser.Actions.GetFirst(this.body.getChildren(), { x: this.head.x, y: this.head.y }, 1);

        if (hitBody)
        {
            //  Game Over
            this.scene.playFX(this.deathEffect);

            this.alive = false;

            return false;
        }
        else
        {
            //  Update the timer ready for the next movement
            this.moveTime = time + this.speed;

            return true;
        }
    }

    grow ()
    {
        const newPart = this.body.create(this.tail.x, this.tail.y, 'body');

        newPart.setOrigin(0);

        this.scene.playFX(this.eatEffect);
    }

    collideWithFood (food)
    {
        if (this.head.x === food.x && this.head.y === food.y)
        {
            this.grow();

            food.eat();

            //  For every 5 items of food eaten we'll increase the snake speed a little
            if (this.speed > 20 && food.total % 5 === 0)
            {
                this.speed -= 5;
            }

            return true;
        }
        else
        {
            return false;
        }
    }

    updateGrid (grid)
    {
        //  Remove all body pieces from valid positions list
        this.body.children.each(function (segment) {

            const bx = segment.x / 16;
            const by = segment.y / 16;

            grid[by][bx] = false;

        });

        return grid;
    }
}

class SnakeScene extends Phaser.Scene
{
    constructor ()
    {
        super('snake');
    }

    //  ZGames : textures dessinées par le code (à la place des deux images 16 px de l'exemple)
    makeTextures ()
    {
        if (this.textures.exists('body'))
        {
            return;
        }

        const g = this.make.graphics({ add: false });

        //  Segment du serpent : carré arrondi blanc, coloré ensuite avec setTint (dégradé)
        g.fillStyle(0xffffff);
        g.fillRoundedRect(1, 1, 14, 14, 4);
        g.generateTexture('body', 16, 16);
        g.clear();

        //  Fruit : pomme rouge avec un reflet et une feuille
        g.fillStyle(0xff4d5e);
        g.fillCircle(8, 9, 6);
        g.fillStyle(0xffffff, 0.6);
        g.fillCircle(6, 7, 1.5);
        g.fillStyle(0x3ccf6e);
        g.fillEllipse(10, 3, 5, 3);
        g.generateTexture('food', 16, 16);
        g.destroy();
    }

    create ()
    {
        this.makeTextures();

        //  ZGames : fond en damier aligné sur la grille de 16 px
        const bg = this.add.graphics();

        for (let y = 0; y < 30; y++)
        {
            for (let x = 0; x < 40; x++)
            {
                bg.fillStyle((x + y) % 2 ? 0x1b1e3a : 0x20244a);
                bg.fillRect(x * 16, y * 16, 16, 16);
            }
        }

        //  Halo qui pulse sous le fruit
        this.glow = this.add.circle(0, 0, 11, 0xff4d5e, 0.35);
        this.tweens.add({ targets: this.glow, scale: 1.5, alpha: 0, duration: 700, repeat: -1 });

        this.food = new Food(this, 3, 4);

        this.snake = new Snake(this, 8, 8);

        //  Le serpent part avec 3 segments au lieu d'un seul
        this.snake.body.create(7 * 16, 8 * 16, 'body').setOrigin(0);
        this.snake.body.create(6 * 16, 8 * 16, 'body').setOrigin(0);

        this.eyes = this.add.graphics();
        this.started = false;

        this.hint = this.add.text(320, 300, 'Flèche, ZQSD ou glisser pour commencer', {
            fontFamily: ZG.FONT, fontSize: '22px', color: '#eceeff'
        }).setOrigin(0.5);
        this.tweens.add({ targets: this.hint, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });

        this.render();

        //  Create our keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();

        //  ZGames : ZQSD / WASD et glisser du doigt en plus des flèches
        this.input.keyboard.on('keydown', (e) => this.turn(ZG.keyToDir(e.code)));
        ZG.onSwipe(this, (dir) => this.turn(dir));

        this.ended = false;
        ZG.setScore(0);
    }

    turn (dir)
    {
        if (!dir || !this.snake.alive)
        {
            return;
        }

        //  La première direction lance la partie
        if (!this.started)
        {
            this.started = true;
            this.hint.destroy();
        }

        if (dir === 'left') this.snake.faceLeft();
        else if (dir === 'right') this.snake.faceRight();
        else if (dir === 'up') this.snake.faceUp();
        else if (dir === 'down') this.snake.faceDown();
    }

    //  Effets sonores générés avec le contexte audio de Phaser.
    //  L'exemple utilisait Phaser.Sound.Dynamic.FX, qui n'existe pas dans Phaser 3.80 : l'erreur
    //  arrêtait la boucle du jeu dès la première pomme. On produit un son équivalent avec Web Audio.
    playFX (effect)
    {
        const ctx = this.sound.context;

        if (!ctx || ctx.state !== 'running')
        {
            return;
        }

        try
        {
            const now = ctx.currentTime;
            const attack = effect.attack || 0.01;
            const decay = effect.decay || 0.2;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = effect.type || 'sine';
            osc.frequency.setValueAtTime(effect.frequency, now);

            if (effect.pitchBend)
            {
                //  Petit glissement de hauteur (son « miam »)
                osc.frequency.exponentialRampToValueAtTime(effect.frequency + effect.pitchBend, now + attack + decay);
            }

            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.25, now + attack);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);

            osc.connect(gain).connect(ctx.destination);
            osc.start(now);
            osc.stop(now + attack + decay + 0.05);
        }
        catch (e)
        {
            //  Un problème de son ne doit jamais bloquer le jeu
        }
    }

    //  ZGames : dégradé de couleur le long du corps, yeux orientés, halo sous le fruit
    render ()
    {
        const parts = this.snake.body.getChildren();
        const from = Phaser.Display.Color.ValueToColor(0x7cf29c);
        const to = Phaser.Display.Color.ValueToColor(0x14935a);

        parts.forEach((part, i) => {
            const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, Math.max(parts.length, 8), Math.min(i, 8));
            part.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
        });

        const dirs = [ [ 0, -1 ], [ 0, 1 ], [ -1, 0 ], [ 1, 0 ] ];
        const [ dx, dy ] = dirs[this.snake.direction];
        const cx = this.snake.head.x + 8;
        const cy = this.snake.head.y + 8;

        this.eyes.clear();
        this.eyes.fillStyle(0x0b0c18);
        this.eyes.fillCircle(cx + dx * 3 - dy * 3, cy + dy * 3 + dx * 3, 1.8);
        this.eyes.fillCircle(cx + dx * 3 + dy * 3, cy + dy * 3 - dx * 3, 1.8);

        this.glow.setPosition(this.food.x + 8, this.food.y + 9);
    }

    update (time, delta)
    {
        if (!this.started)
        {
            return;
        }

        if (!this.snake.alive)
        {
            if (!this.ended)
            {
                this.ended = true;
                const score = this.food.total * 10;
                const record = score > 0 && ZG.submit(score);
                ZG.overlay(this, 'Game over',
                    `Score : ${score} points${record ? '\n🏆 Nouveau record !' : ''}`,
                    { color: '#ff5d73', delay: 300 });
            }

            return;
        }

        /**
        * Check which key is pressed, and then change the direction the snake
        * is heading based on that. The checks ensure you don't double-back
        * on yourself, for example if you're moving to the right and you press
        * the LEFT cursor, it ignores it, because the only valid directions you
        * can move in at that time is up and down.
        */
        if (this.cursors.left.isDown)
        {
            this.snake.faceLeft();
        }
        else if (this.cursors.right.isDown)
        {
            this.snake.faceRight();
        }
        else if (this.cursors.up.isDown)
        {
            this.snake.faceUp();
        }
        else if (this.cursors.down.isDown)
        {
            this.snake.faceDown();
        }

        if (this.snake.update(time))
        {
            //  If the snake updated, we need to check for collision against food

            if (this.snake.collideWithFood(this.food))
            {
                ZG.setScore(this.food.total * 10);

                this.repositionFood();
            }

            this.render();
        }
    }

    /**
    * We can place the food anywhere in our 40x30 grid
    * *except* on-top of the snake, so we need
    * to filter those out of the possible food locations.
    * If there aren't any locations left, they've won!
    *
    * @method repositionFood
    * @return {boolean} true if the food was placed, otherwise false
    */
    repositionFood ()
    {
        //  First create an array that assumes all positions
        //  are valid for the new piece of food

        //  A Grid we'll use to reposition the food each time it's eaten
        const testGrid = [];

        for (let y = 0; y < 30; y++)
        {
            testGrid[y] = [];

            for (let x = 0; x < 40; x++)
            {
                testGrid[y][x] = true;
            }
        }

        this.snake.updateGrid(testGrid);

        //  Purge out false positions
        const validLocations = [];

        for (let y = 0; y < 30; y++)
        {
            for (let x = 0; x < 40; x++)
            {
                if (testGrid[y][x] === true)
                {
                    //  Is this position valid for food? If so, add it here ...
                    validLocations.push({ x: x, y: y });
                }
            }
        }

        if (validLocations.length > 0)
        {
            //  Use the RNG to pick a random food position
            const pos = Phaser.Math.RND.pick(validLocations);

            //  And place it
            this.food.setPosition(pos.x * 16, pos.y * 16);

            return true;
        }
        else
        {
            return false;
        }
    }
}

ZG.register({
    id: 'snake',
    width: 640,
    height: 480,
    scene: SnakeScene
});
