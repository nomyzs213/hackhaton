import Phaser from 'phaser';
import { getBestTime, getMuted, setMuted } from '../utils/storage.js';
import { sfxClick } from '../utils/audio.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const { width, height } = this.scale;

    // Tło graficzne
    if (this.textures.exists('menu-bg')) {
      const bg = this.add.image(width / 2, height / 2, 'menu-bg');
      bg.setDisplaySize(width, height);
      bg.setAlpha(0.45);
    } else {
      this.cameras.main.setBackgroundColor('#0b0f19');
    }

    // Dodaj subtelne przyciemnienie
    this.add.rectangle(width / 2, height / 2, width, height, 0x070b14, 0.4);

    // Tytuł gry z cieniem
    this.add.text(width / 2, 90, 'ODKRYJ GLIWICE', {
      fontSize: '48px',
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5);

    this.add.text(width / 2, 140, 'Edukacyjna Przygoda w Stylu Retro Pixel-Art', {
      fontSize: '18px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    // Panel z instrukcją
    const instrPanel = this.add.rectangle(width / 2, 235, 520, 100, 0x141f33, 0.85)
      .setStrokeStyle(1, 0x334a75);

    const instrLines = [
      '🗺️ Zwiedzaj tętniące życiem Gliwice i zbierz 12 unikalnych odznak!',
      '🚗 Uważaj na ruch uliczny, autobusy PKM i tramwaje (-1 życie przy zderzeniu).',
      '⏱️ Masz 3.5 minuty na przejście! Błędna odpowiedź w quizie to -10s kary.'
    ];
    this.add.text(width / 2, 235, instrLines.join('\n'), {
      fontSize: '14px',
      color: '#e0e0e0',
      align: 'center',
      lineSpacing: 8
    }).setOrigin(0.5);

    // Przycisk START
    const btnStart = this.add.rectangle(width / 2, 330, 240, 56, 0x4caf50)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true });
    const btnText = this.add.text(width / 2, 330, 'ROZPOCZNIJ GRĘ', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Animacja pulsowania przycisku start
    this.tweens.add({
      targets: [btnStart, btnText],
      scaleX: 1.04,
      scaleY: 1.04,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    btnStart.on('pointerover', () => btnStart.fillColor = 0x66bb6a);
    btnStart.on('pointerout', () => btnStart.fillColor = 0x4caf50);
    btnStart.on('pointerdown', () => {
      sfxClick();
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameScene');
      });
    });

    // Przełącznik wyciszenia (Mute)
    const muteLabel = () => getMuted() ? 'Dźwięk: WYŁĄCZONY' : 'Dźwięk: WŁĄCZONY';
    const muteBtn = this.add.rectangle(width / 2, 400, 200, 36, 0x223555)
      .setInteractive({ useHandCursor: true });
    const muteTxt = this.add.text(width / 2, 400, muteLabel(), {
      fontSize: '14px',
      color: '#ffffff'
    }).setOrigin(0.5);

    muteBtn.on('pointerover', () => muteBtn.fillColor = 0x334a75);
    muteBtn.on('pointerout', () => muteBtn.fillColor = 0x223555);
    muteBtn.on('pointerdown', () => {
      setMuted(!getMuted());
      muteTxt.setText(muteLabel());
      sfxClick();
    });

    // Najlepszy czas
    const best = getBestTime();
    const bestText = best === null ? 'Najlepszy czas: —' : `🏆 Rekord przejścia: ${best}s`;
    this.add.text(width / 2, 445, bestText, {
      fontSize: '15px',
      color: '#ffd700',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Klawiszologia na dole
    this.add.text(width / 2, height - 42, 'Sterowanie: Strzałki / WASD • [E] Odkryj miejsce • [1-4] Wybór odpowiedzi • [Esc] Pauza • [M] Dźwięk', {
      fontSize: '12px',
      color: '#9aa0a6'
    }).setOrigin(0.5);

    this.add.text(width / 2, height - 18, 'Grafiki: styl Pixel-Art 16x16 • Dźwięk: Web Audio API • Gliwice 2026', {
      fontSize: '10px',
      color: '#666e75'
    }).setOrigin(0.5);
  }
}