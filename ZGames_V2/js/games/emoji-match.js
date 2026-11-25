/* Emoji Match — réflexion
 * Source : exemple officiel Phaser « games/emoji match »
 * (lui-même basé sur le jeu Emoji Match de Tom Miller : https://codepen.io/creativeocean/full/OeKjmp)
 * https://github.com/phaserjs/examples/tree/master/public/src/games/emoji%20match — code sous licence MIT
 * Adaptations ZGames : modules ES regroupés en un seul script, textes en français, record enregistré
 * par la plateforme (au lieu du registre Phaser), correction du double clic sur une paire déjà trouvée,
 * ressources dans assets/emoji-match/.
 */

const EMOJI_FONT_STYLE = {
    fontFamily: 'Arial',
    fontSize: 48,
    color: '#ffffff',
    fontStyle: 'bold',
    padding: 16,
    shadow: {
        color: '#000000',
        fill: true,
        offsetX: 2,
        offsetY: 2,
        blur: 4
    }
};

class EmojiBoot extends Phaser.Scene
{
    constructor ()
    {
        super('Boot');
    }

    create ()
    {
        this.registry.set('highscore', ZG.getBest() || 0);

        this.scene.start('Preloader');
    }
}

class EmojiPreloader extends Phaser.Scene
{
    constructor ()
    {
        super('Preloader');

        this.loadText;
    }

    preload ()
    {
        this.loadText = this.add.text(400, 360, 'Chargement…', { fontFamily: 'Arial', fontSize: 64, color: '#e3f2ed' });

        this.loadText.setOrigin(0.5);
        this.loadText.setStroke('#203c5b', 6);
        this.loadText.setShadow(2, 2, '#2d2d2d', 4, true, false);

        this.load.setPath('assets/emoji-match/');
        this.load.image([ 'background', 'logo' ]);
        this.load.atlas('emojis', 'emojis.png', 'emojis.json');

        //  Audio ...
        this.load.audio('music', [ 'music.ogg', 'music.mp3' ]);
        this.load.audio('countdown', [ 'countdown.ogg', 'countdown.mp3' ]);
        this.load.audio('match', [ 'match.ogg', 'match.mp3' ]);
    }

    create ()
    {
        if (this.sound.locked)
        {
            this.loadText.setText('Cliquez pour commencer');

            this.input.once('pointerdown', () => {

                this.scene.start('MainMenu');

            });
        }
        else
        {
            this.scene.start('MainMenu');
        }
    }
}

class EmojiMainMenu extends Phaser.Scene
{
    constructor ()
    {
        super('MainMenu');

        this.music;
    }

    create ()
    {
        let background = this.add.image(400, 300, 'background');

        this.tweens.add({
            targets: background,
            alpha: { from: 0, to: 1 },
            duration: 1000
        });

        this.add.text(20, 20, 'Record : ' + this.registry.get('highscore'), EMOJI_FONT_STYLE);

        let logo = this.add.image(400, -200, 'logo');

        if (!this.music)
        {
            this.music = this.sound.play('music', { loop: true });
        }

        this.tweens.add({
            targets: logo,
            y: 300,
            ease: 'bounce.out',
            duration: 1200
        });

        this.input.once('pointerdown', () => {

            this.scene.start('MainGame');

        });
    }
}

class EmojiMainGame extends Phaser.Scene
{
    constructor ()
    {
        super('MainGame');

        this.emojis;

        this.circle1;
        this.circle2;

        this.child1;
        this.child2;

        this.selectedEmoji = null;
        this.matched = false;

        this.score = 0;
        this.highscore = 0;
        this.scoreText;

        this.timer;
        this.timerText;
    }

    create ()
    {
        //  ZGames : remise à zéro quand la scène est relancée
        this.timer = null;
        this.selectedEmoji = null;
        this.score = 0;
        ZG.setScore(0);

        this.add.image(400, 300, 'background');

        this.circle1 = this.add.circle(0, 0, 42).setStrokeStyle(3, 0xf8960e);
        this.circle2 = this.add.circle(0, 0, 42).setStrokeStyle(3, 0x00ff00);

        this.circle1.setVisible(false);
        this.circle2.setVisible(false);

        //  Create a 4x4 grid aligned group to hold our sprites

        this.emojis = this.add.group({
            key: 'emojis',
            frameQuantity: 1,
            repeat: 15,
            gridAlign: {
                width: 4,
                height: 4,
                cellWidth: 90,
                cellHeight: 90,
                x: 280,
                y: 200
            }
        });

        this.timerText = this.add.text(20, 20, '30:00', EMOJI_FONT_STYLE);
        this.scoreText = this.add.text(500, 20, 'Trouvés : 0', EMOJI_FONT_STYLE);

        let children = this.emojis.getChildren();

        children.forEach((child) => {

            child.setInteractive();

        });

        this.input.on('gameobjectdown', this.selectEmoji, this);
        this.input.once('pointerdown', this.start, this);

        this.highscore = this.registry.get('highscore');

        this.arrangeGrid();
    }

    start ()
    {
        this.score = 0;
        this.matched = false;

        this.timer = this.time.addEvent({ delay: 30000, callback: this.gameOver, callbackScope: this });

        this.sound.play('countdown', { delay: 27 });
    }

