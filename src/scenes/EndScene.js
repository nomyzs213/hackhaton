import Phaser from 'phaser';
import { setBestTime } from '../utils/storage.js';
import { sfxClick, sfxWin, sfxGameOver, stopBGM } from '../utils/audio.js';
import { landmarks } from '../data/landmarks.js';

export class EndScene extends Phaser.Scene {
  constructor() {
    super('EndScene');
  }

  init(data) {
    this.result = data;
  }

  create() {
    stopBGM();
    const { width, height } = this.scale;
    const win = this.result.win;

    if (win) {
      sfxWin();
    } else {
      sfxGameOver();
    }

    // Tło
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a111c);

    // Nagłówek
    const titleText = win ? '★ ZWYCIĘSTWO! ★' : 'KONIEC CZASU';
    const subText = win
      ? 'Gratulacje! Poznałeś 12 najważniejszych skarbów Gliwic!'
      : 'Nie poddawaj się! Spróbuj ponownie zwiedzić miasto.';
    const titleColor = win ? '#ffd700' : '#e53935';

    this.add.text(width / 2, 34, titleText, {
      fontSize: '34px', color: titleColor, fontStyle: 'bold', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5);

    this.add.text(width / 2, 64, subText, {
      fontSize: '14px', color: '#e0e0e0'
    }).setOrigin(0.5);

    // Wynik
    const totalTime = 210;
    const elapsed = totalTime - Math.max(0, this.result.timeLeft || 0);
    const badgesCollected = this.result.badges || 0;

    let isNewRecord = false;
    if (win) {
      isNewRecord = setBestTime(elapsed);
    }

    // Tytuł honorowy
    let rankTitle = 'Odkrywca Gliwic';
    if (win) {
      if (elapsed <= 100) rankTitle = '🥇 Legenda Okrzei i Honorowy Rajca Gliwic!';
      else if (elapsed <= 150) rankTitle = '🥈 Znawca Zabytków i Przyjaciel Miasta!';
      else rankTitle = '🥉 Odkrywca Gliwic!';
    }

    // Certyfikat i statystyki
    this.add.rectangle(width / 2, 108, 620, 56, 0x142033)
      .setStrokeStyle(2, win ? 0xffd700 : 0x556688);

    const statString = win
      ? `Czas: ${elapsed}s  •  Odznaki: ${badgesCollected}/12  •  Pozostałe życia: ${this.result.lives ?? 1}/3`
      : `Czas wyprawy: ${elapsed}s  •  Zdobyte odznaki: ${badgesCollected}/12`;

    this.add.text(width / 2, 98, statString, {
      fontSize: '14px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);

    const subStatString = win
      ? (isNewRecord ? '★ NOWY REKORD CZASU! ★ — ' + rankTitle : rankTitle)
      : 'Spróbuj jeszcze raz omijać auta i odpowiedzieć na pytania!';

    this.add.text(width / 2, 120, subStatString, {
      fontSize: '12px', color: win ? '#4caf50' : '#ff9800', fontStyle: 'bold'
    }).setOrigin(0.5);

    // ==================== GALERIA 12 MIEJSC GLIWIC ====================
    this.add.text(width / 2, 152, 'Twoje gliwickie trofea i odkryte miejsca (12 miejsc):', {
      fontSize: '13px', color: '#ffd700', fontStyle: 'bold'
    }).setOrigin(0.5);

    const startX = width / 2 - 345;
    const startY = 186;
    landmarks.forEach((lm, idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const px = startX + col * 230;
      const py = startY + row * 76;

      this.add.rectangle(px, py, 215, 66, 0x142033).setStrokeStyle(1, 0x2e4466);

      // Miniaturka landmarku
      const tex = this.textures.exists(lm.textureKey) ? lm.textureKey : 'landmark';
      this.add.image(px - 72, py, tex).setScale(0.48);

      // Nazwa
      this.add.text(px - 40, py - 16, lm.name, {
        fontSize: '11px', color: '#ffffff', fontStyle: 'bold', wordWrap: { width: 140 }
      });

      // Status
      const isDiscovered = idx < badgesCollected;
      const statusTxt = isDiscovered ? '✓ Zdobyto odznakę' : '✗ Nieodkryte';
      const statusColor = isDiscovered ? '#4caf50' : '#78909c';
      this.add.text(px - 40, py + 12, statusTxt, {
        fontSize: '10px', color: statusColor, fontStyle: 'bold'
      });
    });

    // ==================== PRZYCISKI ====================
    const btnRestart = this.add.rectangle(width / 2 - 130, 470, 230, 46, 0x4caf50)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true });
    this.add.text(width / 2 - 130, 470, 'ZAGRAJ PONOWNIE', {
      fontSize: '15px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);

    btnRestart.on('pointerover', () => btnRestart.fillColor = 0x66bb6a);
    btnRestart.on('pointerout', () => btnRestart.fillColor = 0x4caf50);
    btnRestart.on('pointerdown', () => {
      sfxClick();
      this.scene.start('GameScene');
    });

    const btnMenu = this.add.rectangle(width / 2 + 130, 470, 230, 46, 0x223555)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true });
    this.add.text(width / 2 + 130, 470, 'MENU GŁÓWNE', {
      fontSize: '15px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);

    btnMenu.on('pointerover', () => btnMenu.fillColor = 0x334a75);
    btnMenu.on('pointerout', () => btnMenu.fillColor = 0x223555);
    btnMenu.on('pointerdown', () => {
      sfxClick();
      this.scene.start('MenuScene');
    });
  }
}