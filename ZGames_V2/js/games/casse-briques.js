/* Casse-briques — arcade
 * Source : exemple officiel Phaser « games/breakout »
 * https://github.com/phaserjs/examples/blob/master/public/src/games/breakout/breakout.js — code sous licence MIT
 * Adaptations ZGames : score (10 points par brique), 3 vies et écran de fin, contrôle au clavier,
 * images chargées depuis assets/casse-briques/.
 */

class Breakout extends Phaser.Scene
{
    constructor ()
    {
        super({ key: 'breakout' });

        this.bricks;
        this.paddle;
        this.ball;
    }

    preload ()
    {
        this.load.atlas('assets', 'assets/casse-briques/breakout.png', 'assets/casse-briques/breakout.json');
    }

    create ()
    {
        this.score = 0;
        this.lives = 3;
        this.over = false;
        ZG.setScore(0);

        //  Enable world bounds, but disable the floor
        this.physics.world.setBoundsCollision(true, true, true, false);

        //  Create the bricks in a 10x6 grid
        this.bricks = this.physics.add.staticGroup({
            key: 'assets', frame: [ 'blue1', 'red1', 'green1', 'yellow1', 'silver1', 'purple1' ],
            frameQuantity: 10,
            gridAlign: { width: 10, height: 6, cellWidth: 64, cellHeight: 32, x: 112, y: 100 }
        });

        this.ball = this.physics.add.image(400, 500, 'assets', 'ball1').setCollideWorldBounds(true).setBounce(1);
        this.ball.setData('onPaddle', true);

        this.paddle = this.physics.add.image(400, 550, 'assets', 'paddle1').setImmovable();

        //  Our colliders
        this.physics.add.collider(this.ball, this.bricks, this.hitBrick, null, this);
        this.physics.add.collider(this.ball, this.paddle, this.hitPaddle, null, this);

        //  ZGames : vies restantes
        this.livesText = this.add.text(16, 16, '', { fontFamily: ZG.FONT, fontSize: '20px', color: '#ffffff' });
        this.updateLives();

        //  Input events
        this.input.on('pointermove', function (pointer)
        {

            //  Keep the paddle within the game
            this.paddle.x = Phaser.Math.Clamp(pointer.x, 52, 748);

            if (this.ball.getData('onPaddle'))
            {
                this.ball.x = this.paddle.x;
            }

        }, this);

        this.input.on('pointerup', this.launch, this);

        //  ZGames : flèches pour la raquette, Espace pour lancer
        this.cursors = this.input.keyboard.createCursorKeys();
        this.input.keyboard.on('keydown-SPACE', this.launch, this);
    }

    launch ()
    {
        if (this.ball.getData('onPaddle') && !this.over)
        {
            this.ball.setVelocity(-75, -300);
            this.ball.setData('onPaddle', false);
        }
    }

    updateLives ()
    {
        this.livesText.setText('❤ '.repeat(this.lives).trim());
    }

    hitBrick (ball, brick)
    {
        brick.disableBody(true, true);

        this.score += 10;
        ZG.setScore(this.score);

        if (this.bricks.countActive() === 0)
        {
            this.resetLevel();
        }
    }

    resetBall ()
    {
        this.ball.setVelocity(0);
        this.ball.setPosition(this.paddle.x, 500);
        this.ball.setData('onPaddle', true);
    }

    resetLevel ()
    {
        this.resetBall();

        this.bricks.children.each(brick =>
        {

            brick.enableBody(false, 0, 0, true, true);

        });
    }

    hitPaddle (ball, paddle)
    {
        let diff = 0;

        if (ball.x < paddle.x)
        {
            //  Ball is on the left-hand side of the paddle
            diff = paddle.x - ball.x;
            ball.setVelocityX(-10 * diff);
        }
        else if (ball.x > paddle.x)
        {
            //  Ball is on the right-hand side of the paddle
            diff = ball.x - paddle.x;
            ball.setVelocityX(10 * diff);
        }
        else
        {
            //  Ball is perfectly in the middle
            //  Add a little random X to stop it bouncing straight up!
            ball.setVelocityX(2 + Math.random() * 8);
        }
    }

    loseLife ()
    {
        this.lives--;
        this.updateLives();

        if (this.lives > 0)
        {
            this.resetBall();
            return;
        }

        this.over = true;
        this.ball.setVelocity(0).setVisible(false);
        const record = this.score > 0 && ZG.submit(this.score);
        ZG.overlay(this, 'Game over',
            `Score : ${this.score} points${record ? '\n🏆 Nouveau record !' : ''}`,
            { color: '#ff5d73' });
    }

    update ()
    {
        if (this.over)
        {
            return;
        }

        if (this.cursors.left.isDown || this.cursors.right.isDown)
        {
            const dx = this.cursors.left.isDown ? -10 : 10;
            this.paddle.x = Phaser.Math.Clamp(this.paddle.x + dx, 52, 748);

            if (this.ball.getData('onPaddle'))
            {
                this.ball.x = this.paddle.x;
            }
        }

        if (this.ball.y > 600)
        {
            this.loseLife();
        }
    }
}

ZG.register({ id: 'casse-briques', width: 800, height: 600, scene: Breakout });