    selectEmoji (pointer, emoji)
    {
        if (this.matched)
        {
            return;
        }

        //  Is this the first or second selection?
        if (!this.selectedEmoji)
        {
            //  Our first emoji
            this.circle1.setPosition(emoji.x, emoji.y);
            this.circle1.setVisible(true);

            this.selectedEmoji = emoji;
        }
        else if (emoji !== this.selectedEmoji)
        {
            //  Our second emoji

            //  Is it a match?
            if (emoji.frame.name === this.selectedEmoji.frame.name)
            {
                //  ZGames : bloque les clics pendant l'animation (sinon la paire compte deux fois)
                this.matched = true;

                this.circle1.setStrokeStyle(3, 0x00ff00);
                this.circle2.setPosition(emoji.x, emoji.y);
                this.circle2.setVisible(true);

                this.tweens.add({
                    targets: [ this.child1, this.child2 ],
                    scale: 1.4,
                    angle: '-=30',
                    yoyo: true,
                    ease: 'sine.inout',
                    duration: 200,
                    completeDelay: 200,
                    onComplete: () => this.newRound()
                });

                this.sound.play('match');
            }
            else
            {
                this.circle1.setPosition(emoji.x, emoji.y);
                this.circle1.setVisible(true);

                this.selectedEmoji = emoji;
            }
        }
    }

    newRound ()
    {
        this.score++;

        this.scoreText.setText('Trouvés : ' + this.score);
        ZG.setScore(this.score);

        this.circle1.setStrokeStyle(3, 0xf8960e);

        this.circle1.setVisible(false);
        this.circle2.setVisible(false);

        //  Stagger tween them all out
        this.tweens.add({
            targets: this.emojis.getChildren(),
            scale: 0,
            ease: 'power2',
            duration: 600,
            delay: this.tweens.stagger(100, { grid: [ 4, 4 ], from: 'center' }),
            onComplete: () => {
                this.matched = false;
                this.arrangeGrid();
            }
        });
    }

    arrangeGrid ()
    {
        //  We need to make sure there is only one pair in the grid
        //  Let's create an array with all possible frames in it:

        let frames = Phaser.Utils.Array.NumberArray(1, 40);
        let selected = Phaser.Utils.Array.NumberArray(0, 15);
        let children = this.emojis.getChildren();

        //  Now we pick 16 random values, removing each one from the array so we can't pick it again
        //  and set those into the sprites

        for (let i = 0; i < 16; i++)
        {
            let frame = Phaser.Utils.Array.RemoveRandomElement(frames);

            children[i].setFrame('smile' + frame);
        }

        //  Finally, pick two random children and make them a pair:
        let index1 = Phaser.Utils.Array.RemoveRandomElement(selected);
        let index2 = Phaser.Utils.Array.RemoveRandomElement(selected);

        this.child1 = children[index1];
        this.child2 = children[index2];

        //  Set the frame to match
        this.child2.setFrame(this.child1.frame.name);

        //  Clear the currently selected emojis (if any)
        this.selectedEmoji = null;

        //  Stagger tween them all in
        this.tweens.add({
            targets: children,
            scale: { start: 0, from: 0, to: 1 },
            ease: 'bounce.out',
            duration: 600,
            delay: this.tweens.stagger(100, { grid: [ 4, 4 ], from: 'center' })
        });
    }

    update ()
    {
        if (this.timer)
        {
            if (this.timer.getProgress() === 1)
            {
                this.timerText.setText('00:00');
            }
            else
            {
                const remaining = (30 - this.timer.getElapsedSeconds()).toPrecision(4);
                const pos = remaining.indexOf('.');

                let seconds = remaining.substring(0, pos);
                let ms = remaining.substr(pos + 1, 2);

                seconds = Phaser.Utils.String.Pad(seconds, 2, '0', 1);

                this.timerText.setText(seconds + ':' + ms);
            }
        }
    }

    gameOver ()
    {
        //  Show them where the match actually was
        this.circle1.setStrokeStyle(4, 0xfc29a6).setPosition(this.child1.x, this.child1.y).setVisible(true);
        this.circle2.setStrokeStyle(4, 0xfc29a6).setPosition(this.child2.x, this.child2.y).setVisible(true);

        this.input.off('gameobjectdown', this.selectEmoji, this);

        if (this.score > this.highscore)
        {
            this.registry.set('highscore', this.score);
        }

        //  ZGames : enregistre le record de la plateforme
        if (this.score > 0)
        {
            ZG.submit(this.score);
        }

        this.tweens.add({
            targets: [ this.circle1, this.circle2 ],
            alpha: 0,
            yoyo: true,
            repeat: 2,
            duration: 250,
            ease: 'sine.inout',
            onComplete: () => {

                this.input.once('pointerdown', () => {
                    this.scene.start('MainMenu');
                }, this);

            }
        });
    }
}

ZG.register({
    id: 'emoji-match',
    width: 800,
    height: 600,
    config: { backgroundColor: '#008eb0' },
    scene: [ EmojiBoot, EmojiPreloader, EmojiMainMenu, EmojiMainGame ],
    restartScene: 'MainGame'
});
