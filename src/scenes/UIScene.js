import Phaser from 'phaser';
import { sfxClick, sfxSuccess, sfxWrong, sfxCoin } from '../utils/audio.js';
import { getMuted, setMuted } from '../utils/storage.js';

export class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  init(data) {
    this.gameScene = data.gameScene;
  }

  create() {
    const { width, height } = this.scale;

    // ==================== HUD GÓRNY ====================
    // Tło lewego paska HUD (czas i życia)
    this.add.rectangle(16, 16, 230, 46, 0x101626, 0.88)
      .setOrigin(0).setStrokeStyle(2, 0x334466);

    // Ikona zegara i tekst czasu
    if (this.textures.exists('icon-clock')) {
      this.add.image(34, 39, 'icon-clock').setScale(1.0);
    }
    this.timerText = this.add.text(52, 22, 'Czas: 3:00', {
      fontSize: '14px', color: '#ffffff', fontStyle: 'bold'
    });

    // Ikony serduszek (życia)
    this.heartIcons = [];
    for (let i = 0; i < 3; i++) {
      const h = this.add.image(52 + i * 18, 48, 'icon-heart').setScale(0.9);
      this.heartIcons.push(h);
    }

    // Tło prawego paska HUD (odznaki i kompas) - mniejsze żeby nie nachodziło
    this.add.rectangle(width - 16, 16, 280, 46, 0x101626, 0.9)
      .setOrigin(1, 0).setStrokeStyle(2, 0x334466);

    // Ikona odznaki i tekst
    if (this.textures.exists('badge')) {
      this.add.image(width - 266, 39, 'badge').setScale(0.9);
    }
    this.badgesText = this.add.text(width - 248, 22, 'Odznaki: 0/12', {
      fontSize: '13px', color: '#ffd700', fontStyle: 'bold'
    });

    // Kompas GPS / Wskaźnik najbliższego celu
    this.compassText = this.add.text(width - 248, 44, 'Cel: Szukanie...', {
      fontSize: '10px', color: '#81d4fa'
    });

    // Przycisk wyciszenia (Mute) - wewnątrz prawego panelu
    const muteLabel = () => getMuted() ? '🔇 [M]' : '🔊 [M]';
    this.muteBtn = this.add.text(width - 40, 39, muteLabel(), {
      fontSize: '12px', color: '#cccccc'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.muteBtn.on('pointerdown', () => {
      setMuted(!getMuted());
      this.muteBtn.setText(muteLabel());
      sfxClick();
    });

    this.input.keyboard.on('keydown-M', () => {
      setMuted(!getMuted());
      this.muteBtn.setText(muteLabel());
      sfxClick();
    });

    // ── [?] INSTRUKCJA button ──────────────────────────────────────────────
    const instrBtn = this.add.rectangle(width / 2 - 90, 22, 110, 28, 0x1a237e, 0.92)
      .setStrokeStyle(2, 0x7986cb)
      .setInteractive({ useHandCursor: true })
      .setDepth(20);
    this.add.text(width / 2 - 90, 22, '[H] INSTRUKCJA', {
      fontSize: '11px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(21);
    instrBtn.on('pointerover', () => instrBtn.fillColor = 0x283593);
    instrBtn.on('pointerout', () => instrBtn.fillColor = 0x1a237e);
    instrBtn.on('pointerdown', () => { sfxClick(); this.showTutorial(); });

    this.input.keyboard.on('keydown-H', () => {
      if (!this.tutorialContainer.visible) this.showTutorial();
      else this.closeTutorial();
    });

    // ── [ZAKOŃCZ WYPRAWĘ] button ───────────────────────────────────────────
    const endBtn = this.add.rectangle(width / 2 + 40, 22, 120, 28, 0x7b1fa2, 0.92)
      .setStrokeStyle(2, 0xce93d8)
      .setInteractive({ useHandCursor: true })
      .setDepth(20);
    this.add.text(width / 2 + 40, 22, '🏁 ZAKOŃCZ', {
      fontSize: '10px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(21);
    endBtn.on('pointerover', () => endBtn.fillColor = 0x8e24aa);
    endBtn.on('pointerout', () => endBtn.fillColor = 0x7b1fa2);
    endBtn.on('pointerdown', () => {
      sfxClick();
      if (this.gameScene && this.gameScene.endGame) this.gameScene.endGame(this.gameScene.badges >= this.gameScene.totalBadges);
    });


    // ==================== TUTORIAL MODAL (initialized early so H key works) ====================
    this.tutorialContainer = this.add.container(width / 2, height / 2).setVisible(false).setDepth(200);
    this._buildTutorialModal(width, height);

    // ==================== NPC DIALOG ====================
    this.npcDialogContainer = this.add.container(width / 2, height / 2).setVisible(false).setDepth(190);
    this._buildNPCDialog(width, height);

    // ==================== MINIMAPA GPS (RADAR GLIWIC) ====================
    this.createMinimap(width, height);


    // ==================== QUIZ OVERLAY ====================
    this.quizContainer = this.add.container(width / 2, height / 2).setVisible(false).setDepth(100);

    const quizBackdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.72)
      .setInteractive();
    const quizPanel = this.add.rectangle(0, 0, 700, 400, 0x162238, 0.98)
      .setStrokeStyle(3, 0xffd700);

    this.quizHeader = this.add.text(0, -155, '', {
      fontSize: '22px', color: '#ffd700', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.quizQuestion = this.add.text(0, -100, '', {
      fontSize: '16px', color: '#ffffff', wordWrap: { width: 640 }, align: 'center', lineSpacing: 4
    }).setOrigin(0.5);

    this.quizContainer.add([quizBackdrop, quizPanel, this.quizHeader, this.quizQuestion]);

    // 4 przyciski odpowiedzi
    this.quizButtons = [];
    for (let i = 0; i < 4; i++) {
      const y = -36 + i * 56;
      const btn = this.add.rectangle(0, y, 640, 46, 0x223555)
        .setStrokeStyle(1, 0x446699)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(0, y, '', {
        fontSize: '15px', color: '#ffffff'
      }).setOrigin(0.5);

      btn.on('pointerover', () => {
        btn.fillColor = 0x335080;
        btn.strokeColor = 0xffd700;
      });
      btn.on('pointerout', () => {
        btn.fillColor = 0x223555;
        btn.strokeColor = 0x446699;
      });
      const idx = i;
      btn.on('pointerdown', () => this.handleAnswer(idx));

      this.quizContainer.add([btn, label]);
      this.quizButtons.push({ btn, label });
    }

    // Klawiatura 1-4
    this.input.keyboard.on('keydown', (event) => {
      if (!this.quizContainer.visible) return;
      if (['1', '2', '3', '4'].includes(event.key)) {
        const idx = parseInt(event.key, 10) - 1;
        this.handleAnswer(idx);
      }
    });

    // ==================== OKNO FAKTU EDUKACYJNEGO ====================
    this.factContainer = this.add.container(width / 2, height / 2).setVisible(false).setDepth(110);
    const factBackdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setInteractive();
    const factPanel = this.add.rectangle(0, 0, 640, 340, 0x142033, 0.98).setStrokeStyle(3, 0x4caf50);

    this.factBadgeIcon = this.add.image(0, -100, 'badge').setScale(2.5);
    this.factTitle = this.add.text(0, -50, 'ODZNAKA ZDOBYTA!', {
      fontSize: '22px', color: '#ffd700', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.factText = this.add.text(0, 20, '', {
      fontSize: '15px', color: '#ffffff', wordWrap: { width: 560 }, align: 'center', lineSpacing: 6
    }).setOrigin(0.5);

    const factBtn = this.add.rectangle(0, 115, 240, 44, 0x4caf50)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true });
    const factBtnLabel = this.add.text(0, 115, 'Kontynuuj [Spacja / Enter]', {
      fontSize: '15px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);

    factBtn.on('pointerover', () => factBtn.fillColor = 0x66bb6a);
    factBtn.on('pointerout', () => factBtn.fillColor = 0x4caf50);
    factBtn.on('pointerdown', () => this.closeFact());

    this.factContainer.add([
      factBackdrop, factPanel, this.factBadgeIcon, this.factTitle, this.factText, factBtn, factBtnLabel
    ]);

    this.input.keyboard.on('keydown-SPACE', () => {
      if (this.factContainer.visible) this.closeFact();
    });
    this.input.keyboard.on('keydown-ENTER', () => {
      if (this.factContainer.visible) this.closeFact();
    });

    // ==================== TOAST KARY (-10s) I EASTER EGGÓW ====================
    this.toastContainer = this.add.container(width / 2, 85).setVisible(false).setDepth(95);
    this.toastBg = this.add.rectangle(0, 0, 420, 36, 0xe53935, 0.95).setStrokeStyle(2, 0xffffff);
    this.toastText = this.add.text(0, 0, '', {
      fontSize: '15px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.toastContainer.add([this.toastBg, this.toastText]);

    // ==================== KONTROLE DOTYKOWE (MOBILE) ====================
    this.createTouchControls();
  }

  createMinimap(width, height) {
    // Rozmiar minimapy: 160x90 pikseli (skala 1:12 dla świata 1920x1080)
    const mw = 160;
    const mh = 90;
    const mx = width - mw - 16;
    const my = height - mh - 16;

    this.minimapContainer = this.add.container(mx, my).setDepth(40);

    // Tło minimapy
    const bg = this.add.rectangle(0, 0, mw, mh, 0x142033, 0.85)
      .setOrigin(0).setStrokeStyle(1, 0x81d4fa);

    const title = this.add.text(mw / 2, -10, 'GPS GLIWICE [TAB]', {
      fontSize: '10px', color: '#81d4fa', fontStyle: 'bold'
    }).setOrigin(0.5);

    // Grafika rzeki i dróg na minimapie
    this.miniGraphics = this.add.graphics();
    this.drawStaticMinimap(this.miniGraphics, mw, mh);

    // Dynamiczna warstwa dla gracza i landmarków
    this.miniDynamic = this.add.graphics();

    this.minimapContainer.add([bg, title, this.miniGraphics, this.miniDynamic]);

    // Przełączanie widoczności minimapy klawiszem TAB
    this.input.keyboard.on('keydown-TAB', (e) => {
      e.preventDefault();
      this.minimapContainer.setVisible(!this.minimapContainer.visible);
    });
  }

  drawStaticMinimap(g, mw, mh) {
    g.clear();
    // Skala 1:12
    // Rzeka Kłodnica (y=270..318 -> my=22..26)
    g.fillStyle(0x29b6f6, 0.85);
    g.fillRect(0, 22, mw, 4);

    // Brukowany Rynek w centrum
    g.fillStyle(0xffd54f, 0.45);
    g.fillRect(50, 36, 24, 18);

    // Drogi poziome: [80, 350, 680, 980]
    g.fillStyle(0x78909c, 0.7);
    [80, 350, 680, 980].forEach((ry) => {
      g.fillRect(0, Math.round(ry / 12) - 1, mw, 3);
    });

    // Drogi pionowe: [120, 400, 740, 1140, 1480]
    [120, 400, 740, 1140, 1480].forEach((rx) => {
      g.fillRect(Math.round(rx / 12) - 1, 0, 3, mh);
    });
  }

  updateMinimap(gs) {
    if (!gs || !this.miniDynamic || !this.minimapContainer.visible) return;
    this.miniDynamic.clear();

    const scaleX = 160 / 1920;
    const scaleY = 90 / 1080;

    // Rysuj landmarki na minimapie
    if (gs.landmarks) {
      gs.landmarks.forEach((lm) => {
        const lx = lm.x * scaleX;
        const ly = lm.y * scaleY;
        if (lm.visited) {
          // Złota gwiazdka / kropka (odkryte)
          this.miniDynamic.fillStyle(0xffd700, 1);
          this.miniDynamic.fillCircle(lx, ly, 3);
        } else {
          // Czerwona kropka (do odkrycia)
          this.miniDynamic.fillStyle(0xff1744, 1);
          this.miniDynamic.fillCircle(lx, ly, 3);
        }
      });
    }

    // Rysuj gracza na minimapie (zielona kropka ze wskaźnikiem)
    if (gs.player) {
      const px = gs.player.x * scaleX;
      const py = gs.player.y * scaleY;
      this.miniDynamic.fillStyle(0x00e676, 1);
      this.miniDynamic.fillCircle(px, py, 4);
      this.miniDynamic.lineStyle(1, 0xffffff, 1);
      this.miniDynamic.strokeCircle(px, py, 4);
    }
  }

  updateHUD(gs) {
    if (!gs) return;
    this.badgesText.setText(`Odznaki: ${gs.badges}/${gs.totalBadges}`);
    this.updateTimer(gs.timeLeft);
    this.updateLives(gs.lives);
    this.updateCompass(gs);
    this.updateMinimap(gs);
  }

  updateTimer(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const formatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    this.timerText.setText(`Czas: ${formatted}`);
    if (seconds <= 20) {
      this.timerText.setColor('#ff5252');
    } else {
      this.timerText.setColor('#ffffff');
    }
  }

  updateLives(n) {
    this.heartIcons.forEach((icon, i) => {
      icon.setVisible(i < n);
    });
  }

  updateCompass(gs) {
    if (!gs || !gs.player || !gs.landmarks) return;
    const unvisited = gs.landmarks.filter((l) => !l.visited);
    if (unvisited.length === 0) {
      this.compassText.setText('Wszystkie odznaki zdobyte! ★');
      this.compassText.setColor('#4caf50');
      return;
    }

    let closest = null;
    let minDist = Infinity;
    unvisited.forEach((lm) => {
      const dist = Phaser.Math.Distance.Between(gs.player.x, gs.player.y, lm.x, lm.y);
      if (dist < minDist) {
        minDist = dist;
        closest = lm;
      }
    });

    if (closest) {
      const angle = Phaser.Math.Angle.Between(gs.player.x, gs.player.y, closest.x, closest.y);
      const deg = Phaser.Math.RadToDeg(angle);
      let arrow = '➔';
      if (deg >= -22.5 && deg < 22.5) arrow = '➔';
      else if (deg >= 22.5 && deg < 67.5) arrow = '➘';
      else if (deg >= 67.5 && deg < 112.5) arrow = '⬇';
      else if (deg >= 112.5 && deg < 157.5) arrow = '↙';
      else if (deg >= -67.5 && deg < -22.5) arrow = '➚';
      else if (deg >= -112.5 && deg < -67.5) arrow = '⬆';
      else if (deg >= -157.5 && deg < -112.5) arrow = '↖';
      else arrow = '⬅';

      const distM = Math.round(minDist / 2);
      this.compassText.setText(`Cel: ${closest.data.name} (${distM}m) ${arrow}`);
    }
  }

  showQuiz(data, cb) {
    this.currentQuizData = data;
    this.quizCallback = cb;
    this.quizCorrect = data.answer;
    this.quizHeader.setText(`QUIZ: ${data.name.toUpperCase()}`);
    this.quizQuestion.setText(data.question);

    data.options.forEach((opt, i) => {
      this.quizButtons[i].label.setText(`[${i + 1}]  ${opt}`);
      this.quizButtons[i].btn.fillColor = 0x223555;
    });

    this.quizContainer.setVisible(true);
  }

  handleAnswer(idx) {
    if (!this.quizContainer.visible) return;
    const correct = (idx === this.quizCorrect);
    this.quizContainer.setVisible(false);

    if (correct) {
      sfxSuccess();
      this.showFactModal(this.currentQuizData, () => {
        if (this.quizCallback) {
          const cb = this.quizCallback;
          this.quizCallback = null;
          cb(true);
        }
      });
    } else {
      sfxWrong();
      this.showToast('Błędna odpowiedź! -10 sekund kary!', 0xe53935);
      if (this.quizCallback) {
        const cb = this.quizCallback;
        this.quizCallback = null;
        cb(false);
      }
    }
  }

  showFactModal(data, onClose) {
    this.factCloseCallback = onClose;
    this.factTitle.setText(`ODZNAKA: ${data.name.toUpperCase()}`);
    this.factText.setText(`Brawo! Poprawna odpowiedź!\n\n💡 Ciekawostka o Gliwicach:\n${data.fact}`);
    this.factContainer.setVisible(true);

    this.tweens.add({
      targets: this.factBadgeIcon,
      scaleX: 2.8,
      scaleY: 2.8,
      duration: 300,
      yoyo: true,
      ease: 'Back.easeOut'
    });
  }

  closeFact() {
    this.factContainer.setVisible(false);
    if (this.factCloseCallback) {
      const cb = this.factCloseCallback;
      this.factCloseCallback = null;
      cb();
    }
  }

  showToast(msg, bgColor = 0xe53935) {
    this.toastText.setText(msg);
    this.toastBg.fillColor = bgColor;
    this.toastContainer.setVisible(true);
    this.toastContainer.setAlpha(1);
    this.cameras.main.shake(200, 0.005);
    this.tweens.add({
      targets: this.toastContainer,
      alpha: 0,
      delay: 1600,
      duration: 400,
      onComplete: () => {
        this.toastContainer.setVisible(false);
      }
    });
  }

  showEasterEgg(msg) {
    sfxCoin();
    this.showToast(msg, 0x4caf50);
  }

  flashHit() {
    this.cameras.main.shake(250, 0.007);
    this.cameras.main.flash(150, 229, 57, 53);
  }

  addBadge(n) {
    if (!this.gameScene) return;
    this.badgesText.setText(`Odznaki: ${n}/${this.gameScene.totalBadges}`);
    this.cameras.main.flash(200, 255, 215, 0);
  }

  createTouchControls() {
    if (!this.gameScene) return;
    const t = (this.gameScene.touch = this.gameScene.touch || { up: false, down: false, left: false, right: false });

    const makeBtn = (label, x, y, onDown, onUp) => {
      const r = this.add.rectangle(x, y, 54, 54, 0x101626, 0.6)
        .setStrokeStyle(2, 0xffffff)
        .setInteractive({ useHandCursor: true });
      const txt = this.add.text(x, y, label, {
        fontSize: '22px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5);

      r.on('pointerdown', () => onDown());
      r.on('pointerup', () => onUp());
      r.on('pointerout', () => onUp());
      r.setDepth(50);
      txt.setDepth(51);
      return { r, txt };
    };

    const b = 32;
    const baseY = this.scale.height - 84;
    makeBtn('◀', b + 28, baseY, () => t.left = true, () => t.left = false);
    makeBtn('▲', b + 84, baseY - 56, () => t.up = true, () => t.up = false);
    makeBtn('▼', b + 84, baseY + 56, () => t.down = true, () => t.down = false);
    makeBtn('▶', b + 140, baseY, () => t.right = true, () => t.right = false);

    // Przycisk [E] na telefonie (nie koliduje z minimapą)
    const actionBtn = this.add.rectangle(this.scale.width - 60, baseY - 90, 64, 64, 0x4caf50, 0.85)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true });
    const actionTxt = this.add.text(this.scale.width - 60, baseY - 90, 'E\nODKRYJ', {
      fontSize: '12px', color: '#ffffff', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5);

    actionBtn.on('pointerdown', () => {
      const gs = this.gameScene;
      const nearLm = gs.landmarks.find(
        (lm) => !lm.visited && Phaser.Math.Distance.Between(gs.player.x, gs.player.y, lm.x, lm.y) < 110
      );
      if (nearLm) { gs.tryInteract(nearLm); return; }
      // Fall back to NPC dialog on touch
      const nearNpc = (gs.npcs || []).find(
        (npc) => Phaser.Math.Distance.Between(gs.player.x, gs.player.y, npc.x, npc.y) < 85
      );
      if (nearNpc && !gs.npcDialogOpen && !gs.quizOpen) gs.openNPCDialog(nearNpc);
    });
    actionBtn.setDepth(50);
    actionTxt.setDepth(51);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TUTORIAL MODAL
  // ═══════════════════════════════════════════════════════════════════════════
  _buildTutorialModal(width, height) {
    const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.8).setInteractive();
    const panel = this.add.rectangle(0, 10, 720, 430, 0x0d1b2a, 0.98).setStrokeStyle(3, 0x1565c0);

    const title = this.add.text(0, -190, '📖 JAK GRAĆ – ODKRYJ GLIWICE', {
      fontSize: '22px', color: '#ffd700', fontStyle: 'bold'
    }).setOrigin(0.5);

    const lines = [
      '🎮 STEROWANIE',
      '  Strzałki lub WASD – poruszanie postacią',
      '  [E] – zbliż się do miejsca / NPC i naciśnij by odkryć / porozmawiać',
      '  [1-4] – wybór odpowiedzi w quizie',
      '  [ESC] – pauza  •  [M] – wycisz dźwięk',
      '  [TAB] – pokaż/ukryj minimapę GPS',
      '',
      '🏆 CEL GRY',
      '  Odkryj wszystkie 12 zabytków Gliwic w czasie 3:30 minuty!',
      '  Każdy zabytek wymaga poprawnej odpowiedzi w quizie.',
      '  Błędna odpowiedź = -10 sekund kary!',
      '',
      '🚗 ZAGROŻENIA',
      '  Uważaj na auta, autobusy PKM i tramwaje – uderzenie to -1 życie.',
      '  Masz 3 życia. Utrata wszystkich = koniec gry!',
      '',
      '🪙 EASTER EGGS',
      '  Kliknij [E] przy fontannie Diabełków na Rynku – bonus +10s!',
      '  Rozmawiaj z NPC – zdobywaj ciekawostki o mieście!',
    ].join('\n');

    const text = this.add.text(-330, -160, lines, {
      fontSize: '13px', color: '#e0e0e0', lineSpacing: 5,
      wordWrap: { width: 660 }
    });

    const closeBtn = this.add.rectangle(0, 185, 200, 40, 0x4caf50)
      .setStrokeStyle(2, 0xffffff).setInteractive({ useHandCursor: true });
    const closeTxt = this.add.text(0, 185, 'Zamknij [H / Esc]', {
      fontSize: '14px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);
    closeBtn.on('pointerover', () => closeBtn.fillColor = 0x66bb6a);
    closeBtn.on('pointerout', () => closeBtn.fillColor = 0x4caf50);
    closeBtn.on('pointerdown', () => this.closeTutorial());

    this.tutorialContainer.add([backdrop, panel, title, text, closeBtn, closeTxt]);

    this.input.keyboard.on('keydown-ESC', () => {
      if (this.tutorialContainer.visible) this.closeTutorial();
    });
  }

  showTutorial() {
    if (this.gameScene) this.gameScene.registry.set('paused', true);
    this.tutorialContainer.setVisible(true);
  }

  closeTutorial() {
    this.tutorialContainer.setVisible(false);
    if (this.gameScene && !this.gameScene.quizOpen && !this.gameScene.npcDialogOpen)
      this.gameScene.registry.set('paused', false);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NPC DIALOG
  // ═══════════════════════════════════════════════════════════════════════════
  _buildNPCDialog(width, height) {
    const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.55).setInteractive();
    const panel = this.add.rectangle(0, 120, 640, 200, 0x0d2137, 0.97).setStrokeStyle(2, 0x4db6ac);

    const avatar = this.add.rectangle(-270, 120, 50, 50, 0x263238).setStrokeStyle(2, 0x4db6ac);
    this.npcAvatarIcon = this.add.text(-270, 120, '🧑', { fontSize: '24px' }).setOrigin(0.5);

    this.npcNameText = this.add.text(-240, 90, 'NPC', {
      fontSize: '14px', color: '#4db6ac', fontStyle: 'bold'
    });
    this.npcDialogText = this.add.text(-240, 112, '', {
      fontSize: '13px', color: '#e0e0e0', wordWrap: { width: 520 }, lineSpacing: 4
    });

    const closeBtn = this.add.rectangle(180, 190, 140, 36, 0x00796b)
      .setStrokeStyle(2, 0xffffff).setInteractive({ useHandCursor: true });
    const closeTxt = this.add.text(180, 190, 'OK [E / Spacja]', {
      fontSize: '13px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);
    closeBtn.on('pointerover', () => closeBtn.fillColor = 0x00897b);
    closeBtn.on('pointerout', () => closeBtn.fillColor = 0x00796b);
    closeBtn.on('pointerdown', () => this.closeNPCDialog());

    this.npcDialogContainer.add([backdrop, panel, avatar, this.npcAvatarIcon,
      this.npcNameText, this.npcDialogText, closeBtn, closeTxt]);

    this.input.keyboard.on('keydown-SPACE', () => {
      if (this.npcDialogContainer.visible) this.closeNPCDialog();
    });
    this.input.keyboard.on('keydown-E', () => {
      if (this.npcDialogContainer.visible) this.closeNPCDialog();
    });
  }

  showNPCDialog(name, text, onClose) {
    this.npcDialogCloseCallback = onClose;
    this.npcNameText.setText(name);
    this.npcDialogText.setText(text);
    this.npcDialogContainer.setVisible(true);
  }

  closeNPCDialog() {
    this.npcDialogContainer.setVisible(false);
    if (this.npcDialogCloseCallback) {
      const cb = this.npcDialogCloseCallback;
      this.npcDialogCloseCallback = null;
      cb();
    }
  }
}