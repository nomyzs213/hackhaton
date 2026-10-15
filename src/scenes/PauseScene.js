import Phaser from 'phaser';
import { sfxClick, stopBGM } from '../utils/audio.js';
import { getMuted, setMuted } from '../utils/storage.js';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super('PauseScene');
  }

  init(data) {
    this.gameScene = data.gameScene;
  }

  create() {
    const { width, height } = this.scale;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x0b0f19, 0.8)
      .setInteractive();

    const panel = this.add.rectangle(width / 2, height / 2, 380, 320, 0x162238)
      .setStrokeStyle(2, 0xffd700);

    this.add.text(width / 2, height / 2 - 110, 'PAUZA', {
      fontSize: '36px', color: '#ffd700', fontStyle: 'bold'
    }).setOrigin(0.5);

    // Przycisk "Wznów"
    const resumeBtn = this.add.rectangle(width / 2, height / 2 - 30, 260, 48, 0x4caf50)
      .setInteractive({ useHandCursor: true });
    this.add.text(width / 2, height / 2 - 30, 'WZNÓW GRĘ [Esc]', {
      fontSize: '18px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);

    resumeBtn.on('pointerover', () => resumeBtn.fillColor = 0x66bb6a);
    resumeBtn.on('pointerout', () => resumeBtn.fillColor = 0x4caf50);
    resumeBtn.on('pointerdown', () => this.resume());

    // Przycisk Mute
    const muteLabel = () => getMuted() ? 'Dźwięk: WYŁĄCZONY' : 'Dźwięk: WŁĄCZONY';
    const muteBtn = this.add.rectangle(width / 2, height / 2 + 35, 260, 44, 0x223555)
      .setInteractive({ useHandCursor: true });
    const muteTxt = this.add.text(width / 2, height / 2 + 35, muteLabel(), {
      fontSize: '16px', color: '#ffffff'
    }).setOrigin(0.5);

    muteBtn.on('pointerover', () => muteBtn.fillColor = 0x334a75);
    muteBtn.on('pointerout', () => muteBtn.fillColor = 0x223555);
    muteBtn.on('pointerdown', () => {
      setMuted(!getMuted());
      muteTxt.setText(muteLabel());
      sfxClick();
    });

    // Przycisk "Powrót do menu"
    const menuBtn = this.add.rectangle(width / 2, height / 2 + 95, 260, 44, 0x8b3a2b)
      .setInteractive({ useHandCursor: true });
    this.add.text(width / 2, height / 2 + 95, 'MENU GŁÓWNE', {
      fontSize: '16px', color: '#ffffff'
    }).setOrigin(0.5);

    menuBtn.on('pointerover', () => menuBtn.fillColor = 0xa84a35);
    menuBtn.on('pointerout', () => menuBtn.fillColor = 0x8b3a2b);
    menuBtn.on('pointerdown', () => {
      sfxClick();
      stopBGM();
      this.scene.stop('UIScene');
      this.scene.stop('GameScene');
      this.scene.stop('PauseScene');
      this.scene.start('MenuScene');
    });

    this.input.keyboard.on('keydown-ESC', () => this.resume());
  }

  resume() {
    sfxClick();
    if (this.gameScene) {
      this.gameScene.resumeGame();
    } else {
      this.scene.stop();
    }
  }
}